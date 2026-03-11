export abstract class AppError extends Error {
  abstract readonly code: string;
  abstract readonly retryable: boolean;
  readonly context?: Record<string, unknown>;

  constructor(message: string, context?: Record<string, unknown>) {
    super(message);
    this.name = new.target.name;
    this.context = context;
  }
}

export class ValidationError extends AppError {
  readonly code = 'VALIDATION_ERROR';
  readonly retryable = false;
}

export class StorageError extends AppError {
  readonly code = 'STORAGE_ERROR';
  readonly retryable = true;
}

export class NotFoundError extends AppError {
  readonly code = 'NOT_FOUND';
  readonly retryable = false;
}

/**
 * Convert unknown thrown values into a user-safe message.
 */
export function getErrorMessage(error: unknown, fallback = 'An unexpected error occurred.'): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  if (typeof error === 'string' && error.trim()) {
    return error;
  }
  if (error && typeof error === 'object') {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === 'string' && maybeMessage.trim()) {
      return maybeMessage;
    }
  }
  return fallback;
}
