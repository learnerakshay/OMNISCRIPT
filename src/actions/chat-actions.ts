import { MessageRole, Conversation, Message } from "@prisma/client";
import * as chatRepo from "../lib/repositories/chat-repository";
import { 
  createConversationSchema, 
  updateConversationSchema, 
  getConversationSchema, 
  deleteConversationSchema, 
  createMessageSchema, 
  getConversationMessagesSchema, 
  deleteMessageSchema 
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
  data: { role: MessageRole; content: string }
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
    parsed.data.content
  );
}

/**
 * Retrieves all messages in a conversation, validating user ownership of the conversation first.
 */
export async function serverGetConversationMessages(userId: string, conversationId: string): Promise<Message[]> {
  if (!userId) {
    throw new ValidationError("User must be authenticated.");
  }

  const parsed = getConversationMessagesSchema.safeParse({ conversationId });
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message || "Invalid input.");
  }

  return await chatRepo.getConversationMessages(parsed.data.conversationId, userId);
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
