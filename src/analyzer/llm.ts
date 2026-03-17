// ============================================================
// Lucid SDK — LLM Analyzer
// Uses any OpenAI-compatible client (Together, Groq, Ollama,
// OpenRouter, Azure, Fireworks, Mistral, vLLM, LiteLLM, etc.)
// ============================================================

import type { AnalysisResult, LucidAnalyzer } from '../types';
import { ANALYSIS_PROMPT, formatAnalysisInput } from './prompt';

interface LLMAnalyzerConfig {
  /** OpenAI-compatible client instance (from `openai` package) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any;
  /** Model to use */
  model?: string;
  /** Temperature (default: 0.1) */
  temperature?: number;
  /** Max tokens for response (default: 600) */
  maxTokens?: number;
  /** Max AI response length to include in analysis (default: 2000) */
  maxAiResponseLength?: number;
}

/**
 * Analyzer using any OpenAI-compatible LLM client.
 *
 * Pass your own client instance — configure it for any provider
 * by setting `baseURL` in the OpenAI constructor.
 *
 * @example
 * ```typescript
 * import OpenAI from 'openai';
 *
 * const client = new OpenAI({
 *   apiKey: process.env.LUCID_API_KEY,
 *   baseURL: process.env.LUCID_BASE_URL,
 * });
 *
 * const analyzer = new LLMAnalyzer({ client, model: process.env.LUCID_MODEL });
 * ```
 */
export class LLMAnalyzer implements LucidAnalyzer {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: any;
  private model: string;
  private temperature: number;
  private maxTokens: number;
  private maxAiResponseLength: number;

  constructor(config: LLMAnalyzerConfig) {
    this.client = config.client;
    this.model = config.model || 'gpt-4o-mini';
    this.temperature = config.temperature ?? 0.1;
    this.maxTokens = config.maxTokens ?? 2000;
    this.maxAiResponseLength = config.maxAiResponseLength ?? 2000;
  }

  async analyze(
    userMessage: string,
    aiResponse: string,
    context?: string
  ): Promise<AnalysisResult | null> {
    try {
      const input = formatAnalysisInput(
        userMessage,
        aiResponse,
        this.maxAiResponseLength,
        context
      );

      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: ANALYSIS_PROMPT },
          { role: 'user', content: input },
        ],
        temperature: this.temperature,
        max_tokens: this.maxTokens,
      });

      console.log('[Lucid] Raw completion:', JSON.stringify(completion).slice(0, 1000));

      const choice = completion.choices?.[0];
      const content = choice?.message?.content
        || (choice?.message as any)?.reasoning
        || (choice as any)?.text;

      if (!content) {
        console.error('[Lucid] No content found in response');
        return null;
      }

      console.log('[Lucid] Analysis content:', content.slice(0, 500));
      const result = await parseResponse(content, userMessage);
      console.log('[Lucid] Parsed result:', JSON.stringify(result));
      return result;
    } catch (error) {
      console.error('[Lucid] Analysis error:', error);
      return null;
    }
  }
}

async function parseResponse(
  content: string,
  userMessage: string
): Promise<AnalysisResult | null> {
  const defaults: AnalysisResult = {
    summary: userMessage.substring(0, 100),
    cognitive: {
      autonomy_score: 0,
      learning_score: 0,
      engagement_score: 0,
      metacognition_score: 0,
      verification_score: 0,
      motivation_type: 'instrumental',
      delegation_count: 0,
      delegation_type: 'none',
      learning_moments: 0,
      application_moments: 0,
    },
    moderation: { has_flags: false, flags: [] },
  };

  try {
    // Parse TOON response from LLM
    const parsed = await parseToon(content);
    if (!parsed) return null;

    // Check if this looks like a cognitive analysis result
    if (!parsed.cognitive && parsed.autonomy_score === undefined) return null;

    // Handle flat format (scores at top level) vs nested format
    const cognitive = parsed.cognitive
      ? { ...defaults.cognitive, ...(parsed.cognitive as object) }
      : {
          autonomy_score: (parsed.autonomy_score as number) ?? 0,
          learning_score: (parsed.learning_score as number) ?? 0,
          engagement_score: (parsed.engagement_score as number) ?? 0,
          metacognition_score: (parsed.metacognition_score as number) ?? 0,
          verification_score: (parsed.verification_score as number) ?? 0,
          motivation_type: ((parsed.motivation_type as string) ?? 'instrumental') as 'intrinsic' | 'instrumental' | 'avoidance',
          delegation_count: (parsed.delegation_count as number) ?? 0,
          delegation_type: (parsed.delegation_type as string as 'none' | 'routine' | 'cognitive') ?? 'none',
          learning_moments: (parsed.learning_moments as number) ?? 0,
          application_moments: (parsed.application_moments as number) ?? 0,
        };

    return {
      summary: (parsed.summary as string) || defaults.summary,
      cognitive,
      moderation: (parsed.moderation as AnalysisResult['moderation'])?.has_flags
        ? (parsed.moderation as AnalysisResult['moderation'])
        : defaults.moderation,
    };
  } catch {
    return null;
  }
}

/** Parse TOON format response */
async function parseToon(content: string): Promise<Record<string, unknown> | null> {
  try {
    // Strip markdown code blocks if present
    const cleaned = content
      .replace(/^```(?:toon)?\s*\n?/m, '')
      .replace(/\n?```\s*$/m, '')
      .trim();

    // TOON content detection: look for "key: value" patterns without JSON braces
    if (cleaned.includes('{') && !cleaned.startsWith('summary:')) return null;

    const { decode } = await import('@toon-format/toon');
    const parsed = decode(cleaned);
    if (parsed && typeof parsed === 'object' && ('summary' in parsed || 'cognitive' in parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}
