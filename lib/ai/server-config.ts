/* ══════════════════════════════════════════════════════════════
   Raily AI — Server-Side Configuration
   
   Reads AI provider configuration from server-only environment
   variables. NEVER exposes API keys to the client bundle.
   
   Usage:
     import { getServerConfig } from "@/lib/ai/server-config";
   
   Only import this file from server components, API routes,
   or server actions. Importing it from client code will
   throw an error.
   ══════════════════════════════════════════════════════════════ */

export type AIProviderType = "groq" | "openrouter";

export interface ServerAIProviderConfig {
  provider: AIProviderType;
  model: string;
  apiKey: string;
  baseUrl: string;
  maxTokens: number;
  temperature: number;
}

const PROVIDER_ENDPOINTS: Record<AIProviderType, string> = {
  groq: "https://api.groq.com/openai/v1",
  openrouter: "https://openrouter.ai/api/v1",
};

const PROVIDER_MODELS: Record<AIProviderType, string> = {
  groq: "llama-3.3-70b-versatile",
  openrouter: "google/gemini-2.0-flash-001",
};

/**
 * Get the AI provider configuration using server-only env vars.
 *
 * Required env vars (in .env.local, NOT prefixed with NEXT_PUBLIC_):
 *   - AI_PROVIDER         ("groq" | "openrouter", default: "groq")
 *   - GROQ_API_KEY        (if provider is groq)
 *   - OPENROUTER_API_KEY  (if provider is openrouter)
 *
 * Optional:
 *   - GROQ_MODEL
 *   - OPENROUTER_MODEL
 */
export function getServerConfig(): ServerAIProviderConfig {
  const provider = (process.env.AI_PROVIDER || "groq") as AIProviderType;

  if (provider === "openrouter") {
    return {
      provider: "openrouter",
      model: process.env.OPENROUTER_MODEL || PROVIDER_MODELS.openrouter,
      apiKey: process.env.OPENROUTER_API_KEY || "",
      baseUrl: PROVIDER_ENDPOINTS.openrouter,
      maxTokens: 4096,
      temperature: 0.3,
    };
  }

  // Default: Groq
  return {
    provider: "groq",
    model: process.env.GROQ_MODEL || PROVIDER_MODELS.groq,
    apiKey: process.env.GROQ_API_KEY || "",
    baseUrl: PROVIDER_ENDPOINTS.groq,
    maxTokens: 4096,
    temperature: 0.3,
  };
}

/**
 * Check if the AI provider is configured with a valid API key.
 */
export function isAIProviderConfigured(): boolean {
  const config = getServerConfig();
  return !!config.apiKey;
}
