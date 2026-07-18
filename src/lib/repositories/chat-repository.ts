import { Conversation, ConversationBranch, Message, MessageRole, Prisma } from "@prisma/client";
import { prisma } from "../prisma";

export class DatabaseError extends Error { constructor(message: string) { super(message); this.name = "DatabaseError"; } }
export class UnauthorizedError extends Error { constructor(message: string) { super(message); this.name = "UnauthorizedError"; } }
export class NotFoundError extends Error { constructor(message: string) { super(message); this.name = "NotFoundError"; } }
export class ConflictError extends Error { constructor(message: string) { super(message); this.name = "ConflictError"; } }

export interface BranchMetadata extends ConversationBranch {
  siblingCount: number;
  siblingIndex: number;
}

export interface DeleteMessageResult {
  conversationId: string;
  deletedMessageIds: string[];
  deletedBranchIds: string[];
  conversationDeleted: boolean;
  conversationEmpty: boolean;
  nextActiveBranchId: string | null;
}

async function validateOwnership(id: string, userId: string, client: Prisma.TransactionClient | typeof prisma = prisma): Promise<Conversation> {
  const conversation = await client.conversation.findUnique({ where: { id } });
  if (!conversation) throw new NotFoundError("Conversation not found.");
  if (conversation.userId !== userId) throw new UnauthorizedError("You are not authorized to perform this action.");
  return conversation;
}

async function requireBranch(conversationId: string, branchId: string, client: Prisma.TransactionClient | typeof prisma = prisma) {
  const branch = await client.conversationBranch.findFirst({ where: { id: branchId, conversationId } });
  if (!branch) throw new NotFoundError("Branch not found.");
  return branch;
}

async function ensureRootBranch(conversationId: string, client: Prisma.TransactionClient | typeof prisma = prisma) {
  const conversation = await client.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation) throw new NotFoundError("Conversation not found.");
  if (conversation.activeBranchId) {
    const active = await client.conversationBranch.findFirst({ where: { id: conversation.activeBranchId, conversationId } });
    if (active) return active;
  }

  // Existing conversations can have a missing or stale active pointer while
  // being migrated. Reuse their root branch before creating anything new.
  const root = await client.conversationBranch.findFirst({
    where: { conversationId, parentBranchId: null },
    orderBy: { createdAt: "asc" },
  }) ?? await client.conversationBranch.create({ data: { conversationId, siblingOrder: 0 } });
  await client.conversation.update({ where: { id: conversationId }, data: { activeBranchId: root.id } });
  return root;
}

async function getBranchMetadata(conversationId: string, branchId: string, client: Prisma.TransactionClient | typeof prisma = prisma): Promise<BranchMetadata> {
  const branch = await requireBranch(conversationId, branchId, client);
  if (!branch.forkMessageId) return { ...branch, siblingCount: 1, siblingIndex: 0 };
  const siblings = await client.conversationBranch.findMany({
    where: { conversationId, forkMessageId: branch.forkMessageId },
    orderBy: [{ siblingOrder: "asc" }, { createdAt: "asc" }],
  });
  const siblingIndex = siblings.findIndex((item) => item.id === branch.id);
  return { ...branch, siblingCount: siblings.length, siblingIndex: Math.max(0, siblingIndex) };
}

export async function createConversation(userId: string, title?: string): Promise<Conversation> {
  try {
    return await prisma.$transaction(async (tx) => {
      const conversation = await tx.conversation.create({ data: { userId, title: title || "New Conversation" } });
      const root = await tx.conversationBranch.create({ data: { conversationId: conversation.id, siblingOrder: 0 } });
      return tx.conversation.update({ where: { id: conversation.id }, data: { activeBranchId: root.id } });
    });
  } catch (error) {
    console.error("Error in createConversation:", error);
    throw new DatabaseError("Failed to create a new conversation.");
  }
}

export async function getConversation(id: string, userId: string) { return validateOwnership(id, userId); }

