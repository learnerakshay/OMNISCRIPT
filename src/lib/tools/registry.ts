import { FunctionDeclaration, Type } from "@google/genai";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

// Interface for standard tools in our registry
export interface ToolDefinition {
  declaration: FunctionDeclaration;
  execute: (args: any, signal?: AbortSignal) => Promise<any>;
}

const FETCH_TIMEOUT_MS = 12_000;
const MAX_RESPONSE_BYTES = 1_000_000;
const MAX_REDIRECTS = 5;

function logToolFailure(tool: string, error: unknown) {
  const errorName = error instanceof Error ? error.name : "UnknownError";
  console.error(JSON.stringify({ event: "tool_execution_failed", tool, errorName }));
}

function isPrivateAddress(address: string): boolean {
  const normalized = address.toLowerCase();
  const mappedIpv4 = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);

  if (mappedIpv4) {
    return isPrivateAddress(mappedIpv4[1]);
  }

  if (isIP(normalized) === 4) {
    const octets = normalized.split(".").map(Number);
    const [first, second] = octets;

    return first === 0 ||
      first === 10 ||
      first === 127 ||
      first >= 224 ||
      (first === 100 && second >= 64 && second <= 127) ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && (second === 0 || second === 168)) ||
      (first === 198 && (second === 18 || second === 19));
  }

  if (isIP(normalized) === 6) {
    return normalized === "::" ||
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe80:");
  }

  return true;
}

async function validatePublicUrl(rawUrl: string): Promise<URL> {
  const url = new URL(rawUrl);

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error("Only HTTP and HTTPS URLs are allowed.");
  }

  if (url.username || url.password) {
    throw new Error("URLs with embedded credentials are not allowed.");
  }

  if ((url.protocol === "http:" && url.port && url.port !== "80") ||
      (url.protocol === "https:" && url.port && url.port !== "443")) {
    throw new Error("Only standard HTTP and HTTPS ports are allowed.");
  }

  if (url.hostname.toLowerCase() === "localhost") {
    throw new Error("Local network URLs are not allowed.");
  }

  const addresses = isIP(url.hostname)
    ? [{ address: url.hostname }]
    : await lookup(url.hostname, { all: true, verbatim: true });

  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error("The requested URL does not resolve to a public address.");
  }

  return url;
}

async function readPublicResponse(
  rawUrl: string,
  headers: HeadersInit,
  signal?: AbortSignal
): Promise<{ url: string; body: string }> {
  const timeoutController = new AbortController();
  const timeout = setTimeout(() => timeoutController.abort(), FETCH_TIMEOUT_MS);
  const abortFromCaller = () => timeoutController.abort();
  signal?.addEventListener("abort", abortFromCaller, { once: true });

  try {
    let currentUrl = rawUrl;

    for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
      const validatedUrl = await validatePublicUrl(currentUrl);
      const response = await fetch(validatedUrl, {
        headers,
        redirect: "manual",
        signal: timeoutController.signal,
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) {
          throw new Error("The URL redirected without a destination.");
        }
        currentUrl = new URL(location, validatedUrl).toString();
        continue;
      }

      if (!response.ok) {
        throw new Error(`Request returned HTTP ${response.status}.`);
      }

      const contentLength = Number(response.headers.get("content-length"));
      if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
        throw new Error("The URL response exceeds the allowed size.");
      }

      if (!response.body) {
        return { url: validatedUrl.toString(), body: "" };
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let bytesRead = 0;
      let body = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        bytesRead += value.byteLength;
        if (bytesRead > MAX_RESPONSE_BYTES) {
          await reader.cancel();
          throw new Error("The URL response exceeds the allowed size.");
        }

        body += decoder.decode(value, { stream: true });
      }

      body += decoder.decode();
      return { url: validatedUrl.toString(), body };
    }

    throw new Error("The URL exceeded the allowed number of redirects.");
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abortFromCaller);
  }
}

