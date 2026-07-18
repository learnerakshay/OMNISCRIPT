import express, { Request, Response, NextFunction } from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { verifyToken } from "@clerk/backend";
import { generateText, streamText } from "ai";
import { z } from "zod";
import { getOpenAIModel, handleAIError } from "./src/lib/ai";
import { 
  serverCreateConversation,
  serverGetConversation,
  serverGetUserConversations,
  serverUpdateConversationTitle,
  serverDeleteConversation,
  serverCreateMessage,
  serverGetConversationMessages,
  serverDeleteMessage,
  serverGetConversationBranches,
  serverCreateBranch,
  serverSetActiveBranch,
  serverDeleteBranch,
  ValidationError
} from "./src/actions/chat-actions";
import { executeTool } from "./src/lib/tools/registry";

// Vite loads .env.local for the browser, but the Express process is started by tsx.
// Load local server configuration without overriding platform-injected environment variables.
dotenv.config({
  path: [
    path.resolve(process.cwd(), ".env.local"),
    path.resolve(process.cwd(), ".env"),
  ],
});

// Extend Request interface to include Clerk authenticated user info
interface AuthenticatedRequest extends Request {
  auth?: {
    userId: string;
  };
}

const app = express();
const PORT = 3000;

// Centralized JSON body parser
app.use(express.json());

const STREAM_WINDOW_MS = 60_000;
const MAX_STREAM_REQUESTS_PER_WINDOW = 12;
const MAX_CONCURRENT_STREAMS_PER_USER = 2;
const AI_STREAM_TIMEOUT_MS = 90_000;

interface StreamUsage {
  requests: number[];
  active: number;
}

const streamUsageByUser = new Map<string, StreamUsage>();

function acquireStreamSlot(userId: string): (() => void) | null {
  const now = Date.now();
  const usage = streamUsageByUser.get(userId) ?? { requests: [], active: 0 };
  usage.requests = usage.requests.filter((timestamp) => now - timestamp < STREAM_WINDOW_MS);

  if (usage.requests.length >= MAX_STREAM_REQUESTS_PER_WINDOW || usage.active >= MAX_CONCURRENT_STREAMS_PER_USER) {
    streamUsageByUser.set(userId, usage);
    return null;
  }

  usage.requests.push(now);
  usage.active += 1;
  streamUsageByUser.set(userId, usage);

  return () => {
    const current = streamUsageByUser.get(userId);
    if (!current) return;

    current.active = Math.max(0, current.active - 1);
    current.requests = current.requests.filter((timestamp) => Date.now() - timestamp < STREAM_WINDOW_MS);
    if (current.active === 0 && current.requests.length === 0) {
      streamUsageByUser.delete(userId);
    } else {
      streamUsageByUser.set(userId, current);
    }
  };
}

function writeSse(res: Response, payload: unknown) {
  if (!res.writableEnded && !res.destroyed) {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  }
}

function endSse(res: Response) {
  if (!res.writableEnded && !res.destroyed) {
    res.write("data: [DONE]\n\n");
  }
  if (!res.writableEnded && !res.destroyed) {
    res.end();
  }
}

function logStreamEvent(event: string, details: Record<string, string | number | boolean | undefined>) {
  console.error(JSON.stringify({ event, ...details }));
}

const webSearchParameters = z.object({
  query: z.string().trim().min(1).max(500),
});

const readUrlParameters = z.object({
  url: z.string().trim().url().max(2_048),
});

/**
 * Clerk Authorization Middleware
 * Resolves user session from the Authorization header (Bearer token).
 * Fails safely with meaningful error logs without exposing internal credentials.
 */
async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    res.status(503).json({ 
      error: "Authentication service is not configured. Please set CLERK_SECRET_KEY in the Secrets panel." 
    });
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized. Access token is required." });
    return;
  }

  const token = authHeader.split(" ")[1];
  try {
    const verified = await verifyToken(token, { secretKey });
    
    if (!verified || !verified.sub) {
      res.status(401).json({ error: "Unauthorized. Invalid session subject." });
      return;
    }

    req.auth = { userId: verified.sub };
    next();
  } catch (error) {
    console.error("Clerk session validation failed:", error);
    res.status(401).json({ error: "Unauthorized. Token verification failed." });
  }
}

