import { z } from "zod";

export type ToolName = "calculator" | "currentDateTime" | "webSearch";
export type ToolExecutionResult = { success: true; summary: string; result: Record<string, unknown> } | { success: false; error: string };

export interface RegisteredTool<TInput> {
  name: ToolName;
  description: string;
  parameters: z.ZodType<TInput>;
  execute: (input: TInput, signal?: AbortSignal) => Promise<ToolExecutionResult>;
}

export const calculatorInputSchema = z.object({
  expression: z.string().trim().min(1, "A calculator expression is required.").max(200)
    .describe("The complete arithmetic expression to calculate, for example: 24 * 18."),
});
const dateTimeSchema = z.object({ timezone: z.string().trim().max(100).optional() });
export const webSearchInputSchema = z.object({
  query: z.string().trim().min(1, "A web search query is required.").max(400, "Web search queries must be 400 characters or fewer.")
    .describe("The complete, specific search query to look up on the live web."),
});

type WebSearchResult = { title: string; url: string; snippet: string; publishedDate?: string; score?: number };
const TAVILY_SEARCH_URL = "https://api.tavily.com/search";
const WEB_SEARCH_TIMEOUT_MS = 8_000;
const WEB_SEARCH_CACHE_TTL_MS = 5 * 60_000;
const FRESH_SEARCH_CACHE_TTL_MS = 60_000;
const MAX_WEB_SEARCH_ATTEMPTS = 2;
const MAX_WEB_SEARCH_CACHE_ENTRIES = 100;
const webSearchCache = new Map<string, { expiresAt: number; result: ToolExecutionResult }>();

type SearchIntent = {
  effectiveQuery: string;
  cacheKey: string;
  isFreshnessSensitive: boolean;
};

const YEAR_PATTERN = /\b(?:19|20)\d{2}\b/g;
const FRESHNESS_PATTERN = /\b(current|currently|latest|most recent|recent|today|yesterday|tomorrow|this week|this month|live|price|score|standing|election|news)\b/i;
const COMPETITION_RESULT_PATTERN = /\b(won|winner|champion|championship|final|result)\b/i;

export function normalizeWebSearchQuery(modelQuery: string, userPrompt: string): string {
  const normalizedModelQuery = modelQuery.replace(/\s+/g, " ").trim();
  const normalizedUserPrompt = userPrompt.replace(/\s+/g, " ").trim();
  const isFreshnessRequest = FRESHNESS_PATTERN.test(normalizedUserPrompt);
  const explicitYears = new Set(normalizedUserPrompt.match(YEAR_PATTERN) ?? []);

  let query = normalizedModelQuery.replace(YEAR_PATTERN, (year) => explicitYears.has(year) ? year : "");
  query = query.replace(/\s+/g, " ").trim();

  if (isFreshnessRequest && COMPETITION_RESULT_PATTERN.test(query)) {
    query = query.replace(/\b(?:latest|most recent|recent|current)\b/i, "latest completed");
    if (!/\bofficial\b/i.test(query)) query = `${query} official result`;
  }

  return query || normalizedUserPrompt;
}

function getSearchIntent(query: string): SearchIntent {
  const normalizedQuery = query.replace(/\s+/g, " ").trim();
  const isFreshnessSensitive = FRESHNESS_PATTERN.test(normalizedQuery);
  const currentDate = new Date().toISOString().slice(0, 10);
  const effectiveQuery = isFreshnessSensitive
    ? `${normalizedQuery} (current as of ${currentDate})`
    : normalizedQuery;

  return {
    effectiveQuery,
    cacheKey: `${isFreshnessSensitive ? "fresh" : "standard"}:${effectiveQuery.toLocaleLowerCase("en-US")}`,
    isFreshnessSensitive,
  };
}

