/**
 * SOP Service
 *
 * Orchestrates document processing and AI step extraction for the
 * guided workflow "Upload an SOP" flow.
 */

import {
  processDocument,
  DocumentProcessingError,
} from '../utils/documentProcessor';
import { supabase } from '../lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SOPProcessingStage =
  | 'extracting-text'
  | 'analyzing-steps'
  | 'complete'
  | 'error';

export interface SOPProcessingProgress {
  stage: SOPProcessingStage;
  /** User-facing status message. */
  message: string;
}

export interface SOPExtractionResult {
  steps: string[];
}

export interface SOPExtractionError {
  /** User-facing error message. */
  message: string;
  /** Whether the user should retry with the same file or pick a different one. */
  retryable: boolean;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * End-to-end SOP step extraction.
 *
 * 1. Extracts text from the uploaded file (client-side).
 * 2. Sends the text to the `/api/ai/extract-steps` edge function.
 * 3. Returns the extracted steps or a user-friendly error.
 *
 * @param file      The file selected by the user.
 * @param onProgress  Optional callback to update the UI with processing status.
 */
export async function extractStepsFromFile(
  file: File,
  onProgress?: (progress: SOPProcessingProgress) => void
): Promise<SOPExtractionResult> {
  // ---- Step 1: Extract text ----
  onProgress?.({
    stage: 'extracting-text',
    message: 'Extracting text from document\u2026',
  });

  let text: string;
  try {
    const result = await processDocument(file);
    text = result.text;
  } catch (error) {
    const msg =
      error instanceof DocumentProcessingError
        ? error.message
        : 'Failed to read document. Please try a different file.';

    onProgress?.({ stage: 'error', message: msg });

    // Document parsing errors are almost always file-specific (wrong format, too large, empty,
    // corrupted). Retrying the same file rarely helps, so treat these as non-retryable.
    throw new SOPServiceError(msg, !(error instanceof DocumentProcessingError));
  }

  // ---- Step 2: Call AI extraction API ----
  onProgress?.({
    stage: 'analyzing-steps',
    message: 'Analyzing steps\u2026',
  });

  let data: { steps?: string[]; error?: string };
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }

    const response = await fetch('/api/ai/extract-steps', {
      method: 'POST',
      headers,
      body: JSON.stringify({ text, filename: file.name }),
    });

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      throw new SOPServiceError(
        'AI extraction is not available. Start the AI API and try again.',
        true
      );
    }

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) {
        throw new SOPServiceError(
          'You need to be signed in to analyze SOP documents.',
          false
        );
      }
      throw new SOPServiceError(
        String(body?.error || `Server error (${response.status})`),
        response.status >= 500
      );
    }

    data = body;
  } catch (error) {
    if (error instanceof SOPServiceError) throw error;

    const msg =
      error instanceof Error
        ? error.message
        : 'Failed to analyze the document. Please try again.';

    onProgress?.({ stage: 'error', message: msg });
    throw new SOPServiceError(msg, true);
  }

  // ---- Handle API response ----
  if (data.error) {
    const msg = data.error;
    onProgress?.({ stage: 'error', message: msg });
    throw new SOPServiceError(msg, false);
  }

  if (!data.steps || data.steps.length === 0) {
    const msg = 'No steps could be extracted. Try uploading a different document.';
    onProgress?.({ stage: 'error', message: msg });
    throw new SOPServiceError(msg, false);
  }

  onProgress?.({ stage: 'complete', message: 'Done!' });
  return { steps: data.steps };
}

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class SOPServiceError extends Error {
  /** Whether the same file could succeed on retry (e.g. network issue). */
  retryable: boolean;

  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = 'SOPServiceError';
    this.retryable = retryable;
  }
}
