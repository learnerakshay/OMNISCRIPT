import { MessageRole, Conversation, Message } from "@prisma/client";
import * as chatRepo from "../lib/repositories/chat-repository";
import { 
  createConversationSchema, 
  updateConversationSchema, 
  getConversationSchema, 
  deleteConversationSchema, 
  createMessageSchema, 
  getConversationMessagesSchema, 
  deleteMessageSchema,
  createBranchSchema,
  selectBranchSchema,
  deleteBranchSchema
} from "../lib/validation";

// Custom error classes for clean business logic error handling
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Creates a new conversation for an authenticated user.
 */
export async function serverCreateConversation(userId: string, data: { title?: string }): Promise<Conversation> {
  if (!userId) {
    throw new ValidationError("User must be authenticated.");
  }
  
  const parsed = createConversationSchema.safeParse(data);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message || "Invalid input.");
  }

  return await chatRepo.createConversation(userId, parsed.data.title);
}

/**
 * Retrieves a specific conversation after validating ownership.
 */
export async function serverGetConversation(userId: string, id: string): Promise<Conversation> {
  if (!userId) {
    throw new ValidationError("User must be authenticated.");
  }

  const parsed = getConversationSchema.safeParse({ id });
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message || "Invalid input.");
  }

  return await chatRepo.getConversation(parsed.data.id, userId);
}

/**
 * Retrieves all conversations belonging to the authenticated user.
 */
export async function serverGetUserConversations(userId: string): Promise<Conversation[]> {
  if (!userId) {
    throw new ValidationError("User must be authenticated.");
  }
  return await chatRepo.getUserConversations(userId);
}

/**
 * Updates a conversation title after validating user ownership.
 */
export async function serverUpdateConversationTitle(userId: string, id: string, title: string): Promise<Conversation> {
  if (!userId) {
    throw new ValidationError("User must be authenticated.");
  }

  const parsed = updateConversationSchema.safeParse({ id, title });
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message || "Invalid input.");
  }

  return await chatRepo.updateConversationTitle(parsed.data.id, userId, parsed.data.title);
}

/**
 * Deletes a conversation and cascades to its messages, validating user ownership first.
 */
export async function serverDeleteConversation(userId: string, id: string): Promise<Conversation> {
  if (!userId) {
    throw new ValidationError("User must be authenticated.");
  }

  const parsed = deleteConversationSchema.safeParse({ id });
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message || "Invalid input.");
  }

  return await chatRepo.deleteConversation(parsed.data.id, userId);
}

/**
 * Appends a message to a conversation after validating ownership.
 */
export async function serverCreateMessage(
  userId: string, 
  conversationId: string, 
  data: { role: MessageRole; content: string; branchId?: string; expectedHeadMessageId?: string | null }
): Promise<Message> {
  if (!userId) {
    throw new ValidationError("User must be authenticated.");
  }

  const parsed = createMessageSchema.safeParse({ conversationId, ...data });
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message || "Invalid input.");
  }

  return await chatRepo.createMessage(
    parsed.data.conversationId, 
    userId, 
    parsed.data.role, 
    parsed.data.content,
    parsed.data.branchId,
    parsed.data.expectedHeadMessageId ?? undefined
  );
}

/**
 * Retrieves all messages in a conversation, validating user ownership of the conversation first.
 */
export async function serverGetConversationMessages(userId: string, conversationId: string, branchId?: string): Promise<Message[]> {
  if (!userId) {
    throw new ValidationError("User must be authenticated.");
  }

  const parsed = getConversationMessagesSchema.safeParse({ conversationId });
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message || "Invalid input.");
  }

  const result = await chatRepo.getBranchMessages(parsed.data.conversationId, userId, branchId);
  return result.messages;
}

export async function serverGetConversationBranches(userId: string, conversationId: string) {
  if (!userId) throw new ValidationError("User must be authenticated.");
  const parsed = getConversationMessagesSchema.safeParse({ conversationId });
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message || "Invalid input.");
  return chatRepo.getConversationBranches(parsed.data.conversationId, userId);
}

export async function serverCreateBranch(userId: string, conversationId: string, forkMessageId: string) {
  if (!userId) throw new ValidationError("User must be authenticated.");
  const parsed = createBranchSchema.safeParse({ conversationId, forkMessageId });
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message || "Invalid input.");
  return chatRepo.createBranch(parsed.data.conversationId, userId, parsed.data.forkMessageId);
}

export async function serverSetActiveBranch(userId: string, conversationId: string, branchId: string) {
  if (!userId) throw new ValidationError("User must be authenticated.");
  const parsed = selectBranchSchema.safeParse({ conversationId, branchId });
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message || "Invalid input.");
  return chatRepo.setActiveBranch(parsed.data.conversationId, userId, parsed.data.branchId);
}

export async function serverDeleteBranch(userId: string, conversationId: string, branchId: string) {
  if (!userId) throw new ValidationError("User must be authenticated.");
  const parsed = deleteBranchSchema.safeParse({ conversationId, branchId });
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message || "Invalid input.");
  return chatRepo.deleteBranch(parsed.data.conversationId, userId, parsed.data.branchId);
}

/**
 * Deletes a message from a conversation, validating ownership first.
 */
export async function serverDeleteMessage(userId: string, id: string): Promise<Message> {
  if (!userId) {
    throw new ValidationError("User must be authenticated.");
  }

  const parsed = deleteMessageSchema.safeParse({ id });
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message || "Invalid input.");
  }

  return await chatRepo.deleteMessage(parsed.data.id, userId);
}
