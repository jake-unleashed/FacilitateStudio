import dotenv from 'dotenv';
import express from 'express';
import OpenAI from 'openai';
import {
  getExtractSopStepsSystemPrompt,
} from '../shared/ai/extractSopStepsPrompt.js';

// Load local environment variables for development.
// - `.env.local` is gitignored and is where secrets should live.
// - We also load `.env` as a fallback if the user prefers it.
dotenv.config({ path: '.env.local' });
dotenv.config();

// Keep this fixed to match the Vite dev proxy target.
const PORT = 8787;
const MAX_EXTRACTED_STEPS = 50;

const app = express();
app.use(express.json({ limit: '2mb' }));

app.post('/api/ai/extract-steps', async (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  const filename = typeof req.body?.filename === 'string' ? req.body.filename : undefined;

  if (!text) {
    return res.status(400).json({ error: 'Missing or empty "text" field' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server misconfiguration: OPENAI_API_KEY is missing' });
  }

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
      { signal: controller.signal }
    );

    const content = completion?.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return res.status(502).json({ error: 'Empty AI response' });
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      return res.status(502).json({ error: 'Invalid AI response format' });
    }

    const steps = Array.isArray(parsed?.steps)
      ? parsed.steps
          .map((s) => (typeof s === 'string' ? s.trim() : ''))
          .filter(Boolean)
          .slice(0, MAX_EXTRACTED_STEPS)
      : [];

    if (steps.length > 0) {
      return res.json({ steps });
    }

    if (parsed?.error) {
      return res.status(422).json({ error: String(parsed.error) });
    }

    return res.status(422).json({ error: 'No steps could be extracted from this document.' });
  } catch {
    return res.status(502).json({ error: 'Failed to analyze the document. Please try again.' });
  } finally {
    clearTimeout(timeout);
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[dev-api] listening on http://localhost:${PORT}`);
});

