import { useState, useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { 
  Sparkles, 
  Menu, 
  ArrowUp, 
  ArrowDown,
  X, 
  Terminal, 
  Loader2, 
  ShieldAlert, 
  Compass,
  MessageSquare,
  ChevronLeft,
  Plus
} from "lucide-react";
import { 
  SignedIn, 
  SignedOut, 
  SignInButton, 
  SignUpButton, 
  useUser,
  useAuth
} from "@clerk/clerk-react";
import { useQueryClient } from "@tanstack/react-query";
import { apiUrl, chatKeys } from "./hooks/use-chat";
import { useToast } from "./providers/toast-provider";

import {
  useConversations,
  useConversationMessages,
  useCreateConversation,
  useUpdateConversationTitle,
  useDeleteConversation,
  useCreateMessage,
  useDeleteMessage,
  useConversationBranches,
  useCreateBranch,
  useSetActiveBranch,
  useDeleteBranch,
} from "@/hooks/use-chat";

import { useAccent } from "./providers/accent-provider";
import { useUserSettings } from "./providers/settings-provider";
import { LogoSymbol } from "@/components/logo-symbol";
import { Sidebar } from "@/components/sidebar";
import { MessageBubble } from "@/components/message-bubble";
import { SettingsDialog } from "@/components/settings-dialog";
import { useSounds } from "./hooks/use-sounds";

const TITLE_STOP_WORDS = new Set(["a", "an", "and", "are", "be", "brief", "can", "explain", "give", "in", "is", "it", "me", "of", "please", "tell", "the", "to", "what", "with", "you"]);

function createConciseTitle(prompt: string): string {
  const normalized = prompt.replace(/[^a-zA-Z0-9/]+/g, " ").trim();
  const lower = normalized.toLowerCase();
  if (/(calculate|calculation)/.test(lower) && /time/.test(lower)) return "Calculation and Time";
  const timezoneMatch = normalized.match(/(?:in|time)\s+[A-Za-z]+\/([A-Za-z_]+)/i);
  if (/time/.test(lower) && timezoneMatch) return `${timezoneMatch[1].replace(/_/g, " ")} Time`;
  const words = normalized.split(/\s+/).filter((word) => word.length > 1 && !TITLE_STOP_WORDS.has(word.toLowerCase()));
  return words.slice(0, 3).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ") || "New Conversation";
}

export default function App() {
  const { user, isLoaded } = useUser();
  const shouldReduceMotion = useReducedMotion();
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { classes, accentColor } = useAccent();
  const { settings } = useUserSettings();
  const { playSound } = useSounds();
  const [isHeaderRippling, setIsHeaderRippling] = useState(false);
  const authPageRef = useRef<HTMLDivElement>(null);
  const loginGlowRef = useRef<HTMLDivElement>(null);
  const touchGlowFrameRef = useRef<number>(0);
  const touchGlowFadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchGlowPositionRef = useRef({ x: 0, y: 0 });
  const activeTouchPointerIdRef = useRef<number | null>(null);
  const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
  const isUsingFallbackKey = !clerkPublishableKey?.trim();

  useEffect(() => {
    if (user || typeof window === "undefined") return;
    const media = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!media.matches || reducedMotion.matches) return;

    let animationFrame = 0;
    let pointerX = window.innerWidth / 2;
    let pointerY = window.innerHeight / 2;
    const updateGlow = () => {
      animationFrame = 0;
      if (loginGlowRef.current) {
        loginGlowRef.current.style.setProperty("--login-glow-x", `${pointerX - 160}px`);
        loginGlowRef.current.style.setProperty("--login-glow-y", `${pointerY - 160}px`);
      }
    };
    const handlePointerMove = (event: PointerEvent) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      if (!animationFrame) animationFrame = window.requestAnimationFrame(updateGlow);
    };
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
    };
  }, [user]);

  useEffect(() => () => {
    if (touchGlowFrameRef.current) window.cancelAnimationFrame(touchGlowFrameRef.current);
    if (touchGlowFadeTimeoutRef.current) clearTimeout(touchGlowFadeTimeoutRef.current);
  }, []);

  const updateTouchGlow = (clientX: number, clientY: number) => {
    const container = authPageRef.current;
    if (!container) return;

    const bounds = container.getBoundingClientRect();
    touchGlowPositionRef.current = { x: clientX - bounds.left, y: clientY - bounds.top };
    if (!touchGlowFrameRef.current) {
      touchGlowFrameRef.current = window.requestAnimationFrame(() => {
        touchGlowFrameRef.current = 0;
        const glow = loginGlowRef.current;
        if (!glow) return;
        const { x, y } = touchGlowPositionRef.current;
        glow.style.setProperty("--login-glow-x", `${x - 160}px`);
        glow.style.setProperty("--login-glow-y", `${y - 160}px`);
        glow.style.opacity = "0.3";
      });
    }
  };

  const isCoarseTouchDevice = () =>
    typeof window !== "undefined" && window.matchMedia("(hover: none) and (pointer: coarse)").matches;

  const handleAuthPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" || !isCoarseTouchDevice()) return;
    if (touchGlowFadeTimeoutRef.current) clearTimeout(touchGlowFadeTimeoutRef.current);
    activeTouchPointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    updateTouchGlow(event.clientX, event.clientY);
  };

  const handleAuthPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" && activeTouchPointerIdRef.current === event.pointerId) {
      updateTouchGlow(event.clientX, event.clientY);
    }
  };

  const handleAuthPointerRelease = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" || activeTouchPointerIdRef.current !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    activeTouchPointerIdRef.current = null;
    if (touchGlowFadeTimeoutRef.current) clearTimeout(touchGlowFadeTimeoutRef.current);
    touchGlowFadeTimeoutRef.current = setTimeout(() => {
      if (loginGlowRef.current) loginGlowRef.current.style.opacity = "0.25";
    }, 350);
  };

  const handleAuthLostPointerCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (activeTouchPointerIdRef.current !== event.pointerId) return;
    activeTouchPointerIdRef.current = null;
    if (touchGlowFadeTimeoutRef.current) clearTimeout(touchGlowFadeTimeoutRef.current);
    touchGlowFadeTimeoutRef.current = setTimeout(() => {
      if (loginGlowRef.current) loginGlowRef.current.style.opacity = "0.25";
    }, 350);
  };

  const loginGlowColor: Record<typeof accentColor, string> = {
    blue: "#2563eb",
    purple: "#8b5cf6",
    emerald: "#39FF14",
    orange: "#f97316",
    rose: "#f43f5e",
    cyan: "#06b6d4",
  };

  // React Query Hook integrations
  const { data: conversations, isLoading: isLoadingConversations, refetch: refetchConversations } = useConversations();
  const createConversation = useCreateConversation();
  const updateConversationTitle = useUpdateConversationTitle();
  const deleteConversation = useDeleteConversation();
  const createMessage = useCreateMessage();
  const deleteMessage = useDeleteMessage();
  const createBranch = useCreateBranch();
  const setActiveBranch = useSetActiveBranch();
  const deleteBranch = useDeleteBranch();

  // Selected state
  const [selectedConvId, setSelectedConvId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("omniscript-user-settings");
        const parsed = saved ? JSON.parse(saved) : null;
        const remember = parsed ? parsed.rememberLastConversation : true;
        if (remember !== false) {
          return localStorage.getItem("omniscript-last-conv-id");
        }
      } catch (e) {
        console.warn("Failed to initialize last conversation ID", e);
      }
    }
    return null;
  });
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null);

  // Save active conversation ID for "Remember Last Conversation" feature
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (settings.rememberLastConversation) {
        if (selectedConvId) {
          localStorage.setItem("omniscript-last-conv-id", selectedConvId);
        } else {
          localStorage.removeItem("omniscript-last-conv-id");
        }
      } else {
        localStorage.removeItem("omniscript-last-conv-id");
      }
    }
  }, [selectedConvId, settings.rememberLastConversation]);
  
  // Load messages for current conversation
  const { data: branchState, isLoading: isLoadingBranches } = useConversationBranches(selectedConvId);
  const resolvedBranchId = activeBranchId && branchState?.branches.some((branch) => branch.id === activeBranchId)
    ? activeBranchId
    : branchState?.activeBranchId ?? null;
  const { data: messages, isLoading: isLoadingMessages } = useConversationMessages(selectedConvId, resolvedBranchId);
  const activeBranch = branchState?.branches.find((branch) => branch.id === resolvedBranchId);

  useEffect(() => {
    setActiveBranchId(branchState?.activeBranchId ?? null);
  }, [selectedConvId, branchState?.activeBranchId]);

  useEffect(() => {
    setActiveBranchId(null);
  }, [selectedConvId]);

  // Layout & UI states
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [isSettingsOpen, setSettingsOpen] = useState(false);

  // Composer state
  const [composerText, setComposerText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  // Streaming AI states
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingToolCall, setStreamingToolCall] = useState<{
    name: string;
    status: "searching" | "reading_url" | "processing" | "completed" | "failed";
    query?: string;
    url?: string;
  } | null>(null);
  const [streamingCitations, setStreamingCitations] = useState<Array<{ title: string; url: string; snippet?: string }> | null>(null);
  const [userHasScrolledUp, setUserHasScrolledUp] = useState(false);
  const shouldShowLandingHero = !selectedConvId || (
    !isLoadingMessages && !isLoadingBranches &&
    !isStreaming &&
    (messages?.length ?? 0) === 0
  );

  // Auto-resize composer textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [composerText]);

  // Scroll to bottom helper
  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior });
    }
  };

  // Auto-scroll messages container to bottom on new message or conversation selection
  useEffect(() => {
    if (settings.autoScroll) {
      scrollToBottom("smooth");
    }
  }, [messages, isLoadingMessages, settings.autoScroll]);

  // Auto-scroll messages container to bottom on active streaming updates
  useEffect(() => {
    if (settings.autoScroll && isStreaming && !userHasScrolledUp) {
      scrollToBottom("auto");
    }
  }, [streamingText, isStreaming, userHasScrolledUp, settings.autoScroll]);

  // Handle scroll to show/hide scroll-to-bottom button
  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      // Show button if user scrolls up more than 150px
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
      setShowScrollBottom(!isNearBottom);

      if (isStreaming) {
        if (!isNearBottom) {
          setUserHasScrolledUp(true);
        } else {
          setUserHasScrolledUp(false);
        }
      }
    }
  };


  // Register modern keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (!settings.keyboardNavigation) return;

      // Ctrl/Cmd + K to focus message input
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        textareaRef.current?.focus();
      }
      
      // Ctrl/Cmd + B to toggle sidebar
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setSidebarCollapsed(prev => !prev);
      }

      // Esc to close any open dialog/dropdown
      if (e.key === "Escape") {
        if (isSettingsOpen) {
          setSettingsOpen(false);
        }
        if (isMobileDrawerOpen) {
          setMobileDrawerOpen(false);
        }
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [isSettingsOpen, isMobileDrawerOpen, settings.keyboardNavigation]);

  // Centered, premium loading experience centered on the OMNISCRIPT logo
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center relative select-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative flex flex-col items-center space-y-6">
          <div className="relative w-16 h-16">
            <LogoSymbol className="w-16 h-16" isGenerating={true} />
            <motion.div
              className="absolute -inset-4 rounded-2xl border border-dashed border-emerald-500/25"
              animate={{ rotate: 360 }}
              transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
            />
            <motion.div
              className="absolute -inset-8 rounded-full border border-emerald-500/10"
              animate={{ rotate: -360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            />
          </div>

          <div className="text-center space-y-1.5 pt-2">
            <h1 className="font-display font-bold text-lg tracking-wider text-white">OMNISCRIPT</h1>
            <div className="flex items-center gap-2 justify-center text-[10px] font-mono text-emerald-400 tracking-widest uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Calibrating Neural Interfaces</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Submit new message to active conversation and stream the AI response
  const handleSubmitMessage = async (textToSend: string) => {
    const cleanText = textToSend.trim();
    if (!cleanText) return;
    if (createMessage.isPending || createConversation.isPending || isStreaming) return;

    let activeId = selectedConvId;

    try {
      // If no active conversation, auto-create one first
      if (!activeId) {
        const autoTitle = createConciseTitle(cleanText);
          
        const newConv = await createConversation.mutateAsync({ title: autoTitle });
        activeId = newConv.id;
        setSelectedConvId(activeId);
      }

      setComposerText("");
      setUserHasScrolledUp(false);
      
      // 1. Save user's message
      const userMessage = await createMessage.mutateAsync({
        conversationId: activeId,
        role: "USER",
        content: cleanText,
        branchId: resolvedBranchId || undefined,
        expectedHeadMessageId: activeBranch?.headMessageId ?? null,
      });
      // The create-message response is the authoritative branch for a newly
      // created conversation; state/query metadata may not have resolved yet.
      const streamBranchId = userMessage.branchId;
      setActiveBranchId(streamBranchId);

      // 2. Setup streaming states
      playSound("activation");
      setIsStreaming(true);
      setStreamingText("");
      setStreamingToolCall(null);
      setStreamingCitations(null);

      // 3. Initiate SSE connection
      const token = await getToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(apiUrl(`/api/conversations/${activeId}/stream`), {
        method: "POST",
        headers,
        body: JSON.stringify({ branchId: streamBranchId, expectedHeadMessageId: userMessage.id }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error || `HTTP error ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Stream reader could not be established.");
      }

      const decoder = new TextDecoder();
      let done = false;
      let accumulated = "";

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunkStr = decoder.decode(value, { stream: true });
          accumulated += chunkStr;

          const lines = accumulated.split("\n");
          accumulated = lines.pop() || "";

          for (const line of lines) {
            const cleanLine = line.trim();
            if (!cleanLine) continue;
            if (cleanLine.startsWith("data: ")) {
              const dataStr = cleanLine.slice(6);
              if (dataStr === "[DONE]") {
                done = true;
                break;
              }
              let parsed: any;
              try {
                parsed = JSON.parse(dataStr);
              } catch (e) {
                console.warn("Failed to parse stream chunk", e);
                continue;
              }

              if (parsed.error) {
                throw new Error(parsed.error);
              }

              if (parsed.type === "status") {
                setStreamingToolCall({
                  name: parsed.name,
                  status: parsed.status,
                  query: parsed.query,
                  url: parsed.url
                });
              } else if (parsed.type === "citations") {
                setStreamingCitations(parsed.citations);
              } else if (parsed.type === "text") {
                setStreamingText(prev => (prev || "") + parsed.text);
              } else if (parsed.text) {
                setStreamingText(prev => (prev || "") + parsed.text);
              }
            }
          }
        }
      }

      // Invalidate query to pull the final completed message saved in DB
      await queryClient.invalidateQueries({ queryKey: chatKeys.messages(activeId, streamBranchId) });
      await queryClient.invalidateQueries({ queryKey: chatKeys.branches(activeId) });
    } catch (err: any) {
      console.error("Failed to append message or stream response", err);
      toast({
        title: "Communication Failure",
        description: err.message || "An unexpected error occurred while streaming response.",
        variant: "error"
      });
    } finally {
      setIsStreaming(false);
      setStreamingText(null);
      setStreamingToolCall(null);
      setStreamingCitations(null);
    }
  };

  const handleCreateBranch = async (messageId: string) => {
    if (!selectedConvId || createBranch.isPending || isStreaming) return;
    try {
      const branch = await createBranch.mutateAsync({ conversationId: selectedConvId, forkMessageId: messageId });
      setActiveBranchId(branch.id);
      toast({ title: "Branch Created", description: "A new continuation is now active.", variant: "success" });
    } catch (error) {
      toast({ title: "Failed to Create Branch", description: error instanceof Error ? error.message : "Unable to create a branch.", variant: "error" });
    }
  };

  const handleSelectBranch = async (branchId: string) => {
    if (!selectedConvId || branchId === activeBranchId || setActiveBranch.isPending || isStreaming) return;
    try {
      await setActiveBranch.mutateAsync({ conversationId: selectedConvId, branchId });
      setActiveBranchId(branchId);
    } catch (error) {
      toast({ title: "Failed to Switch Branch", description: error instanceof Error ? error.message : "Unable to switch branch.", variant: "error" });
    }
  };

  const handleDeleteBranch = async () => {
    if (!selectedConvId || !activeBranchId || deleteBranch.isPending || isStreaming) return;
    if (!window.confirm("Delete this branch and its unique messages? Shared history will remain.")) return;
    try {
      const result = await deleteBranch.mutateAsync({ conversationId: selectedConvId, branchId: activeBranchId });
      setActiveBranchId(result.activeBranchId);
      toast({ title: "Branch Deleted", description: "Switched to a valid continuation.", variant: "success" });
    } catch (error) {
      toast({ title: "Failed to Delete Branch", description: error instanceof Error ? error.message : "Unable to delete this branch.", variant: "error" });
    }
  };


  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (settings.enterToSend && e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmitMessage(composerText);
    }
  };

  // Suggested Prompts landing triggers
  const suggestedPrompts = [
    {
      title: "Synthesize software design architectures",
      prompt: "Synthesize an elegant, minimal architectural structure for a fast-scaling full-stack developer platform using React and Node.js."
    },
    {
      title: "Analyze database transaction integrity",
      prompt: "Construct a clean Postgres statement to manage multi-tenant row isolations safely without schema blocking, including compound indexing instructions."
    },
    {
      title: "Refactor nested asynchronous logic",
      prompt: "Translate a complex callback chain into modern, clean TypeScript async/await structures using typed exception boundaries."
    },
    {
      title: "Outline a premium SaaS product strategy",
      prompt: "Draft a modern developer-focused messaging scheme emphasizing speed, offline-first reliability, and visual craftsmanship."
    }
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex overflow-hidden selection:bg-foreground/10 transition-colors duration-300 font-sans">
      
      {/* Fallback configuration alert banner (absolute top floating) */}
      {isUsingFallbackKey && (
        <div className="fixed top-3 right-3 left-3 md:left-auto md:w-96 z-50 flex items-start gap-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl p-3.5 shadow-md">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <p className="font-semibold text-amber-900 dark:text-amber-300">Sandbox Key Running</p>
            <p className="text-amber-700 dark:text-amber-400 leading-relaxed">
              Using local mock sessions because Clerk keys are missing. Connect keys via AI Studio to write to Postgres.
            </p>
          </div>
        </div>
      )}

      {/* SIGNED OUT AUTH SPLASH SCREEN */}
      <SignedOut>
        <div
          ref={authPageRef}
          onPointerDown={handleAuthPointerDown}
          onPointerMoveCapture={handleAuthPointerMove}
          onPointerUp={handleAuthPointerRelease}
          onPointerCancel={handleAuthPointerRelease}
          onLostPointerCapture={handleAuthLostPointerCapture}
          className="flex-1 flex flex-col justify-between items-center p-6 bg-linear-to-b from-background via-muted/10 to-muted/20 relative min-h-screen touch-pan-y"
        >
          <div
            ref={loginGlowRef}
            aria-hidden="true"
            className="absolute left-0 top-0 z-0 h-80 w-80 rounded-full blur-3xl opacity-25 pointer-events-none will-change-transform"
            style={{
              background: `radial-gradient(circle, ${loginGlowColor[accentColor]} 0%, transparent 68%)`,
              transform: "translate3d(var(--login-glow-x, 0px), var(--login-glow-y, 0px), 0)",
            }}
          />
          {/* Subtle background nodes */}
          <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-zinc-400/5 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-zinc-300/5 rounded-full blur-3xl pointer-events-none"></div>

          <div className="w-full max-w-5xl flex items-center justify-start h-16">
            <div className="flex items-center gap-2.5">
              <LogoSymbol className="w-8 h-8" touchInteractive />
              <span className="font-display font-bold text-base tracking-tight">OMNISCRIPT</span>
            </div>
          </div>

          <motion.div
            className="w-full max-w-sm relative z-10"
            animate={shouldReduceMotion ? undefined : { y: [0, -4, 0] }}
            transition={shouldReduceMotion ? undefined : { duration: 5, repeat: Infinity, ease: "easeInOut" }}
          >
            <motion.div
              aria-hidden="true"
              className="absolute inset-0 rounded-2xl border border-emerald-400/30 pointer-events-none"
              animate={shouldReduceMotion ? { opacity: 0 } : {
                opacity: [0.1, isCoarseTouchDevice() ? 0.32 : 0.22, 0.1],
                boxShadow: isCoarseTouchDevice()
                  ? ["0 0 5px rgba(57,255,20,0.08)", "0 0 11px rgba(57,255,20,0.18)", "0 0 5px rgba(57,255,20,0.08)"]
                  : ["0 0 4px rgba(57,255,20,0.06)", "0 0 8px rgba(57,255,20,0.12)", "0 0 4px rgba(57,255,20,0.06)"],
              }}
              transition={shouldReduceMotion ? undefined : { duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
            />
          <main className="w-full bg-card border border-border rounded-2xl p-8 shadow-md text-center space-y-6 relative z-10">
            <div className="space-y-3">
              <div className="mx-auto flex justify-center">
                <LogoSymbol className="w-12 h-12" touchInteractive />
              </div>
              <h1 className="font-display font-bold text-2xl tracking-tight text-foreground">
                Welcome to OMNISCRIPT
              </h1>
              <p className="text-xs text-muted-foreground leading-relaxed px-2">
                A minimal workspace prioritizing visual quality, lightning performance, and real-time document sync.
              </p>
            </div>

            <div className="space-y-2.5 pt-2">
              <SignInButton mode="modal">
                <button className="w-full flex items-center justify-center py-2.5 bg-foreground text-background hover:bg-foreground/90 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer shadow-sm">
                  Access Portal
                </button>
              </SignInButton>

              <SignUpButton mode="modal">
                <button className="w-full flex items-center justify-center py-2.5 bg-card border border-border text-foreground hover:bg-accent rounded-xl text-xs font-semibold tracking-wide transition-colors cursor-pointer">
                  Create Developer Identity
                </button>
              </SignUpButton>
            </div>

            <div className="pt-4 border-t border-border/60 text-[10px] font-mono text-muted-foreground flex items-center justify-center gap-1.5">
              <span>Verified Identity Handshake Powered by Clerk</span>
            </div>
          </main>
          </motion.div>

          <footer className="w-full max-w-5xl text-center text-[11px] font-mono text-muted-foreground/70 py-4">
            © {new Date().getFullYear()} OMNISCRIPT. Crafted with structural precision.
          </footer>
        </div>
      </SignedOut>

      {/* SIGNED IN APP MAIN CONTAINER */}
      <SignedIn>
        <div className="flex-1 flex h-screen overflow-hidden relative">
          
          {/* Responsive Sidebar - Persistent Desktop, Sliding Mobile drawer */}
          <div className="hidden md:block shrink-0">
            <Sidebar
              conversations={conversations}
              isLoading={isLoadingConversations}
              selectedId={selectedConvId}
              onSelect={setSelectedConvId}
              onCreate={(title) => {
                createConversation.mutate({ title }, {
                  onSuccess: (data) => setSelectedConvId(data.id)
                });
              }}
              isCreatePending={createConversation.isPending}
              onRename={(id, title) => updateConversationTitle.mutate({ id, title })}
              onDelete={(id) => {
                deleteConversation.mutate({ id }, {
                  onSuccess: () => {
                    if (selectedConvId === id) setSelectedConvId(null);
                  }
                });
              }}
              onOpenSettings={() => setSettingsOpen(true)}
              isCollapsed={isSidebarCollapsed}
              setCollapsed={setSidebarCollapsed}
              isGenerating={isStreaming}
            />
          </div>

          {/* Mobile Sliding Sidebar Drawer Overlay */}
          <AnimatePresence>
            {isMobileDrawerOpen && (
              <div className="fixed inset-0 z-40 md:hidden flex">
                {/* Mobile Drawer Backdrop */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setMobileDrawerOpen(false)}
                  className="absolute inset-0 bg-black/40 backdrop-blur-xs"
                ></motion.div>

                {/* Mobile Sidebar Frame */}
                <motion.div
                  initial={{ x: "-100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "-100%" }}
                  transition={{ type: "tween", duration: 0.25 }}
                  className="relative z-10 w-full max-w-[300px] sm:max-w-[320px] bg-card h-full shadow-2xl"
                >
                  <Sidebar
                    conversations={conversations}
                    isLoading={isLoadingConversations}
                    selectedId={selectedConvId}
                    onSelect={(id) => {
                      setSelectedConvId(id);
                      setMobileDrawerOpen(false);
                    }}
                    onCreate={(title) => {
                      createConversation.mutate({ title }, {
                        onSuccess: (data) => {
                          setSelectedConvId(data.id);
                          setMobileDrawerOpen(false);
                        }
                      });
                    }}
                    isCreatePending={createConversation.isPending}
                    onRename={(id, title) => updateConversationTitle.mutate({ id, title })}
                    onDelete={(id) => {
                      deleteConversation.mutate({ id }, {
                        onSuccess: () => {
                          if (selectedConvId === id) setSelectedConvId(null);
                        }
                      });
                    }}
                    onOpenSettings={() => {
                      setSettingsOpen(true);
                      setMobileDrawerOpen(false);
                    }}
                    isCollapsed={false}
                    setCollapsed={() => {}}
                    isGenerating={isStreaming}
                    onClose={() => setMobileDrawerOpen(false)}
                  />
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Chat main viewport area */}
          <div className="flex-1 flex flex-col h-full bg-background relative overflow-hidden">
            
            {/* Header toolbar */}
            <header className="h-12 sm:h-16 border-b border-border/80 px-2 sm:px-6 flex items-center justify-between bg-card/50 backdrop-blur-md sticky top-0 z-10 relative pt-[env(safe-area-inset-top)]">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <button
                  onClick={() => setMobileDrawerOpen(true)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-border hover:bg-accent text-foreground md:hidden cursor-pointer shrink-0 transition-colors"
                  title="Menu"
                >
                  <Menu className="w-3.5 h-3.5" />
                </button>
                
                {/* Active conversation title display or placeholder */}
                {selectedConvId ? (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <MessageSquare className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-[11px] sm:text-xs font-semibold max-w-[100px] xs:max-w-[140px] sm:max-w-xs truncate">
                      {conversations?.find((c) => c.id === selectedConvId)?.title || "Active Chat"}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 select-none">
                    <LogoSymbol className="w-5 h-5 sm:w-6 sm:h-6" isGenerating={isStreaming} />
                    <span className="font-display font-bold text-[11px] sm:text-xs tracking-tight">OMNISCRIPT</span>
                  </div>
                )}
              </div>

              {/* Header Right Utility */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                {/* Desktop/Tablet New Chat */}
                <button
                  onClick={() => {
                    playSound("creation");
                    setIsHeaderRippling(true);
                    setTimeout(() => setIsHeaderRippling(false), 600);
                    setSelectedConvId(null);
                    setComposerText("");
                  }}
                  className={`px-3 py-2 border border-border rounded-xl hover:${classes.accentBg} text-muted-foreground hover:${classes.text} text-[11px] font-semibold tracking-wide uppercase cursor-pointer relative overflow-visible h-9 items-center justify-center hidden sm:flex`}
                  title="Close active chat and return to dashboard"
                >
                  New Chat
                  <AnimatePresence>
                    {isHeaderRippling && (
                      <motion.span
                        className="absolute inset-0 rounded-xl border-2 border-emerald-500/80 pointer-events-none z-10"
                        initial={{ scale: 1, opacity: 0.8 }}
                        animate={{ scale: 1.3, opacity: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                      />
                    )}
                  </AnimatePresence>
                </button>

                {/* Mobile Compact Icon-Only New Chat */}
                <button
                  onClick={() => {
                    playSound("creation");
                    setIsHeaderRippling(true);
                    setTimeout(() => setIsHeaderRippling(false), 600);
                    setSelectedConvId(null);
                    setComposerText("");
                  }}
                  className={`border border-border rounded-lg hover:${classes.accentBg} text-muted-foreground hover:${classes.text} cursor-pointer relative overflow-visible h-8 w-8 flex items-center justify-center sm:hidden`}
                  title="New Chat"
                  aria-label="New Chat"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <AnimatePresence>
                    {isHeaderRippling && (
                      <motion.span
                        className="absolute inset-0 rounded-lg border-2 border-emerald-500/80 pointer-events-none z-10"
                        initial={{ scale: 1, opacity: 0.8 }}
                        animate={{ scale: 1.3, opacity: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                      />
                    )}
                  </AnimatePresence>
                </button>
              </div>

              {/* Minimalist, animated progress indicator during AI response streaming */}
              {isStreaming && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500/10 overflow-hidden z-20 pointer-events-none">
                  <motion.div
                    className="h-full bg-emerald-500 shadow-[0_0_8px_#10b981]"
                    initial={{ x: "-100%" }}
                    animate={{ x: "100%" }}
                    transition={{
                      repeat: Infinity,
                      duration: 1.5,
                      ease: "easeInOut"
                    }}
                  />
                </div>
              )}
            </header>

            {/* Chat Body viewports */}
            <div 
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 sm:py-6 md:px-8 space-y-4 sm:space-y-6 custom-scrollbar flex justify-center bg-linear-to-b from-background to-muted/5"
            >
              <div className="w-full max-w-3xl flex flex-col min-h-full">
                <AnimatePresence mode="wait">
                  {shouldShowLandingHero ? (
                    /* EMPTY/LANDING STATE GREETINGS */
                    <motion.div
                      key="empty-state"
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -15 }}
                      transition={{ duration: 0.3 }}
                      className="flex-1 flex flex-col justify-center py-10 space-y-10"
                    >
                      <div className="text-center space-y-4">
                        <div className="flex justify-center">
                          <LogoSymbol className="w-14 h-14" isGenerating={isStreaming} />
                        </div>
                        <h2 className="font-display font-bold text-2xl tracking-tight text-foreground md:text-3xl">
                          What can OMNISCRIPT build for you?
                        </h2>
                        <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                          Enter your prompt below. If no chat is active, OMNISCRIPT will automatically establish a database session and initiate writing.
                        </p>
                      </div>

                      {/* Prompt suggestion grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6 sm:mb-8 max-w-2xl mx-auto w-full">
                        {suggestedPrompts.map((item, index) => (
                          <button
                            key={index}
                            onClick={() => {
                              playSound("click");
                              setComposerText(item.prompt);
                              if (textareaRef.current) textareaRef.current.focus();
                            }}
                            className={`p-4 rounded-xl border ${classes.border} bg-card text-left hover:-translate-y-0.5 hover:scale-[1.01] transition-[transform,border-color] duration-200 ease-out cursor-pointer group space-y-1.5 focus:outline-hidden focus:ring-1 focus:ring-ring`}
                          >
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                              <Compass className="w-3.5 h-3.5 text-muted-foreground" />
                              {item.title}
                            </div>
                            <p className="text-[11px] text-muted-foreground line-clamp-2 leading-normal">
                              {item.prompt}
                            </p>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  ) : (
                    /* MESSAGES CHAT STREAM VIEWPORT */
                    <motion.div
                      key="messages-viewport"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex-1 flex flex-col space-y-6"
                    >
                      {isLoadingMessages ? (
                        /* Premium Shimmer Skeleton Loader */
                        <div className="flex-1 flex flex-col gap-6 pt-4 pb-[180px] sm:pb-[200px] md:pb-[220px] w-full">
                          {[1, 2, 3].map((n) => (
                            <div 
                              key={n} 
                              className={`flex gap-3 w-full max-w-xl ${n % 2 === 0 ? "ml-auto flex-row-reverse" : "mr-auto"}`}
                            >
                              <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-muted/30 animate-pulse shrink-0"></div>
                              <div className="space-y-2 flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <div className="h-3.5 w-16 bg-zinc-200 dark:bg-muted/30 animate-pulse rounded-md"></div>
                                  <div className="h-3 w-10 bg-zinc-100 dark:bg-muted/20 animate-pulse rounded-md"></div>
                                </div>
                                <div className="h-20 w-full bg-zinc-100 dark:bg-muted/20 border border-zinc-200/60 dark:border-border/40 animate-pulse rounded-2xl rounded-tl-none"></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (!messages || messages.length === 0) && !isStreaming ? (
                        <div className="flex-1 flex flex-col items-center justify-center py-20 text-center space-y-3">
                           <MessageSquare className="w-8 h-8 text-muted-foreground animate-bounce" />
                           <p className="text-xs font-semibold text-muted-foreground">Active session initialized.</p>
                           <p className="text-[11px] text-muted-foreground/80 max-w-xs">Type your custom instruction below to write a message to the relational layer.</p>
                        </div>
                      ) : (
                        <div className="flex-1 flex flex-col gap-6 pb-[180px] sm:pb-[200px] md:pb-[220px]">
                          {(messages || []).map((msg) => (
                            <MessageBubble
                              key={msg.id}
                              message={msg}
                              onDelete={(id) => {
                                if (!selectedConvId || isStreaming) return;
                                deleteMessage.mutate(
                                  { id, conversationId: selectedConvId },
                                  {
                                    onSuccess: (result) => {
                                      if (selectedConvId !== result.conversationId) return;
                                      if (result.conversationDeleted || result.conversationEmpty) {
                                        setActiveBranchId(null);
                                        setSelectedConvId(null);
                                        return;
                                      }
                                      setActiveBranchId(result.nextActiveBranchId);
                                    },
                                  },
                                );
                              }}
                              isDeleting={deleteMessage.isPending || isStreaming}
                              onBranch={msg.role === "ASSISTANT" ? handleCreateBranch : undefined}
                              isBranching={createBranch.isPending}
                              branchNavigation={(() => {
                                if (!activeBranch) return undefined;
                                const allBranches = branchState?.branches || [];
                                const isChildFork = activeBranch.forkMessageId === msg.id;
                                const parentBranchId = isChildFork ? activeBranch.parentBranchId : activeBranch.id;
                                const children = allBranches
                                  .filter((branch) => branch.parentBranchId === parentBranchId && branch.forkMessageId === msg.id)
                                  .sort((a, b) => a.siblingOrder - b.siblingOrder || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                                if (!isChildFork && children.length === 0) return undefined;
                                const parent = allBranches.find((branch) => branch.id === parentBranchId);
                                const alternatives = parent ? [parent, ...children] : children;
                                const index = alternatives.findIndex((branch) => branch.id === activeBranch.id);
                                return {
                                  current: index + 1,
                                  total: alternatives.length,
                                  previousBranchId: alternatives[index - 1]?.id,
                                  nextBranchId: alternatives[index + 1]?.id,
                                  onSelect: handleSelectBranch,
                                  onDelete: handleDeleteBranch,
                                  canDelete: Boolean(activeBranch.parentBranchId),
                                  isSwitching: setActiveBranch.isPending || deleteBranch.isPending,
                                };
                              })()}
                            />
                          ))}

                          {isStreaming && streamingText !== null && (
                            <MessageBubble
                              key="active-streaming-bubble"
                              message={{
                                id: "streaming-temp-id",
                                conversationId: selectedConvId || "",
                                branchId: activeBranchId || "",
                                parentMessageId: activeBranch?.headMessageId || null,
                                role: "ASSISTANT",
                                content: streamingText,
                                createdAt: new Date(),
                                updatedAt: new Date()
                              }}
                              onDelete={() => {}}
                              isDeleting={false}
                              isStreaming={true}
                              streamingToolCall={streamingToolCall}
                              streamingCitations={streamingCitations}
                            />
                          )}

                          <div ref={messagesEndRef} />
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* MESSAGE COMPOSER CONTAINER */}
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-background via-background/95 to-transparent p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] flex flex-col items-center justify-end z-10 pointer-events-none">
              
              {/* Scroll to Bottom Floating Button */}
              <AnimatePresence>
                {showScrollBottom && (
                  <motion.button
                    initial={{ opacity: 0, y: 12, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 12, scale: 0.95 }}
                    transition={{ type: "spring", damping: 18, stiffness: 220 }}
                    onClick={() => {
                      setUserHasScrolledUp(false);
                      scrollToBottom("smooth");
                    }}
                    className={`mb-3.5 sm:mb-4 flex items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 sm:px-3.5 sm:py-2 ${classes.bg} ${classes.hoverBg} rounded-full text-[10px] sm:text-xs font-semibold shadow-lg hover:scale-105 active:scale-95 transition-all pointer-events-auto cursor-pointer border border-border/10 select-none`}
                  >
                    <ArrowDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 animate-bounce" />
                    <span>{isStreaming && userHasScrolledUp ? "Jump to Latest" : "Scroll to bottom"}</span>
                  </motion.button>
                )}
              </AnimatePresence>


              <div className="w-full max-w-3xl pointer-events-auto">
                <div className={`relative border border-border bg-card rounded-2xl p-2.5 sm:p-2 shadow-md hover:border-foreground/20 focus-within:${classes.focusBorder} focus-within:ring-2 focus-within:${classes.ring} transition-all`}>
                  
                  {/* Autosizing Textarea field */}
                  <textarea
                    ref={textareaRef}
                    rows={1}
                    value={composerText}
                    onChange={(e) => setComposerText(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder={
                      selectedConvId 
                        ? "Message OMNISCRIPT..." 
                        : "Send a message to auto-initiate secure session..."
                    }
                    className="w-full pl-3 pr-12 py-2.5 sm:py-2 bg-transparent text-[16px] sm:text-xs text-foreground placeholder-muted-foreground focus:outline-hidden resize-none min-h-[38px] max-h-[200px]"
                    style={{ overflowY: "auto" }}
                  />

                  {/* Actions footer row inside composer */}
                  <div className="flex items-center justify-end border-t border-border/50 pt-2 px-1.5">
                    
                    {/* Prompt Character Counter and Help tips */}
                    <div className="flex items-center gap-3">
                      {composerText.length > 0 && (
                        <span className="text-[10px] font-mono text-muted-foreground select-none hidden sm:inline">
                          {composerText.length} chars
                        </span>
                      )}
                      
                      <button
                        onClick={() => {
                          playSound("click");
                          handleSubmitMessage(composerText);
                        }}
                        disabled={!composerText.trim() || createMessage.isPending || createConversation.isPending}
                        className={`p-2.5 sm:p-1.5 rounded-xl ${classes.bg} ${classes.hoverBg} disabled:bg-muted disabled:text-muted-foreground transition-all cursor-pointer shadow-xs shrink-0 flex items-center justify-center`}
                        title="Send Message"
                      >
                        {createMessage.isPending || createConversation.isPending ? (
                          <Loader2 className="w-4 h-4 sm:w-3.5 sm:h-3.5 animate-spin" />
                        ) : (
                          <ArrowUp className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                </div>

                <p className="mt-2 text-center text-[10px] text-muted-foreground/70">
                  OMNISCRIPT can make mistakes. Verify important information.
                </p>
              </div>
            </div>

          </div>

          {/* Settings Modal Popup */}
          <SettingsDialog
            isOpen={isSettingsOpen}
            onClose={() => setSettingsOpen(false)}
          />

        </div>
      </SignedIn>

    </div>
  );
}
