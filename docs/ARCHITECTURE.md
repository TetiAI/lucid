# Lucid SDK — Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        HOST APPLICATION                        │
│                                                                 │
│  ┌──────────┐    ┌──────────────┐    ┌────────────────────┐     │
│  │  User     │───▶│  AI Engine   │───▶│  AI Response       │     │
│  │  Message  │    │  + Guidelines│    │  (adapted)         │     │
│  └──────┬───┘    └──────▲───────┘    └────────────────────┘     │
│         │               │                                       │
│         │        ┌──────┴───────┐                               │
│         │        │ lucid        │                               │
│         │        │ .getGuidelines()                             │
│         │        └──────────────┘                               │
│         │                                                       │
│         ▼                                                       │
│  ┌──────────────────────────────────────────────────────┐       │
│  │                    LUCID SDK                         │       │
│  │                                                      │       │
│  │  lucid.track(userId, { userMessage, aiResponse })    │       │
│  │                                                      │       │
│  │  ┌────────────┐  ┌──────────┐  ┌─────────────────┐  │       │
│  │  │  Analyzer   │  │ Scoring  │  │  Guidelines     │  │       │
│  │  │  (LLM)     │  │ (EMA)    │  │  (Prompt Gen)   │  │       │
│  │  └─────┬──────┘  └────┬─────┘  └────────▲────────┘  │       │
│  │        │              │                  │           │       │
│  │        ▼              ▼                  │           │       │
│  │  ┌────────────────────────────────────┐  │           │       │
│  │  │           Session Tracker          │  │           │       │
│  │  │  (fatigue, duration, patterns)     │──┘           │       │
│  │  └────────────────┬───────────────────┘              │       │
│  │                   │                                  │       │
│  │                   ▼                                  │       │
│  │  ┌────────────────────────────────────┐              │       │
│  │  │           Store Adapter            │              │       │
│  │  │  (Memory / Prisma / Custom)        │              │       │
│  │  └────────────────┬───────────────────┘              │       │
│  │                   │                                  │       │
│  └───────────────────┼──────────────────────────────────┘       │
│                      │                                          │
└──────────────────────┼──────────────────────────────────────────┘
                       │
                       ▼
              ┌─────────────────┐
              │    Database     │
              │ lucid_cognitive │
              └─────────────────┘
```

## Module Responsibilities

### `lucid.ts` — Orchestrator
The main `Lucid` class coordinates all modules. It:
- Receives `track()` calls with user-AI message exchanges
- Routes analysis to the configured analyzer
- Updates topic and user cognitive data via scoring
- Manages session state and fatigue detection
- Serves profiles and guidelines on demand

### `scoring.ts` — EMA & Score Engine
Pure mathematical functions, zero side effects:
- `getAdaptiveAlpha()` — Calculates EMA smoothing factor
- `calculateEMA()` — Exponential Moving Average
- `calculateScore()` — Combines experience × quality
- `calculateLevel()` — Maps score to level 0-10
- `calculateTrend()` — Detects improving/stable/declining
- `getScaffoldingLevel()` — Determines AI support level (full/guided/hints/challenge) based on autonomy, learning, and metacognition

### `session.ts` — Session & Fatigue
Tracks cognitive sessions and detects fatigue with age-aware thresholds:
- Session gap detection (30-min inactivity = new session)
- Duration-based fatigue (age-specific: 15/20/30/45 min for child/teen/young_adult/adult)
- Volume-based fatigue (age-specific: 10/15/20/30 msgs)
- Pattern-based fatigue (shortening responses)

### `guidelines.ts` — Prompt Guidelines
Generates adaptive text for AI system prompts:
- Age-based protection (child/teen/young_adult/adult) with strong rules for minors
- Fatigue warnings with break suggestions
- Autonomy-based adaptation (delegation vs independence)
- Metacognition-aware guidance (encouraging self-verification and reflection)
- Learning engagement stimulation
- Trend-based intervention (declining engagement)
- Cognitive drift warnings (when CDI > 0.3)
- Scaffolding level adaptation (full/guided/hints/challenge)
- Delegation type awareness (warns specifically about cognitive delegation vs routine)

### `drift.ts` — Cognitive Drift Detection
Detects gradual cognitive decline by comparing early vs recent weekly history:
- `calculateDriftIndex()` — Compares early and recent weekly snapshots
- Returns 0-1 (0 = stable, > 0.3 = warning, > 0.6 = severe)
- Available in `CognitiveProfile` as `driftIndex`

### `analyzer/` — LLM Analysis
Abstracts the LLM call for message analysis:
- `LucidAnalyzer` interface — implement for any provider
- `LLMAnalyzer` — built-in analyzer using the official `openai` SDK
- `ANALYSIS_PROMPT` — the unified analysis prompt

### `store/` — Persistence
Storage adapters for any database:
- `LucidStore` interface — implement for any database
- `MemoryStore` — in-memory (dev/testing)
- `PrismaStore` — PostgreSQL via Prisma ORM

## Data Flow

### Track Flow (after each message)

```
1. lucid.track(userId, { userMessage, aiResponse, topicId })
2. Analyzer: LLM scores the message → AnalysisResult (includes metacognition, delegation_type)
3. Topic update: EMA smooth scores → TopicCognitiveData
4. User update:
   a. Session: update/create → fatigue detection
   b. Counters: increment delegation (routine/cognitive), learning, etc.
   c. EMA: smooth user-level scores (autonomy, learning, engagement, metacognition)
   d. Score: experience × quality → 0-10000
   e. Level: score / 1000 → 0-10
   f. Trend: compare autonomy change
   g. History: weekly snapshot (every 3 messages, includes metacognition)
5. Store: persist to database
```

### Guidelines Flow (before AI response)

```
1. lucid.getGuidelines(userId)
2. Store: load UserCognitiveData
3. Drift: calculate CDI from weekly history → driftIndex
4. Scaffolding: determine level from autonomy + learning + metacognition
5. Guidelines: analyze profile (incl. metacognition, drift, scaffolding, delegation types) → generate adaptation text
6. Return: text block for system prompt injection
```

## Database Schema

Single table design using `kind` as discriminator:

```
lucid_cognitive
├── id (CUID primary key)
├── kind (discriminator: user_cognitive | topic_cognitive | etc.)
├── externalId (userId or topicId from host app)
├── userId (optional, for counting topics per user)
├── data (JSON — the actual cognitive/moderation data)
├── createdAt
└── updatedAt

Indexes:
├── UNIQUE(kind, externalId)
├── INDEX(kind)
└── INDEX(userId)
```

This single-table design means:
- One migration to add Lucid to any project
- No foreign keys to host application tables
- Clean separation of concerns
- Easy to query by kind or by user

## Integration Patterns

### Full Integration

```typescript
const client = new OpenAI({
  apiKey: process.env.LUCID_API_KEY,
  baseURL: process.env.LUCID_BASE_URL,
});
const lucid = new Lucid({
  store: new PrismaStore(prisma),
  analyzer: new LLMAnalyzer({ client }),
  debug: true,
});

// After each message (fire-and-forget):
lucid.track(userId, {
  userMessage: msg,
  aiResponse: response,
  topicId: conversationId,
}).catch(console.error);

// Before AI response:
const guidelines = await lucid.getGuidelines(userId);
systemPrompt += guidelines;

// In user dashboard:
const profile = await lucid.getProfile(userId);
// → { score, level, trend, ... }
```