function requiresCompetitionClarification(query: string): boolean {
  const requestsWinner = /\b(won|winner|champion|championship|title holder)\b/i.test(query);
  const identifiesEdition = /\b(?:19|20)\d{2}\b|\bmen'?s\b|\bwomen'?s\b|\bunder[- ]?\d+\b|\bu[- ]?\d+\b|\bedition\b/i.test(query);
  return requestsWinner && !identifiesEdition && !FRESHNESS_PATTERN.test(query);
}

function getAuthorityScore(url: string): number {
  const hostname = new URL(url).hostname.toLowerCase();
  if (["reddit.com", "x.com", "facebook.com", "instagram.com", "tiktok.com"].some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))) return -100;
  if (hostname.endsWith(".gov")) return 50;
  if (hostname.endsWith(".edu")) return 40;
  if (hostname.endsWith(".int")) return 35;
  if (["reuters.com", "apnews.com", "bbc.com", "nytimes.com", "theguardian.com"].some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))) return 30;
  if (hostname.includes("official")) return 20;
  return 0;
}

function shouldRefineStaleCompetitionSearch(intent: SearchIntent, results: WebSearchResult[]): boolean {
  if (!intent.isFreshnessSensitive || !COMPETITION_RESULT_PATTERN.test(intent.effectiveQuery) || /\b(?:19|20)\d{2}\b/.test(intent.effectiveQuery)) return false;
  const currentYear = new Date().getUTCFullYear();
  const resultYears = results
    .flatMap((result) => `${result.title} ${result.snippet}`.match(YEAR_PATTERN) ?? [])
    .map(Number);
  return resultYears.length > 0 && resultYears.every((year) => year < currentYear - 1);
}

function buildRefinedSearchQuery(query: string): string {
  const withoutDateContext = query.replace(/\s*\(current as of \d{4}-\d{2}-\d{2}\)\s*/i, " ").trim();
  const completedQuery = /\blatest completed\b/i.test(withoutDateContext)
    ? withoutDateContext
    : withoutDateContext.replace(/\b(?:latest|most recent|recent|current)\b/i, "latest completed");
  const withOfficialResult = /\bofficial result\b/i.test(completedQuery)
    ? completedQuery
    : `${completedQuery} official result`;
  return `${withOfficialResult} (current as of ${new Date().toISOString().slice(0, 10)})`;
}

function rankSearchResults(results: WebSearchResult[], freshnessSensitive: boolean): WebSearchResult[] {
  return [...results].sort((left, right) => {
    const authorityDifference = getAuthorityScore(right.url) - getAuthorityScore(left.url);
    if (authorityDifference !== 0) return authorityDifference;
    if (freshnessSensitive) {
      const rightDate = right.publishedDate ? Date.parse(right.publishedDate) : 0;
      const leftDate = left.publishedDate ? Date.parse(left.publishedDate) : 0;
      if (rightDate !== leftDate) return rightDate - leftDate;
    }
    return (right.score ?? 0) - (left.score ?? 0);
  });
}

function waitForRetry(signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, 250);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new Error("Tool execution was cancelled."));
    }, { once: true });
  });
}

function cacheWebSearchResult(cacheKey: string, result: ToolExecutionResult, ttl: number) {
  const now = Date.now();
  for (const [key, entry] of webSearchCache) {
    if (entry.expiresAt <= now) webSearchCache.delete(key);
  }
  if (!webSearchCache.has(cacheKey) && webSearchCache.size >= MAX_WEB_SEARCH_CACHE_ENTRIES) {
    const oldestKey = webSearchCache.keys().next().value;
    if (oldestKey) webSearchCache.delete(oldestKey);
  }
  webSearchCache.set(cacheKey, { expiresAt: now + ttl, result });
}

