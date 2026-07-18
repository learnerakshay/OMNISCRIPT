import { MessageRole, Conversation, Message } from "@prisma/client";
import { prisma } from "../prisma";

// Production-ready custom errors to avoid exposing raw database internals
export class DatabaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseError";
  }
}

export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

/**
 * Validates conversation ownership before performing sensitive actions.
 * Throws NotFoundError if the conversation does not exist, and UnauthorizedError
 * if the user is not the owner.
 */
async function validateOwnership(id: string, userId: string): Promise<Conversation> {
  let conversation: Conversation | null;
  try {
    conversation = await prisma.conversation.findUnique({
      where: { id },
    });
  } catch (error) {
    throw new DatabaseError("Failed to retrieve conversation metadata during validation.");
  }

  if (!conversation) {
    throw new NotFoundError("Conversation not found.");
  }

  if (conversation.userId !== userId) {
    throw new UnauthorizedError("You are not authorized to perform this action.");
  }

  return conversation;
}

/**
 * Creates a new conversation for a specified user.
 */
export async function createConversation(userId: string, title?: string): Promise<Conversation> {
  if (!userId) {
    throw new Error("User identifier is required.");
  }

  try {
    return await prisma.conversation.create({
      data: {
        userId,
        title: title || "New Conversation",
      },
    });
  } catch (error) {
    console.error("Error in createConversation:", error);
    throw new DatabaseError("Failed to create a new conversation.");
  }
}

/**
 * Safely fetches a specific conversation, verifying user ownership.
 */
export async function getConversation(id: string, userId: string): Promise<Conversation> {
  if (!id || !userId) {
    throw new Error("Conversation and user identifiers are required.");
  }

  return await validateOwnership(id, userId);
}

/**
 * Fetches all conversations belonging to a user, sorted by last update date descending.
 */
export async function getUserConversations(userId: string): Promise<Conversation[]> {
  if (!userId) {
    throw new Error("User identifier is required.");
  }

  try {
    return await prisma.conversation.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    });
  } catch (error) {
    console.error("Error in getUserConversations:", error);
    throw new DatabaseError("Failed to fetch user conversations.");
  }
}

/**
 * Updates a conversation title, enforcing user ownership.
 */
export async function updateConversationTitle(
  id: string,
  userId: string,
  title: string
): Promise<Conversation> {
  if (!id || !userId || !title.trim()) {
    throw new Error("Missing parameters or empty conversation title.");
  }

  await validateOwnership(id, userId);

  try {
    return await prisma.conversation.update({
      where: { id },
      data: { 
        title: title.trim(),
        // Prisma updates 'updatedAt' automatically due to @updatedAt attribute
      },
    });
  } catch (error) {
    console.error("Error in updateConversationTitle:", error);
    throw new DatabaseError("Failed to update conversation title.");
  }
}

/**
 * Deletes a conversation and cascades the deletion to all its messages, enforcing user ownership.
 */
export async function deleteConversation(id: string, userId: string): Promise<Conversation> {
  if (!id || !userId) {
    throw new Error("Conversation and user identifiers are required.");
  }

  await validateOwnership(id, userId);

  try {
    return await prisma.conversation.delete({
      where: { id },
    });
  } catch (error) {
    console.error("Error in deleteConversation:", error);
    throw new DatabaseError("Failed to delete conversation.");
  }
}

/**
 * Appends a new message to a conversation, verifying that the user owns the conversation first.
 */
export async function createMessage(
  conversationId: string,
  userId: string,
  role: MessageRole,
  content: string
): Promise<Message> {
  if (!conversationId || !userId || !content) {
    throw new Error("Conversation ID, role, and content are required.");
  }

  await validateOwnership(conversationId, userId);

  try {
    // Update the conversation's updatedAt timestamp and add the message atomically
    const [message] = await prisma.$transaction([
      prisma.message.create({
        data: {
          conversationId,
          role,
          content,
        },
      }),
      prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      }),
    ]);
    return message;
  } catch (error) {
    console.error("Error in createMessage:", error);
    throw new DatabaseError("Failed to create and append message.");
  }
}

/**
 * Fetches all messages within a conversation, sorted chronologically. Enforces user ownership.
 */
export async function getConversationMessages(
  conversationId: string,
  userId: string
): Promise<Message[]> {
  if (!conversationId || !userId) {
    throw new Error("Conversation and user identifiers are required.");
  }

  await validateOwnership(conversationId, userId);

  try {
    return await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
    });
  } catch (error) {
    console.error("Error in getConversationMessages:", error);
    throw new DatabaseError("Failed to retrieve conversation messages.");
  }
}

/**
 * Deletes a specific message after confirming it belongs to a conversation owned by the user.
 */
export async function deleteMessage(messageId: string, userId: string): Promise<Message> {
  if (!messageId || !userId) {
    throw new Error("Message and user identifiers are required.");
  }

  let message: Message | null;
  try {
    message = await prisma.message.findUnique({
      where: { id: messageId },
    });
  } catch (error) {
    throw new DatabaseError("Failed to retrieve message metadata during validation.");
  }

  if (!message) {
    throw new NotFoundError("Message not found.");
  }

  // Validate that the conversation the message belongs to is owned by this user
  await validateOwnership(message.conversationId, userId);

  try {
    return await prisma.message.delete({
      where: { id: messageId },
    });
  } catch (error) {
    console.error("Error in deleteMessage:", error);
    throw new DatabaseError("Failed to delete message.");
  }
}
