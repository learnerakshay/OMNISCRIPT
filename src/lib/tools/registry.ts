import { z } from "zod";

export type ToolName = "calculator" | "currentDateTime";
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
  if (name === "calculator") {
    console.info(JSON.stringify({
      event: "calculator_input_validation",
      rawInput: rawArguments,
      parsedInput: parsedArguments,
      valid: result.success,
      validationError: result.success ? undefined : result.error.issues[0]?.message,
    }));
  }
  return result.success
    ? { success: true, data: result.data }
    : { success: false, error: result.error.issues[0]?.message || "Tool arguments are invalid." };
}
export async function executeTool(name: string, input: unknown, signal?: AbortSignal): Promise<ToolExecutionResult> { if (!isToolName(name)) return { success: false, error: "Unknown tool." }; if (signal?.aborted) return { success: false, error: "Tool execution was cancelled." }; return registry[name].execute(input, signal); }
