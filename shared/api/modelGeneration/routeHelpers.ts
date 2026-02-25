export function jsonResponse(body: unknown, init?: ResponseInit): Response {
  const initHeaders = new Headers(init?.headers);
  if (!initHeaders.has('Content-Type')) {
    initHeaders.set('Content-Type', 'application/json');
  }

  return new Response(JSON.stringify(body), {
    ...init,
    headers: initHeaders,
  });
}

export function finalizeWithCors(
  response: Response,
  corsHeaders: Record<string, string> | null
): Response {
  if (!corsHeaders) return response;

  const headers = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([name, value]) => headers.set(name, String(value)));

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function captureModelGenerationException(
  error: unknown,
  extra: Record<string, unknown>,
  event: string = 'ai_generate_model_error'
): void {
  const safeError =
    error instanceof Error
      ? { name: error.name, message: error.message }
      : { type: typeof error };

  console.error(
    JSON.stringify({
      event,
      error: safeError,
      ...extra,
    })
  );
}
