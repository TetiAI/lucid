<p align="center">
  <img src=".github/logo.svg" alt="Lucid" width="300" />
</p>

<p align="center">
  <strong>Cognitive health protection for AI agents.</strong>
</p>

<p align="center">
  <img src=".github/teti-logo.svg" alt="TetiAI" height="17"> by <a href="https://teti.ai/hub">TetiAI</a>
</p>


Lucid monitors how users interact with AI systems and adapts responses in real-time to prevent cognitive dependency — the gradual, often invisible tendency to offload thinking to AI instead of using it as a tool for growth.

---

## Why Lucid?

AI makes us more productive, but research shows it can also make us cognitively lazy:

- **MIT Media Lab (2025)**: Heavy AI delegation correlates with measurable decline in critical thinking over 3-6 months
- **Neuroplasticity**: Cognitive skills atrophy when consistently offloaded ("use it or lose it")
- **AICICA (2025)**: Younger users show higher AI dependency and lower critical thinking scores
- **Under-25 vulnerability**: The prefrontal cortex doesn't fully mature until ~25 — younger users are more susceptible to cognitive dependency (Arain et al., 2013; APA, 2025)

The problem is subtle: each individual interaction seems fine, but over weeks and months, users gradually stop thinking for themselves. Lucid detects this drift and intervenes before it becomes entrenched.

---

## How It Works

Lucid operates as a continuous feedback loop between the user, your AI, and the cognitive protection system:

```
User sends message
       │
       ▼
┌─────────────────────────┐
│  AI responds normally    │◄── System prompt includes
│  (with adapted behavior) │    Lucid guidelines
└─────────────────────────┘
       │
       ▼
┌─────────────────────────┐
│  Lucid analyzes the      │    Runs async (fire-and-forget)
│  exchange via LLM        │    — does not slow the chat
└─────────────────────────┘
       │
       ▼
┌─────────────────────────┐
│  Updates cognitive       │    EMA smoothing prevents
│  profile over time       │    single messages from
└─────────────────────────┘    distorting the profile
       │
       ▼
  Next message: guidelines
  adapt based on updated profile
```

**The key insight**: Lucid doesn't block or filter anything. It adapts *how* the AI responds based on the user's cognitive patterns. A user who delegates everything gets an AI that asks more questions. A user who thinks independently gets an AI that challenges them further.

---

## The Methodology

### Six Cognitive Dimensions

Each message exchange is scored across six dimensions, aligned with validated psychometric scales (GAIDS α=.87, AIMS 2025, Cognitive Offloading Scale α=.90, Collaborative AI Metacognition Scale 2025):

| Dimension | Range | What It Measures | Based On |
|-----------|-------|-----------------|----------|
| **Autonomy** | 0 to 1 | Independent thinking vs delegation | Self-Determination Theory (Deci & Ryan, 2000) |
| **Learning** | 0 to 1 | Curiosity, asking "why", understanding | Bloom's Taxonomy |
| **Engagement** | 0 to 1 | Quality and depth of participation | Flow Theory (Csikszentmihalyi, 1990) |
| **Metacognition** | 0 to 1 | Self-awareness about own thinking process | Metacognitive Theory (Flavell, 1979) |
| **Verification** | 0 to 1 | Critical evaluation of AI output | GAIDS (Goh & Hartanto, 2025), PNAS Nexus 2025 |
| **Motivation** | type | Why the user engages (intrinsic/instrumental/avoidance) | AI Motivation Scale (AIMS, 2025), SDT |

### Delegation Classification

Not all delegation is harmful. Lucid distinguishes between:

| Type | Examples | Risk |
|------|----------|------|
| **Routine** | Formatting, translating, boilerplate | Low — offloading mechanical work is fine |
| **Cognitive** | Reasoning, deciding, creating, analyzing | High — offloading thinking itself |

### Adaptive Profiles with EMA

Scores are smoothed using an **Exponential Moving Average** with adaptive alpha — new users' profiles form quickly, while established users' profiles are stable and resistant to anomalies. A single bad message won't distort a well-established cognitive profile.

### Four Layers of Protection

1. **Real-time adaptation** — Guidelines injected into the AI system prompt adapt responses based on the user's current cognitive state (autonomy, learning, metacognition, verification, motivation)