export async function getUserConversations(userId: string) {
  return prisma.conversation.findMany({ where: { userId }, orderBy: { updatedAt: "desc" } });
}

export async function updateConversationTitle(id: string, userId: string, title: string) {
  await validateOwnership(id, userId);
  return prisma.conversation.update({ where: { id }, data: { title: title.trim() } });
}

export async function deleteConversation(id: string, userId: string) {
  await validateOwnership(id, userId);
  return prisma.conversation.delete({ where: { id } });
}

export async function getConversationBranches(conversationId: string, userId: string) {
  await validateOwnership(conversationId, userId);
  const root = await ensureRootBranch(conversationId);
  const branches = await prisma.conversationBranch.findMany({ where: { conversationId }, orderBy: [{ forkMessageId: "asc" }, { siblingOrder: "asc" }, { createdAt: "asc" }] });
  const metadata = await Promise.all(branches.map((branch) => getBranchMetadata(conversationId, branch.id)));
  return { activeBranchId: root.id, branches: metadata };
}

export async function getBranchMessages(conversationId: string, userId: string, requestedBranchId?: string): Promise<{ branch: BranchMetadata; messages: Message[] }> {
  await validateOwnership(conversationId, userId);
  const active = await ensureRootBranch(conversationId);
  const branchId = requestedBranchId || active.id;
  const branch = await getBranchMetadata(conversationId, branchId);
  if (!branch.headMessageId) return { branch, messages: [] };

  // Recursive lineage makes shared ancestors visible without copying message rows.
  const rows = await prisma.$queryRaw<Message[]>(Prisma.sql`
    WITH RECURSIVE lineage AS (
      SELECT m.*, 0 AS depth, ARRAY[m.id] AS visited
      FROM "messages" m WHERE m.id = ${branch.headMessageId}
      UNION ALL
      SELECT parent.*, lineage.depth + 1, lineage.visited || parent.id
      FROM "messages" parent
      JOIN lineage ON lineage."parent_message_id" = parent.id
      WHERE NOT parent.id = ANY(lineage.visited) AND lineage.depth < 10000
    )
    SELECT "id", "conversation_id" AS "conversationId", "branch_id" AS "branchId", "parent_message_id" AS "parentMessageId", role, content, "created_at" AS "createdAt", "updated_at" AS "updatedAt"
    FROM lineage ORDER BY depth DESC
  `);
  return { branch, messages: rows };
}

export async function createBranch(conversationId: string, userId: string, forkMessageId: string): Promise<BranchMetadata> {
  return prisma.$transaction(async (tx) => {
    await validateOwnership(conversationId, userId, tx);
    const active = await ensureRootBranch(conversationId, tx);
    const source = await requireBranch(conversationId, active.id, tx);
    const path = await getBranchMessages(conversationId, userId, source.id);
    if (!path.messages.some((message) => message.id === forkMessageId)) throw new ConflictError("The selected message is not visible in the active branch.");
    const forkMessage = await tx.message.findFirst({ where: { id: forkMessageId, conversationId } });
    if (!forkMessage) throw new NotFoundError("Message not found.");
    await tx.$queryRaw(Prisma.sql`SELECT id FROM "messages" WHERE id = ${forkMessageId} FOR UPDATE`);
    const latestSibling = await tx.conversationBranch.aggregate({ where: { conversationId, forkMessageId }, _max: { siblingOrder: true } });
    const branch = await tx.conversationBranch.create({
      data: { conversationId, parentBranchId: source.id, forkMessageId, headMessageId: forkMessageId, siblingOrder: (latestSibling._max.siblingOrder ?? -1) + 1 },
    });
    await tx.conversation.update({ where: { id: conversationId }, data: { activeBranchId: branch.id } });
    return getBranchMetadata(conversationId, branch.id, tx);
  });
}

export async function setActiveBranch(conversationId: string, userId: string, branchId: string) {
  await validateOwnership(conversationId, userId);
  await requireBranch(conversationId, branchId);
  return prisma.conversation.update({ where: { id: conversationId }, data: { activeBranchId: branchId } });
}

