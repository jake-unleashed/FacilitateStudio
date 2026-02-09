import OpenAI from 'openai';
import {
  getExtractSopStepsSystemPrompt,
} from '../../shared/ai/extractSopStepsPrompt.js';

export const config = { runtime: 'edge' };
const MAX_EXTRACTED_STEPS = 50;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function json(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return json({ error: 'Method Not Allowed' }, { status: 405 });
  }

  // --- Parse body ---
  let text: string | undefined;
  let filename: string | undefined;
  try {
    const data = await req.json().catch(() => ({}));
    text = typeof data?.text === 'string' ? data.text.trim() : undefined;
    filename = typeof data?.filename === 'string' ? data.filename : undefined;
  } catch {
    return json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!text) {
    return json({ error: 'Missing or empty "text" field' }, { status: 400 });
  }

  // --- Resolve API key ---
  const apiKey =
    process.env.OPENAI_API_KEY ??
    (process as unknown as { env?: Record<string, string | undefined> }).env?.OPENAI_API_KEY;

  if (!apiKey) {
    return json(
      { error: 'Server misconfiguration: OPENAI_API_KEY is missing' },
      { status: 500 }
    );
  }

  // --- Call OpenAI ---
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const client = new OpenAI({ apiKey });

  const systemInstruction = getExtractSopStepsSystemPrompt();

  const userPrompt = filename ? `Document "${filename}":\n\n${text}` : text;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const completion = await client.chat.completions.create(
      {
        model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 600,
      },
      { signal: controller.signal as unknown as AbortSignal }
    );

    const content = completion?.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return json({ error: 'Empty AI response' }, { status: 502 });
    }

    let parsed: { steps?: string[]; error?: string } | null = null;
    try {
      parsed = JSON.parse(content);
    } catch {
      return json({ error: 'Invalid AI response format' }, { status: 502 });
    }

    if (parsed?.steps && Array.isArray(parsed.steps) && parsed.steps.length > 0) {
      const steps = parsed.steps
        .map((s: unknown) => (typeof s === 'string' ? s.trim() : ''))
        .filter(Boolean)
        .slice(0, MAX_EXTRACTED_STEPS);
      if (steps.length > 0) return json({ steps });
    }

    if (parsed?.error) {
      return json({ error: String(parsed.error) });
    }

    return json({ error: 'No steps could be extracted from this document.' }, { status: 422 });
  } catch {
    return json({ error: 'Failed to analyze the document. Please try again.' }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