2. **Session-level fatigue detection** — Monitors session duration, message volume, and response shortening patterns to suggest breaks before cognitive overload

3. **Long-term drift detection** — The Cognitive Drift Index (CDI) compares early vs recent weekly patterns to catch gradual decline that session-level metrics miss

4. **Trust & motivation awareness** — Detects over-trust (accepting everything) and avoidance motivation (using AI to escape thinking), the two strongest predictors of cognitive dependency

### Progressive Scaffolding

Based on Vygotsky's Zone of Proximal Development, Lucid progressively reduces AI support as users grow:

| Level | AI Behavior |
|-------|-------------|
| `full` | Step-by-step guidance, check understanding |
| `guided` | Structured hints, leading questions |
| `hints` | Minimal nudges, let user lead |
| `challenge` | Socratic dialogue, push boundaries |

The scaffolding level is determined by the combination of autonomy, learning, and metacognition scores — metacognition is the strongest signal for readiness, because a user who actively verifies AI output is ready for less support.

### Context-Aware Analysis

Each message is analyzed with topic context (previous conversation summary) when available. This prevents misscoring — a brief "ok do it" after 10 messages of deep collaboration is different from "ok do it" as a first message. The system also factors in AI response length to calibrate expectations.

### Effectiveness Tracking

```typescript
const report = await lucid.getEffectiveness(userId);
// → { autonomyDelta: +0.18, verificationDelta: +0.12, weeksTracked: 8, sufficient: true }
```

Measures if Lucid's guidelines are actually improving cognitive engagement over time by comparing early vs recent weekly patterns.

### Age-Based Protection

Users under 25 receive stricter thresholds based on prefrontal cortex maturation research:

| | Adults | Under 25 |
|---|--------|----------|
| Session limit | 45 min | 30 min |
| Message limit | 30/session | 20/session |
| Guidelines | Standard | Always includes teaching-first approach |

```typescript
const guidelines = await lucid.getGuidelines(userId, 'under25');
```

---

## Quick Start

```bash
npm install @tetiai/lucid
```

```typescript
import OpenAI from 'openai';
import { Lucid, PrismaStore, LLMAnalyzer } from '@tetiai/lucid';

const client = new OpenAI({
  apiKey: process.env.LUCID_API_KEY,
  baseURL: process.env.LUCID_BASE_URL,
});

const lucid = new Lucid({
  store: new PrismaStore(prisma),
  analyzer: new LLMAnalyzer({ client, model: process.env.LUCID_MODEL }),
});

// After each message (fire-and-forget, does not block response):
lucid.track(userId, {
  userMessage: "Write the code for me",
  aiResponse: "Sure, here's the implementation...",
  topicId: "conversation-123",
}).catch(console.error);

// Before AI response:
const guidelines = await lucid.getGuidelines(userId);
systemPrompt += guidelines;

// User dashboard:
const profile = await lucid.getProfile(userId);
// → { score: 3200, level: 3, trend: "improving", driftIndex: 0.12, scaffoldingLevel: "guided",
//     verification: 0.42, dominantMotivation: "instrumental", trustCalibration: "calibrated" }
```

---

## How It Adapts

`lucid.getGuidelines(userId)` returns text to inject into your AI's system prompt. The guidelines change automatically based on the user's cognitive profile:

**Low autonomy:**
> "ALWAYS ask for their initial thoughts before providing solutions."

**High cognitive delegation:**
> "User is offloading reasoning to AI. Never decide for the user — present options and ask them to choose."

**Cognitive drift detected (CDI > 0.3):**
> "User's engagement is gradually declining. Ask for their analysis before providing yours."

**Fatigue detected:**
> "Suggest a break. Keep responses shorter. Don't propose new tasks."

**Over-trust detected:**
> "User accepts AI output without questioning. Include caveats, ask 'Does this match your experience?'"

**Avoidance motivation:**
> "User is using AI to avoid thinking. Break tasks into pieces, ask 'What part feels hardest?'"

**Generation effect (all scaffolding levels):**
> "Ask user to attempt their own solution before providing yours."

**Scaffolding: challenge mode:**
> "User is highly capable. Push boundaries, propose harder problems, use Socratic questioning."

