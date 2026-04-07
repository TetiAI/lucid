# Lucid Cognitive Protection System

## Overview

Lucid implements a cognitive health protection system for AI-powered applications. As AI becomes more capable, users risk developing cognitive dependency — delegating thinking to AI rather than using AI as a tool to enhance their own abilities.

Lucid monitors and protects against this by tracking six cognitive dimensions in real-time and adapting AI responses accordingly.

---

## The Problem: AI Cognitive Dependency

Research from MIT Media Lab (2025) demonstrates that heavy AI use can lead to:

1. **Cognitive Offloading**: Users stop thinking through problems themselves
2. **Critical Thinking Atrophy**: "Use it or lose it" — unused cognitive skills deteriorate
3. **Autonomy Erosion**: Users become unable to complete tasks without AI assistance
4. **Engagement Decline**: Interactions become superficial ("do it for me" patterns)

Lucid exists to prevent this while preserving the benefits of AI assistance.

---

## Part 1: How It Monitors

### What It Analyzes

After each user message, the system analyzes **in background** (without slowing the chat):

| Dimension | What It Measures | Example |
|-----------|-----------------|---------|
| **Autonomy** | Does the user think independently or delegate everything? | "Write it for me" = low autonomy, "I was thinking that..." = high |
| **Learning** | Is the user trying to understand? | "Why does this work?" = high, "Just give me the code" = low |
| **Engagement** | Quality of participation | Articulated responses vs "ok", "yes" |
| **Metacognition** | Is the user aware of their own thinking process? | "Let me verify that..." = high, "I think my approach might be wrong because..." = high, blindly accepting AI output = low |
| **Verification** | Does the user critically evaluate AI output? | "Are you sure?" = high, "That doesn't seem right" = high, accepting everything = low |
| **Motivation** | Why is the user engaging with AI? | "I want to understand" = intrinsic, "Format this for me" = instrumental, "Just tell me" = avoidance |

### Context-Aware Analysis

Each message is analyzed with **topic context** when available — the accumulated summary from previous messages in the conversation. This prevents misscoring:
- A brief "ok" after 10 messages of deep discussion → reasonable conclusion, not low engagement
- "Write this for me" after trying 3 approaches → justified delegation, not laziness

The system also factors in **AI response length** — if the AI gave a 10-word answer, a short user response is expected.

### Scoring: Adaptive EMA (Exponential Moving Average)

The system uses an **adaptive EMA** where the smoothing factor (alpha) decreases as more messages are analyzed:

```
α = max(0.02, 0.1 / log₁₀(total_messages + 10))
```

| Total Messages | Alpha (α) | New Message Weight | Messages to Shift Profile |
|---------------|-----------|-------------------|--------------------------|
| 1 (new)       | 10%       | 10%               | ~15                      |
| 50            | 6%        | 6%                | ~25                      |
| 100           | 5%        | 5%                | ~30                      |
| 500           | 4%        | 4%                | ~38                      |
| 1000          | 3%        | 3%                | ~50                      |
| 5000+         | 2%        | 2% (minimum)      | ~75                      |

**Why adaptive?**
- **New user**: Profile must form quickly → higher alpha
- **Established user**: Stable pattern → lower alpha, resistant to anomalies

### Practical Example

**NEW user (10 messages)**, autonomy = 0.5, writes "Write everything for me" (score 0.0):

```
α = 0.08 (8%)
New Score = 0.08 × 0.0 + 0.92 × 0.5 = 0.46
```
→ Profile is still malleable, drops by 0.12

**ESTABLISHED user (1000 messages)**, same scenario:

```
α = 0.03 (3%)
New Score = 0.03 × (-1.0) + 0.97 × 0.5 = 0.455
```
→ Profile is stable, drops only 0.045

### Age-Based Protection

Lucid provides four age-based protection tiers aligned with neurodevelopmental stages. Each tier adjusts fatigue thresholds, scaffolding caps, and guideline strictness based on how the brain develops at that stage.

