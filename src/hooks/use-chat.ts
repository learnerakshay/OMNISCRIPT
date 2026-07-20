import { useAuth } from "@clerk/clerk-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Conversation, ConversationBranch, Message, MessageRole } from "@prisma/client";
import { useToast } from "../providers/toast-provider";

// Centralized and structured query keys to prevent hardcoded key collision issues
export const chatKeys = {
  all: ["chat"] as const,
  conversations: () => [...chatKeys.all, "conversations"] as const,
  conversation: (id: string) => [...chatKeys.all, "conversation", id] as const,
  messages: (conversationId: string, branchId?: string | null) => [...chatKeys.all, "messages", conversationId, branchId || "active"] as const,
  branches: (conversationId: string) => [...chatKeys.all, "branches", conversationId] as const,
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, "") || "";
export const apiUrl = (path: string) => `${API_BASE_URL}${path}`;

export interface BranchMetadata extends ConversationBranch { siblingCount: number; siblingIndex: number; }
export interface ConversationBranches { activeBranchId: string; branches: BranchMetadata[]; }
export interface DeleteMessageResult {
  conversationId: string;
  deletedMessageIds: string[];
  deletedBranchIds: string[];
  conversationDeleted: boolean;
  conversationEmpty: boolean;
  nextActiveBranchId: string | null;
}

const isBranchId = (value: string | null | undefined): value is string =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

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

  const response = await fetch(apiUrl(url), {
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
export function useConversationMessages(conversationId: string | null, branchId?: string | null) {
  const { getToken, userId } = useAuth();

  return useQuery<Message[], Error>({
    queryKey: chatKeys.messages(conversationId || "", branchId),
    queryFn: () => authenticatedFetch<Message[]>(`/api/conversations/${conversationId}/messages?branchId=${encodeURIComponent(branchId!)}`, {}, getToken),
    // A branch-specific read must wait for metadata from the selected conversation.
    // This prevents a previous conversation's branch ID being used during selection.
    enabled: !!userId && !!conversationId && isBranchId(branchId),
  });
}

export function useConversationBranches(conversationId: string | null) {
  const { getToken, userId } = useAuth();
  return useQuery<ConversationBranches, Error>({
    queryKey: chatKeys.branches(conversationId || ""),
    queryFn: () => authenticatedFetch<ConversationBranches>(`/api/conversations/${conversationId}/branches`, {}, getToken),
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
      queryClient.setQueryData<Conversation[]>(chatKeys.conversations(), (current = []) => [data, ...current.filter((conversation) => conversation.id !== data.id)]);
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

  return useMutation<Message, Error, { conversationId: string; role: MessageRole; content: string; branchId?: string; expectedHeadMessageId?: string | null }>({
    mutationFn: ({ conversationId, role, content, branchId, expectedHeadMessageId }) => 
      authenticatedFetch<Message>(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        // Never submit a transient, empty, or stale client branch value. The server
        // resolves the conversation's persisted active branch when this is omitted.
        body: JSON.stringify({ role, content, branchId: isBranchId(branchId) ? branchId : undefined, expectedHeadMessageId }),
      }, getToken),
    onSuccess: (data) => {
      // Invalidate messages list for this specific conversation
      queryClient.invalidateQueries({ queryKey: chatKeys.messages(data.conversationId, data.branchId) });
      queryClient.invalidateQueries({ queryKey: chatKeys.branches(data.conversationId) });
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

  return useMutation<DeleteMessageResult, Error, { id: string; conversationId: string }>({
    mutationFn: ({ id }) => 
      authenticatedFetch<DeleteMessageResult>(`/api/messages/${id}`, {
        method: "DELETE",
      }, getToken),
    onSuccess: (data) => {
      if (data.conversationDeleted) {
        queryClient.removeQueries({ queryKey: chatKeys.messages(data.conversationId) });
        queryClient.removeQueries({ queryKey: chatKeys.branches(data.conversationId) });
        queryClient.removeQueries({ queryKey: chatKeys.conversation(data.conversationId) });
      } else {
        queryClient.invalidateQueries({ queryKey: chatKeys.messages(data.conversationId) });
        queryClient.invalidateQueries({ queryKey: chatKeys.branches(data.conversationId) });
        queryClient.invalidateQueries({ queryKey: chatKeys.conversation(data.conversationId) });
      }
      queryClient.invalidateQueries({ queryKey: chatKeys.conversations() });
      toast({
        title: data.deletedBranchIds.length > 0 ? "Turn and Branches Deleted" : "Message Deleted",
        description: data.deletedBranchIds.length > 0
          ? "The selected turn and its dependent branches were removed."
          : "The selected message was successfully removed from the conversation.",
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

export function useCreateBranch() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation<BranchMetadata, Error, { conversationId: string; forkMessageId: string }>({
    mutationFn: ({ conversationId, forkMessageId }) => authenticatedFetch<BranchMetadata>(`/api/conversations/${conversationId}/branches`, { method: "POST", body: JSON.stringify({ forkMessageId }) }, getToken),
    onSuccess: (branch) => {
      queryClient.invalidateQueries({ queryKey: chatKeys.branches(branch.conversationId) });
      queryClient.invalidateQueries({ queryKey: chatKeys.conversation(branch.conversationId) });
    },
  });
}

export function useSetActiveBranch() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation<Conversation, Error, { conversationId: string; branchId: string }>({
    mutationFn: ({ conversationId, branchId }) => authenticatedFetch<Conversation>(`/api/conversations/${conversationId}/active-branch`, { method: "PATCH", body: JSON.stringify({ branchId }) }, getToken),
    onSuccess: (conversation) => {
      queryClient.invalidateQueries({ queryKey: chatKeys.branches(conversation.id) });
      queryClient.invalidateQueries({ queryKey: chatKeys.conversation(conversation.id) });
    },
  });
}

export function useDeleteBranch() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation<{ deletedBranchId: string; activeBranchId: string | null }, Error, { conversationId: string; branchId: string }>({
    mutationFn: ({ conversationId, branchId }) => authenticatedFetch<{ deletedBranchId: string; activeBranchId: string | null }>(`/api/conversations/${conversationId}/branches/${branchId}`, { method: "DELETE" }, getToken),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: chatKeys.branches(variables.conversationId) });
      queryClient.invalidateQueries({ queryKey: chatKeys.messages(variables.conversationId) });
      queryClient.invalidateQueries({ queryKey: chatKeys.conversation(variables.conversationId) });
    },
  });
}