---

## Storage Adapters

### MemoryStore (dev/testing)
```typescript
const store = new MemoryStore();
```

### PrismaStore (production)
```typescript
const store = new PrismaStore(prisma);
```
Supports PostgreSQL, MySQL, SQLite, MongoDB, and any Prisma-compatible database.

Add to your Prisma schema:
```prisma
model LucidCognitive {
  id         String   @id @default(cuid())
  kind       String
  externalId String
  userId     String?
  data       Json
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@unique([kind, externalId])
  @@index([kind])
  @@index([userId])
  @@map("lucid_cognitive")
}
```

### RedisStore (distributed)
```typescript
const store = new RedisStore(redisClient);
```

### Custom Store
Implement the `LucidStore` interface for any other database.

---

## Analyzer

Uses the `openai` SDK as a universal client — works with any compatible provider (Together AI, Groq, Ollama, OpenRouter, etc.) via `baseURL`:

```typescript
const client = new OpenAI({
  apiKey: process.env.LUCID_API_KEY,
  baseURL: process.env.LUCID_BASE_URL,
});

const analyzer = new LLMAnalyzer({ client, model: process.env.LUCID_MODEL });
```

Configure your provider and model via environment variables. See `.env.example` for details.

Implement `LucidAnalyzer` interface for non-compatible providers.

---

## API

| Method | Description |
|--------|-------------|
| `track(userId, input)` | Analyze and track a message exchange |
| `getProfile(userId)` | Get cognitive profile (score, level, trend, driftIndex, scaffoldingLevel) |
| `getGuidelines(userId \| profile, ageGroup?)` | Get adaptive prompt guidelines |
| `getTopicData(topicId)` | Get per-conversation data |
| `deleteTrack(trackId)` | Delete single track (auto-recalculates) |
| `deleteTopic(topicId)` | Delete topic data (auto-recalculates) |
| `deleteUser(userId)` | Delete all user data (GDPR) |
| `getEffectiveness(userId)` | Measure if guidelines are improving engagement |
| `recalculateUser(userId)` | Recalculate user profile from tracks |
| `recalculateTopic(topicId)` | Recalculate topic from tracks |

See [docs/API.md](docs/API.md) for complete reference.

---

## Playground

Web-based playground to chat with AI and see Lucid's cognitive protection in real-time.

```bash
cd lucid
npx tsx playground/server.ts
# → http://localhost:3333
```

Set `LUCID_API_KEY`, `LUCID_BASE_URL`, and `LUCID_MODEL` in a `.env` file. See `.env.example`.

---

## Performance & Cost

Lucid is designed to add **zero latency** and **near-zero cost** to your AI application:

- **Fire-and-forget analysis**: `track()` runs asynchronously — it never blocks the AI response. The user gets their answer instantly, cognitive analysis happens in the background.
- **TOON format**: Analysis uses [Token-Oriented Object Notation](https://github.com/toon-format/toon), saving ~40% tokens on LLM output compared to JSON. On 10k messages/day, that's ~1M tokens/day saved.
- **No DB required for guidelines**: `getGuidelines()` accepts a profile object directly — if you already have the profile in memory (e.g., from session state), no database call is needed:
  ```typescript
  // Zero-latency: pass the profile object, skip the DB
  const guidelines = await lucid.getGuidelines(cachedProfile, ageGroup);
  ```
- **Cheap models work great**: The analysis prompt is optimized for small, fast models (Llama 3.1 8B, Gemini Flash, etc.). No need for expensive frontier models.

---

## Philosophy

- **Not a judge**: No "good" or "bad" scores. The system adapts, not evaluates.
- **Invisible by default**: Users don't see scores unless you show them.
- **Privacy first**: Only aggregated metrics, never message content.
- **GDPR ready**: `deleteUser()` for complete data deletion.

---

## Documentation

- [Cognitive System](docs/COGNITIVE-SYSTEM.md) — How the scoring and adaptation works
- [Research Foundation](docs/RESEARCH.md) — Scientific basis and 31 references
- [Architecture](docs/ARCHITECTURE.md) — System design and data flow
- [API Reference](docs/API.md) — Complete method and type documentation

---

## License

BSD-3-Clause — TetiAI LLC
