import { createOpenAI } from "@ai-sdk/openai";

// ----------------------------------------------------------------------------
// SINGLE LOCATION FOR MODEL CONFIGURATION
// ----------------------------------------------------------------------------
export const AI_MODEL_NAME = "gpt-4o-mini";

let openaiInstance: ReturnType<typeof createOpenAI> | null = null;

/**
 * Returns a lazy-initialized OpenAI provider instance.
 * Validates the presence of OPENAI_API_KEY gracefully.
 */
export function getOpenAIProvider() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is missing. Please configure it in your Settings > Secrets panel."
    );
  }

  if (!openaiInstance) {
    openaiInstance = createOpenAI({
      apiKey,
    });
  }
  return openaiInstance;
}

/**
 * Returns the centralized model configuration.
 */
export function getOpenAIModel() {
  const provider = getOpenAIProvider();
  return provider(AI_MODEL_NAME);
}

/**
 * Safely parses and normalizes OpenAI-specific error messages into 
 * user-friendly fallback descriptions.
 */
export function handleAIError(error: any): string {
  console.error("AI Service Error:", error);
  
  const status = error?.status || error?.statusCode;
  const message = error?.message || "";

  if (!process.env.OPENAI_API_KEY) {
    return "The OpenAI API Key is missing. Please add OPENAI_API_KEY in your Settings > Secrets panel.";
  }

  if (status === 401 || message.includes("Incorrect API key") || message.includes("invalid_api_key") || message.includes("Unauthorized")) {
    return "The provided OpenAI API Key appears to be invalid or expired. Please check your key in Settings > Secrets.";
  }

  if (status === 429 || message.includes("Rate limit") || message.includes("insufficient_quota") || message.includes("quota")) {
    return "We have exceeded the OpenAI API rate limit or quota. Please try again in a few moments or verify your billing plan.";
  }

  if (status === 503 || status === 500 || message.includes("overloaded") || message.includes("server_error")) {
    return "The OpenAI service is temporarily overloaded or experiencing an outage. Please try again shortly.";
  }

  if (error?.code === "ENOTFOUND" || message.includes("fetch failed") || message.includes("network") || message.includes("dns")) {
    return "A network connectivity issue occurred while reaching OpenAI. Please check the server's internet connection and try again.";
  }

  return error.message || "An unexpected error occurred while communicating with the AI service.";
}