function toSafeSearchResult(value: unknown): WebSearchResult | null {
  if (!value || typeof value !== "object") return null;
  const result = value as Record<string, unknown>;
  if (typeof result.url !== "string" || typeof result.title !== "string") return null;
  try {
    const url = new URL(result.url);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return {
      title: result.title.trim().slice(0, 300) || url.hostname,
      url: url.toString(),
      snippet: typeof result.content === "string" ? result.content.trim().slice(0, 600) : "",
      publishedDate: typeof result.published_date === "string" ? result.published_date.trim().slice(0, 100) : undefined,
      score: typeof result.score === "number" && Number.isFinite(result.score) ? result.score : undefined,
    };
  } catch {
    return null;
  }
}

async function executeWebSearch(input: unknown, signal?: AbortSignal): Promise<ToolExecutionResult> {
  const parsed = webSearchInputSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message || "Web search arguments are invalid." };

  if (requiresCompetitionClarification(parsed.data.query)) {
    return { success: false, error: "This request could refer to multiple competition editions or categories. Please specify the year and, when applicable, the competition category." };
  }

  const apiKey = process.env.TAVILY_API_KEY?.trim();
  if (!apiKey) return { success: false, error: "Web search is not configured. Set TAVILY_API_KEY on the server." };

  const intent = getSearchIntent(parsed.data.query);
  const cached = webSearchCache.get(intent.cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.result;
  if (cached) webSearchCache.delete(intent.cacheKey);

  const timeoutController = new AbortController();
  const timeout = setTimeout(() => timeoutController.abort(), WEB_SEARCH_TIMEOUT_MS);
  const requestSignal = signal ? AbortSignal.any([signal, timeoutController.signal]) : timeoutController.signal;

  try {
    let response: Response | undefined;
    for (let attempt = 1; attempt <= MAX_WEB_SEARCH_ATTEMPTS; attempt += 1) {
      try {
        response = await fetch(TAVILY_SEARCH_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: apiKey,
            query: intent.effectiveQuery,
            topic: intent.isFreshnessSensitive ? "news" : "general",
            days: intent.isFreshnessSensitive ? 30 : undefined,
            search_depth: intent.isFreshnessSensitive ? "advanced" : "basic",
            max_results: 6,
            include_answer: false,
            include_raw_content: false,
          }),
          signal: requestSignal,
        });
      } catch (error) {
        if (requestSignal.aborted || attempt === MAX_WEB_SEARCH_ATTEMPTS) throw error;
        await waitForRetry(requestSignal);
        continue;
      }

      if (response.ok || response.status === 401 || response.status === 403 || response.status === 429 || attempt === MAX_WEB_SEARCH_ATTEMPTS) break;
      await waitForRetry(requestSignal);
    }

    if (!response?.ok) {
      if (response?.status === 401 || response?.status === 403) return { success: false, error: "Web search authentication failed. Verify TAVILY_API_KEY on the server." };
      if (response?.status === 429) return { success: false, error: "Web search is temporarily rate limited. Please try again shortly." };
      return { success: false, error: "Web search is temporarily unavailable. Please try again." };
    }

    const payload: unknown = await response.json();
    const rawResults: unknown[] | null = payload && typeof payload === "object" && Array.isArray((payload as Record<string, unknown>).results)
      ? (payload as Record<string, unknown>).results as unknown[]
      : null;
    if (!rawResults) return { success: false, error: "Web search returned an invalid response." };

    let results = rankSearchResults(
      rawResults.map(toSafeSearchResult).filter((result): result is WebSearchResult => result !== null),
      intent.isFreshnessSensitive,
    ).slice(0, 5);
    if (results.length === 0) return { success: false, error: "Web search returned no usable results." };

    if (shouldRefineStaleCompetitionSearch(intent, results)) {
      const refinedResponse = await fetch(TAVILY_SEARCH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          query: buildRefinedSearchQuery(intent.effectiveQuery),
          topic: "news",
          days: 30,
          search_depth: "advanced",
          max_results: 6,
          include_answer: false,
          include_raw_content: false,
        }),
        signal: requestSignal,
      });
      if (!refinedResponse.ok) return { success: false, error: "Web search could not verify a current result. Please try again shortly." };

      const refinedPayload: unknown = await refinedResponse.json();
      const refinedRawResults = refinedPayload && typeof refinedPayload === "object" && Array.isArray((refinedPayload as Record<string, unknown>).results)
        ? (refinedPayload as Record<string, unknown>).results as unknown[]
        : [];
      results = rankSearchResults(
        refinedRawResults.map(toSafeSearchResult).filter((result): result is WebSearchResult => result !== null),
        true,
      ).slice(0, 5);
      if (results.length === 0) return { success: false, error: "Web search could not verify a current result. Please try again shortly." };
    }
    const result: ToolExecutionResult = {
      success: true,
      summary: `Found ${results.length} web results for ${parsed.data.query}`,
      result: {
        query: parsed.data.query,
        effectiveQuery: intent.effectiveQuery,
        freshnessSensitive: intent.isFreshnessSensitive,
        results,
      },
    };
    cacheWebSearchResult(intent.cacheKey, result, intent.isFreshnessSensitive ? FRESH_SEARCH_CACHE_TTL_MS : WEB_SEARCH_CACHE_TTL_MS);
    return result;
  } catch (error) {
    if (timeoutController.signal.aborted && !signal?.aborted) return { success: false, error: "Web search timed out. Please try again." };
    if (signal?.aborted) return { success: false, error: "Tool execution was cancelled." };
    return { success: false, error: "Web search could not reach the provider. Please try again." };
  } finally {
    clearTimeout(timeout);
  }
}