```typescript
const guidelines = await lucid.getGuidelines(userId, 'child');  // 6-12
const guidelines = await lucid.getGuidelines(userId, 'teen');   // 13-17
const guidelines = await lucid.getGuidelines(userId, 'young_adult'); // 18-24
const guidelines = await lucid.getGuidelines(userId, 'adult');  // 25+

// Backwards compatible:
const guidelines = await lucid.getGuidelines(userId, 'young_adult'); // 18-24
```

| | Child (6-12) | Teen (13-17) | Young Adult (18-24) | Adult (25+) |
|---|---|---|---|---|
| Session limit | 15 min | 20 min | 30 min | 45 min |
| Message limit | 10/session | 15/session | 20/session | 30/session |
| Max scaffolding | `full` only | `full` / `guided` | all levels | all levels |
| Cognitive delegation | **Blocked** | **Blocked** | Warned | Warned |
| Session fatigue | **Hard stop** | **Hard stop** | Suggestion | Suggestion |
| Guidelines | Always Socratic, never direct answers | Require attempt first, validate independent thinking | Teaching-first approach | Standard |

#### Why These Tiers?

**Child (6-12)** — Piaget's concrete operational stage. Children are building foundational reasoning, working memory, and problem-solving skills. AI must never replace this learning process — at this age, the process IS the learning. Scaffolding is locked to `full` because even a seemingly capable child may be mimicking patterns without deep understanding (Piaget, 1952; Diamond, 2013).

**Teen (13-17)** — Abstract thinking is developing but inconsistent. The prefrontal cortex is undergoing rapid myelination, making this period both high-opportunity and high-risk: habits formed now (including delegation habits) become deeply ingrained due to heightened neuroplasticity (Casey et al., 2008; Steinberg, 2005). Scaffolding caps at `guided` because teens need structure even when they appear autonomous. Emotional dependency on AI is also monitored — teens may use AI as a social substitute.

**Young Adult (18-24)** — The prefrontal cortex is still maturing (~25). Critical thinking and decision-making are improving but not fully developed. Stricter fatigue thresholds and teaching-first guidelines apply (Arain et al., 2013; APA, 2025).

**Adult (25+)** — Fully mature prefrontal cortex. The risk is atrophy from disuse (neuroplasticity works both ways), not developmental interference. Standard adaptive protections apply.

#### Hard Rules for Minors

For `child` and `teen` users, certain protections are **strong rules** rather than adaptive guidelines:

1. **Cognitive delegation block**: If a minor's cognitive delegation ratio exceeds 15%, the AI is instructed to refuse performing reasoning/analysis tasks and instead guide the user through the problem. For adults this is a warning; for minors it's a requirement.

2. **Session stop**: When fatigue is detected for a minor, guidelines instruct the AI to wrap up the conversation (summarize accomplishments, suggest what to pick up next time) rather than merely suggesting a break. This protects against extended sessions during critical developmental periods.

3. **Mandatory generation effect**: For children, every response must begin by asking "What do you think?" — this is not optional regardless of the user's scores. For teens, an attempt is required before help is provided.

### Delegation Types

Delegation is classified by type to distinguish between healthy offloading of mechanical work and concerning offloading of thinking:

| Type | Value | Examples | Concern Level |
|------|-------|----------|---------------|
| **None** | `'none'` | No delegation detected | — |
| **Routine** | `'routine'` | Formatting, translating, boilerplate generation | Low |
| **Cognitive** | `'cognitive'` | Reasoning, deciding, analyzing, creating | High |

`UserCognitiveData` tracks `total_delegation_routine` and `total_delegation_cognitive` separately. Guidelines specifically warn about cognitive delegation patterns, while routine delegation is considered normal AI use.

### Trust Calibration

Derived from the user's verification score (EMA-smoothed), trust calibration indicates whether the user has a healthy relationship with AI output:

