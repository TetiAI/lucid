# Lucid SDK — API Reference

Complete reference for all public methods, types, and configuration options.

---

## Lucid Class

The main entry point for the SDK.

### Constructor

```typescript
import OpenAI from 'openai';
import { Lucid, MemoryStore, LLMAnalyzer } from '@tetiai/lucid';

const client = new OpenAI({
  apiKey: process.env.LUCID_API_KEY,
  baseURL: process.env.LUCID_BASE_URL,
});

const lucid = new Lucid({
  store: new MemoryStore(),                              // Required
  analyzer: new LLMAnalyzer({ client, model: process.env.LUCID_MODEL }), // Optional
  debug: true,                                           // Optional (default: false)
});
```

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `store` | `LucidStore` | Yes | Storage adapter for persisting cognitive data |
| `analyzer` | `LucidAnalyzer` | No | LLM analyzer for automatic scoring |
| `debug` | `boolean` | No | Enable console logging (default: false) |

---

### `lucid.track(userId, input)`

Track a user-AI message exchange with automatic LLM analysis.

```typescript
await lucid.track('user-123', {
  userMessage: "Why does this algorithm use O(n log n)?",
  aiResponse: "The algorithm uses a divide-and-conquer approach...",
  topicId: "conversation-456",  // optional
});
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | `string` | Yes | Unique user identifier from your system |
| `input.userMessage` | `string` | Yes | The user's message text |
| `input.aiResponse` | `string` | Yes | The AI's response text |
| `input.topicId` | `string` | No | Conversation/topic ID for per-conversation tracking |

**Returns**: `Promise<void>`

**Behavior:**
- Skips messages shorter than 5 characters
- Calls the configured analyzer to score the message
- Updates topic cognitive data (if topicId provided)
- Updates user cognitive data (session, scores, level)
- Fire-and-forget safe: errors are logged, not thrown

---

### `lucid.getProfile(userId)`

Get the public cognitive profile for a user.

```typescript
const profile = await lucid.getProfile('user-123');

// Returns:
{
  userId: 'user-123',
  score: 3200,              // 0-10000
  level: 3,                 // 0-10
  levelProgress: 0.2,       // progress to next level (0-1)
  trend: 'improving',       // 'improving' | 'stable' | 'declining'
  autonomy: 0.45,           // 0 to 1 (EMA smoothed)
  learning: 0.72,           // 0-1 (EMA smoothed)
  engagement: 0.65,         // 0-1 (EMA smoothed)
  metacognition: 0.58,      // 0-1 (EMA smoothed)
  verification: 0.42,       // 0-1 (EMA smoothed)
  dominantMotivation: 'instrumental', // 'intrinsic' | 'instrumental' | 'avoidance'
  trustCalibration: 'calibrated',     // 'calibrated' | 'over_trust' | 'under_trust'
  totalMessages: 142,
  isFatigued: false,
  fatigueReason: undefined,
  driftIndex: 0.12,         // 0-1 (Cognitive Drift Index)
  scaffoldingLevel: 'guided', // 'full' | 'guided' | 'hints' | 'challenge'
  weeklyHistory: [
    { week: '2026-W10', autonomy: 0.4, learning: 0.7, metacognition: 0.5, messages: 120, fatigue_events: 2 },
    { week: '2026-W11', autonomy: 0.45, learning: 0.72, metacognition: 0.58, messages: 142, fatigue_events: 1 },
  ]
}
```

**Returns**: `Promise<CognitiveProfile | null>` — null if no data tracked yet

---

### `lucid.getGuidelines(userId | data, ageGroup?)`

Get cognitive adaptation guidelines for injection into an AI system prompt. Pass `ageGroup` to enable age-based protections.

You can pass either a `userId` (Lucid loads the profile from the store) or a `UserCognitiveData` object directly (skips the store query).

```typescript
// With userId — Lucid loads from store
const guidelines = await lucid.getGuidelines('user-123', 'teen');

// With profile — no extra store query
const profile = await lucid.getProfile('user-123');
const guidelines = await lucid.getGuidelines(profile, 'child');
// Returns a text block like:
//
// ## COGNITIVE SUPPORT
// Adapt your responses to protect and enhance user cognition:
//
// User tends to delegate (autonomy: 0.25)
// - ALWAYS ask for their initial thoughts before providing solutions
// ...

