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

export async function deleteMessage(messageId: string, userId: string): Promise<Message> {
  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message) throw new NotFoundError("Message not found.");
  await validateOwnership(message.conversationId, userId);
  const referenced = await prisma.$transaction(async (tx) => {
    const childCount = await tx.message.count({ where: { parentMessageId: messageId } });
    const branchCount = await tx.conversationBranch.count({ where: { OR: [{ forkMessageId: messageId }, { headMessageId: messageId }] } });
    if (childCount || branchCount) throw new ConflictError("Messages used by a branch cannot be deleted.");
    return tx.message.delete({ where: { id: messageId } });
  });
  return referenced;
}
