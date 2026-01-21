export interface StepCardHandle {
  /** Flush any in-progress edits (e.g. focused textarea that hasn’t blurred yet). */
  flushPendingUpdates: () => void;
}

