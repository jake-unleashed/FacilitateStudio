import type OpenAI from 'openai';
import { DEFAULT_OPENAI_MODEL, FALLBACK_POLYCOUNT } from './constants.js';

const MIN_POLYCOUNT = 20_000;
const MAX_POLYCOUNT = 75_000;
const DEFAULT_TIMEOUT_MS = 8_000;

const SYSTEM_PROMPT = [
  'You are a 3D modeling assistant.',
  'You will receive an image of a physical object.',
  'Assess geometric complexity for real-time rendering and return only JSON with one field: {"targetPolycount": <number>}.',
  'Guidelines:',
  '- Simple objects (bottle, hammer, cone): 20000-30000',
  '- Medium objects (game controller, wrench, chair): 35000-50000',
  '- Complex objects (vehicle, engine, bulldozer, detailed machinery): 55000-75000',
  'Consider part count, silhouette complexity, curvature detail, and fine mechanical details.',
].join('\n');

function clampPolycount(value: number): number {
  return Math.max(MIN_POLYCOUNT, Math.min(MAX_POLYCOUNT, Math.round(value)));
}

function parseTargetPolycount(content: string | null | undefined): number | null {
  if (!content) return null;

  try {
    const parsed = JSON.parse(content) as { targetPolycount?: unknown };
    if (typeof parsed.targetPolycount !== 'number' || !Number.isFinite(parsed.targetPolycount)) {
      return null;
    }
    return clampPolycount(parsed.targetPolycount);
  } catch {
    return null;
  }
}

export async function estimateTargetPolycount(params: {
  client: OpenAI;
  imageDataUrl: string;
  model?: string;
  timeoutMs?: number;
}): Promise<number> {
  const { client, imageDataUrl, model = DEFAULT_OPENAI_MODEL, timeoutMs = DEFAULT_TIMEOUT_MS } = params;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const completion = await client.chat.completions.create(
      {
        model,
        temperature: 0,
        response_format: { type: 'json_object' },
        max_tokens: 120,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Estimate a target polycount for this object image.' },
              { type: 'image_url', image_url: { url: imageDataUrl } },
            ],
          },
        ],
      },
      { signal: controller.signal }
    );

    const content = completion.choices?.[0]?.message?.content;
    return parseTargetPolycount(content) ?? FALLBACK_POLYCOUNT;
  } catch {
    return FALLBACK_POLYCOUNT;
  } finally {
    clearTimeout(timeout);
  }
}

