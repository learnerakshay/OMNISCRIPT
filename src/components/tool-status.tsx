import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Search, 
  Globe, 
  Link as LinkIcon, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  ChevronDown, 
  ChevronUp, 
  ExternalLink,
  Loader2
} from "lucide-react";

interface ToolStatusProps {
  name: string;
  status: "searching" | "reading_url" | "processing" | "completed" | "failed";
  query?: string;
  url?: string;
  citations?: Array<{ title: string; url: string; snippet?: string }>;
  error?: string;
}

export function formatCalculatorExpression(expression: string): string {
  return expression.split("").map((character) => {
    if (character === "*") return "\u00d7";
    if (character === "/") return "\u00f7";
    return character;
  }).join("");
}

export function ToolStatusIndicator({ name, status, query, url, citations = [], error }: ToolStatusProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const isCalculator = name === "calculator";
  const isDateTime = name === "currentDateTime";
  const label = isCalculator ? "Calculator" : isDateTime ? "Current date & time" : "Tool";
  const displayTarget = isCalculator ? formatCalculatorExpression(query || "") : url;

  // Render active streaming states (not completed yet)
  if (status === "searching" || status === "reading_url" || status === "processing") {
    return (
      <div className="flex items-center gap-3 px-3 py-2 bg-muted/30 border border-border/40 rounded-xl max-w-fit text-xs text-muted-foreground select-none">
        <div className="relative flex items-center justify-center">
          <Loader2 className="w-4 h-4 text-zinc-500 animate-spin" />
        </div>
        <div className="space-y-0.5">
          <p className="font-medium text-foreground flex items-center gap-1.5">
            {isCalculator ? <Search className="w-3.5 h-3.5 text-zinc-500" /> : <LinkIcon className="w-3.5 h-3.5 text-zinc-500" />}
            {status === "searching" && `Running ${label.toLowerCase()}...`}
            {status === "reading_url" && `Preparing ${label.toLowerCase()}...`}
            {status === "processing" && "Preparing response..."}
          </p>
          <p className="text-[10px] font-mono text-muted-foreground max-w-sm truncate">
            {displayTarget}
          </p>
        </div>
      </div>
    );
  }

  // Render failed states
  if (status === "failed") {
    return (
      <div className="flex items-start gap-3 p-3 bg-red-500/5 border border-red-500/10 rounded-xl text-xs max-w-md">
        <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-red-500 flex items-center gap-1.5">
            {label} Failed
          </p>
          <p className="text-muted-foreground leading-relaxed text-[11px]">
            {error || `An unexpected error occurred during execution.`}
          </p>
        </div>
      </div>
    );
  }

  // Deterministic internal tools are results, not sources. Never route them
  // through the generic citation/document renderer.
  if (isCalculator || isDateTime) {
    return (
      <div className="max-w-fit rounded-xl border border-border/60 bg-muted/15 px-3 py-2 text-xs select-none">
        <div className="flex items-center gap-2 text-foreground/90">
          <CheckCircle2 className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
          <span className="font-medium">{label}</span>
        </div>
        {displayTarget && (
          <p className="mt-1 pl-5.5 font-mono text-[10.5px] text-muted-foreground break-words">
            {displayTarget}
          </p>
        )}
      </div>
    );
  }

  // Render completed states (expandable pill)
  const hasDetails = citations && citations.length > 0;

  return (
    <div className="space-y-2 max-w-full">
      <div 
        onClick={() => hasDetails && setIsExpanded(!isExpanded)}
        className={`flex items-center justify-between gap-4 px-3.5 py-1.5 border border-border/60 rounded-xl text-xs text-muted-foreground select-none transition-all duration-200 ${
          hasDetails 
            ? "bg-muted/20 hover:bg-muted/35 cursor-pointer hover:border-border/80" 
            : "bg-muted/10 cursor-default"
        }`}
      >
        <div className="flex items-center gap-2 truncate">
          <CheckCircle2 className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
          <span className="font-medium text-foreground/90 shrink-0">
            {label}
          </span>
          <span className="font-mono text-[10.5px] truncate max-w-[280px] text-muted-foreground">
            {displayTarget}
          </span>
        </div>

        {hasDetails && (
          <div className="flex items-center gap-1.5 shrink-0 text-[10px] font-mono">
            <span className="bg-muted-foreground/10 px-1.5 py-0.5 rounded-sm text-foreground/80">
              {citations.length} {citations.length === 1 ? "source" : "sources"}
            </span>
            {isExpanded ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
          </div>
        )}
      </div>

      {/* Expandable Details Tray */}
      <AnimatePresence initial={false}>
        {isExpanded && hasDetails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pb-1.5 pt-0.5">
              {citations.map((cit, idx) => (
                <div 
                  key={idx}
                  className="p-2.5 bg-muted/15 border border-border/40 rounded-xl hover:border-border/70 transition-colors flex flex-col justify-between gap-1.5 group/card"
                >
                  <div className="space-y-1">
                    <a 
                      href={cit.url} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="font-semibold text-[11px] text-foreground hover:text-indigo-500 dark:hover:text-indigo-400 flex items-center gap-1 group/link line-clamp-1 transition-colors"
                    >
                      {cit.title || "Untitled Document"}
                      <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover/link:opacity-100 group-hover/card:opacity-60 transition-all shrink-0" />
                    </a>
                    {cit.snippet && (
                      <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2">
                        {cit.snippet}
                      </p>
                    )}
                  </div>
                  <div className="truncate font-mono text-[9px] text-muted-foreground/60">
                    {cit.url}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ----------------------------------------------------------------------------
// STATIC CITATION DISPLAY FOOTER Component
// ----------------------------------------------------------------------------
interface CitationsProps {
  citations: Array<{ title: string; url: string }>;
}

export function CitationFooter({ citations }: CitationsProps) {
  if (!citations || citations.length === 0) return null;

  return (
    <div className="mt-4 pt-3.5 border-t border-border/30 space-y-2">
      <p className="text-[10px] font-mono font-bold tracking-wider text-muted-foreground uppercase">
        Verified References
      </p>
      <div className="flex flex-wrap gap-1.5">
        {citations.map((cit, idx) => (
          <a
            key={idx}
            href={cit.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-2 py-1 bg-muted/20 border border-border/40 rounded-lg text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all max-w-[200px]"
            title={cit.title || cit.url}
          >
            <Globe className="w-2.5 h-2.5 text-zinc-500 shrink-0" />
            <span className="truncate">{cit.title || "Source"}</span>
            <span className="font-mono text-[8.5px] text-muted-foreground/60">[{idx + 1}]</span>
          </a>
        ))}
      </div>
    </div>
  );
}
