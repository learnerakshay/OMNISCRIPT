import { z } from "zod";

export const createConversationSchema = z.object({
  title: z.string().trim().max(100).optional(),
});

export const updateConversationSchema = z.object({
  id: z.string().uuid("Invalid conversation identifier format."),
  title: z.string().trim().min(1, "Title cannot be empty.").max(100, "Title cannot exceed 100 characters."),
});

export const deleteConversationSchema = z.object({
  id: z.string().uuid("Invalid conversation identifier format."),
});

export const getConversationSchema = z.object({
  id: z.string().uuid("Invalid conversation identifier format."),
});

export const createMessageSchema = z.object({
  conversationId: z.string().uuid("Invalid conversation identifier format."),
  role: z.enum(["USER", "ASSISTANT", "SYSTEM"]),
  content: z.string().trim().min(1, "Message content cannot be empty.").max(10000, "Message content is too long."),
});

export const getConversationMessagesSchema = z.object({
  conversationId: z.string().uuid("Invalid conversation identifier format."),
});

export const deleteMessageSchema = z.object({
  id: z.string().uuid("Invalid message identifier format."),
});
