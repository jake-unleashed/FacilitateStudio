import type OpenAI from 'openai';
import {
  MAX_EXTRACTED_STEPS,
  OPENAI_MAX_TOKENS,
  OPENAI_TIMEOUT_MS_DEFAULT,
} from './extractStepsConstants.js';

export function buildUserPrompt(text: string, filename: string | undefined): string {
  return filename ? `Document "${filename}":\n\n${text}` : text;
}

function normalizeSteps(parsed: unknown): string[] {
  if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as { steps?: unknown }).steps)) {
    return [];
  }

  const steps = (parsed as { steps: unknown[] }).steps;
  return steps
    .map((step) => (typeof step === 'string' ? step.trim() : ''))
    .filter(Boolean)
    .slice(0, MAX_EXTRACTED_STEPS);
}

export async function extractSopStepsWithOpenAI(params: {
  client: OpenAI;
  model: string;
  systemInstruction: string;
  text: string;
  filename?: string;
  timeoutMs?: number;
}): Promise<
  | { ok: true; steps: string[] }
  | { ok: false; status: number; error: string; stage?: string; rawError?: unknown }
> {
  const {
    client,
    model,
    systemInstruction,
    text,
    filename,
    timeoutMs = OPENAI_TIMEOUT_MS_DEFAULT,
  } = params;

  const userPrompt = buildUserPrompt(text, filename);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

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
        max_tokens: OPENAI_MAX_TOKENS,
      },
      { signal: controller.signal }
    );

    const content = completion?.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return { ok: false, status: 502, error: 'Empty AI response' };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return { ok: false, status: 502, error: 'Invalid AI response format' };
    }

    const steps = normalizeSteps(parsed);
    if (steps.length > 0) {
      return { ok: true, steps };
    }

    if (parsed && typeof parsed === 'object' && 'error' in parsed) {
      return { ok: false, status: 422, error: String((parsed as { error: unknown }).error) };
    }

    return { ok: false, status: 422, error: 'No steps could be extracted from this document.' };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { ok: false, status: 504, error: 'AI request timed out. Please try again.' };
    }
    return {
      ok: false,
      status: 502,
      error: 'Failed to analyze the document. Please try again.',
      stage: 'openai_chat_completion',
      rawError: error,
    };
  } finally {
    clearTimeout(timeout);
  }
}
