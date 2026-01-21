/**
 * Convert base64 string to ArrayBuffer.
 * Used when we receive base64 data from storage.
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Convert base64 string to text (for OBJ files which are text-based).
 */
export function base64ToText(base64: string): string {
  const binaryString = atob(base64);
  // Use TextDecoder for proper UTF-8 handling
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new TextDecoder('utf-8').decode(bytes);
}

