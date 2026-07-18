import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { useToast } from "../providers/toast-provider";

interface CodeBlockProps {
  language: string;
  code: string;
}

export function CodeBlock({ language, code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast({
        title: "Code Copied",
        description: "The code block was copied to your clipboard.",
        variant: "success",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy code", err);
      toast({
        title: "Copy Failed",
        description: "Could not write code to clipboard.",
        variant: "error",
      });
    }
  };

  const highlightCode = (codeText: string, lang: string) => {
    if (!codeText) return codeText;
    const cleanLang = lang.toLowerCase();

    const escapeHtml = (text: string) => {
      return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    };

    // SQL Highlighting
    if (cleanLang === "sql") {
      // Group 1: Comments (--...)
      // Group 2: Strings ('...' or "...")
      // Group 3: Keywords
      // Group 4: Types
      const tokenRegex = /(--.*)|('(?:''|[^'])*'|"(?:""|[^"])*")|(\b(?:SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|DATABASE|PRIMARY|KEY|FOREIGN|INDEX|JOIN|LEFT|RIGHT|INNER|ON|AND|OR|NOT|NULL|PRAGMA|CASCADE|ALTER|ADD|DROP|CONSTRAINT)\b)|(\b(?:VARCHAR|TEXT|INT|INTEGER|BIGINT|BOOLEAN|DATE|TIMESTAMP|CHAR|UUID|DECIMAL|NUMERIC|REAL|DOUBLE)\b)/gi;

      let lastIndex = 0;
      let html = "";

      codeText.replace(tokenRegex, (match, comment, string, keyword, type, offset) => {
        if (offset > lastIndex) {
          html += escapeHtml(codeText.slice(lastIndex, offset));
        }

        const escapedMatch = escapeHtml(match);
        if (comment) {
          html += `<span class="text-zinc-500 font-normal">${escapedMatch}</span>`;
        } else if (string) {
          html += `<span class="text-amber-500 font-medium">${escapedMatch}</span>`;
        } else if (keyword) {
          html += `<span class="text-indigo-400 font-semibold">${escapedMatch}</span>`;
        } else if (type) {
          html += `<span class="text-emerald-400 font-medium">${escapedMatch}</span>`;
        } else {
          html += escapedMatch;
        }

        lastIndex = offset + match.length;
        return match;
      });

      if (lastIndex < codeText.length) {
        html += escapeHtml(codeText.slice(lastIndex));
      }

      return <code dangerouslySetInnerHTML={{ __html: html }} />;
    }

    // JS / TS / JSX / TSX / JSON Highlighting
    if (
      ["js", "ts", "jsx", "tsx", "javascript", "typescript", "json"].includes(
        cleanLang
      )
    ) {
      // Group 1: Comments (//... or /*...*/)
      // Group 2: Strings ("..." or '...' or `...`)
      // Group 3: Keywords
      // Group 4: Numbers
      const tokenRegex = /(\/\/.*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\b(?:import|export|default|from|const|let|var|function|return|async|await|try|catch|finally|throw|new|if|else|for|while|do|switch|case|break|continue|class|interface|type|extends|implements|keyof|readonly|as|any|string|number|boolean|void|unknown|never|null|undefined|true|false)\b)|(\b\d+\b)/g;

      let lastIndex = 0;
      let html = "";

      codeText.replace(tokenRegex, (match, comment, string, keyword, number, offset) => {
        if (offset > lastIndex) {
          html += escapeHtml(codeText.slice(lastIndex, offset));
        }

        const escapedMatch = escapeHtml(match);
        if (comment) {
          html += `<span class="text-zinc-500 font-normal">${escapedMatch}</span>`;
        } else if (string) {
          html += `<span class="text-amber-500 font-medium">${escapedMatch}</span>`;
        } else if (keyword) {
          html += `<span class="text-indigo-400 font-semibold">${escapedMatch}</span>`;
        } else if (number) {
          html += `<span class="text-cyan-400 font-medium">${escapedMatch}</span>`;
        } else {
          html += escapedMatch;
        }

        lastIndex = offset + match.length;
        return match;
      });

      if (lastIndex < codeText.length) {
        html += escapeHtml(codeText.slice(lastIndex));
      }

      return <code dangerouslySetInnerHTML={{ __html: html }} />;
    }

    // Fallback standard text
    return <code>{codeText}</code>;
  };

  return (
    <div className="my-4 rounded-xl border border-zinc-800/80 overflow-hidden bg-zinc-950 text-zinc-50 shadow-md">
      {/* Code Header Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900/60 select-none">
        <span className="text-[10px] font-mono font-bold tracking-wider text-zinc-400 uppercase">
          {language}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
          title="Copy code to clipboard"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-emerald-500 font-semibold">COPIED</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>COPY</span>
            </>
          )}
        </button>
      </div>

      {/* Code Body */}
      <div className="p-4 overflow-x-auto max-w-full font-mono text-[12px] leading-relaxed custom-scrollbar selection:bg-zinc-800">
        <pre className="whitespace-pre">{highlightCode(code, language)}</pre>
      </div>
    </div>
  );
}
