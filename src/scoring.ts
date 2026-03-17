// ============================================================
// Lucid SDK — Scoring Engine
// EMA adaptive smoothing, cognitive score, and level calculation
// ============================================================
//
// Based on research:
// - MIT Media Lab 2025: AI cognitive dependency study
// - Neuroplasticity principles ("use it or lose it")
// - Cognitive scaffolding in education
//
// Score System:
//   Experience unlocks POTENTIAL (slow sqrt growth)
//   Quality determines how much POTENTIAL is used
//   Score = maxPotential × qualityScore (0-10000)
//   Level = floor(score / 1000) (0-10)
//
// EMA Adaptive Alpha:
//   α = max(MIN, BASE / log₁₀(messages + 10))
//   New users: α ≈ 10% (profile malleable)
//   Established users: α ≈ 2-3% (profile stable)
// ============================================================

import type { ScaffoldingLevel, TrustCalibration, MotivationType } from './types';

// ========== CONSTANTS ==========

/** Starting alpha for new users (10%) */
export const EMA_ALPHA_BASE = 0.1;

/** Minimum alpha for established users (2%) */
export const EMA_ALPHA_MIN = 0.02;

/** Messages needed for experience factor to reach 100% */
export const EXPERIENCE_MESSAGES_MAX = 1000;

/** Maximum cognitive score */
export const MAX_SCORE = 10000;

/** Points per level */
export const POINTS_PER_LEVEL = 1000;

/** Maximum level (0-10) */
export const MAX_LEVEL = 10;

/** Autonomy change threshold to shift trend */
export const TREND_THRESHOLD = 0.05;

// ========== WEIGHT CONFIGURATION ==========

/**
 * Weights for quality score calculation.
 * These determine how much each dimension contributes to the final score.
 *
 * Research-derived weights:
 *
 * autonomy (30%): Strongest predictor of cognitive outcomes.
 *   SDT meta-analysis (Howard et al., 2024): autonomy → cognitive skills r=.28
 *   Gerlich (2025): cognitive offloading → critical thinking r=-.75
 *   MIT Media Lab: delegation is the most damaging pattern (55% neural connectivity loss)
 *
 * metacognition (20%): Strongest independent predictor of learning.
 *   Veenman et al. (2006): 17% unique variance in learning outcomes (1.7x intelligence)
 *
 * learning (20%): Important for motivation, weaker for cognitive outcomes.
 *   SDT: competence → performance r=.04 (weak), but competence → engagement r=.44
 *
 * verification (15%): Protective mechanism for critical thinking.
 *   Lee et al. (Microsoft/CMU, CHI 2025): verification is what remains of
 *   critical thinking in AI-assisted work
 *
 * engagement (15%): Necessary but insufficient alone.
 *   MIT: users can be "engaged" with AI in ways that still reduce cognitive capacity
 */
export const QUALITY_WEIGHTS = {
  autonomy: 0.30,
  metacognition: 0.20,
  learning: 0.20,
  verification: 0.15,
  engagement: 0.15,
} as const;

// ========== FUNCTIONS ==========

/**
 * Calculate adaptive EMA alpha based on total messages.
 *
 * More messages → more stable profile → lower alpha.
 * This means a single bad message won't significantly affect
 * an established user's profile.
 *
 * Formula: α = max(MIN, BASE / log₁₀(messages + 10))
 *
 * | Messages | Alpha | Weight of new msg |
 * |----------|-------|-------------------|
 * | 1        | 10%   | High              |
 * | 50       | 6%    | Medium            |
 * | 100      | 5%    | Medium-Low        |
 * | 500      | 4%    | Low               |
 * | 1000     | 3%    | Very Low          |
 * | 5000+    | 2%    | Minimum           |
 */
export function getAdaptiveAlpha(totalMessages: number): number {
  const adaptiveAlpha = EMA_ALPHA_BASE / Math.log10(totalMessages + 10);
  return Math.max(EMA_ALPHA_MIN, adaptiveAlpha);
}

