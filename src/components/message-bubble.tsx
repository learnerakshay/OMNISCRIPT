import { Message } from "@prisma/client";
import { useUser } from "@clerk/clerk-react";
import { Sparkles, Trash2, Copy, Check } from "lucide-react";
import { useState } from "react";
import { motion } from "motion/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "./code-block";
import { useAccent } from "../providers/accent-provider";
import { ThinkingSkeleton } from "./thinking-skeleton";
import { useUserSettings } from "../providers/settings-provider";
import { ToolStatusIndicator, CitationFooter } from "./tool-status";

interface MessageBubbleProps {
  message: Message;
  onDelete: (id: string) => void;
  isDeleting: boolean;
  isStreaming?: boolean;
  streamingToolCall?: {
    name: string;
    status: "searching" | "reading_url" | "processing" | "completed" | "failed";
    query?: string;
    url?: string;
  } | null;
  streamingCitations?: Array<{ title: string; url: string; snippet?: string }> | null;
}

export function MessageBubble({ 
  message, 
  onDelete, 
  isDeleting, 
  isStreaming,
  streamingToolCall,
  streamingCitations
}: MessageBubbleProps) {
  const { user } = useUser();
  const { classes } = useAccent();
  const { settings } = useUserSettings();
  const [copied, setCopied] = useState(false);

  const isUser = message.role === "USER";

  // Check if message is a JSON-serialized OMNISCRIPT metadata structure
  let isOmniscriptJSON = false;
  let parsedData: any = null;
  if (!isUser && message.content && message.content.startsWith('{"omniscript":true')) {
    try {
      parsedData = JSON.parse(message.content);
      isOmniscriptJSON = true;
    } catch (e) {
      console.warn("Stale or unparseable assistant message content", e);
    }
  }

  const displayText = isOmniscriptJSON ? (parsedData.text || "") : message.content;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(displayText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text", err);
    }
  };

  const activeToolCall = isStreaming ? streamingToolCall : (isOmniscriptJSON ? parsedData.toolCall : null);
  const activeCitations = isStreaming ? streamingCitations : (isOmniscriptJSON ? parsedData.citations : null);

  return (
    <motion.div
      initial={settings.reduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={settings.reduceMotion ? { opacity: 1 } : { opacity: 0, y: -10 }}
      transition={settings.reduceMotion ? { duration: 0 } : { duration: 0.25, ease: "easeOut" }}
      className={`group flex items-start gap-2 sm:gap-3 w-full max-w-3xl ${
        isUser ? "ml-auto flex-row-reverse" : "mr-auto"
      }`}
    >
      {/* Avatar Container */}
      <div className="shrink-0">
        {isUser ? (
          user?.imageUrl ? (
            <img
              src={user.imageUrl}
              alt={user.fullName || "User Avatar"}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-border bg-muted select-none"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-zinc-900 text-white dark:bg-zinc-200 dark:text-zinc-900 flex items-center justify-center font-bold text-xs select-none">
              {user?.firstName?.slice(0, 1) || "U"}
            </div>
          )
        ) : (
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-linear-to-tr from-zinc-900 to-zinc-700 dark:from-white dark:to-zinc-200 text-white dark:text-zinc-900 flex items-center justify-center shadow-xs select-none">
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
        )}
      </div>

      {/* Message Bubble Body */}
      <div className={`space-y-1 flex flex-col ${
        isUser 
          ? "max-w-[78%] sm:max-w-[85%] items-end" 
          : "max-w-[92%] sm:max-w-[95%] flex-1 min-w-0"
      }`}>
        {/* Timestamp / Meta info */}
        <div className={`flex items-center gap-2 text-[10px] text-muted-foreground ${isUser ? "justify-end" : "justify-start"}`}>
          <span className="font-semibold text-foreground/80">
            {isUser ? user?.fullName || "You" : "OMNISCRIPT"}
          </span>
          {settings.showTimestamps && (
            <>
              <span>•</span>
              <span className="font-mono">{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </>
          )}
        </div>

        {/* Content Container */}
        <div
          className={`relative p-4 rounded-2xl text-sm leading-relaxed border transition-all ${
            isUser
              ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 border-zinc-800 dark:border-zinc-200 rounded-tr-none shadow-xs text-left"
              : "bg-zinc-100/50 dark:bg-muted/40 text-foreground border-zinc-200/80 dark:border-border rounded-tl-none hover:bg-zinc-100/80 dark:hover:bg-muted/50 w-full min-w-0"
          }`}
        >
          {isStreaming && !displayText && !activeToolCall ? (
            <ThinkingSkeleton />
          ) : (
            <div className="space-y-3.5">
              {/* If we have an active or persistent tool call, display its status indicator */}
              {activeToolCall && (
                <div className="mb-2">
                  <ToolStatusIndicator 
                    name={activeToolCall.name}
                    status={activeToolCall.status}
                    query={activeToolCall.query}
                    url={activeToolCall.url}
                    citations={activeCitations || []}
                    error={activeToolCall.error}
                  />
                </div>
              )}

              {/* Render the core message markdown text */}
              {displayText && (
                <div className="markdown-body select-text break-words prose prose-zinc dark:prose-invert max-w-none text-xs leading-relaxed selection:bg-zinc-500/20">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      code({ className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || "");
                        const isInline = !match || !String(children).includes("\n");

                        if (isInline) {
                          return (
                            <code
                              className={`${
                                isUser
                                  ? "bg-zinc-800 text-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                                  : "bg-zinc-100/80 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200"
                              } px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold`}
                              {...props}
                            >
                              {children}
                            </code>
                          );
                        }

                        return (
                          <CodeBlock
                            language={match ? match[1] : "text"}
                            code={String(children).replace(/\n$/, "")}
                          />
                        );
                      },
                      p({ children }) {
                        return (
                          <p className={`mb-4 last:mb-0 leading-relaxed ${
                            isUser ? "text-inherit" : "text-zinc-950 dark:text-zinc-50"
                          }`}>
                            {children}
                          </p>
                        );
                      },
                      ul({ children }) {
                        return (
                          <ul className={`list-disc list-inside ml-4 space-y-1.5 my-4 ${
                            isUser ? "text-inherit" : "text-zinc-900 dark:text-zinc-100"
                          }`}>
                            {children}
                          </ul>
                        );
                      },
                      ol({ children }) {
                        return (
                          <ol className={`list-decimal list-inside ml-4 space-y-1.5 my-4 ${
                            isUser ? "text-inherit" : "text-zinc-900 dark:text-zinc-100"
                          }`}>
                            {children}
                          </ol>
                        );
                      },
                      li({ children }) {
                        return <li className="my-1 leading-relaxed">{children}</li>;
                      },
                      h1({ children }) {
                        return (
                          <h1 className={`text-sm font-bold mt-5 mb-2.5 first:mt-0 uppercase tracking-wider ${
                            isUser ? "text-white dark:text-zinc-950" : "text-foreground"
                          }`}>
                            {children}
                          </h1>
                        );
                      },
                      h2({ children }) {
                        return (
                          <h2 className={`text-xs font-semibold mt-4 mb-2 first:mt-0 uppercase tracking-wide ${
                            isUser ? "text-white dark:text-zinc-950" : "text-foreground"
                          }`}>
                            {children}
                          </h2>
                        );
                      },
                      h3({ children }) {
                        return (
                          <h3 className={`text-[11px] font-semibold mt-3 mb-1.5 first:mt-0 uppercase tracking-normal ${
                            isUser ? "text-white dark:text-zinc-950" : "text-foreground"
                          }`}>
                            {children}
                          </h3>
                        );
                      },
                      blockquote({ children }) {
                        return (
                          <blockquote className={`border-l-2 pl-3 italic my-3 ${
                            isUser 
                              ? "border-zinc-700 dark:border-zinc-300 text-zinc-200 dark:text-zinc-700" 
                              : "border-border/80 text-zinc-600 dark:text-zinc-400"
                          }`}>
                            {children}
                          </blockquote>
                        );
                      },
                      a({ children, href }) {
                        return (
                          <a
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            className={`transition-colors underline ${
                              isUser 
                                ? "text-emerald-200 dark:text-emerald-700 hover:text-white dark:hover:text-emerald-900" 
                                : "text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300"
                            }`}
                          >
                            {children}
                          </a>
                        );
                      },
                      hr() {
                        return <hr className={`my-4 ${isUser ? "border-zinc-700 dark:border-zinc-200" : "border-t border-border/60"}`} />;
                      },
                      img({ src, alt }) {
                        return (
                          <img
                            src={src}
                            alt={alt}
                            className="max-w-full h-auto rounded-lg shadow-xs my-4 border border-border/45 select-none"
                            referrerPolicy="no-referrer"
                          />
                        );
                      },
                      table({ children }) {
                        return (
                          <div className="overflow-x-auto my-4 max-w-full rounded-lg border border-border">
                            <table className="w-full border-collapse text-[11px] text-left">{children}</table>
                          </div>
                        );
                      },
                      thead({ children }) {
                        return <thead className="bg-muted/40 font-semibold border-b border-border">{children}</thead>;
                      },
                      tbody({ children }) {
                        return <tbody className="divide-y divide-border/60">{children}</tbody>;
                      },
                      tr({ children }) {
                        return <tr className="hover:bg-muted/20 transition-colors">{children}</tr>;
                      },
                      th({ children }) {
                        return <th className="px-3 py-2 border-r last:border-r-0 border-border font-bold">{children}</th>;
                      },
                      td({ children }) {
                        return <td className="px-3 py-2 border-r last:border-r-0 border-border">{children}</td>;
                      },
                    }}
                  >
                    {displayText}
                  </ReactMarkdown>

                  {isStreaming && (
                    <span className="inline-block w-1.5 h-3.5 ml-1 bg-zinc-700 dark:bg-zinc-300 animate-pulse align-middle" />
                  )}
                </div>
              )}

              {/* If we have completed persistent citations, show the Verified References footer */}
              {!isStreaming && isOmniscriptJSON && parsedData.citations && parsedData.citations.length > 0 && (
                <CitationFooter citations={parsedData.citations} />
              )}
            </div>
          )}

          {/* Action Overlay: copy & delete */}
          <div
            className="absolute bottom-full right-0 mb-1.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 flex items-center gap-1 bg-popover border border-border p-1 rounded-lg shadow-sm z-10 transition-all duration-200 pointer-events-none group-hover:pointer-events-auto group-focus-within:pointer-events-auto transform translate-y-1 group-hover:translate-y-0 group-focus-within:translate-y-0"
          >
            <button
              onClick={handleCopy}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
              title="Copy message"
              aria-label="Copy message"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => onDelete(message.id)}
              disabled={isDeleting}
              className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/15 transition-colors cursor-pointer"
              title="Delete message"
              aria-label="Delete message"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
