/**
 * Extract a human-readable error message from various error types.
 * GLTFLoader can pass Error, ErrorEvent, string, or other types to the error callback.
 */
export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (error instanceof ErrorEvent) {
    return error.message || 'Network or file loading error';
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object') {
    // Check for common error-like properties
    const errorObj = error as Record<string, unknown>;
    if (typeof errorObj.message === 'string') {
      return errorObj.message;
    }
    if (typeof errorObj.error === 'string') {
      return errorObj.error;
    }
    // Try to stringify the object for debugging
    try {
      return JSON.stringify(error);
    } catch {
      return 'Unknown parsing error (object)';
    }
  }
  return 'Unknown error occurred';
}

