#!/usr/bin/env node
// ============================================================
// Lucid Playground — Server
// Uses the real Lucid SDK. Run: npx tsx playground/server.ts
// ============================================================

import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import OpenAI from 'openai';
import { Lucid } from '../src/lucid';
import { MemoryStore } from '../src/store/memory';
import { LLMAnalyzer } from '../src/analyzer/llm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PORT = 3333;
const html = readFileSync(join(__dirname, 'index.html'), 'utf-8');

// --- Load .env ---
function loadEnv() {
  const envPath = join(__dirname, '..', '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    // Strip quotes, then inline comments
    if (val.startsWith('"') || val.startsWith("'")) {
      const quote = val[0];
      const endIdx = val.indexOf(quote, 1);
      if (endIdx > 0) val = val.slice(1, endIdx);
      else val = val.slice(1);
    } else {
      val = val.split('#')[0].trim();
    }
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnv();

// --- Config ---
const API_KEY = process.env.LUCID_API_KEY || '';
const BASE_URL = process.env.LUCID_BASE_URL || '';
const MODEL = process.env.LUCID_MODEL || '';

if (!API_KEY || !BASE_URL || !MODEL) {
  console.error('\n  ⚠ Missing config. Set LUCID_API_KEY, LUCID_BASE_URL, and LUCID_MODEL in .env\n');
  process.exit(1);
}

// --- LLM client (works with any OpenAI-compatible provider via baseURL) ---
const openai = new OpenAI({ apiKey: API_KEY, baseURL: BASE_URL });

// --- Lucid SDK ---
const store = new MemoryStore();
const lucid = new Lucid({
  store,
  analyzer: new LLMAnalyzer({ client: openai, model: MODEL, temperature: 0.1, maxTokens: 2000 }),
  debug: true,
});

console.log(`  Config: model=${MODEL}, baseUrl=${BASE_URL}`);

// --- Chat history per user ---
const chatHistories = new Map<string, Array<{ role: string; content: string }>>();

// --- Parse body ---
async function parseBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (c: Buffer) => { body += c; });
    req.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve({}); } });
  });
}

// --- Handler ---
async function handler(req: IncomingMessage, res: ServerResponse) {
  const url = req.url || '/';
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // HTML
  if (url === '/' || url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
    return;
  }

  // Logo
  if (url === '/logo.svg') {
    const logoPath = join(__dirname, '..', '.github', 'logo.svg');
    if (existsSync(logoPath)) {
      res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
      res.end(readFileSync(logoPath));
    } else {
      res.writeHead(404);
      res.end();
    }
    return;
  }

  // Config
  if (url === '/config') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ model: MODEL, baseUrl: BASE_URL }));
    return;
  }

  // Chat
  if (url === '/chat' && req.method === 'POST') {
    const body = await parseBody(req);
    const { userId: uid, topicId: tid, message, age } = body;
    if (!message) { res.writeHead(400); res.end('Missing message'); return; }

    const userId = uid || 'user-1';
    const topicId = tid || 'topic-1';
    const ageGroup = age ? (parseInt(age, 10) < 25 ? 'under25' as const : 'adult' as const) : undefined;

    // Chat history
    const hKey = userId + ':' + topicId;
    if (!chatHistories.has(hKey)) chatHistories.set(hKey, []);
    const history = chatHistories.get(hKey)!;
    history.push({ role: 'user', content: message });

    // System prompt with Lucid guidelines
    const guidelines = await lucid.getGuidelines(userId, ageGroup);
    const systemPrompt = 'You are the Lucid Playground assistant. Be concise and natural.' + guidelines;

    // SSE headers
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });

    // Send current guidelines
    res.write(`data: ${JSON.stringify({ type: 'system_prompt', guidelines: guidelines.trim() || null })}\n\n`);

    try {
      // Stream chat completion using OpenAI SDK
      const stream = await openai.chat.completions.create({
        model: MODEL,
        messages: [
          { role: 'system' as const, content: systemPrompt },
          ...history.slice(-20) as any,
        ],
        stream: true,
      });

      let fullResponse = '';

      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta?.content || '';
        if (delta) {
          fullResponse += delta;
          res.write(`data: ${JSON.stringify({ type: 'chunk', content: delta })}\n\n`);
        }
      }

      history.push({ role: 'assistant', content: fullResponse });

      // Signal that analysis is starting
      res.write(`data: ${JSON.stringify({ type: 'analyzing' })}\n\n`);

      // Track with Lucid SDK
      await lucid.track(userId, { userMessage: message, aiResponse: fullResponse, topicId });

      // Send cognitive data
      const profile = await lucid.getProfile(userId);
      const allTracks = await store.getTracksByUser(userId);
      const lastTrack = allTracks[allTracks.length - 1] || null;
      const cd = profile?.cognitiveData;

      res.write(`data: ${JSON.stringify({
        type: 'cognitive',
        profile,
        lastTrack: lastTrack ? {
          autonomy_score: lastTrack.autonomy_score,
          learning_score: lastTrack.learning_score,
          engagement_score: lastTrack.engagement_score,
          metacognition_score: lastTrack.metacognition_score,
          verification_score: lastTrack.verification_score,
          motivation_type: lastTrack.motivation_type,
          delegation_count: lastTrack.delegation_count,
          delegation_type: lastTrack.delegation_type,
          learning_moments: lastTrack.learning_moments,
          application_moments: lastTrack.application_moments,
        } : null,
        guidelines: profile ? (await lucid.getGuidelines(profile, ageGroup)).trim() || null : null,
        counters: {
          total_delegation_cognitive: cd?.total_delegation_cognitive || 0,
          total_learning_moments: cd?.total_learning_moments || 0,
          total_application_moments: cd?.total_application_moments || 0,
        },
      })}\n\n`);

      res.write('data: [DONE]\n\n');
      res.end();

    } catch (err: any) {
      console.error('[Playground] Error:', err.message);
      res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`);
      res.end();
    }
    return;
  }

  res.writeHead(404);
  res.end('Not found');
}

const server = createServer(handler);
server.listen(PORT, () => {
  console.log(`\n  Lucid Playground → http://localhost:${PORT}\n`);
});
