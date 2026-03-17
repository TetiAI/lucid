// ============================================================
// Lucid SDK — Cognitive Drift Detection
// Detects gradual, often invisible shifts in cognitive patterns
// across sessions over time (weeks/months).
// ============================================================
//
// Based on research:
// - Cognitive Drift Index (CDI) studies showing 17-24% drift
//   in 90-minute AI-assisted sessions (2025)
// - Cognitive Atrophy Paradox: delegation drift as slow
//   reallocation of cognitive responsibility (MDPI, 2025)
// - Entangled Human-AI cognition: behavioral drift in
//   repeated interactions (arxiv, 2026)
//
// Unlike fatigue (short-term, within a session), drift is a
// long-term phenomenon that happens across weeks/months.
// ============================================================

import type { WeeklySnapshot } from './types';

/** Minimum weeks of history needed to calculate drift */
export const DRIFT_MIN_WEEKS = 3;

/** Drift index above this triggers "drifting" guidelines */
export const DRIFT_WARNING_THRESHOLD = 0.3;

/** Drift index above this triggers "severe drift" guidelines */
export const DRIFT_SEVERE_THRESHOLD = 0.6;

/**
 * Calculate the Cognitive Drift Index (CDI) from weekly history.
 *
 * Compares recent weeks against earlier weeks across all dimensions.
 * A positive drift index means cognitive engagement is declining
 * over time — the user is gradually offloading more thinking to AI.
 *
 * The index is 0-1 where:
 * - 0 = perfectly stable or improving
 * - 0.3+ = noticeable drift (warning)
 * - 0.6+ = severe drift (intervention needed)
 *
 * Algorithm:
 * 1. Split history into "early" (first half) and "recent" (second half)
 * 2. Average each dimension for both halves
 * 3. Calculate decline per dimension (negative change = drift)
 * 4. Weight and normalize to 0-1
 */
export function calculateDriftIndex(history: WeeklySnapshot[]): number {
  if (!history || history.length < DRIFT_MIN_WEEKS) return 0;

  const mid = Math.floor(history.length / 2);
  const early = history.slice(0, mid);
  const recent = history.slice(mid);

  const avgEarly = averageSnapshots(early);
  const avgRecent = averageSnapshots(recent);

  // Calculate decline for each dimension (positive = got worse)
  const autonomyDecline = avgEarly.autonomy - avgRecent.autonomy;
  const learningDecline = avgEarly.learning - avgRecent.learning;
  const engagementDecline = avgEarly.engagement - avgRecent.engagement;
  const metacognitionDecline = avgEarly.metacognition - avgRecent.metacognition;

  // Only count declines (positive values), not improvements
  const weightedDrift =
    Math.max(0, autonomyDecline) * 0.30 +
    Math.max(0, learningDecline) * 0.30 +
    Math.max(0, engagementDecline) * 0.20 +
    Math.max(0, metacognitionDecline) * 0.20;

  // Clamp to 0-1
  return Math.min(1, Math.max(0, weightedDrift * 2)); // ×2 to make the scale more sensitive
}

function averageSnapshots(snapshots: WeeklySnapshot[]): {
  autonomy: number;
  learning: number;
  engagement: number;
  metacognition: number;
} {
  const n = snapshots.length;
  if (n === 0) return { autonomy: 0, learning: 0, engagement: 0, metacognition: 0 };

  return {
    autonomy: snapshots.reduce((s, w) => s + w.autonomy, 0) / n,
    learning: snapshots.reduce((s, w) => s + w.learning, 0) / n,
    engagement: snapshots.reduce((s, w) => s + (w.engagement || 0), 0) / n,
    metacognition: snapshots.reduce((s, w) => s + (w.metacognition || 0), 0) / n,
  };
}