export async function createMessage(conversationId: string, userId: string, role: MessageRole, content: string, branchId?: string, expectedHeadMessageId?: string): Promise<Message> {
  return prisma.$transaction(async (tx) => {
    const conversation = await validateOwnership(conversationId, userId, tx);
    const branch = await requireBranch(conversationId, branchId || (await ensureRootBranch(conversationId, tx)).id, tx);
    if (expectedHeadMessageId !== undefined && expectedHeadMessageId !== branch.headMessageId) throw new ConflictError("Branch state changed. Refresh and try again.");
    const message = await tx.message.create({ data: { conversationId, branchId: branch.id, parentMessageId: branch.headMessageId, role, content } });
    await tx.conversationBranch.update({ where: { id: branch.id }, data: { headMessageId: message.id } });
    await tx.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date(), activeBranchId: branch.id } });
    return message;
  });
}

export async function deleteBranch(conversationId: string, userId: string, branchId: string) {
  return prisma.$transaction(async (tx) => {
    const conversation = await validateOwnership(conversationId, userId, tx);
    const branch = await requireBranch(conversationId, branchId, tx);
    if (!branch.parentBranchId) throw new ConflictError("The root branch cannot be deleted.");
    const children = await tx.conversationBranch.count({ where: { parentBranchId: branch.id } });
    if (children > 0) throw new ConflictError("A branch with child branches cannot be deleted.");
    const siblings = await tx.conversationBranch.findMany({ where: { conversationId, forkMessageId: branch.forkMessageId }, orderBy: { siblingOrder: "asc" } });
    const replacement = siblings.find((item) => item.id !== branch.id) ?? await requireBranch(conversationId, branch.parentBranchId, tx);
    if (conversation.activeBranchId === branch.id) await tx.conversation.update({ where: { id: conversationId }, data: { activeBranchId: replacement.id } });
    const branchMessages = await tx.message.findMany({ where: { branchId: branch.id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
    for (const message of branchMessages) {
      await tx.message.delete({ where: { id: message.id } });
    }
    await tx.conversationBranch.delete({ where: { id: branch.id } });
    return { deletedBranchId: branch.id, activeBranchId: conversation.activeBranchId === branch.id ? replacement.id : conversation.activeBranchId };
  });
}

export async function deleteMessage(messageId: string, userId: string): Promise<DeleteMessageResult> {
  return prisma.$transaction(async (tx) => {
    const target = await tx.message.findUnique({ where: { id: messageId } });
    if (!target) throw new NotFoundError("Message not found.");
    const conversation = await validateOwnership(target.conversationId, userId, tx);

    // A branch is a continuation of the message lineage, so deleting a message
    // removes only its descendants and branches that depend on those descendants.
    // This leaves earlier history and unrelated sibling continuations intact.
    const descendants = await tx.$queryRaw<Array<{ id: string; parentMessageId: string | null; depth: number }>>(Prisma.sql`
      WITH RECURSIVE descendants AS (
        SELECT m.id, m.parent_message_id, 0 AS depth, ARRAY[m.id] AS visited
        FROM "messages" m
        WHERE m.id = ${messageId} AND m.conversation_id = ${conversation.id}
        UNION ALL
        SELECT child.id, child.parent_message_id, descendants.depth + 1, descendants.visited || child.id
        FROM "messages" child
        JOIN descendants ON child.parent_message_id = descendants.id
        WHERE child.conversation_id = ${conversation.id}
          AND NOT child.id = ANY(descendants.visited)
          AND descendants.depth < 10000
      )
      SELECT id, parent_message_id AS "parentMessageId", depth
      FROM descendants
    `);
    const deletedMessageIds = descendants.map((message) => message.id);
    const deletedMessageIdSet = new Set(deletedMessageIds);

    const allBranches = await tx.conversationBranch.findMany({ where: { conversationId: conversation.id } });
    const branchesToDelete = new Set(
      allBranches
        .filter((branch) => branch.parentBranchId !== null && branch.forkMessageId !== null && deletedMessageIdSet.has(branch.forkMessageId))
        .map((branch) => branch.id),
    );

    // A branch with retained messages before the deleted turn stays valid; only
    // a branch whose fork point was removed (and its descendants) is removed.
    let foundChild = true;
    while (foundChild) {
      foundChild = false;
      for (const branch of allBranches) {
        if (branch.parentBranchId && branchesToDelete.has(branch.parentBranchId) && !branchesToDelete.has(branch.id)) {
          branchesToDelete.add(branch.id);
          foundChild = true;
        }
      }
    }

    const deletedBranchIds = [...branchesToDelete];
    let nextActiveBranchId = conversation.activeBranchId;
    if (nextActiveBranchId && branchesToDelete.has(nextActiveBranchId)) {
      let replacement = allBranches.find((branch) => branch.id === nextActiveBranchId)?.parentBranchId ?? null;
      while (replacement && branchesToDelete.has(replacement)) {
        replacement = allBranches.find((branch) => branch.id === replacement)?.parentBranchId ?? null;
      }
      nextActiveBranchId = replacement ?? allBranches.find((branch) => !branch.parentBranchId)?.id ?? null;
    }

    const deletedMessageParents = new Map(descendants.map((message) => [message.id, message.parentMessageId]));
    const nearestRetainedHead = (messageId: string): string | null => {
      let currentId: string | null = messageId;
      while (currentId && deletedMessageIdSet.has(currentId)) {
        currentId = deletedMessageParents.get(currentId) ?? null;
      }
      return currentId;
    };

    // Keep surviving branches readable by moving any deleted head back to the
    // closest retained message in the same shared lineage.
    for (const branch of allBranches) {
      if (!branchesToDelete.has(branch.id) && branch.headMessageId && deletedMessageIdSet.has(branch.headMessageId)) {
        await tx.conversationBranch.update({
          where: { id: branch.id },
          data: { headMessageId: nearestRetainedHead(branch.headMessageId) },
        });
      }
    }

    if (conversation.activeBranchId !== nextActiveBranchId) {
      await tx.conversation.update({
        where: { id: conversation.id },
        data: { activeBranchId: nextActiveBranchId },
      });
    }

    // Remove branch-to-message references before deleting descendant messages.
    // These branches are deleted later, after their owned message rows are gone.
    for (const branchId of deletedBranchIds) {
      await tx.conversationBranch.update({
        where: { id: branchId },
        data: { forkMessageId: null, headMessageId: null },
      });
    }

    // Delete message descendants from leaves up, then delete branches from
    // leaves to root so hierarchy and message foreign keys remain valid.
    const deleteBranchDepth = (branchId: string): number => {
      let depth = 0;
      let current = allBranches.find((branch) => branch.id === branchId);
      while (current?.parentBranchId) {
        depth += 1;
        current = allBranches.find((branch) => branch.id === current?.parentBranchId);
      }
      return depth;
    };
    for (const message of [...descendants].sort((a, b) => b.depth - a.depth)) {
      await tx.message.delete({ where: { id: message.id } });
    }
    for (const branchId of deletedBranchIds.sort((a, b) => deleteBranchDepth(b) - deleteBranchDepth(a))) {
      await tx.conversationBranch.delete({ where: { id: branchId } });
    }

    const remainingMessageCount = await tx.message.count({ where: { conversationId: conversation.id } });
    if (remainingMessageCount === 0) {
      await tx.conversation.delete({ where: { id: conversation.id } });
      return {
        conversationId: conversation.id,
        deletedMessageIds,
        deletedBranchIds,
        conversationDeleted: true,
        conversationEmpty: true,
        nextActiveBranchId: null,
      };
    }

    return {
      conversationId: conversation.id,
      deletedMessageIds,
      deletedBranchIds,
      conversationDeleted: false,
      conversationEmpty: false,
      nextActiveBranchId,
    };
  });
}
