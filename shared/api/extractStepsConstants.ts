export const MAX_EXTRACTED_STEPS = 50;
export const MAX_INPUT_TEXT_LENGTH = 100_000;
export const MAX_FILENAME_LENGTH = 256;
export const MAX_REQUEST_BODY_BYTES = 524_288;
export const RATE_LIMIT_WINDOW_MS = 60_000;
export const DEFAULT_USER_LIMIT_PER_MINUTE = 10;
export const DEFAULT_IP_LIMIT_PER_MINUTE = 20;
export const OPENAI_TIMEOUT_MS_DEFAULT = 12_000;
// Keep token budget bounded to avoid long/expensive responses while still
// fitting typical 8-14 step SOP outputs plus model formatting overhead.
export const OPENAI_MAX_TOKENS = 600;
