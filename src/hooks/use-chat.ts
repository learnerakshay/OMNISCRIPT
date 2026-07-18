import { useAuth } from "@clerk/clerk-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Conversation, Message, MessageRole } from "@prisma/client";
import { useToast } from "../providers/toast-provider";

// Centralized and structured query keys to prevent hardcoded key collision issues
export const chatKeys = {
  all: ["chat"] as const,
  conversations: () => [...chatKeys.all, "conversations"] as const,
  conversation: (id: string) => [...chatKeys.all, "conversation", id] as const,
  messages: (conversationId: string) => [...chatKeys.all, "messages", conversationId] as const,
};

/**
 * Robust authenticated fetch utility.
 * Resolves the active Clerk JWT session token, handles Content-Type headers,
 * and formats clean Client-friendly application-level errors.
 */
async function authenticatedFetch<T>(
  url: string,
  options: RequestInit = {},
  getToken: () => Promise<string | null>
): Promise<T> {
  const token = await getToken();
  
  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const errorMessage = errorBody.error || `HTTP error ${response.status}`;
    const error = new Error(errorMessage);
    (error as any).status = response.status;
    throw error;
  }

  return response.json() as Promise<T>;
}

/**
 * Hook to retrieve all conversations belonging to the authenticated user.
 */
export function useConversations() {
  const { getToken, userId } = useAuth();

  return useQuery<Conversation[], Error>({
    queryKey: chatKeys.conversations(),
    queryFn: () => authenticatedFetch<Conversation[]>("/api/conversations", {}, getToken),
    enabled: !!userId, // Execute only if the user is authenticated
  });
}

/**
 * Hook to retrieve details of a specific conversation.
 */
export function useConversation(id: string | null) {
  const { getToken, userId } = useAuth();

  return useQuery<Conversation, Error>({
    queryKey: chatKeys.conversation(id || ""),
    queryFn: () => authenticatedFetch<Conversation>(`/api/conversations/${id}`, {}, getToken),
    enabled: !!userId && !!id,
  });
}

/**
 * Hook to retrieve all messages in a specific conversation.
 */
export function useConversationMessages(conversationId: string | null) {
  const { getToken, userId } = useAuth();

  return useQuery<Message[], Error>({
    queryKey: chatKeys.messages(conversationId || ""),
    queryFn: () => authenticatedFetch<Message[]>(`/api/conversations/${conversationId}/messages`, {}, getToken),
    enabled: !!userId && !!conversationId,
  });
}

/**
 * Mutation hook to create a new conversation.
 * Automatically invalidates active conversation list queries on success.
 */
export function useCreateConversation() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation<Conversation, Error, { title?: string }>({
    mutationFn: (data) => 
      authenticatedFetch<Conversation>("/api/conversations", {
        method: "POST",
        body: JSON.stringify(data),
      }, getToken),
    onSuccess: (data) => {
      // Invalidate list to trigger fresh background reload
      queryClient.invalidateQueries({ queryKey: chatKeys.conversations() });
      toast({
        title: "Conversation Created",
        description: `"${data.title || 'Untitled Chat'}" is ready for collaboration.`,
        variant: "success",
      });
    },
    onError: (err) => {
      toast({
        title: "Failed to Create Conversation",
        description: err.message,
        variant: "error",
      });
    },
  });
}

/**
 * Mutation hook to rename a conversation title.
 * Invalidate list and specific conversation cache on success.
 */
export function useUpdateConversationTitle() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation<Conversation, Error, { id: string; title: string }>({
    mutationFn: ({ id, title }) => 
      authenticatedFetch<Conversation>(`/api/conversations/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ title }),
      }, getToken),
    onSuccess: (data) => {
      // Trigger updates across list and individual conversation caches
      queryClient.invalidateQueries({ queryKey: chatKeys.conversations() });
      queryClient.invalidateQueries({ queryKey: chatKeys.conversation(data.id) });
      toast({
        title: "Conversation Renamed",
        description: `Renamed successfully to "${data.title}".`,
        variant: "success",
      });
    },
    onError: (err) => {
      toast({
        title: "Failed to Rename",
        description: err.message,
        variant: "error",
      });
    },
  });
}

/**
 * Mutation hook to delete an active conversation.
 * Invalidates conversation list cache.
 */
export function useDeleteConversation() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation<Conversation, Error, { id: string }>({
    mutationFn: ({ id }) => 
      authenticatedFetch<Conversation>(`/api/conversations/${id}`, {
        method: "DELETE",
      }, getToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatKeys.conversations() });
      toast({
        title: "Conversation Deleted",
        description: "The conversation history has been permanently deleted.",
        variant: "success",
      });
    },
    onError: (err) => {
      toast({
        title: "Failed to Delete",
        description: err.message,
        variant: "error",
      });
    },
  });
}

/**
 * Mutation hook to append a new message.
 * Invalidates conversation messages list cache.
 */
export function useCreateMessage() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation<Message, Error, { conversationId: string; role: MessageRole; content: string }>({
    mutationFn: ({ conversationId, role, content }) => 
      authenticatedFetch<Message>(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        body: JSON.stringify({ role, content }),
      }, getToken),
    onSuccess: (data) => {
      // Invalidate messages list for this specific conversation
      queryClient.invalidateQueries({ queryKey: chatKeys.messages(data.conversationId) });
    },
    onError: (err) => {
      toast({
        title: "Failed to Send Message",
        description: err.message,
        variant: "error",
      });
    },
  });
}

/**
 * Mutation hook to delete a specific message.
 * Invalidates message cache for the parent conversation.
 */
export function useDeleteMessage() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation<Message, Error, { id: string; conversationId: string }>({
    mutationFn: ({ id }) => 
      authenticatedFetch<Message>(`/api/messages/${id}`, {
        method: "DELETE",
      }, getToken),
    onSuccess: (data) => {
      // Refresh messages list for the conversation this message belonged to
      queryClient.invalidateQueries({ queryKey: chatKeys.messages(data.conversationId) });
      toast({
        title: "Message Deleted",
        description: "Message was successfully removed from the conversation.",
        variant: "success",
      });
    },
    onError: (err) => {
      toast({
        title: "Failed to Delete Message",
        description: err.message,
        variant: "error",
      });
    },
  });
}

