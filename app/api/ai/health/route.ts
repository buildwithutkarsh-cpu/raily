/* ══════════════════════════════════════════════════════════════
   RAILY — AI Health Check API Route
   
   GET /api/ai Your messages you can tell/health
   
   Returns the status of the AI provider configuration:
   - configured: whether an API key is present
   - provider: which provider is selected (groq / openrouter)
   - model: which model is configured
   - reachable: whether the provider's API is reachable
   - latency: response time for the reachability check
   ══════════════════════════════════════════════════════════════ */

import { getServerConfig } from "@/lib/ai/server-config";

export async function GET() {
  const start = performance.now();
  const config = getServerConfig();
  const configured = !!config.apiKey;

  let reachable = false;
  let reachabilityError: string | null = null;

  if (configured) {
    try {
      // Test provider connectivity by calling the models endpoint
      const response = await fetch(`${config.baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
        },
        signal: AbortSignal.timeout(5_000),
      });
      reachable = response.ok;
      if (!reachable) {
        reachabilityError = `Provider returned ${response.status}`;
      }
    } catch (err: unknown) {
      reachable = false;
      reachabilityError = err instanceof Error ? err.message : "Provider unreachable";
    }
  }

  const elapsed = (performance.now() - start).toFixed(0);

  return Response.json({
    success: true,
    timestamp: new Date().toISOString(),
    latency: `${elapsed}ms`,
    data: {
      configured,
      reachable,
      provider: config.provider,
      model: config.model,
      error: reachabilityError,
      healthy: configured && reachable,
    },
  });
}