// ----------------------------------------------------------------------------
// Tool 1: Web Search
// ----------------------------------------------------------------------------
export const webSearchTool: ToolDefinition = {
  declaration: {
    name: "webSearch",
    description: "Search the web for real-time information, current events, latest news, and public information.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: "The search query (e.g. 'SpaceX launch schedule', 'latest news about React 19')",
        },
      },
      required: ["query"],
    },
  },
  execute: async ({ query }: { query: string }, signal?: AbortSignal) => {
    try {
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const { body: html } = await readPublicResponse(url, {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      }, signal);
      const results: Array<{ title: string; url: string; snippet: string }> = [];

      // Parse DuckDuckGo html results safely using string splitting and regexes
      const resultBlocks = html.split(/class="[^"]*web-result/g);
      for (let i = 1; i < resultBlocks.length; i++) {
        if (results.length >= 6) break;
        const block = resultBlocks[i];

        // Match the title link
        const linkMatch = block.match(/<a\s+class="result__a"\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
        if (!linkMatch) continue;

        let rawUrl = linkMatch[1];
        let finalUrl = rawUrl;
        
        // Resolve redirect uddg URLs to direct URLs
        if (rawUrl.includes("uddg=")) {
          const uddgMatch = rawUrl.match(/uddg=([^&]+)/);
          if (uddgMatch) {
            finalUrl = decodeURIComponent(uddgMatch[1]);
          }
        }

        const title = linkMatch[2].replace(/<\/?[^>]+(>|$)/g, "").trim();

        // Match snippet description
        const snippetMatch = block.match(/<a\s+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i) || 
                             block.match(/<div\s+class="result__snippet"[^>]*>([\s\S]*?)<\/div>/i);
        const snippet = snippetMatch ? snippetMatch[1].replace(/<\/?[^>]+(>|$)/g, "").trim() : "";

        if (title && finalUrl) {
          results.push({
            title,
            url: finalUrl,
            snippet: snippet || "No description available."
          });
        }
      }

      // Backup regex scraper if class names changed or are different
      if (results.length === 0) {
        const genericRegex = /<a\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>([\s\S]*?)(?:<br>|$)/gi;
        let match;
        while ((match = genericRegex.exec(html)) !== null && results.length < 5) {
          const href = match[1];
          if (href.startsWith("http") && !href.includes("duckduckgo")) {
            const title = match[2].replace(/<\/?[^>]+(>|$)/g, "").trim();
            const snippet = match[3].replace(/<\/?[^>]+(>|$)/g, "").trim();
            if (title && href) {
              results.push({ title, url: href, snippet });
            }
          }
        }
      }

      return {
        success: true,
        query,
        results: results.slice(0, 6)
      };
    } catch (error: any) {
      logToolFailure("webSearch", error);
      return {
        success: false,
        error: error.message || "Failed to search the web"
      };
    }
  },
};

// ----------------------------------------------------------------------------
// Tool 2: URL Reader
// ----------------------------------------------------------------------------
export const urlReaderTool: ToolDefinition = {
  declaration: {
    name: "readUrl",
    description: "Fetch and read the raw text contents of any given web page/URL to explain, summarize, or extract detailed information.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        url: {
          type: Type.STRING,
          description: "The absolute web page URL (e.g. 'https://nextjs.org/blog/next-15')",
        },
      },
      required: ["url"],
    },
  },
  execute: async ({ url }: { url: string }, signal?: AbortSignal) => {
    try {
      const { url: resolvedUrl, body: html } = await readPublicResponse(url, {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }, signal);

      // Extrapolate page title
      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : "";

      // Sanitize markup and isolate readable document body
      let cleanText = html
        .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, "")
        .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, "")
        .replace(/<head[^>]*>([\s\S]*?)<\/head>/gi, "")
        .replace(/<svg[^>]*>([\s\S]*?)<\/svg>/gi, "")
        .replace(/<nav[^>]*>([\s\S]*?)<\/nav>/gi, "")
        .replace(/<footer[^>]*>([\s\S]*?)<\/footer>/gi, "")
        .replace(/<header[^>]*>([\s\S]*?)<\/header>/gi, "");

      cleanText = cleanText.replace(/<\/?[^>]+(>|$)/g, " ");
      cleanText = cleanText
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");

      cleanText = cleanText.replace(/\s+/g, " ").trim();

      // Guard model context limitations by truncating extremely long documents
      const maxLength = 15000;
      const content = cleanText.length > maxLength 
        ? cleanText.slice(0, maxLength) + " ... [Content truncated to prevent context overflow]" 
        : cleanText;

      return {
        success: true,
        url: resolvedUrl,
        title,
        content
      };
    } catch (error: any) {
      logToolFailure("readUrl", error);
      return {
        success: false,
        error: error.message || "Failed to parse and read the URL"
      };
    }
  },
};

// ----------------------------------------------------------------------------
// TOOL REGISTRY CENTRAL COMPILER & ROUTER
// ----------------------------------------------------------------------------
const registry: Record<string, ToolDefinition> = {
  [webSearchTool.declaration.name]: webSearchTool,
  [urlReaderTool.declaration.name]: urlReaderTool,
};

/**
 * Returns all registered FunctionDeclarations for Gemini configuration
 */
export function getRegisteredTools() {
  return Object.values(registry).map(tool => tool.declaration);
}

/**
 * Dispatches and executes a tool from the registry with standard inputs
 */
export async function executeTool(name: string, args: any, signal?: AbortSignal): Promise<any> {
  const tool = registry[name];
  if (!tool) {
    throw new Error(`Tool "${name}" is not registered in the OMNISCRIPT Tool Registry.`);
  }
  return await tool.execute(args, signal);
}