function calculate(expression: string): number {
  const source = expression.replace(/\s+/g, "");
  if (!/^[0-9.+\-*/()]+$/.test(source)) throw new Error("Only arithmetic operators and parentheses are supported.");
  let index = 0;
  const parseExpression = (): number => { let value = parseTerm(); while (source[index] === "+" || source[index] === "-") { const operator = source[index++]; const right = parseTerm(); value = operator === "+" ? value + right : value - right; } return value; };
  const parseTerm = (): number => { let value = parseFactor(); while (source[index] === "*" || source[index] === "/") { const operator = source[index++]; const right = parseFactor(); if (operator === "/" && right === 0) throw new Error("Division by zero is not allowed."); value = operator === "*" ? value * right : value / right; } return value; };
  const parseFactor = (): number => { const sign = source[index] === "-" ? (index++, -1) : 1; if (source[index] === "(") { index++; const value = parseExpression(); if (source[index++] !== ")") throw new Error("Malformed expression."); return sign * value; } const match = source.slice(index).match(/^(?:\d+\.?\d*|\.\d+)/); if (!match) throw new Error("Malformed expression."); index += match[0].length; return sign * Number(match[0]); };
  const result = parseExpression(); if (index !== source.length || !Number.isFinite(result)) throw new Error("Malformed expression."); return result;
}

const registry: Record<ToolName, RegisteredTool<unknown>> = {
  calculator: { name: "calculator", description: "Calculate one arithmetic expression. Always provide the full expression in the required expression field, for example { expression: '24 * 18' }.", parameters: calculatorInputSchema, async execute(input) { try { const { expression } = calculatorInputSchema.parse(input); const value = calculate(expression); return { success: true, summary: `${expression} = ${value}`, result: { expression, value } }; } catch (error) { return { success: false, error: error instanceof Error ? error.message : "Calculator failed." }; } } },
  currentDateTime: { name: "currentDateTime", description: "Get the current date and time, optionally for an IANA timezone.", parameters: dateTimeSchema, async execute(input) { try { const { timezone } = dateTimeSchema.parse(input); const usedTimezone = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone; const now = new Date(); const formatter = new Intl.DateTimeFormat("en-US", { timeZone: usedTimezone, dateStyle: "full", timeStyle: "long" }); const parts = new Intl.DateTimeFormat("en-US", { timeZone: usedTimezone, dateStyle: "medium", timeStyle: "medium" }).formatToParts(now); const date = parts.filter((part) => ["month", "day", "year"].includes(part.type)).map((part) => part.value).join(" "); const time = parts.filter((part) => ["hour", "minute", "second", "dayPeriod"].includes(part.type)).map((part) => part.value).join(""); return { success: true, summary: formatter.format(now), result: { isoTimestamp: now.toISOString(), readableDate: date, readableTime: time, timezone: usedTimezone } }; } catch { return { success: false, error: "Invalid IANA timezone." }; } } },
  webSearch: { name: "webSearch", description: "Search the live web for current, time-sensitive, or externally verifiable information. Always provide a specific non-empty query field.", parameters: webSearchInputSchema, execute: executeWebSearch },
};