/**
 * Calculate Exponential Moving Average.
 *
 * EMA smooths cognitive scores over time, preventing
 * single messages from drastically changing the profile.
 *
 * Formula: newValue = α × current + (1-α) × previous
 *
 * @param current - The new observation value
 * @param previous - The previous EMA value (undefined for first observation)
 * @param alpha - Smoothing factor (0-1), typically from getAdaptiveAlpha()
 */
export function calculateEMA(
  current: number,
  previous: number | undefined,
  alpha: number
): number {
  if (previous === undefined) return current;
  return alpha * current + (1 - alpha) * previous;
}

/**
 * Clamp a value to a min/max range.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Calculate the quality score (0-1) from cognitive dimensions.
 *
 * Quality represents how well the user engages cognitively.
 * It combines five dimensions with research-derived weights:
 * - Autonomy: [0,1] → weight 30%
 * - Metacognition: [0,1] → weight 20%
 * - Learning: [0,1] → weight 20%
 * - Verification: [0,1] → weight 15%
 * - Engagement: [0,1] → weight 15%
 */
export function calculateQualityScore(
  autonomy: number,
  learning: number,
  engagement: number,
  metacognition: number = 0,
  verification: number = 0
): number {
  return (
    autonomy * QUALITY_WEIGHTS.autonomy +
    metacognition * QUALITY_WEIGHTS.metacognition +
    learning * QUALITY_WEIGHTS.learning +
    verification * QUALITY_WEIGHTS.verification +
    engagement * QUALITY_WEIGHTS.engagement
  );
}

/**
 * Calculate the experience factor (0-1) from total messages.
 *
 * Uses square root for SLOW growth:
 * - 1 msg = 3%
 * - 10 msgs = 10%
 * - 50 msgs = 22%
 * - 100 msgs = 32%
 * - 500 msgs = 71%
 * - 1000 msgs = 100%
 *
 * This ensures users can't reach high levels quickly —
 * they need both quality AND quantity.
 */
export function calculateExperienceFactor(totalMessages: number): number {
  return Math.min(1, Math.sqrt(totalMessages) / Math.sqrt(EXPERIENCE_MESSAGES_MAX));
}

/**
 * Calculate the cognitive score (0-10000).
 *
 * Score = maxPotential × qualityScore
 * Where maxPotential = experienceFactor × 10000
 *
 * This creates a system where:
 * - Experience unlocks POTENTIAL (the ceiling)
 * - Quality determines how much of that ceiling you reach
 * - A new user with perfect quality still scores low
 * - An established user with poor quality also scores low
 */
export function calculateScore(
  autonomy: number,
  learning: number,
  engagement: number,
  totalMessages: number,
  metacognition: number = 0,
  verification: number = 0
): number {
  const quality = calculateQualityScore(autonomy, learning, engagement, metacognition, verification);
  const experience = calculateExperienceFactor(totalMessages);
  const maxPotential = experience * MAX_SCORE;
  return Math.round(maxPotential * quality);
}

/**
 * Calculate the cognitive level (0-10) from score.
 * Each level = 1000 points.
 */
export function calculateLevel(score: number): number {
  return Math.min(MAX_LEVEL, Math.floor(score / POINTS_PER_LEVEL));
}

/**
 * Calculate progress within the current level (0-1).
 * E.g., score=3500 → level=3, progress=0.5
 */
export function getLevelProgress(score: number): number {
  const level = calculateLevel(score);
  if (level >= MAX_LEVEL) return 1;
  const levelStart = level * POINTS_PER_LEVEL;
  return (score - levelStart) / POINTS_PER_LEVEL;
}

/**
 * Determine cognitive trend based on autonomy change.
 */