/**
 * Error boundary helper mapping internal validation, database ownership,
 * and standard server errors into structured JSON payloads.
 */
function handleServerError(error: any, res: Response) {
  console.error("Server execution error:", error);

  if (error instanceof ValidationError) {
    res.status(400).json({ error: error.message });
    return;
  }

  const errorName = error?.name || "";
  const errorMessage = error?.message || "";

  if (errorName === "NotFoundError" || errorMessage.includes("not found")) {
    res.status(404).json({ error: errorMessage || "Resource not found." });
    return;
  }

  if (errorName === "UnauthorizedError" || errorMessage.includes("authorized")) {
    res.status(403).json({ error: errorMessage || "Forbidden. You do not own this resource." });
    return;
  }

  if (errorName === "ConflictError") {
    res.status(409).json({ error: errorMessage || "The branch state changed. Please refresh and try again." });
    return;
  }

  res.status(500).json({ error: "An internal server error occurred." });
}

// ============================================================================
// API ROUTES (Processed before Vite middleware)
// ============================================================================

// Health check endpoint
app.get("/api/health", (req: Request, res: Response) => {
  res.json({ status: "ok", service: "OMNISCRIPT-Backend" });
});

// Conversation Operations
app.post("/api/conversations", requireAuth as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await serverCreateConversation(req.auth!.userId, req.body);
    res.status(201).json(result);
  } catch (error) {
    handleServerError(error, res);
  }
});

app.get("/api/conversations", requireAuth as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await serverGetUserConversations(req.auth!.userId);
    res.json(result);
  } catch (error) {
    handleServerError(error, res);
  }
});

app.get("/api/conversations/:id", requireAuth as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await serverGetConversation(req.auth!.userId, req.params.id);
    res.json(result);
  } catch (error) {
    handleServerError(error, res);
  }
});

app.patch("/api/conversations/:id", requireAuth as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await serverUpdateConversationTitle(req.auth!.userId, req.params.id, req.body.title);
    res.json(result);
  } catch (error) {
    handleServerError(error, res);
  }
});

app.delete("/api/conversations/:id", requireAuth as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await serverDeleteConversation(req.auth!.userId, req.params.id);
    res.json(result);
  } catch (error) {
    handleServerError(error, res);
  }
});

// Message Operations
app.post("/api/conversations/:id/messages", requireAuth as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await serverCreateMessage(req.auth!.userId, req.params.id, req.body);
    res.status(201).json(result);
  } catch (error) {
    handleServerError(error, res);
  }
});

app.get("/api/conversations/:id/messages", requireAuth as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const branchId = typeof req.query.branchId === "string" ? req.query.branchId : undefined;
    const result = await serverGetConversationMessages(req.auth!.userId, req.params.id, branchId);
    res.json(result);
  } catch (error) {
    handleServerError(error, res);
  }
});

// Branch Operations
app.get("/api/conversations/:id/branches", requireAuth as any, async (req: AuthenticatedRequest, res: Response) => {
  try { res.json(await serverGetConversationBranches(req.auth!.userId, req.params.id)); } catch (error) { handleServerError(error, res); }
});

app.post("/api/conversations/:id/branches", requireAuth as any, async (req: AuthenticatedRequest, res: Response) => {
  try { res.status(201).json(await serverCreateBranch(req.auth!.userId, req.params.id, req.body.forkMessageId)); } catch (error) { handleServerError(error, res); }
});

app.patch("/api/conversations/:id/active-branch", requireAuth as any, async (req: AuthenticatedRequest, res: Response) => {
  try { res.json(await serverSetActiveBranch(req.auth!.userId, req.params.id, req.body.branchId)); } catch (error) { handleServerError(error, res); }
});

