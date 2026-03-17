// ============================================================
// Lucid SDK — Cognitive Guidelines Generator
// Produces adaptive prompt instructions based on the user's
// cognitive profile. Inject these into your AI system prompt
// to adapt responses in real-time.
// ============================================================
//
// The guidelines implement:
// - Age-based protection (under 25)
// - Fatigue detection and break suggestions
// - Cognitive drift alerts (long-term pattern changes)
// - Metacognitive stimulation (self-awareness prompts)
// - Scaffolding fading (progressive autonomy)
// - Delegation type awareness (routine vs cognitive)
// - Autonomy and learning adaptation
// ============================================================

import type { UserCognitiveData, AgeGroup, ScaffoldingLevel } from './types';
import { calculateDriftIndex, DRIFT_WARNING_THRESHOLD, DRIFT_SEVERE_THRESHOLD } from './drift';
import { getScaffoldingLevel, getTrustCalibration, getDominantMotivation } from './scoring';

// ========== THRESHOLDS ==========

/** Autonomy below this triggers "delegation" guidelines */
const LOW_AUTONOMY_THRESHOLD = 0.35;

/** Autonomy above this triggers "independent thinker" guidelines */
const HIGH_AUTONOMY_THRESHOLD = 0.75;

/** Learning below this triggers "low engagement" guidelines */
const LOW_LEARNING_THRESHOLD = 0.3;

/** Delegation ratio above this triggers "high delegation" warning */
const HIGH_DELEGATION_RATIO = 0.5;

/** Metacognition below this triggers metacognitive prompts */
const LOW_METACOGNITION_THRESHOLD = 0.3;

/** Cognitive delegation ratio above this triggers specific warnings */
const HIGH_COGNITIVE_DELEGATION_RATIO = 0.3;

/** Verification below this triggers over-trust warnings */
const LOW_VERIFICATION_THRESHOLD = 0.2;

/** Avoidance ratio above this triggers motivation warnings */
const HIGH_AVOIDANCE_RATIO = 0.3;

// ========== SCAFFOLDING GUIDELINES ==========

const SCAFFOLDING_GUIDELINES: Record<ScaffoldingLevel, string> = {
  full: `
SCAFFOLDING: FULL SUPPORT
- Provide step-by-step guidance for each task
- Show your reasoning process explicitly
- Ask the user to follow along and confirm understanding at each step
- Offer examples and analogies to build mental models
- GENERATION EFFECT: Before showing a solution, ask "What do you think the first step would be?" — even a wrong attempt improves retention`,

  guided: `
SCAFFOLDING: GUIDED
- Provide structure but leave parts for the user to fill in
- Ask guiding questions: "What do you think the next step should be?"
- Give the framework, let them do the reasoning
- Correct gently when they go off track
- GENERATION EFFECT: Ask the user to attempt their own solution first, then compare with yours — self-generated answers are remembered better`,

  hints: `
SCAFFOLDING: HINTS ONLY
- Don't provide direct solutions — give hints and nudges
- Use Socratic questioning: "What would happen if...?"
- Let the user struggle productively before intervening (productive failure improves deep learning)
- Validate their approach when correct, redirect with questions when not
- GENERATION EFFECT: When possible, give the problem structure and let the user generate the solution entirely`,

  challenge: `
SCAFFOLDING: CHALLENGE MODE
- The user is highly capable — challenge them to go deeper
- Ask "Is there a better way?" or "What are the tradeoffs?"
- Propose edge cases and counterexamples
- Treat them as a peer: debate, don't instruct
- GENERATION EFFECT: Present problems without hints — the user learns most by generating solutions from scratch`,
};

// ========== MAIN FUNCTION ==========

/**
 * Build cognitive adaptation guidelines from a user's cognitive profile.
 *
 * Returns a text block ready to be appended to an AI system prompt.
 * The guidelines instruct the AI to adapt its responses based on
 * the user's cognitive state — fatigue, autonomy, learning patterns,
 * metacognition, scaffolding level, and cognitive drift.
 *
 * Returns empty string if no cognitive data is available.
 */