export function getToolDefinitions() { return Object.values(registry).map((tool) => ({ name: tool.name, description: tool.description, parameters: tool.parameters })); }
export function isToolName(value: string): value is ToolName { return value in registry; }
export function getRegisteredToolNames(): ToolName[] { return Object.keys(registry) as ToolName[]; }

type UnknownRecord = Record<string, unknown>;
const asRecord = (value: unknown): UnknownRecord | null => typeof value === "object" && value !== null && !Array.isArray(value) ? value as UnknownRecord : null;

export type NormalizedToolCall = { callId: string; toolName: string; arguments: unknown; rawKeys: string[] };

export function normalizeToolCall(rawCall: unknown): { success: true; call: NormalizedToolCall } | { success: false; error: string; rawKeys: string[]; toolName: string; rawArguments: unknown } {
  const call = asRecord(rawCall);
  const rawKeys = call ? Object.keys(call) : [];
  if (!call) return { success: false, error: "Tool call is not an object.", rawKeys, toolName: "", rawArguments: undefined };

  const functionPayload = asRecord(call.function);
  const toolName = typeof call.toolName === "string"
    ? call.toolName
    : typeof functionPayload?.name === "string" ? functionPayload.name : "";
  const callId = typeof call.toolCallId === "string"
    ? call.toolCallId
    : typeof call.callId === "string" ? call.callId : typeof call.id === "string" ? call.id : "";
  const rawArguments = call.input ?? call.args ?? call.arguments ?? call.parsed_arguments ?? functionPayload?.arguments;
  const argumentsValue = Array.isArray(rawArguments) && rawArguments.every((item) => typeof item === "string")
    ? rawArguments.join("")
    : rawArguments;

  if (!callId || !toolName) return { success: false, error: "Tool call is missing its identifier or name.", rawKeys, toolName, rawArguments: argumentsValue };
  if (argumentsValue === undefined) return { success: false, error: "Tool call is missing arguments.", rawKeys, toolName, rawArguments: argumentsValue };
  return { success: true, call: { callId, toolName, arguments: argumentsValue, rawKeys } };
}

export function parseToolArguments(name: string, rawArguments: unknown): { success: true; data: unknown } | { success: false; error: string } {
  if (!isToolName(name)) return { success: false, error: "Unknown tool." };
  let parsedArguments = rawArguments;
  if (typeof rawArguments === "string") {
    try {
      parsedArguments = JSON.parse(rawArguments) as unknown;
    } catch {
      return { success: false, error: "Tool arguments are not valid JSON." };
    }
  }
  const result = registry[name].parameters.safeParse(parsedArguments);
  return result.success
    ? { success: true, data: result.data }
    : { success: false, error: result.error.issues[0]?.message || "Tool arguments are invalid." };
}
export async function executeTool(name: string, input: unknown, signal?: AbortSignal): Promise<ToolExecutionResult> { if (!isToolName(name)) return { success: false, error: "Unknown tool." }; if (signal?.aborted) return { success: false, error: "Tool execution was cancelled." }; return registry[name].execute(input, signal); }