app.delete("/api/conversations/:id/branches/:branchId", requireAuth as any, async (req: AuthenticatedRequest, res: Response) => {
  try { res.json(await serverDeleteBranch(req.auth!.userId, req.params.id, req.params.branchId)); } catch (error) { handleServerError(error, res); }
});

app.delete("/api/messages/:id", requireAuth as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await serverDeleteMessage(req.auth!.userId, req.params.id);
    res.json(result);
  } catch (error) {
    handleServerError(error, res);
  }
});

// AI Chat Streaming Operation
app.post("/api/conversations/:id/stream", requireAuth as any, async (req: AuthenticatedRequest, res: Response) => {
  let releaseStreamSlot: (() => void) | undefined;
  let abortController: AbortController | undefined;
  let onResponseClose: (() => void) | undefined;
  let streamTimeout: ReturnType<typeof setTimeout> | undefined;

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      res.status(400).json({ 
        error: "OPENAI_API_KEY is missing. Please configure it in your Settings > Secrets panel." 
      });
      return;
    }

    const conversationId = req.params.id;
    const userId = req.auth!.userId;
    const requestedBranchId = typeof req.body?.branchId === "string" ? req.body.branchId : undefined;

    releaseStreamSlot = acquireStreamSlot(userId) ?? undefined;
    if (!releaseStreamSlot) {
      res.status(429).json({ error: "Too many active or recent AI requests. Please wait a moment and try again." });
      return;
    }

    abortController = new AbortController();
    streamTimeout = setTimeout(() => {
      abortController?.abort();
      logStreamEvent("ai_stream_timed_out", { conversationId, userId });
    }, AI_STREAM_TIMEOUT_MS);
    onResponseClose = () => {
      if (!res.writableEnded) {
        abortController?.abort();
        logStreamEvent("ai_stream_client_disconnected", { conversationId, userId });
      }
    };
    res.once("close", onResponseClose);

    // Verify conversation ownership
    const conversation = await serverGetConversation(userId, conversationId);
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found or unauthorized access." });
      return;
    }

    // Get messages
    const messages = await serverGetConversationMessages(userId, conversationId, requestedBranchId);

    // Format for Vercel AI SDK (USER -> user, ASSISTANT -> assistant)
    // Strip out JSON metadata from past assistant messages so the model gets clean context
    const coreMessages = messages.map(msg => {
      let text = msg.content;
      if (msg.role === "ASSISTANT" && text.startsWith('{"omniscript":true')) {
        try {
          const parsed = JSON.parse(text);
          text = parsed.text || text;
        } catch (e) {
          // fallback to original
        }
      }
      return {
        role: msg.role === "USER" ? ("user" as const) : ("assistant" as const),
        content: text
      };
    });

    // 1. Ask OpenAI to analyze user prompt and decide if external tool calling is required
    const initialResponse = await generateText({
      model: getOpenAIModel(),
      messages: coreMessages,
      system: "You are OMNISCRIPT, an ultra-premium, modern AI-powered software engineering partner. Provide elegant, production-ready, typed answers. Determine if a tool is required. If a tool like webSearch or readUrl is needed to answer, return the appropriate function call. Only call webSearch when you lack real-time or up-to-date knowledge about recent events, public details, or recent technological revisions. Only call readUrl if the user explicitly specifies a URL to read, analyze, explain, or summarize.",
      tools: {
        webSearch: {
          description: "Search the web for real-time information, current events, latest news, and public information.",
          parameters: webSearchParameters,
        } as any,
        readUrl: {
          description: "Fetch and read the raw text contents of any given web page/URL to explain, summarize, or extract detailed information.",
          parameters: readUrlParameters,
        } as any,
      } as any,
      abortSignal: abortController.signal,
    });

    const toolCalls = initialResponse.toolCalls as any[];

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    if (toolCalls && toolCalls.length > 0) {
      const call = toolCalls[0] as { toolName?: unknown; args?: unknown; toolCallId?: unknown };
      const toolName = typeof call?.toolName === "string" ? call.toolName : "";
      const toolCallId = typeof call?.toolCallId === "string" ? call.toolCallId : "";

      if (!toolCallId || !toolName) {
        writeSse(res, { error: "The AI returned an incomplete tool request. Please try again." });
        endSse(res);
        return;
      }

      const parsedToolArgs = toolName === "webSearch"
        ? webSearchParameters.safeParse(call.args)
        : toolName === "readUrl"
          ? readUrlParameters.safeParse(call.args)
          : null;

      if (!parsedToolArgs || !parsedToolArgs.success) {
        writeSse(res, { error: "The AI requested an unsupported or invalid tool operation. Please try again." });
        endSse(res);
        return;
      }

      const toolArgs = parsedToolArgs.data as { query?: string; url?: string };

      if (toolName === "webSearch") {
        const query = toolArgs.query || "";
        
        // Stream search initialization status
        writeSse(res, { 
          type: "status", 
          name: "webSearch", 
          status: "searching", 
          query 
        });

        // Execute search on server side
        let toolResult;
        try {
          toolResult = await executeTool(toolName, toolArgs, abortController.signal);
        } catch (err: any) {
          toolResult = { success: false, error: err.message };
        }

        // Stream analysis status
        writeSse(res, { 
          type: "status", 
          name: "webSearch", 
          status: "processing" 
        });

        // Extract citations/sources
        const citations = toolResult.success && toolResult.results 
          ? toolResult.results.map((r: any) => ({ title: r.title, url: r.url, snippet: r.snippet }))
          : [];

        // Stream citations list early
        writeSse(res, { 
          type: "citations", 
          citations 
        });

        // Feed tool results back to the model in Vercel AI SDK format
        const updatedMessages = [
          ...coreMessages,
          {
            role: "assistant" as const,
            content: [
              {
                type: "tool-call" as const,
                toolCallId,
                toolName,
                args: toolArgs,
              }
            ]
          },
          {
            role: "tool" as const,
            content: [
              {
                type: "tool-result" as const,
                toolCallId,
                toolName,
                result: toolResult,
              }
            ]
          }
        ];

        // Stream the final synthesized conversational response
        const { textStream } = await streamText({
          model: getOpenAIModel(),
          messages: updatedMessages as any,
          system: "You are OMNISCRIPT. Synthesize the provided tool results to answer the user's prompt with absolute precision. Incorporate the sources seamlessly and answer in elegant markdown. Do not repeat URLs verbatim in your text, as they will be displayed as neat citation elements. NEVER output raw JSON.",
          abortSignal: abortController.signal,
        });

        let fullResponseText = "";
        for await (const text of textStream) {
          if (text) {
            fullResponseText += text;
            writeSse(res, { type: "text", text });
          }
        }

        // Persist final answer as structured metadata in content
        const finalMessageContent = JSON.stringify({
          omniscript: true,
          text: fullResponseText,
          toolCall: {
            name: "webSearch",
            query,
            status: toolResult.success ? "completed" : "failed",
            error: toolResult.success ? undefined : toolResult.error
          },
          citations
        });

        if (abortController.signal.aborted) {
          throw new Error("AI stream was cancelled before the response could be saved.");
        }
        await serverCreateMessage(userId, conversationId, {
          role: "ASSISTANT",
          content: finalMessageContent,
          branchId: requestedBranchId
        });

      } else if (toolName === "readUrl") {
        const url = toolArgs.url || "";

        // Stream URL reader initialization status
        writeSse(res, { 
          type: "status", 
          name: "readUrl", 
          status: "reading_url", 
          url 
        });

        // Execute URL content fetching on server side
        let toolResult;
        try {
          toolResult = await executeTool(toolName, toolArgs, abortController.signal);
        } catch (err: any) {
          toolResult = { success: false, error: err.message };
        }

        // Stream analysis status
        writeSse(res, { 
          type: "status", 
          name: "readUrl", 
          status: "processing" 
        });

        // Extract citation
        const citations = toolResult.success 
          ? [{ title: toolResult.title || url, url }]
          : [];

        // Stream citations list early
        writeSse(res, { 
          type: "citations", 
          citations 
        });

        // Feed tool results back to the model in Vercel AI SDK format
        const updatedMessages = [
          ...coreMessages,
          {
            role: "assistant" as const,
            content: [
              {
                type: "tool-call" as const,
                toolCallId,
                toolName,
                args: toolArgs,
              }
            ]
          },
          {
            role: "tool" as const,
            content: [
              {
                type: "tool-result" as const,
                toolCallId,
                toolName,
                result: toolResult,
              }
            ]
          }
        ];

        // Stream the final summarized or analyzed answer
        const { textStream } = await streamText({
          model: getOpenAIModel(),
          messages: updatedMessages as any,
          system: "You are OMNISCRIPT. Process and synthesize the text content of the webpage provided in the tool results to address the user's prompt (e.g. summarize, explain, or answer questions). Cite the website. NEVER output raw JSON.",
          abortSignal: abortController.signal,
        });

        let fullResponseText = "";
        for await (const text of textStream) {
          if (text) {
            fullResponseText += text;
            writeSse(res, { type: "text", text });
          }
        }

        // Persist final answer as structured metadata in content
        const finalMessageContent = JSON.stringify({
          omniscript: true,
          text: fullResponseText,
          toolCall: {
            name: "readUrl",
            url,
            status: toolResult.success ? "completed" : "failed",
            error: toolResult.success ? undefined : toolResult.error
          },
          citations
        });

        if (abortController.signal.aborted) {
          throw new Error("AI stream was cancelled before the response could be saved.");
        }
        await serverCreateMessage(userId, conversationId, {
          role: "ASSISTANT",
          content: finalMessageContent,
          branchId: requestedBranchId
        });
      }
    } else {
      // No external tool required. Directly stream the text of initialResponse to client smoothly.
      const responseText = initialResponse.text || "";
      let index = 0;
      const chunkSize = 24; // chunks of characters
      
      while (index < responseText.length) {
        if (abortController.signal.aborted) {
          throw new Error("AI stream was cancelled before completion.");
        }
        const nextChunk = responseText.slice(index, index + chunkSize);
        index += chunkSize;
        writeSse(res, { type: "text", text: nextChunk });
        await new Promise(resolve => setTimeout(resolve, 10)); // tiny gap for ultra-smooth streaming experience
      }

      // Save final message to DB
      if (!abortController.signal.aborted && responseText.trim()) {
        await serverCreateMessage(userId, conversationId, {
          role: "ASSISTANT",
          content: responseText,
          branchId: requestedBranchId
        });
      }
    }

    endSse(res);
  } catch (error: any) {
    logStreamEvent("ai_stream_failed", {
      errorName: error?.name || "Error",
      conversationId: req.params.id,
      userId: req.auth?.userId,
      aborted: abortController?.signal.aborted,
    });
    const friendlyError = handleAIError(error);
    if (res.headersSent) {
      writeSse(res, { error: friendlyError });
      endSse(res);
    } else {
      res.status(500).json({ error: friendlyError });
    }
  } finally {
    if (streamTimeout) {
      clearTimeout(streamTimeout);
    }
    if (onResponseClose) {
      res.removeListener("close", onResponseClose);
    }
    releaseStreamSlot?.();
  }
});


// ============================================================================
// ENVIRONMENT & FRONTEND ROUTE RESOLVER (Vite vs Compiled Asset)
// ============================================================================

async function initializeServer() {
  if (process.env.NODE_ENV !== "production") {
    // Integrate Vite development server middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static frontend assets compiled during standard production build
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[OMNISCRIPT Backend] Server boot complete on http://0.0.0.0:${PORT}`);
  });
}

initializeServer().catch((error) => {
  console.error("Failed to initialize server entry point:", error);
  process.exit(1);
});
