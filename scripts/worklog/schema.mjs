/**
 * Worklog NDJSON Event Schema
 * 
 * This module defines the canonical schema for all worklog events.
 * Events are append-only and stored in .git/worklog/events.ndjson.
 */

/**
 * Base fields common to all events
 * @typedef {Object} BaseEvent
 * @property {string} ts - ISO 8601 timestamp with timezone
 * @property {string} type - Event type discriminator
 * @property {string} branch - Git branch name at time of event
 * @property {string} [feature] - Feature identifier (defaults to branch name)
 */

/**
 * Session start event (triggered by beforeSubmitPrompt hook)
 * @typedef {Object} SessionStartEvent
 * @property {'session_start'} type
 * @property {string} conversationId - Cursor conversation ID
 * @property {string} generationId - Cursor generation ID for this turn
 * @property {string} intentSummary - 1-2 sentence summary of user's intention
 * @property {string} [promptHash] - Optional SHA256 hash of prompt for traceability
 */

/**
 * Session end event (triggered by stop hook)
 * @typedef {Object} SessionEndEvent
 * @property {'session_end'} type
 * @property {string} conversationId
 * @property {string} generationId
 * @property {'completed'|'aborted'|'error'|'unknown'} status
 * @property {number} durationMs - Duration since session_start
 * @property {string[]} insights - 0-2 insight/diary bullets extracted from assistant response
 * @property {string} [responseHash] - Optional SHA256 hash of final response
 */

/**
 * Git commit event (triggered by post-commit hook)
 * @typedef {Object} CommitEvent
 * @property {'commit'} type
 * @property {string} hash - Git commit SHA
 * @property {string} subject - Commit message subject line
 * @property {number} [filesChanged] - Number of files changed
 * @property {number} [insertions] - Lines inserted
 * @property {number} [deletions] - Lines deleted
 */

/**
 * Git push event (triggered by pre-push hook)
 * @typedef {Object} PushEvent
 * @property {'push'} type
 * @property {string} remote - Remote name (e.g., 'origin')
 * @property {string} range - Commit range being pushed (e.g., 'abc123..def456')
 * @property {string[]} commits - Array of commit SHAs included in push
 */

/**
 * Feature digest pointer event (written when digest is generated)
 * @typedef {Object} FeatureDigestEvent
 * @property {'feature_digest'} type
 * @property {string} digestPath - Path to generated markdown digest
 * @property {string} fromCommit - First commit in range
 * @property {string} toCommit - Last commit in range
 * @property {string} featureId - Feature identifier
 */

/**
 * Tool use event (optional, for granular tracking)
 * @typedef {Object} ToolEvent
 * @property {'tool'} type
 * @property {string} conversationId
 * @property {string} generationId
 * @property {string} toolName - Tool name (e.g., 'Shell', 'Write', 'Read')
 * @property {string} [toolInput] - Truncated tool input
 * @property {'started'|'completed'|'failed'} status
 */

/**
 * Assistant response event (triggered by afterAgentResponse hook)
 * @typedef {Object} AssistantResponseEvent
 * @property {'assistant_response'} type
 * @property {string} conversationId
 * @property {string} generationId
 * @property {string} intentSummary - Intention parsed from WORKLOG_START (or fallback)
 * @property {'text'|'transcript'|'missing'} [source] - Where intentSummary came from
 * @property {string} [responseHash] - Optional hash of assistant response text
 */

/**
 * Feature window determination rules:
 * - Feature ID defaults to current branch name
 * - A feature is considered "open" from first session_start or commit on a branch
 * - A feature is considered "closed" when:
 *   1. A push event occurs, OR
 *   2. The branch changes (next event is on different branch)
 * - Feature boundaries are inferred during digest generation
 */

export const EventTypes = {
  SESSION_START: 'session_start',
  SESSION_END: 'session_end',
  COMMIT: 'commit',
  PUSH: 'push',
  FEATURE_DIGEST: 'feature_digest',
  TOOL: 'tool',
  ASSISTANT_RESPONSE: 'assistant_response',
};

export const SessionStatus = {
  COMPLETED: 'completed',
  ABORTED: 'aborted',
  ERROR: 'error',
  UNKNOWN: 'unknown',
};

/**
 * Validates an event has required base fields
 */
export function validateBaseEvent(event) {
  if (!event.ts || !event.type || !event.branch) {
    throw new Error(
      `Invalid event: missing required fields (ts, type, branch). Got: ${JSON.stringify(event)}`
    );
  }
  if (!Object.values(EventTypes).includes(event.type)) {
    throw new Error(`Invalid event type: ${event.type}`);
  }
}

/**
 * Creates a base event object with common fields
 */
export function createBaseEvent(type, branch, feature = null) {
  return {
    ts: new Date().toISOString(),
    type,
    branch,
    feature: feature || branch,
  };
}
