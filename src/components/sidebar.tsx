import { useState, useEffect } from "react";
import { Conversation } from "@prisma/client";
import { 
  Plus, 
  Search, 
  Settings, 
  ChevronLeft, 
  ChevronRight, 
  MessageSquare, 
  Edit3, 
  Trash2, 
  Check, 
  X, 
  LogOut,
  Sparkles,
  Pin,
  PinOff
} from "lucide-react";
import { useUser, SignOutButton } from "@clerk/clerk-react";
import { LogoSymbol } from "./logo-symbol";
import { motion, AnimatePresence } from "motion/react";
import { useAccent } from "../providers/accent-provider";
import { useToast } from "../providers/toast-provider";
import { useSounds } from "../hooks/use-sounds";
import { formatLastActive } from "../utils/date";

interface SidebarProps {
  conversations: Conversation[] | undefined;
  isLoading: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCreate: (title?: string) => void;
  isCreatePending: boolean;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onOpenSettings: () => void;
  isCollapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  isGenerating?: boolean;
  onClose?: () => void;
}

export function Sidebar({
  conversations = [],
  isLoading,
  selectedId,
  onSelect,
  onCreate,
  isCreatePending,
  onRename,
  onDelete,
  onOpenSettings,
  isCollapsed,
  setCollapsed,
  isGenerating = false,
  onClose,
}: SidebarProps) {
  const { user } = useUser();
  const { classes, accentColor } = useAccent();
  const { toast } = useToast();
  const { playSound } = useSounds();
  const [isRippling, setIsRippling] = useState(false);

  const handleNewChatClick = () => {
    playSound("creation");
    setIsRippling(true);
    setTimeout(() => setIsRippling(false), 600);
    onCreate();
  };
  
  const [search, setSearch] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [swipingId, setSwipingId] = useState<string | null>(null);

  // Load pinned state from localStorage
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("omniscript-pinned-chats");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Sync pinned ids to localStorage
  const savePinnedState = (newPinned: string[]) => {
    setPinnedIds(newPinned);
    localStorage.setItem("omniscript-pinned-chats", JSON.stringify(newPinned));
  };

  const handleTogglePin = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const isPinned = pinnedIds.includes(id);
    const updated = isPinned 
      ? pinnedIds.filter((p) => p !== id) 
      : [...pinnedIds, id];
    
    savePinnedState(updated);
    toast({
      title: isPinned ? "Conversation Unpinned" : "Conversation Pinned",
      description: isPinned 
        ? "Moved down to the recent list." 
        : "Pinned to the top of your history list.",
      variant: "success"
    });
  };

  const filtered = conversations.filter((c) =>
    (c.title || "Untitled Chat").toLowerCase().includes(search.toLowerCase())
  );

  const pinnedConvs = filtered.filter((c) => pinnedIds.includes(c.id));
  const recentConvs = filtered.filter((c) => !pinnedIds.includes(c.id));

  const handleStartEdit = (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation();
    setEditingId(id);
    setEditVal(title || "Untitled Chat");
  };

  const handleSaveEdit = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (editVal.trim()) {
      onRename(id, editVal.trim());
    }
    setEditingId(null);
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const handleDeleteTrigger = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeletingId(id);
  };

  const handleConfirmDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onDelete(id);
    setDeletingId(null);
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingId(null);
  };

  // Keyboard shortcut focus hook for input search
  useEffect(() => {
    const handleShortcut = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const inputEl = document.getElementById("search-input") as HTMLInputElement;
        inputEl?.focus();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  const renderConversationItem = (conv: Conversation, isPinned: boolean) => {
    const isSelected = selectedId === conv.id;
    const isEditing = editingId === conv.id;
    const isDeleting = deletingId === conv.id;
    const actionButtonClass = "shrink-0 p-1.5 rounded-md border-0 bg-transparent shadow-none text-muted-foreground transition-[color,transform,background-color] duration-150 ease-out cursor-pointer hover:-translate-y-px hover:scale-[1.05] hover:text-foreground hover:bg-muted/20 focus:outline-hidden focus:ring-1 focus:ring-ring";

    return (
      <div
        key={conv.id}
        className="relative group w-full overflow-hidden rounded-xl"
      >
        {/* Swipe Quick Actions Behind Panel */}
        {swipingId === conv.id && (
        <div className="absolute inset-0 bg-zinc-100 dark:bg-muted/40 rounded-xl flex items-center justify-end px-2.5 gap-1.5 z-0">
          <button
            onClick={(e) => handleTogglePin(e, conv.id)}
            className="shrink-0 p-1.5 rounded-lg shadow-none text-muted-foreground hover:text-foreground hover:bg-card/80 transition-colors duration-150 cursor-pointer"
            title={isPinned ? "Unpin" : "Pin"}
          >
            <Pin className={`w-3.5 h-3.5 ${isPinned ? "fill-current text-amber-500" : ""}`} />
          </button>
          <button
            onClick={(e) => handleStartEdit(e, conv.id, conv.title || "")}
            className="shrink-0 p-1.5 rounded-lg shadow-none text-muted-foreground hover:text-foreground hover:bg-card/80 transition-colors duration-150 cursor-pointer"
            title="Rename"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => handleDeleteTrigger(e, conv.id)}
            className="shrink-0 p-1.5 rounded-lg shadow-none text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors duration-150 cursor-pointer"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
        )}

        {/* Swipeable Interactive foreground container */}
        <motion.div
          drag="x"
          dragDirectionLock
          dragConstraints={{ left: -110, right: 0 }}
          dragElastic={{ left: 0.05, right: 0 }}
          onDragStart={() => setSwipingId(conv.id)}
          onDragEnd={() => setSwipingId(null)}
          onClick={() => !isEditing && onSelect(conv.id)}
          className={`relative z-10 flex items-center gap-3 px-3.5 py-3 rounded-xl transition-all cursor-pointer bg-card border border-transparent select-none ${
            isSelected
              ? `${classes.activeHighlight} border-border shadow-xs`
              : "text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-accent/40"
          }`}
          style={{ x: 0 }}
          whileTap={{ scale: 0.99 }}
        >
          <MessageSquare className={`w-4 h-4 shrink-0 transition-colors ${
            isSelected ? classes.text : "text-muted-foreground/80 group-hover:text-foreground"
          }`} />

          {!isCollapsed && (
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              {isEditing ? (
                <input
                  type="text"
                  value={editVal}
                  onChange={(e) => setEditVal(e.target.value)}
                  className={`w-full bg-card border ${classes.border} text-xs text-foreground rounded-md px-1.5 py-0.5 focus:outline-hidden ring-1 ${classes.ring}`}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                />
              ) : (
                <div className="flex flex-col justify-center">
                  <div className="flex items-start justify-between gap-1.5 w-full">
                    <p className={`min-w-0 text-[11px] sm:text-xs font-medium leading-normal break-words line-clamp-2 ${isSelected ? "text-foreground font-semibold" : "text-zinc-700 dark:text-zinc-300 group-hover:text-foreground"}`}>
                      {conv.title || "Untitled Chat"}
                    </p>
                    {isPinned && (
                      <Pin className="w-3 h-3 text-amber-500 fill-current rotate-45 shrink-0 mt-0.5" />
                    )}
                  </div>
                  {conv.updatedAt && (
                    <span className="text-[8px] sm:text-[9px] text-zinc-500 dark:text-zinc-400 font-mono mt-1 tracking-wider uppercase select-none font-semibold">
                      {formatLastActive(conv.updatedAt)}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Desktop Hover Quick Actions */}
          {!isCollapsed && !isEditing && (
            <div className="shrink-0 w-[92px] flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200">
              <button
                onClick={(e) => handleTogglePin(e, conv.id)}
                className={actionButtonClass}
                title={isPinned ? "Unpin Chat" : "Pin Chat"}
              >
                <Pin className={`w-3.5 h-3.5 ${isPinned ? "fill-current text-amber-500" : ""}`} />
              </button>
              <button
                onClick={(e) => handleStartEdit(e, conv.id, conv.title || "")}
                className={actionButtonClass}
                title="Rename Chat"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => handleDeleteTrigger(e, conv.id)}
                className={`${actionButtonClass} hover:text-destructive hover:bg-destructive/10`}
                title="Delete Chat"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Inline Rename confirm buttons */}
          {isEditing && (
            <div className="absolute right-2 flex items-center gap-1 bg-card pl-2 rounded-r-xl">
              <button
                onClick={(e) => handleSaveEdit(e, conv.id)}
                className="p-1 rounded-md text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors cursor-pointer"
                title="Save"
              >
                <Check className="w-3.5 h-3.5 stroke-[3px]" />
              </button>
              <button
                onClick={handleCancelEdit}
                className="p-1 rounded-md text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                title="Cancel"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </motion.div>
      </div>
    );
  };

  return (
    <aside
      className={`relative h-full border-r border-border bg-card text-foreground flex flex-col transition-all duration-300 z-30 ${
        isCollapsed ? "w-16" : "w-full md:w-64"
      }`}
    >
      {/* Sidebar Header */}
      <div className="h-16 border-b border-border px-4 flex items-center justify-between overflow-hidden">
        <div className="flex items-center gap-3">
          <LogoSymbol className="w-8 h-8" isGenerating={isGenerating} />
          {!isCollapsed && (
            <motion.span
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="font-display font-bold tracking-tight text-base bg-linear-to-r from-foreground to-foreground/80 bg-clip-text text-transparent"
            >
              OMNISCRIPT
            </motion.span>
          )}
        </div>

        {/* Collapse Button (Desktop) or Close/Dismiss Button (Mobile Drawer) */}
        {!isCollapsed && (
          <div className="flex items-center gap-1">
            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg border border-border hover:bg-accent text-muted-foreground hover:text-foreground flex md:hidden cursor-pointer transition-colors"
                title="Close Drawer"
                aria-label="Close Drawer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setCollapsed(true)}
              className="p-1 rounded-lg border border-border hover:bg-accent text-muted-foreground hover:text-foreground hidden md:flex cursor-pointer transition-colors"
              title="Collapse Sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Expand Button for collapsed state */}
      {isCollapsed && (
        <div className="flex justify-center py-4 border-b border-border">
          <button
            onClick={() => setCollapsed(false)}
            className="p-1 rounded-lg border border-border hover:bg-accent text-muted-foreground hover:text-foreground hidden md:flex cursor-pointer transition-colors"
            title="Expand Sidebar"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Action: New Chat */}
      <div className="p-3">
        {isCollapsed ? (
          <button
            onClick={handleNewChatClick}
            disabled={isCreatePending}
            className="w-10 h-10 mx-auto flex items-center justify-center rounded-xl bg-foreground text-background hover:bg-foreground/90 transition-all shadow-xs cursor-pointer disabled:opacity-50 relative overflow-visible"
            title="New Chat"
          >
            <Plus className="w-5 h-5" />
            <AnimatePresence>
              {isRippling && (
                <motion.span
                  className="absolute inset-0 rounded-xl border-2 border-emerald-500/80 pointer-events-none z-10"
                  initial={{ scale: 1, opacity: 0.8 }}
                  animate={{ scale: 1.6, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              )}
            </AnimatePresence>
          </button>
        ) : (
          <button
            onClick={handleNewChatClick}
            disabled={isCreatePending}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-foreground text-background hover:bg-foreground/90 transition-all font-semibold text-xs tracking-wider uppercase shadow-xs cursor-pointer disabled:opacity-50 relative overflow-visible`}
          >
            <Plus className="w-4 h-4" />
            New Chat
            <AnimatePresence>
              {isRippling && (
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
        )}
      </div>

      {/* Premium Real-time Search Box */}
      {!isCollapsed && (
        <div className="px-3 pb-3">
          <div 
            className={`relative flex items-center border rounded-xl bg-muted/20 transition-all duration-200 ${
              isSearchFocused 
                ? `${classes.border} ${classes.ring} ring-1` 
                : "border-border hover:border-foreground/15"
            }`}
          >
            <Search className={`absolute left-3 w-3.5 h-3.5 transition-colors duration-200 ${
              isSearchFocused ? classes.text : "text-muted-foreground"
            }`} />
            <input
              id="search-input"
              type="text"
              placeholder="Search history..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
              className="w-full pl-9 pr-8 py-2.5 bg-transparent text-xs text-foreground placeholder-muted-foreground/75 focus:outline-hidden"
            />
            {search ? (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 hover:text-foreground text-muted-foreground cursor-pointer transition-colors"
                title="Clear Search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <div className="absolute right-3 pointer-events-none select-none">
                <kbd className="font-mono text-[9px] bg-muted border border-border px-1 py-0.5 rounded text-muted-foreground/60">⌘K</kbd>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Conversation History List */}
      <div className="flex-1 overflow-y-auto px-2 space-y-3 py-1 custom-scrollbar">
        {isLoading ? (
          <div className="space-y-1.5 px-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <div
                key={n}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl bg-zinc-200/60 dark:bg-muted/20 animate-pulse ${
                  isCollapsed ? "justify-center" : ""
                }`}
              >
                <div className="w-4 h-4 bg-zinc-300 dark:bg-muted/40 rounded-md shrink-0"></div>
                {!isCollapsed && (
                  <div className="h-3.5 bg-zinc-300 dark:bg-muted/30 rounded-md w-3/4"></div>
                )}
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          !isCollapsed && (
            <div className="py-10 text-center text-xs text-muted-foreground italic px-4 border border-dashed border-zinc-300 dark:border-border/60 rounded-xl bg-zinc-100/80 dark:bg-muted/10 mx-2">
              <Search className="w-4 h-4 mx-auto mb-2 text-muted-foreground/40" />
              <p className="font-medium text-foreground/80">No results found</p>
              {search && <p className="text-[10px] mt-1 opacity-70">No chats match "{search}"</p>}
            </div>
          )
        ) : (
          <div className="space-y-4">
            {/* Pinned Section */}
            {pinnedConvs.length > 0 && !isCollapsed && (
              <div className="space-y-1">
                <div className="px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 flex items-center gap-1">
                  <Pin className="w-2.5 h-2.5 rotate-45" />
                  <span>Pinned</span>
                </div>
                {pinnedConvs.map((conv) => renderConversationItem(conv, true))}
              </div>
            )}

            {/* Recents Section */}
            <div className="space-y-1">
              {recentConvs.length > 0 && !isCollapsed && (
                <div className="px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">
                  <span>Recents</span>
                </div>
              )}
              {recentConvs.map((conv) => renderConversationItem(conv, false))}
            </div>
          </div>
        )}
      </div>

      {/* User Actions footer */}
      <div className="p-3 border-t border-border bg-zinc-50/70 dark:bg-muted/10 space-y-2">
        <div className={isCollapsed ? "flex justify-center" : "flex justify-end"}>
          <button
            onClick={onOpenSettings}
            className={`p-2 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-accent transition-colors shadow-xs cursor-pointer ${isCollapsed ? "" : "shrink-0"}`}
            title="Settings"
            aria-label="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

        {/* Row 2: User Profile block */}
        <div className="pt-2 border-t border-zinc-200/80 dark:border-border/40">
          {isCollapsed ? (
            <div className="flex justify-center">
              {user?.imageUrl ? (
                <img
                  src={user.imageUrl}
                  alt={user.fullName || "User"}
                  className="w-8 h-8 rounded-full border border-border bg-muted select-none"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-accent text-accent-foreground flex items-center justify-center font-bold text-xs select-none">
                  {user?.firstName?.slice(0, 1) || "U"}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between p-1">
              <div className="flex items-center gap-2.5 min-w-0">
                {user?.imageUrl ? (
                  <img
                    src={user.imageUrl}
                    alt={user.fullName || "User"}
                    className="w-8 h-8 rounded-full border border-border bg-muted shrink-0 select-none"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-accent text-accent-foreground flex items-center justify-center font-bold text-xs shrink-0 select-none">
                    {user?.firstName?.slice(0, 1) || "U"}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">
                    {user?.fullName || "User"}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate font-mono">
                    {user?.primaryEmailAddress?.emailAddress || ""}
                  </p>
                </div>
              </div>

              <SignOutButton>
                <button
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </SignOutButton>
            </div>
          )}
        </div>
      </div>

      {/* Redesigned Deletion Confirmation Dialog */}
      <AnimatePresence>
        {deletingId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeletingId(null)}
              className="absolute inset-0 bg-zinc-950/60 backdrop-blur-xs"
            />

            {/* Dialog Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", duration: 0.3 }}
              className="relative w-full max-w-sm bg-card text-foreground border border-border rounded-xl p-5 shadow-2xl z-50 flex flex-col gap-4"
              role="dialog"
              aria-modal="true"
            >
              <div className="flex items-start gap-3 text-left">
                <div className="p-2 rounded-lg bg-rose-500/10 text-rose-500 shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-foreground">Delete Conversation</h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Are you sure you want to delete this conversation? This action cannot be undone.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 mt-2">
                <button
                  onClick={() => setDeletingId(null)}
                  className="px-3 py-2 border border-border rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground text-xs font-semibold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (deletingId) {
                      onDelete(deletingId);
                      setDeletingId(null);
                    }
                  }}
                  className="px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer transition-colors"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </aside>
  );
}