export function calculateTrend(
  currentAutonomy: number,
  previousAutonomy: number | undefined,
  previousTrend?: 'improving' | 'stable' | 'declining'
): 'improving' | 'stable' | 'declining' {
  if (previousAutonomy === undefined) return 'stable';
  const diff = currentAutonomy - previousAutonomy;
  if (diff > TREND_THRESHOLD) return 'improving';
  if (diff < -TREND_THRESHOLD) return 'declining';
  return previousTrend || 'stable';
}

/**
 * Determine the scaffolding level based on the user's cognitive profile.
 *
 * Implements progressive fading of AI support based on Vygotsky's ZPD:
 * - full: User needs maximum support (low autonomy + low learning)
 * - guided: User is developing, needs structured help
 * - hints: User is competent, only needs nudges
 * - challenge: User is independent, challenge them to grow further
 *
 * The scaffolding level drives how much direct help AI provides.
 */
export function getScaffoldingLevel(
  autonomy: number,
  learning: number,
  metacognition: number,
  totalMessages: number
): ScaffoldingLevel {
  // Need at least some history to move beyond 'full'
  if (totalMessages < 5) return 'full';

  // Composite readiness score (0-1)
  const readiness = autonomy * 0.4 + learning * 0.3 + metacognition * 0.3;

  if (readiness >= 0.7) return 'challenge';
  if (readiness >= 0.5) return 'hints';
  if (readiness >= 0.3) return 'guided';
  return 'full';
}

/**
 * Get ISO week string for a date (e.g., "2024-W05").
 */
export function getWeekString(date: Date): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const days = Math.floor((d.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const week = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  return `${year}-W${week.toString().padStart(2, '0')}`;
}

/**
 * Detect if the current scores represent a context change
 * (e.g., user switching from backend to frontend).
 *
 * When a significant deviation is detected, returns a boosted alpha
 * so the EMA adapts faster to the new context instead of treating
 * the deviation as noise.
 *
 * Detection: If the current score deviates from the EMA by more than
 * the threshold, boost alpha temporarily. The boost is proportional
 * to the deviation size.
 *
 * @returns Boosted alpha if context change detected, null otherwise
 */
export const CONTEXT_CHANGE_THRESHOLD = 0.4;
export const CONTEXT_CHANGE_ALPHA_BOOST = 0.08;

export function detectContextChangeAlpha(
  currentScore: number,
  emaScore: number | undefined,
  baseAlpha: number
): number {
  if (emaScore === undefined) return baseAlpha;

  const deviation = Math.abs(currentScore - emaScore);
  if (deviation > CONTEXT_CHANGE_THRESHOLD) {
    // Boost alpha proportionally to deviation, capped at CONTEXT_CHANGE_ALPHA_BOOST
    const boost = Math.min(CONTEXT_CHANGE_ALPHA_BOOST, deviation * 0.15);
    return Math.min(0.15, baseAlpha + boost);
  }
  return baseAlpha;
}

/**
 * Determine trust calibration from verification score.
 *
 * Based on metacognitive sensitivity research (PNAS Nexus, 2025):
 * - Over-trust (< 0.2): User accepts AI output without questioning — risky
 * - Calibrated (0.2–0.7): User selectively verifies — healthy
 * - Under-trust (> 0.7): User questions everything — inefficient
 *
 * Note: Very high verification can indicate healthy skepticism in
 * early interactions, so this is most meaningful after 10+ messages.
 */
export function getTrustCalibration(avgVerification: number): TrustCalibration {
  if (avgVerification < 0.2) return 'over_trust';
  if (avgVerification > 0.7) return 'under_trust';
  return 'calibrated';
}

/**
 * Determine dominant motivation type from cumulative counts.
 * Returns the most frequent motivation observed across all interactions.
 */
export function getDominantMotivation(
  counts: { intrinsic: number; instrumental: number; avoidance: number }
): MotivationType {
  const { intrinsic, instrumental, avoidance } = counts;
  if (intrinsic >= instrumental && intrinsic >= avoidance) return 'intrinsic';
  if (avoidance >= instrumental) return 'avoidance';
  return 'instrumental';
}