export function buildCognitiveGuidelines(
  data: UserCognitiveData | null | undefined,
  ageGroup?: AgeGroup
): string {
  if (!data || Object.keys(data).length === 0) return '';

  let guidelines = '\n## COGNITIVE SUPPORT\n';
  guidelines += 'Adapt your responses to protect and enhance user cognition:\n';

  const isUnder25 = ageGroup === 'under25';

  // 0. Under-25 general protection — always active for young users
  if (isUnder25) {
    guidelines += `
YOUNG USER PROTECTION (under 25)
- Prioritize teaching and explanation over giving direct solutions
- Always encourage the user to think through problems step by step
- Avoid creating dependency: never just "do it for them" without explanation
- Suggest breaks more proactively
- Frame challenges as learning opportunities\n`;
  }

  // 1. Fatigue detection — highest priority
  if (data.session?.is_fatigued) {
    guidelines += `
FATIGUE DETECTED (${data.session.fatigue_reason || 'extended session'})
- Gently suggest a break: "We've covered a lot - want to save this and continue fresh later?"
- Keep responses shorter and more focused
- Summarize key points if ending the conversation
- Do NOT push for more tasks\n`;
  }

  // 2. Cognitive drift — long-term pattern detection
  const driftIndex = calculateDriftIndex(data.weekly_history);
  if (driftIndex > DRIFT_SEVERE_THRESHOLD) {
    guidelines += `
SEVERE COGNITIVE DRIFT DETECTED (drift index: ${driftIndex.toFixed(2)})
- User's cognitive engagement has been declining significantly over recent weeks
- Actively re-engage: ask thought-provoking questions, don't just execute
- Explicitly invite reflection: "Before I help, what's your take on this?"
- Consider suggesting the user try solving smaller parts independently first\n`;
  } else if (driftIndex > DRIFT_WARNING_THRESHOLD) {
    guidelines += `
COGNITIVE DRIFT WARNING (drift index: ${driftIndex.toFixed(2)})
- User's engagement pattern is gradually shifting toward more passive use
- Gently encourage more active participation
- Ask for their opinion before providing yours
- Occasionally ask: "Want to try this part yourself first?"\n`;
  }

  // 3. Scaffolding level — progressive fading of AI support
  const scaffoldingLevel = getScaffoldingLevel(
    data.avg_autonomy,
    data.avg_learning,
    data.avg_metacognition || 0,
    data.total_messages
  );
  guidelines += SCAFFOLDING_GUIDELINES[scaffoldingLevel];

  // 4. Metacognitive stimulation
  if (data.avg_metacognition !== undefined && data.avg_metacognition < LOW_METACOGNITION_THRESHOLD) {
    guidelines += `
LOW METACOGNITION (${data.avg_metacognition.toFixed(2)})
- The user rarely reflects on their own thinking process
- Occasionally prompt self-awareness: "What made you approach it that way?"
- After solving something, ask: "What did you learn from this that you could apply elsewhere?"
- Encourage verification: "Does this match what you expected?"\n`;
  }

  // 5. Autonomy adaptation
  if (data.avg_autonomy !== undefined) {
    if (data.avg_autonomy < LOW_AUTONOMY_THRESHOLD) {
      guidelines += `
User tends to delegate (autonomy: ${data.avg_autonomy.toFixed(2)})
- ALWAYS ask for their initial thoughts before providing solutions
- Use: "What's your intuition on this?" or "What have you considered so far?"
- When they say "write this for me", respond: "I'll help you write it. What's your main point?"
- Celebrate when they show independent thinking
- Explain your reasoning so they learn\n`;
    } else if (data.avg_autonomy > HIGH_AUTONOMY_THRESHOLD) {
      guidelines += `
User thinks independently (autonomy: ${data.avg_autonomy.toFixed(2)})
- Support their exploration, offer alternatives rather than corrections
- They learn best through dialogue, not instruction
- Challenge them with deeper questions when appropriate\n`;
    }
  }

  // 6. Learning adaptation
  if (data.avg_learning !== undefined && data.avg_learning < LOW_LEARNING_THRESHOLD) {
    guidelines += `
User shows low learning engagement (learning: ${data.avg_learning.toFixed(2)})
- Explain reasoning step by step
- After giving information, ask: "Does this make sense? Any questions?"
- Suggest related concepts to explore
- Connect new information to what they already know\n`;
  }

  // 7. Trend-based adaptation
  if (data.trend === 'declining') {
    guidelines += `
Cognitive engagement is declining
- Stimulate curiosity with "why" and "what if" questions
- Encourage reflection: "What do you think about this approach?"
- Keep interactions engaging and interactive\n`;
  }

  // 8. Delegation type awareness
  if (data.total_delegation_cognitive !== undefined && data.total_messages) {
    const cognitiveDelegationRatio = data.total_delegation_cognitive / Math.max(1, data.total_messages);
    const routineDelegationRatio = (data.total_delegation_routine || 0) / Math.max(1, data.total_messages);

    if (cognitiveDelegationRatio > HIGH_COGNITIVE_DELEGATION_RATIO) {
      guidelines += `
HIGH COGNITIVE DELEGATION (${Math.round(cognitiveDelegationRatio * 100)}% of interactions)
- The user is delegating thinking-heavy tasks (reasoning, decisions, problem-solving)
- This is the most harmful form of cognitive offloading
- NEVER just provide the answer — always involve the user in the reasoning
- Break down the problem and ask them to solve each part
- Routine delegation (${Math.round(routineDelegationRatio * 100)}%) is fine and not counted here\n`;
    }
  }

  // 9. High total delegation pattern (legacy, covers both types)
  if (data.total_delegation !== undefined && data.total_messages !== undefined) {
    const delegationRatio = data.total_delegation / Math.max(1, data.total_messages);
    if (delegationRatio > HIGH_DELEGATION_RATIO) {
      guidelines += `
High delegation pattern detected (${Math.round(delegationRatio * 100)}% of interactions)
- Prioritize teaching over doing
- Break down complex tasks and involve the user in each step
- Ask them to try first, then refine together\n`;
    }
  }

  // 10. Trust calibration — verification behavior
  if (data.avg_verification !== undefined && data.total_messages >= 5) {
    const trustLevel = getTrustCalibration(data.avg_verification);
    if (trustLevel === 'over_trust') {
      guidelines += `
OVER-TRUST DETECTED (verification: ${data.avg_verification.toFixed(2)})
- The user accepts AI output without questioning — this is cognitively risky
- Occasionally include subtle caveats: "This is my best understanding, but you might want to verify..."
- After complex answers, ask: "Does this match your experience?"
- When appropriate, present alternative perspectives to encourage critical evaluation
- Do NOT artificially add errors — just encourage healthy skepticism\n`;
    } else if (trustLevel === 'under_trust') {
      guidelines += `
HIGH VERIFICATION PATTERN (verification: ${data.avg_verification.toFixed(2)})
- The user actively questions and verifies — this is cognitively healthy
- Provide sources, reasoning, and confidence levels to support their verification process
- When confident in your answer, say so clearly to avoid unnecessary friction\n`;
    }
  }

  // 11. Motivation type awareness
  if (data.motivation_counts && data.total_messages >= 5) {
    const dominant = getDominantMotivation(data.motivation_counts);
    const avoidanceRatio = data.motivation_counts.avoidance / Math.max(1, data.total_messages);

    if (dominant === 'avoidance' || avoidanceRatio > HIGH_AVOIDANCE_RATIO) {
      guidelines += `
AVOIDANCE MOTIVATION DETECTED (${Math.round(avoidanceRatio * 100)}% of interactions)
- The user is using AI to avoid thinking, not to learn or be productive
- This is the most harmful motivation pattern for cognitive health
- Gently redirect: instead of doing the task, break it into manageable pieces
- Ask: "What part of this feels hardest? Let's start there together"
- Frame effort positively: struggling with a problem builds understanding\n`;
    } else if (dominant === 'intrinsic') {
      guidelines += `
INTRINSIC MOTIVATION DETECTED
- The user is genuinely curious and learning-oriented — support this
- Offer deeper explorations: "Want to understand why this works?"
- Connect new concepts to broader principles
- Encourage their curiosity with additional resources and related topics\n`;
    }
  }

  // 12. Self-regulation prompts (metacognitive support)
  if (data.avg_metacognition !== undefined && data.avg_metacognition < LOW_METACOGNITION_THRESHOLD &&
      data.avg_verification !== undefined && data.avg_verification < LOW_VERIFICATION_THRESHOLD) {
    guidelines += `
SELF-REGULATION SUPPORT
- The user shows low metacognition AND low verification — needs self-regulation scaffolding
- PLANNING: At the start of complex tasks, ask "What's your plan for tackling this?"
- MONITORING: Mid-task, check in: "Are we on track with what you wanted to achieve?"
- EVALUATION: After completing something, ask: "What worked well? What would you do differently?"\n`;
  }

  return guidelines;
}

/**
 * Build a minimal fatigue-only guideline.
 * Useful when you only want fatigue detection without full cognitive adaptation.
 */
export function buildFatigueGuideline(
  data: UserCognitiveData | null | undefined,
  ageGroup?: AgeGroup
): string {
  if (!data?.session?.is_fatigued) return '';

  return `\n## FATIGUE ALERT
The user has been active for an extended period (${data.session.fatigue_reason || 'extended session'}).
Suggest a break gently. Keep responses concise. Don't propose new tasks.\n`;
}
