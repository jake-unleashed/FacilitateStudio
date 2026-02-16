import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { extractStepsFromFile, SOPServiceError } from './sopService';
import { processDocument, DocumentProcessingError } from '../utils/documentProcessor';
import { supabase } from '../lib/supabase';

vi.mock('../utils/documentProcessor', () => ({
  processDocument: vi.fn(),
  DocumentProcessingError: class DocumentProcessingError extends Error {
    type: string;
    constructor(type: string, message: string) {
      super(message);
      this.type = type;
    }
  },
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
  },
}));

const mockProcessDocument = vi.mocked(processDocument);
const mockGetSession = vi.mocked(supabase.auth.getSession);

function createFile(name = 'test.txt'): File {
  return new File(['step 1'], name, { type: 'text/plain' });
}

describe('sopService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
  });

  it('marks document parsing errors as non-retryable', async () => {
    mockProcessDocument.mockRejectedValueOnce(
      new DocumentProcessingError('unsupported_format', 'Unsupported file format.')
    );
    const onProgress = vi.fn();

    await expect(extractStepsFromFile(createFile(), onProgress)).rejects.toMatchObject({
      message: 'Unsupported file format.',
      retryable: false,
    } satisfies Partial<SOPServiceError>);
    expect(onProgress).toHaveBeenCalledWith({
      stage: 'error',
      message: 'Unsupported file format.',
    });
  });

  it('returns retryable timeout when the API call aborts', async () => {
    mockProcessDocument.mockResolvedValueOnce({ text: 'hello', wordCount: 1 });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValueOnce(new DOMException('The operation was aborted.', 'AbortError'))
    );

    await expect(extractStepsFromFile(createFile())).rejects.toMatchObject({
      message: 'The request timed out. Please try again.',
      retryable: true,
    } satisfies Partial<SOPServiceError>);
  });

  it('returns extracted steps on success', async () => {
    mockProcessDocument.mockResolvedValueOnce({ text: 'hello', wordCount: 1 });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify({ steps: ['Step 1', 'Step 2'] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    await expect(extractStepsFromFile(createFile())).resolves.toEqual({
      steps: ['Step 1', 'Step 2'],
    });
  });
});