| Level | Verification Range | Meaning | System Response |
|-------|-------------------|---------|-----------------|
| `over_trust` | < 0.2 | Accepts everything without questioning | Encourage healthy skepticism, add caveats |
| `calibrated` | 0.2 - 0.7 | Selectively verifies — healthy | No intervention needed |
| `under_trust` | > 0.7 | Questions everything | Provide confidence levels, reduce friction |

Based on metacognitive sensitivity research (PNAS Nexus, 2025) showing trust calibration predicts decision quality in AI-assisted tasks.

### Motivation Types

Based on Self-Determination Theory and the AI Motivation Scale (AIMS, 2025):

| Type | Examples | Risk Level | System Response |
|------|----------|------------|-----------------|
| **Intrinsic** | "I want to understand how this works" | Positive | Support exploration, offer deeper dives |
| **Instrumental** | "Format this JSON for me" | Neutral | Normal AI use, no intervention |
| **Avoidance** | "Just tell me the answer, I don't want to think" | High | Redirect to active engagement, break down problems |

The dominant motivation is determined by counting occurrences across all interactions. Research shows avoidance motivation produces the highest cognitive decline.

### Cognitive Drift Index (CDI)

The system detects **gradual cognitive decline** over time by comparing early vs recent weekly history using `src/drift.ts`. This catches slow deterioration that session-level metrics might miss.

```
CDI = weighted difference between early weeks and recent weeks
      across autonomy, learning, engagement, and metacognition
```

| CDI Range | Status | System Response |
|-----------|--------|-----------------|
| 0 - 0.3 | Stable | No intervention |
| 0.3 - 0.6 | Warning | Guidelines include drift warning, encourage active thinking |
| > 0.6 | Severe | Strong intervention, explicit re-engagement strategies |

Available in `CognitiveProfile` as `driftIndex`.

### Context Change Detection

When a user switches domains (e.g., from backend to frontend), their scores may shift dramatically. Without detection, the system would interpret this as cognitive decline.

Lucid detects context changes by measuring the deviation between current scores and the established EMA. When the deviation exceeds 0.4, alpha is temporarily boosted so the profile adapts faster to the new context instead of treating it as noise.

### Effectiveness Tracking

`lucid.getEffectiveness(userId)` measures whether Lucid's guidelines are actually improving the user's cognitive engagement over time by comparing early weeks vs recent weeks.

```typescript
const report = await lucid.getEffectiveness(userId);
// → { autonomyDelta: +0.18, learningDelta: +0.05, verificationDelta: +0.12,
//     weeksTracked: 8, sufficient: true }
```

Requires at least 4 weeks of data. This is not an A/B test (no control group) — it measures change over time.

### Scaffolding Levels

Based on Vygotsky's scaffolding fading principle, Lucid determines the appropriate AI support level using `getScaffoldingLevel()` in `scoring.ts`. The level is calculated from autonomy, learning, and metacognition scores.

| Level | Criteria | AI Behavior |
|-------|----------|-------------|
| `full` | Low autonomy + low metacognition | Full explanations, step-by-step guidance, check understanding |
| `guided` | Moderate autonomy or learning | Structured hints, leading questions, partial solutions |
| `hints` | Good autonomy + some metacognition | Minimal nudges, let user lead, confirm direction |
| `challenge` | High autonomy + high metacognition | Push boundaries, propose harder problems, Socratic dialogue |

Available in `CognitiveProfile` as `scaffoldingLevel`. Guidelines automatically adapt AI support level accordingly.

### Fatigue Detection

The system detects cognitive fatigue through three indicators, with age-appropriate thresholds:

1. **Long session**: Exceeds the age-specific duration limit (15/20/30/45 min)
2. **High volume**: Exceeds the age-specific message limit (10/15/20/30 per session)
3. **Response shortening**: Pattern of progressively shorter responses (avg < 20 chars)

A "session" resets automatically after 30 minutes of inactivity.

