import { z } from 'zod';
import type { GenerationOptions } from './types.js';

const generationRequestSchema = z.object({
  imageDataUrl: z.string().trim().min(1, 'imageDataUrl is required'),
  imageName: z.string().trim().optional(),
  options: z
    .object({
      targetPolycount: z.number().int().positive().optional(),
      topology: z.enum(['triangle', 'quad']).optional(),
      enablePbr: z.boolean().optional(),
    })
    .optional(),
});

export function parseGenerationRequestBody(data: unknown):
  | { ok: true; imageDataUrl: string; imageName?: string; options?: GenerationOptions }
  | { ok: false; status: 400; error: string } {
  const parsed = generationRequestSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, status: 400, error: 'Invalid generation request body' };
  }

  const imageDataUrl = parsed.data.imageDataUrl;
  if (!/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(imageDataUrl)) {
    return {
      ok: false,
      status: 400,
      error: 'imageDataUrl must be a base64 data URL (png, jpg, jpeg, or webp)',
    };
  }

  return {
    ok: true,
    imageDataUrl,
    imageName: parsed.data.imageName,
    options: parsed.data.options,
  };
}