// Usage:
const systemPrompt = baseSystemPrompt + guidelines;
```

**Returns**: `Promise<string>` — empty string if no cognitive data

---

### `lucid.getTopicData(topicId)`

Get cognitive data for a specific conversation/topic.

```typescript
const topicData = await lucid.getTopicData('conversation-456');
```

**Returns**: `Promise<TopicCognitiveData | null>`

---

### `lucid.deleteUser(userId)`

Delete all cognitive data for a user — profile, all topics, moderation data. For GDPR compliance or account deletion.

```typescript
await lucid.deleteUser('user-123');
```

**Returns**: `Promise<void>`

---

### `lucid.deleteTopic(topicId)`

Delete all cognitive and moderation data for a specific topic/conversation.

```typescript
await lucid.deleteTopic('conversation-456');
```

**Returns**: `Promise<void>`

---

## Store Adapters

### MemoryStore

In-memory storage for development and testing.

```typescript
import { MemoryStore } from '@tetiai/lucid';

const store = new MemoryStore();

// Additional method for testing:
store.clear(); // Wipe all data
```

### PrismaStore

PostgreSQL storage via Prisma ORM. Reuses your existing Prisma connection.

```typescript
import { PrismaStore } from '@tetiai/lucid';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const store = new PrismaStore(prisma);
```

**Requirements:**
- Add the `LucidCognitive` model to your Prisma schema (see `prisma/schema.prisma`)
- Run `npx prisma db push` or create a migration

### Custom Store

Implement the `LucidStore` interface for any database:

```typescript
import type { LucidStore } from '@tetiai/lucid';

class MyCustomStore implements LucidStore {
  async getUser(userId: string) { /* ... */ }
  async saveUser(userId: string, data: UserCognitiveData) { /* ... */ }
  async getTopic(topicId: string) { /* ... */ }
  async saveTopic(topicId: string, data: TopicCognitiveData) { /* ... */ }
  async getTopicModeration(topicId: string) { /* ... */ }
  async saveTopicModeration(topicId: string, data: TopicModerationData) { /* ... */ }
  async getUserModeration(userId: string) { /* ... */ }
  async saveUserModeration(userId: string, data: UserModerationData) { /* ... */ }
  async countUserTopics(userId: string) { /* ... */ }
}
```

---

## Analyzers

### LLMAnalyzer

Uses the `openai` SDK as a universal client. Works with any compatible provider (Together AI, Groq, Ollama, OpenRouter) via `baseURL`.

```typescript
import OpenAI from 'openai';
import { LLMAnalyzer } from '@tetiai/lucid';

// Any OpenAI-compatible provider:
// Together AI → baseURL: 'https://api.together.xyz/v1'
// Groq        → baseURL: 'https://api.groq.com/openai/v1'
// Ollama      → baseURL: 'http://localhost:11434/v1'
// OpenRouter  → baseURL: 'https://openrouter.ai/api/v1'
const client = new OpenAI({
  apiKey: process.env.LUCID_API_KEY,
  baseURL: process.env.LUCID_BASE_URL,
});

const analyzer = new LLMAnalyzer({
  client,                                  // Required: OpenAI-compatible client
  model: process.env.LUCID_MODEL,          // Required: set via env
  temperature: 0.1,                        // default
  maxTokens: 600,                          // default
  maxAiResponseLength: 2000,               // default, truncates AI response
});
```

### Custom Analyzer

Implement the `LucidAnalyzer` interface for non-compatible providers:

```typescript
import type { LucidAnalyzer, AnalysisResult } from '@tetiai/lucid';

