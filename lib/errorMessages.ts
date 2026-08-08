/**
 * Translate raw API/Gemini errors into user-friendly messages.
 * Used server-side in API routes before sending to the client.
 */
export function friendlyError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);

  if (msg.includes("503") || msg.includes("high demand") || msg.includes("overloaded")) {
    return "Our search engine is experiencing high demand right now. Please try again in a moment.";
  }
  if (msg.includes("429") || msg.includes("quota") || msg.includes("rate limit") || msg.includes("RATE_LIMIT")) {
    return "We've hit a temporary rate limit. Please wait a few seconds and try again.";
  }
  if (msg.includes("500") && msg.includes("Internal")) {
    return "Something went wrong on our end. Please try again.";
  }
  if (msg.includes("Could not parse JSON")) {
    return "We got an unexpected response. Please try your search again.";
  }
  if (msg.includes("fetch") || msg.includes("ECONNREFUSED") || msg.includes("network")) {
    return "Couldn't connect to our search service. Please check your connection and try again.";
  }
  if (msg.includes("timeout") || msg.includes("timed out") || msg.includes("ETIMEDOUT") || msg.includes("deadline")) {
    return "The search took too long to respond. Please try again.";
  }

  // Fallback — log for diagnosis but don't leak raw details to client
  console.error("[friendlyError] unmatched error:", msg);
  return "Something unexpected happened. Please try again.";
}
