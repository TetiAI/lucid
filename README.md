<p align="center">
  <img src=".github/logo.svg" alt="Lucid" width="300" />
</p>

<p align="center">
  <strong>Cognitive health protection for AI agents.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@tetiai/lucid"><img src="https://img.shields.io/npm/v/@tetiai/lucid" alt="npm version"></a>
  <a href="https://github.com/tetiai/lucid/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-BSD--3--Clause-blue" alt="License"></a>
  <a href="https://www.npmjs.com/package/@tetiai/lucid"><img src="https://img.shields.io/npm/dm/@tetiai/lucid" alt="npm downloads"></a>
</p>

<p align="center">
  <img src=".github/teti-logo.svg" alt="TetiAI" height="17"> by <a href="https://teti.ai/hub">TetiAI</a>
</p>

---

After 3-6 months of heavy AI use, users show measurable decline in critical thinking ([MIT Media Lab, 2025](docs/RESEARCH.md)). The decline is gradual — each interaction seems fine, but over weeks users stop thinking for themselves. Nobody tracks this. **Lucid does.**

Lucid monitors user-AI interactions across 6 research-backed cognitive dimensions, detects drift over time, and injects adaptive guidelines into your AI's system prompt. Users who delegate everything get an AI that asks more questions. Users who think independently get challenged further.

Zero latency. Fire-and-forget. Any LLM provider.

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
  baseURL: process.env.LUCID_BASE_URL,  // Any OpenAI-compatible provider
});

const lucid = new Lucid({
  store: new PrismaStore(prisma),
  analyzer: new LLMAnalyzer({ client, model: process.env.LUCID_MODEL }),
});

// 1. After each message (fire-and-forget, does not block):
lucid.track(userId, {
  userMessage: "Write the code for me",
  aiResponse: "Sure, here's the implementation...",
  topicId: "conversation-123",
}).catch(console.error);

// 2. Before AI response — inject adaptive guidelines:
const guidelines = await lucid.getGuidelines(userId);
systemPrompt += guidelines;

// 3. User dashboard:
const profile = await lucid.getProfile(userId);
// → { score: 3200, level: 3, trend: "improving", driftIndex: 0.12,
//     scaffoldingLevel: "guided", trustCalibration: "calibrated" }
```

That's it. Three lines to integrate: `track()` after each exchange, `getGuidelines()` before each response, `getProfile()` for the dashboard.

---

## How It Works

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

Lucid doesn't block or filter. It adapts *how* the AI responds based on the user's cognitive patterns.

---

## What It Tracks

Six dimensions, aligned with validated psychometric scales ([GAIDS](docs/RESEARCH.md) α=.87, [Cognitive Offloading Scale](docs/RESEARCH.md) α=.90):

| Dimension | What It Measures |
|-----------|-----------------|
| **Autonomy** | Independent thinking vs delegation |
| **Learning** | Curiosity, asking "why", building understanding |
| **Engagement** | Quality and depth of participation |
| **Metacognition** | Self-awareness about own thinking process |
| **Verification** | Critical evaluation of AI output |
| **Motivation** | Why the user engages — intrinsic, instrumental, or avoidance |

Not all delegation is harmful — Lucid distinguishes **routine** delegation (formatting, translating) from **cognitive** delegation (reasoning, deciding, analyzing). Only cognitive delegation raises concern.

See [Cognitive System](docs/COGNITIVE-SYSTEM.md) for the full methodology: EMA smoothing, scoring weights, drift detection, and scaffolding theory.

---

## How It Adapts

`getGuidelines()` returns text to inject into your AI's system prompt. It changes automatically based on the user's profile:

| Detected Pattern | AI Behavior |
|-----------------|-------------|
| Low autonomy | "Ask for their initial thoughts before providing solutions" |
| High cognitive delegation | "Never decide for the user — present options and ask them to choose" |
| Cognitive drift (CDI > 0.3) | "Ask for their analysis before providing yours" |
| Fatigue detected | "Suggest a break. Keep responses shorter" |
| Over-trust | "Include caveats, ask 'Does this match your experience?'" |
| Avoidance motivation | "Break tasks into pieces, ask 'What part feels hardest?'" |

Lucid also implements **progressive scaffolding** (Vygotsky's ZPD) — AI support fades as users grow:

`full` → `guided` → `hints` → `challenge`

---

## Built For

- **AI chatbots & assistants** — protect users from becoming dependent on your product
- **EdTech platforms** — preserve learning outcomes when students use AI
- **Enterprise AI tools** — maintain workforce critical thinking skills
- **Youth-facing AI** — extra protection for users under 25 (prefrontal cortex still developing)

---

## Key Features

- **Zero latency** — `track()` is fire-and-forget, never blocks the AI response
- **Any LLM provider** — uses the `openai` SDK as universal client (OpenAI, Together AI, Groq, Ollama, OpenRouter, etc.)
- **Cheap models work** — optimized for small models (Llama 3.1 8B, Gemini Flash). No frontier model needed
- **~40% token savings** — analysis uses [TOON format](https://github.com/toon-format/toon) instead of JSON
- **Pluggable storage** — MemoryStore (dev), PrismaStore (production), RedisStore (distributed), or implement your own
- **Age-based protection** — stricter thresholds for under-25 users based on neuroscience research
- **Drift detection** — Cognitive Drift Index catches gradual decline over weeks/months
- **Effectiveness tracking** — measures if guidelines are actually improving engagement
- **GDPR ready** — `deleteUser()` for complete data deletion. No message content stored, only aggregated metrics
- **Context-aware** — a brief "ok do it" after deep collaboration scores differently than as a first message

---

## Storage

```typescript
// Development
const store = new MemoryStore();

// Production (PostgreSQL, MySQL, SQLite, MongoDB)
const store = new PrismaStore(prisma);

// Distributed
const store = new RedisStore(redisClient);
```

<details>
<summary>Prisma schema</summary>

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

</details>

---

## API

| Method | Description |
|--------|-------------|
| `track(userId, input)` | Analyze and track a message exchange |
| `getProfile(userId)` | Get cognitive profile (score, level, trend, driftIndex, scaffoldingLevel) |
| `getGuidelines(userId \| profile, ageGroup?)` | Get adaptive prompt guidelines |
| `getTopicData(topicId)` | Get per-conversation data |
| `getEffectiveness(userId)` | Measure if guidelines are improving engagement |
| `deleteTrack(trackId)` | Delete single track (auto-recalculates) |
| `deleteTopic(topicId)` | Delete topic data (auto-recalculates) |
| `deleteUser(userId)` | Delete all user data (GDPR) |
| `recalculateUser(userId)` | Recalculate user profile from tracks |
| `recalculateTopic(topicId)` | Recalculate topic from tracks |

See [API Reference](docs/API.md) for complete documentation.

---

## Playground

Try it locally — chat with an AI and see cognitive scoring in real-time:

```bash
npx tsx playground/server.ts
# → http://localhost:3333
```

Set `LUCID_API_KEY`, `LUCID_BASE_URL`, and `LUCID_MODEL` in `.env`. See [.env.example](.env.example).

---

## Documentation

- [Cognitive System](docs/COGNITIVE-SYSTEM.md) — Scoring methodology, EMA, drift detection, scaffolding
- [Research Foundation](docs/RESEARCH.md) — Scientific basis and 31+ peer-reviewed references
- [Architecture](docs/ARCHITECTURE.md) — System design and data flow
- [API Reference](docs/API.md) — Complete method and type documentation

---

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](.github/CONTRIBUTING.md) if available, or open an issue to discuss your idea.

---

## License

BSD 3-Clause — [TetiAI LLC](https://teti.ai)