For minors (child/teen), fatigue triggers a **session stop** rather than a suggestion — the AI wraps up the conversation instead of merely recommending a break.

---

## Part 2: How It Adapts Responses

### The Flow

```
┌─────────────────────────────────────────────┐
│  User sends message                         │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│  System loads cognitive profile              │
│  (scores, session, trend)                   │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│  Generates "Cognitive Guidelines" for prompt │
│  (adaptive instructions for the AI)         │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│  AI responds ADAPTED to user's              │
│  cognitive state                            │
└─────────────────────────────────────────────┘
```

### Adaptation Examples

#### When user is UNDER 25 (always active):
> **Guidelines:** "Prioritize teaching over direct solutions. Encourage step-by-step thinking. Avoid creating dependency."

**Result:** AI always explains reasoning, asks the user to think first, and frames challenges as learning opportunities.

#### When FATIGUE is detected:
> **Guidelines:** "The user shows signs of fatigue. Gently suggest a break. Keep responses brief. Don't propose new tasks."

**Result:** AI suggests taking a break and continuing later.

#### When LOW AUTONOMY is detected:
> **Guidelines:** "The user tends to delegate. ALWAYS ask for their thoughts before responding."

**Result:**
- User: "Write an email to the client"
- AI: "Sure, I'll help. What's the main point you want to convey? What tone?"

#### When HIGH AUTONOMY is detected:
> **Guidelines:** "Support their exploration, offer alternatives rather than corrections."

**Result:** AI proposes options and challenges with deeper questions.

#### When DECLINING TREND is detected:
> **Guidelines:** "Cognitive engagement is declining. Stimulate with 'why' and 'what if' questions."

**Result:** AI becomes more interactive, asks more questions, tries to reignite curiosity.

#### When HIGH COGNITIVE DELEGATION is detected:
> **Guidelines:** "User is offloading reasoning and decision-making to AI. Never decide for the user — present options and ask them to choose. Prioritize teaching over doing."

**Result:** Instead of completing cognitive tasks, AI presents options, asks for the user's reasoning, and involves them in each decision.

#### When COGNITIVE DRIFT is detected (CDI > 0.3):
> **Guidelines:** "User's cognitive engagement has been gradually declining over recent weeks. Actively re-engage critical thinking. Ask for their analysis before providing yours."

**Result:** AI becomes more Socratic, requires user input before giving answers, and explicitly flags opportunities for independent thinking.

#### When OVER-TRUST is detected:
> **Guidelines:** "User accepts AI output without questioning. Occasionally include caveats. Ask 'Does this match your experience?'"

**Result:** AI becomes more transparent about uncertainty, invites critical evaluation of its answers.

#### When AVOIDANCE MOTIVATION is detected:
> **Guidelines:** "User is using AI to avoid thinking. Break tasks into manageable pieces. Ask 'What part feels hardest? Let's start there.'"

**Result:** Instead of doing everything, AI identifies the cognitive bottleneck and makes the user engage with it directly.

#### Generation Effect (active at all scaffolding levels):
> **Guidelines:** "Ask user to attempt their own solution before providing yours."

**Result:**
- User: "How do I sort this array?"
- AI: "What approach would you try first? Think about what properties you need to compare."

#### Scaffolding Level: FULL
> **Guidelines:** "Provide full explanations with step-by-step guidance. Check understanding at each step. Do not skip ahead."

**Result:** AI provides complete walkthroughs, asks "Does this make sense?" and builds from basics.

#### Scaffolding Level: CHALLENGE
> **Guidelines:** "User demonstrates strong independent thinking. Push boundaries — propose harder problems, use Socratic questioning, encourage novel approaches."

**Result:** AI acts as a thinking partner rather than an assistant, challenges assumptions, and suggests stretch goals.

---

## Part 3: Score & Level System

### Cognitive Score (0-10,000)

The score combines **experience** and **quality**:

