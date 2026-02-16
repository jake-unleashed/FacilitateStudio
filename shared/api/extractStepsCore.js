import {
  MAX_EXTRACTED_STEPS,
  OPENAI_MAX_TOKENS,
  OPENAI_TIMEOUT_MS_DEFAULT,
} from './extractStepsConstants.js';

/**
 * @param {string} text
 * @param {string | undefined} filename
 * @returns {string}
 */
export function buildUserPrompt(text, filename) {
  return filename ? `Document "${filename}":\n\n${text}` : text;
}

/**
 * @param {unknown} parsed
 * @returns {string[]}
 */
function normalizeSteps(parsed) {
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.steps)) return [];

  return parsed.steps
    .map((step) => (typeof step === 'string' ? step.trim() : ''))
    .filter(Boolean)
    .slice(0, MAX_EXTRACTED_STEPS);
}

/**
 * @param {{
 *   client: import('openai').default;
 *   model: string;
 *   systemInstruction: string;
 *   text: string;
 *   filename?: string;
 *   timeoutMs?: number;
 * }} params
 * @returns {Promise<
 *   | { ok: true; steps: string[] }
 *   | { ok: false; status: number; error: string; stage?: string; rawError?: unknown }
 * >}
 */
export async function extractSopStepsWithOpenAI(params) {
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

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      return { ok: false, status: 502, error: 'Invalid AI response format' };
    }

    const steps = normalizeSteps(parsed);
    if (steps.length > 0) {
      return { ok: true, steps };
    }

    if (parsed?.error) {
      return { ok: false, status: 422, error: String(parsed.error) };
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
