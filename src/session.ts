// ============================================================
// Lucid SDK — Session Tracking & Fatigue Detection
// Monitors cognitive fatigue through session duration,
// message count, and response shortening patterns.
// ============================================================
//
// Fatigue indicators:
// 1. Session duration exceeds age-appropriate threshold
// 2. Message count exceeds age-appropriate limit
// 3. User responses progressively shortening (avg < 20 chars)
//
// A "session" resets after 30 minutes of inactivity.
//
// Age-based thresholds are grounded in developmental research:
// - Child (6-12): Sustained attention ~15-20 min (Mackworth, 1948;
//   Bunce et al., 2010). Shorter sessions protect foundational learning.
// - Teen (13-17): Attention span improving but still limited ~20-25 min
//   (Steinberg, 2005). High neuroplasticity = higher dependency risk.
// - Young adult (18-24): ~30 min, prefrontal cortex still maturing
//   (Arain et al., 2013).
// - Adult (25+): ~45-50 min sustained attention (Mackworth, 1948;
//   Neri et al., 2002). Standard thresholds.
// ============================================================

import type { SessionData, AgeGroup } from './types';

// ========== CONSTANTS ==========

/** Minutes of inactivity before starting a new session */
export const SESSION_GAP_MINUTES = 30;

// --- Session duration limits (minutes) ---

/** Minutes before suggesting a break — adults (25+) */
export const FATIGUE_SESSION_MINUTES = 45;

/** Minutes before suggesting a break — young adults (18-24) */
export const FATIGUE_SESSION_MINUTES_YOUNG_ADULT = 30;

/** Minutes before suggesting a break — teens (13-17) */
export const FATIGUE_SESSION_MINUTES_TEEN = 20;

/** Minutes before suggesting a break — children (6-12) */
export const FATIGUE_SESSION_MINUTES_CHILD = 15;

// --- Message count limits per session ---

/** Messages in a session before suggesting a break — adults (25+) */
export const FATIGUE_MESSAGE_COUNT = 30;

/** Messages in a session before suggesting a break — young adults (18-24) */
export const FATIGUE_MESSAGE_COUNT_YOUNG_ADULT = 20;

/** Messages in a session before suggesting a break — teens (13-17) */
export const FATIGUE_MESSAGE_COUNT_TEEN = 15;

/** Messages in a session before suggesting a break — children (6-12) */
export const FATIGUE_MESSAGE_COUNT_CHILD = 10;

/** Minimum responses needed to detect shortening pattern */
export const FATIGUE_MIN_RESPONSES = 3;

/** Average response length (chars) threshold for fatigue */
export const FATIGUE_SHORT_RESPONSE_THRESHOLD = 20;

/** How many recent response lengths to track */
export const RESPONSE_LENGTHS_WINDOW = 5;

// ========== HELPERS ==========

/**
 * Resolve age group to normalized form.
 */
function resolveAgeGroup(ageGroup?: AgeGroup): 'child' | 'teen' | 'young_adult' | 'adult' {
  if (!ageGroup || ageGroup === 'adult') return 'adult';
  return ageGroup;
}

/**
 * Get the session duration limit (minutes) for an age group.
 */
export function getSessionLimit(ageGroup?: AgeGroup): number {
  switch (resolveAgeGroup(ageGroup)) {
    case 'child': return FATIGUE_SESSION_MINUTES_CHILD;
    case 'teen': return FATIGUE_SESSION_MINUTES_TEEN;
    case 'young_adult': return FATIGUE_SESSION_MINUTES_YOUNG_ADULT;
    default: return FATIGUE_SESSION_MINUTES;
  }
}

/**
 * Get the message count limit per session for an age group.
 */
export function getMessageLimit(ageGroup?: AgeGroup): number {
  switch (resolveAgeGroup(ageGroup)) {
    case 'child': return FATIGUE_MESSAGE_COUNT_CHILD;
    case 'teen': return FATIGUE_MESSAGE_COUNT_TEEN;
    case 'young_adult': return FATIGUE_MESSAGE_COUNT_YOUNG_ADULT;
    default: return FATIGUE_MESSAGE_COUNT;
  }
}

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
  const sessionLimit = getSessionLimit(ageGroup);
  const messageLimit = getMessageLimit(ageGroup);

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
