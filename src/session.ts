// ============================================================
// Lucid SDK — Session Tracking & Fatigue Detection
// Monitors cognitive fatigue through session duration,
// message count, and response shortening patterns.
// ============================================================
//
// Fatigue indicators:
// 1. Session duration > 45 minutes
// 2. Message count > 30 in a single session
// 3. User responses progressively shortening (avg < 20 chars)
//
// A "session" resets after 30 minutes of inactivity.
// ============================================================

import type { SessionData, AgeGroup } from './types';

// ========== CONSTANTS ==========

/** Minutes of inactivity before starting a new session */
export const SESSION_GAP_MINUTES = 30;

/** Minutes before suggesting a break — standard (adults) */
export const FATIGUE_SESSION_MINUTES = 45;

/** Minutes before suggesting a break — under 25 */
export const FATIGUE_SESSION_MINUTES_UNDER25 = 30;

/** Messages in a session before suggesting a break — standard (adults) */
export const FATIGUE_MESSAGE_COUNT = 30;

/** Messages in a session before suggesting a break — under 25 */
export const FATIGUE_MESSAGE_COUNT_UNDER25 = 20;

/** Minimum responses needed to detect shortening pattern */
export const FATIGUE_MIN_RESPONSES = 3;

/** Average response length (chars) threshold for fatigue */
export const FATIGUE_SHORT_RESPONSE_THRESHOLD = 20;

/** How many recent response lengths to track */
export const RESPONSE_LENGTHS_WINDOW = 5;

// ========== FUNCTIONS ==========

/**
 * Detect if the user is showing signs of cognitive fatigue.
 *
 * Three detection methods:
 * 1. Long session: continuous interaction > FATIGUE_SESSION_MINUTES
 * 2. High volume: > FATIGUE_MESSAGE_COUNT messages in session
 * 3. Shortening: responses getting progressively shorter
 *    (all decreasing AND avg < 20 chars)
 */
export function detectFatigue(
  session: SessionData,
  now: Date,
  ageGroup?: AgeGroup
): { is_fatigued: boolean; reason?: string } {
  const isUnder25 = ageGroup === 'under25';
  const sessionLimit = isUnder25 ? FATIGUE_SESSION_MINUTES_UNDER25 : FATIGUE_SESSION_MINUTES;
  const messageLimit = isUnder25 ? FATIGUE_MESSAGE_COUNT_UNDER25 : FATIGUE_MESSAGE_COUNT;

  // 1. Check session duration
  const sessionStart = new Date(session.started_at);
  const sessionMinutes = (now.getTime() - sessionStart.getTime()) / 60000;

  if (sessionMinutes > sessionLimit) {
    return {
      is_fatigued: true,
      reason: `Session duration: ${Math.round(sessionMinutes)} minutes`,
    };
  }

  // 2. Check message count
  if (session.message_count > messageLimit) {
    return {
      is_fatigued: true,
      reason: `High message count: ${session.message_count} messages`,
    };
  }

  // 3. Check response shortening pattern
  const lengths = session.response_lengths;
  if (lengths.length >= FATIGUE_MIN_RESPONSES) {
    const recent = lengths.slice(-FATIGUE_MIN_RESPONSES);
    const isShortening = recent.every(
      (len, i) => i === 0 || len <= recent[i - 1]
    );
    const avgLength = recent.reduce((a, b) => a + b, 0) / recent.length;

    if (isShortening && avgLength < FATIGUE_SHORT_RESPONSE_THRESHOLD) {
      return {
        is_fatigued: true,
        reason: `Responses shortening: avg ${Math.round(avgLength)} chars`,
      };
    }
  }

  return { is_fatigued: false };
}

/**
 * Update or create session data based on message timing.
 *
 * If the gap between the last message and now exceeds
 * SESSION_GAP_MINUTES, a new session is started.
 * Otherwise, the existing session is continued with
 * updated counters and fatigue detection.
 */
export function updateSession(
  existingSession: SessionData | undefined,
  userMessageLength: number,
  now: Date,
  ageGroup?: AgeGroup
): SessionData {
  const lastMessageAt = existingSession?.last_message_at
    ? new Date(existingSession.last_message_at)
    : null;

  const gapMinutes = lastMessageAt
    ? (now.getTime() - lastMessageAt.getTime()) / 60000
    : Infinity;

  // New session if gap > threshold or no existing session
  if (gapMinutes > SESSION_GAP_MINUTES || !existingSession?.started_at) {
    return {
      started_at: now.toISOString(),
      last_message_at: now.toISOString(),
      message_count: 1,
      response_lengths: [userMessageLength],
      is_fatigued: false,
    };
  }

  // Continue existing session
  const responseLengths = [
    ...(existingSession.response_lengths || []),
    userMessageLength,
  ].slice(-RESPONSE_LENGTHS_WINDOW);

  const fatigueCheck = detectFatigue(
    { ...existingSession, response_lengths: responseLengths },
    now,
    ageGroup
  );

  return {
    started_at: existingSession.started_at,
    last_message_at: now.toISOString(),
    message_count: existingSession.message_count + 1,
    response_lengths: responseLengths,
    is_fatigued: fatigueCheck.is_fatigued,
    fatigue_reason: fatigueCheck.reason,
  };
}

/**
 * Create a fresh empty session.
 */
export function createEmptySession(now: Date = new Date()): SessionData {
  return {
    started_at: now.toISOString(),
    last_message_at: now.toISOString(),
    message_count: 0,
    response_lengths: [],
    is_fatigued: false,
  };
}