class MyAnalyzer implements LucidAnalyzer {
  async analyze(userMessage: string, aiResponse: string): Promise<AnalysisResult | null> {
    // Call your LLM, return scores
    return {
      summary: "...",
      cognitive: {
        autonomy_score: 0.5,       // 0 to 1
        learning_score: 0.8,        // 0 to 1
        engagement_score: 0.6,      // 0 to 1
        metacognition_score: 0.7,   // 0 to 1
        verification_score: 0.4,    // 0 to 1
        motivation_type: 'intrinsic', // 'intrinsic' | 'instrumental' | 'avoidance'
        delegation_count: 0,
        delegation_type: 'none',    // 'none' | 'routine' | 'cognitive'
        learning_moments: 1,
        application_moments: 0,
      },
      moderation: { has_flags: false, flags: [] },
    };
  }
}
```

---

## Scoring Utilities

All scoring functions are exported for custom implementations:

```typescript
import {
  getAdaptiveAlpha,     // (totalMessages) → alpha
  calculateEMA,         // (current, previous, alpha) → smoothed
  calculateScore,       // (autonomy, learning, engagement, messages) → 0-10000
  calculateLevel,       // (score) → 0-10
  getLevelProgress,     // (score) → 0-1
  calculateTrend,       // (current, previous, prevTrend?) → trend
  calculateQualityScore, // (autonomy, learning, engagement) → 0-1
  calculateExperienceFactor, // (totalMessages) → 0-1
  getScaffoldingLevel,  // (autonomy, learning, metacognition) → 'full' | 'guided' | 'hints' | 'challenge'
  getTrustCalibration,  // (avgVerification) → 'calibrated' | 'over_trust' | 'under_trust'
  getDominantMotivation, // (counts) → 'intrinsic' | 'instrumental' | 'avoidance'
  clamp,                // (value, min, max) → clamped
  getWeekString,        // (date) → "2026-W11"
} from '@tetiai/lucid';
```

---

## Session Utilities

```typescript
import {
  detectFatigue,      // (session, now, ageGroup?) → { is_fatigued, reason? }
  updateSession,      // (existing, msgLength, now, ageGroup?) → SessionData
  createEmptySession, // (now?) → SessionData
} from '@tetiai/lucid';
```

---

## Drift Utilities

```typescript
import {
  calculateDriftIndex, // (weeklyHistory) → 0-1 (Cognitive Drift Index)
} from '@tetiai/lucid';
```

---

## Constants

```typescript
import {
  MIN_LEVEL,              // 0
  MAX_COGNITIVE_LEVEL,    // 10
  EMA_ALPHA_BASE,         // 0.1
  EMA_ALPHA_MIN,          // 0.02
  EXPERIENCE_MESSAGES_MAX, // 1000
  MAX_SCORE,              // 10000
  POINTS_PER_LEVEL,       // 1000
  MAX_LEVEL,              // 10
  QUALITY_WEIGHTS,        // { autonomy: 0.30, learning: 0.40, engagement: 0.30 }
  SESSION_GAP_MINUTES,    // 30
  FATIGUE_SESSION_MINUTES,              // 45 (adults)
  FATIGUE_SESSION_MINUTES_YOUNG_ADULT,  // 30 (18-24)
  FATIGUE_SESSION_MINUTES_TEEN,         // 20 (13-17)
  FATIGUE_SESSION_MINUTES_CHILD,        // 15 (6-12)
  FATIGUE_MESSAGE_COUNT,                // 30 (adults)
  FATIGUE_MESSAGE_COUNT_YOUNG_ADULT,    // 20 (18-24)
  FATIGUE_MESSAGE_COUNT_TEEN,           // 15 (13-17)
  FATIGUE_MESSAGE_COUNT_CHILD,          // 10 (6-12)
} from '@tetiai/lucid';
```

---

## Types

All TypeScript types are exported:

```typescript
import type {
  LucidConfig,
  LucidStore,
  LucidAnalyzer,
  TrackInput,
  CognitiveProfile,
  UserCognitiveData,
  TopicCognitiveData,
  TopicModerationData,
  UserModerationData,
  AnalysisResult,
  TrackRecord,
  ModerationFlag,
  SessionData,
  WeeklySnapshot,
  AgeGroup,
  DelegationType,           // 'none' | 'routine' | 'cognitive'
  MotivationType,           // 'intrinsic' | 'instrumental' | 'avoidance'
  TrustCalibration,         // 'calibrated' | 'over_trust' | 'under_trust'
  ScaffoldingLevel,         // 'full' | 'guided' | 'hints' | 'challenge'
} from '@tetiai/lucid';
```

See `src/types.ts` for full type definitions.