```
Quality Score = (autonomy × 0.30) + (metacognition × 0.20) + (learning × 0.20) + (verification × 0.15) + (engagement × 0.15)

Experience Factor = √(total_messages) / √(1000)   // SLOW growth

Max Potential = experience_factor × 10,000

Final Score = max_potential × quality_score
```

This creates a system where:
- **Experience** unlocks potential (the ceiling)
- **Quality** determines how much of that ceiling is reached
- A new user with perfect quality still scores low
- An established user with poor quality also scores low

### Experience Growth Projection

```
Messages → Experience Factor → Max Possible Score
1         →  3%              →  316
10        → 10%              →  1,000
50        → 22%              →  2,236
100       → 32%              →  3,162
500       → 71%              →  7,071
1000      → 100%             → 10,000
```

### Levels (0-10)

```
Level = floor(score / 1000), max 10
```

| Level | Score Range |
|-------|-------------|
| 0 | 0-999 |
| 1 | 1,000-1,999 |
| 2 | 2,000-2,999 |
| 3 | 3,000-3,999 |
| 4 | 4,000-4,999 |
| 5 | 5,000-5,999 |
| 6 | 6,000-6,999 |
| 7 | 7,000-7,999 |
| 8 | 8,000-8,999 |
| 9 | 9,000-9,999 |
| 10 | 10,000 |

### Trend Detection

| Condition | Trend |
|-----------|-------|
| Autonomy increases > 0.05 | Improving |
| Autonomy decreases > 0.05 | Declining |
| Otherwise | Stable |

---

## Philosophy

### Not a Judge

The system **does not judge** the user. There is no "good" or "bad" score.

The objective is to **adapt** responses to:
- Protect from cognitive dependency
- Stimulate independent thinking when appropriate
- Respect when the user needs speed

### Invisible but Present

The user doesn't see their scores (unless they ask). The system works silently to deliver an experience that **enhances** rather than **replaces** thinking.

### Grounded in Science

Based on:
- MIT Media Lab 2025 study on AI cognitive dependency
- Neuroplasticity research ("use it or lose it")
- Cognitive scaffolding principles in education
- Prefrontal cortex maturation research (Arain et al., 2013)
- APA Advisory on AI and Adolescent Well-Being (2025)
- AICICA research on AI-induced cognitive atrophy in young users (Gerlich, 2025)

---

## Known Limitations

Transparency about what the system can and cannot do:

1. **LLM-based scoring is approximate** — The analysis uses an LLM to infer cognitive constructs designed for self-report questionnaires. While EMA smoothing compensates for per-message noise, individual scores may be inaccurate. The system's strength is in aggregate patterns, not single-message precision.

2. **AI response quality influences user scores** — If the AI gives a poor or very short response, the user may respond briefly not because they're disengaged, but because there's nothing to engage with. The AI_RESPONSE_LENGTH signal mitigates this partially.

3. **Quality weights are research-informed, not empirically calibrated** — The weights (autonomy 30%, metacognition 20%, learning 20%, verification 15%, engagement 15%) are derived from published effect sizes and meta-analyses, but have not been calibrated through regression on Lucid-specific data.

4. **Metacognition and verification overlap** — "Wait, is that right?" could score on both dimensions. The prompt distinguishes internal awareness (metacognition) from external evaluation (verification), but the LLM may not always differentiate consistently.

5. **No causal validation of guidelines** — We assume that injecting "ask the user to think first" changes AI behavior and user outcomes. Without A/B testing against a control group, this is an assumption. `getEffectiveness()` provides before/after measurement but not causal proof.

6. **Context changes can be misinterpreted** — A backend expert starting frontend work will delegate more. The context change detection (alpha boost) mitigates this, but can't distinguish genuine decline from domain switching in all cases.

---

## Privacy & Data

- Cognitive data is **aggregated**, not message content
- Used **only** to adapt responses
- Users can request deletion at any time (GDPR compliant)
- Incognito mode disables cognitive tracking
