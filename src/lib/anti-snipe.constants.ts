/**
 * Classic anti-sniping rule: a bid landing in the closing seconds of an
 * ascending auction pushes the deadline back, so a last-instant bid can
 * always be seen and responded to rather than winning by timing alone.
 */
export const ANTI_SNIPE_WINDOW_MS = 30_000;
export const ANTI_SNIPE_EXTENSION_MS = 60_000;

/** Auto-close is polled at this interval as a safety net — see scheduler.ts. */
export const AUTO_CLOSE_POLL_INTERVAL_MS = 10_000;
