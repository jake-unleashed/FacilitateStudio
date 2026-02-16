/**
 * Client-side document processing utilities.
 * Extracts plain text from PDF, Word, and text files for SOP analysis.
 */

import { ValidationError } from './errors';
// NOTE: We intentionally lazy-load PDF.js inside `processPDF()`.
// `pdfjs-dist` depends on browser globals (e.g. DOMMatrix). Importing it at
// module load time breaks Node/JSDOM unit tests that import this file.
let isPdfJsConfigured = false;
type PdfTextContent = { items: unknown[] };
type PdfPage = { getTextContent: () => Promise<PdfTextContent> };
type PdfDocument = { numPages: number; getPage: (pageNum: number) => Promise<PdfPage> };
type PdfJsModule = {
  getDocument: (src: { data: ArrayBuffer }) => { promise: Promise<PdfDocument> };
  GlobalWorkerOptions: { workerSrc: string };
};

async function loadPdfJs(): Promise<PdfJsModule> {
  const pdfjsLib = (await import('pdfjs-dist')) as unknown as PdfJsModule;
  const workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

  if (!isPdfJsConfigured) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
    isPdfJsConfigured = true;
  }

  return pdfjsLib;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum file size accepted for processing (10 MB). */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Maximum extracted text length before truncation (100 k characters). */
const MAX_TEXT_LENGTH = 100_000;

/** File extensions we can handle. */
const SUPPORTED_EXTENSIONS = ['pdf', 'doc', 'docx', 'txt', 'rtf'] as const;

export type SupportedDocumentType = (typeof SUPPORTED_EXTENSIONS)[number];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DocumentTextResult {
  text: string;
  wordCount: number;
  pageCount?: number;
}

export type DocumentErrorType =
  | 'unsupported_format'
  | 'file_too_large'
  | 'empty_document'
  | 'extraction_failed';

export class DocumentProcessingError extends ValidationError {
  type: DocumentErrorType;
  constructor(type: DocumentErrorType, message: string) {
    super(message);
    this.type = type;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Accept string for file input `accept` attribute.
 */
export const ACCEPTED_FILE_TYPES = '.pdf,.doc,.docx,.txt,.rtf';

/**
 * Processes a document file and returns its extracted text content.
 *
 * @throws {DocumentProcessingError} with a user-friendly message on failure.
 */
export async function processDocument(file: File): Promise<DocumentTextResult> {
  // --- Validate size ---
  if (file.size > MAX_FILE_SIZE) {
    throw new DocumentProcessingError(
      'file_too_large',
      'File is too large. Maximum size is 10 MB.'
    );
  }

  // --- Validate extension ---
  const extension = getFileExtension(file.name).toLowerCase();
  if (!isSupportedExtension(extension)) {
    throw new DocumentProcessingError(
      'unsupported_format',
      'Unsupported file format. Please use PDF, Word (.doc/.docx), or plain text (.txt/.rtf) files.'
    );
  }

  // --- Extract text ---
  let result: DocumentTextResult;
  try {
    switch (extension) {
      case 'pdf':
        result = await processPDF(file);
        break;
      case 'doc':
      case 'docx':
        result = await processWordDocument(file);
        break;
      case 'txt':
      case 'rtf':
        result = await processTextDocument(file);
        break;
      default:
        throw new DocumentProcessingError('unsupported_format', `Unsupported file type: .${extension}`);
    }
  } catch (error) {
    if (error instanceof DocumentProcessingError) throw error;
    throw new DocumentProcessingError(
      'extraction_failed',
      'Failed to extract text from document. The file may be corrupted or in an unsupported encoding.'
    );
  }

  // --- Validate content ---
  if (!result.text || result.text.trim().length === 0) {
    throw new DocumentProcessingError(
      'empty_document',
      'Document appears to be empty or contains no readable text.'
    );
  }

  // --- Truncate if needed ---
  if (result.text.length > MAX_TEXT_LENGTH) {
    result.text =
      result.text.substring(0, MAX_TEXT_LENGTH) +
      '\n\n[Document truncated due to length]';
  }

  return result;
}

// ---------------------------------------------------------------------------
// Format-specific extractors
// ---------------------------------------------------------------------------

async function processPDF(file: File): Promise<DocumentTextResult> {
  const pdfjsLib = await loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = '';
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: unknown) => {
        if (!item || typeof item !== 'object') return '';
        const maybe = item as { str?: unknown };
        return typeof maybe.str === 'string' ? maybe.str : '';
      })
      .join(' ');
    fullText += pageText + '\n';
  }

  return {
    text: fullText.trim(),
    wordCount: countWords(fullText),
    pageCount: pdf.numPages,
  };
}

async function processWordDocument(file: File): Promise<DocumentTextResult> {
  // Dynamic import so the mammoth bundle is only loaded when needed.
  const mammoth = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });

  return {
    text: result.value.trim(),
    wordCount: countWords(result.value),
  };
}

async function processTextDocument(file: File): Promise<DocumentTextResult> {
  const text = await file.text();
  return {
    text: text.trim(),
    wordCount: countWords(text),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isSupportedExtension(ext: string): ext is SupportedDocumentType {
  return (SUPPORTED_EXTENSIONS as readonly string[]).includes(ext);
}

function getFileExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf('.');
  return dotIndex >= 0 ? filename.slice(dotIndex + 1) : '';
}

function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}
