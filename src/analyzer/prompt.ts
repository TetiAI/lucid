// ============================================================
// Lucid SDK — Analysis Prompt
// The unified prompt sent to the LLM to analyze each
// user-AI message exchange for cognitive scoring.
// ============================================================

/**
 * Unified analysis prompt for cognitive scoring + content moderation.
 *
 * This prompt instructs the LLM to:
 * 1. Generate a dense memory summary
 * 2. Score cognitive dimensions (autonomy, learning, engagement)
 * 3. Flag content moderation issues (very conservative)
 *
 * The prompt is designed to work with any LLM provider.
 */
/**
 * Analysis prompt aligned with validated cognitive assessment scales:
 * - Generative AI Dependency Scale (GAIDS, Goh & Hartanto 2025, α=.87): cognitive preoccupation, consequences, withdrawal
 * - AI Motivation Scale (AIMS, 2025): intrinsic, instrumental, avoidance motivation types
 * - Metacognitive Sensitivity research (PNAS Nexus, 2025): verification behavior as trust calibration
 * - Cognitive Offloading Scale (α=.90): task-specific reliance measurement
 *
 * The prompt captures 6 core dimensions + 4 behavioral flags per message.
 */
export const ANALYSIS_PROMPT = `Analyze this message exchange. Generate a memory summary, cognitive scores, and content moderation.

IMPORTANT: If a TOPIC CONTEXT is provided, use it to calibrate your scoring. A brief "ok" after a long collaborative discussion is different from "ok" as a first message. If AI_RESPONSE_LENGTH is very short, lower your expectations for user engagement — a short AI response doesn't give the user much to engage with.

1. SUMMARY (for future memory retrieval):
Create a DENSE summary including ALL specific details: names, tools, technologies, links, dates, deadlines, decisions, numbers, locations.
Write in the SAME LANGUAGE as the conversation. Max 3 sentences. Be specific, not generic.
BAD: "Discussion about a project with technical suggestions."
GOOD: "Progetto React per task manager. Decisione: usare Vite + Express. Marco suggerisce deadline 15 gennaio."

2. COGNITIVE ANALYSIS (based on USER message only):

Core dimensions:
- autonomy_score (0-1): 1 if user thinks independently, reasons through problems, questions AI output. 0 if user just delegates ("write for me", "do it", "fix this")
- learning_score (0-1): Is user trying to learn/understand? Asking "why", exploring concepts, connecting ideas = high. Just collecting answers = low
- engagement_score (0-1): Quality and depth of user's participation. Articulated responses with reasoning = high. "ok", "yes", "do it" = low
- metacognition_score (0-1): INTERNAL self-awareness — is the user aware of their OWN thinking process? Signs: reflecting on their own approach ("I was thinking about it wrong"), self-correcting their reasoning, planning their learning strategy, recognizing what they don't know ("I'm not sure I understand this part"). This is about the user looking INWARD at their own cognition. 0 if user shows no self-awareness
- verification_score (0-1): EXTERNAL evaluation — does the user critically evaluate the AI's output? Signs: questioning AI accuracy ("are you sure?", "that doesn't seem right"), cross-checking facts, asking for sources, testing AI suggestions before accepting, pointing out AI errors. This is about the user looking OUTWARD at what the AI produces. 0 = accepts everything without question. NOTE: These are distinct — a user can have high metacognition (aware of their own gaps) but low verification (doesn't check AI output), or vice versa
- motivation_type: WHY is the user engaging with AI?
  - "intrinsic": Genuine curiosity, exploring for understanding, learning for its own sake ("I want to understand how this works", "why does this happen?")
  - "instrumental": Pragmatic tool use, getting work done efficiently ("format this", "convert this to JSON", "help me build X")
  - "avoidance": Avoiding cognitive effort, escaping thinking ("just tell me the answer", "I don't want to think about it", "do everything for me"). Key signal: user could think through it but chooses not to

Behavioral flags:
- delegation_count: 1 if user is delegating a task, 0 otherwise
- delegation_type: "none" if not delegating. "routine" if delegating a mechanical/repetitive task (formatting, translating, converting, boilerplate). "cognitive" if delegating a task that requires reasoning, decision-making, creativity, or problem-solving
- learning_moments: 1 if user shows curiosity or asks "why", 0 otherwise
- application_moments: 1 if user applies previous knowledge or references something learned earlier, 0 otherwise

3. CONTENT MODERATION (VERY CONSERVATIVE - only flag clear violations):
Categories: violence, self-harm, illegal-activity, hate-speech, harassment, adult-sexual-content, dangerous-instructions, fraud-scam, terrorism, child-safety

DO NOT FLAG: educational discussions, news, fiction, roleplay, medical questions, security research, dark humor, keyboard spam like "kkkk", typos, questions about AI/system.
ONLY FLAG if 90%+ confident of harmful intent.

Return in TOON format (Token-Oriented Object Notation) only — no JSON, no markdown:

summary: <dense summary in same language>
cognitive:
  autonomy_score: <0 to 1>
  learning_score: <0 to 1>
  engagement_score: <0 to 1>
  metacognition_score: <0 to 1>
  verification_score: <0 to 1>
  motivation_type: <intrinsic|instrumental|avoidance>
  delegation_count: <0 or 1>
  delegation_type: <none|routine|cognitive>
  learning_moments: <0 or 1>
  application_moments: <0 or 1>
moderation:
  has_flags: <true|false>
  flags[0]:`;

/**
 * Format user + AI messages into the analysis input string.
 * AI response is truncated to maxLength to save tokens.
 * Context (if provided) gives the LLM conversation history for better calibration.
 */
export function formatAnalysisInput(
  userMessage: string,
  aiResponse: string,
  maxAiLength: number = 2000,
  context?: string
): string {
  let input = '';

  if (context) {
    input += `TOPIC CONTEXT (previous conversation summary):\n${context}\n\n`;
  }

  const aiLen = aiResponse.length;
  input += `AI_RESPONSE_LENGTH: ${aiLen} characters${aiLen < 100 ? ' (very short — calibrate engagement expectations accordingly)' : ''}\n\n`;
  input += `USER: ${userMessage}\n\nAI: ${aiResponse.substring(0, maxAiLength)}`;

  return input;
}
