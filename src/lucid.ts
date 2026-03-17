// ============================================================
// Lucid SDK — Main Class
// The orchestrator that ties together scoring, session tracking,
// analysis, storage, and guidelines generation.
//
// Lucid is a cognitive health protection system for AI agents.
// It monitors how users interact with AI to prevent:
// - Cognitive dependency (delegating all thinking to AI)
// - Critical thinking atrophy (never questioning, never exploring)
// - Progressive disengagement (increasingly superficial interactions)
// - Cognitive fatigue (overextended sessions)
//
// It does this by:
// 1. Tracking cognitive dimensions per message (autonomy, learning, engagement)
// 2. Building an adaptive profile using EMA smoothing
// 3. Generating prompt guidelines that adapt AI responses
// 4. Detecting fatigue and suggesting breaks
// ============================================================

import type {
  LucidConfig,
  LucidStore,
  LucidAnalyzer,
  TrackInput,
  TrackRecord,
  CognitiveProfile,
  UserCognitiveData,
  TopicCognitiveData,
  TopicModerationData,
  AnalysisResult,
  AgeGroup,
  EffectivenessReport,
} from './types';
import {
  getAdaptiveAlpha,
  calculateEMA,
  clamp,
  calculateScore,
  calculateLevel,
  getLevelProgress,
  calculateTrend,
  getWeekString,
  getScaffoldingLevel,
  getTrustCalibration,
  getDominantMotivation,
  detectContextChangeAlpha,
} from './scoring';
import { updateSession } from './session';
import { buildCognitiveGuidelines } from './guidelines';
import { calculateDriftIndex } from './drift';

/** Minimum message length to trigger analysis */
const MIN_MESSAGE_LENGTH = 5;

/** Simple unique ID generator */
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

/**
 * Lucid — Cognitive Health Protection for AI Agents.
 *
 * @example
 * ```typescript
 * import OpenAI from 'openai';
 * import { Lucid, MemoryStore, LLMAnalyzer } from '@tetiai/lucid';
 *
 * const client = new OpenAI({
 *   apiKey: process.env.LUCID_API_KEY,
 *   baseURL: process.env.LUCID_BASE_URL,
 * });
 * const lucid = new Lucid({
 *   store: new MemoryStore(),
 *   analyzer: new LLMAnalyzer({ client, model: process.env.LUCID_MODEL }),
 * });
 *
 * // After each user-AI exchange:
 * await lucid.track(userId, {
 *   userMessage: "Write the code for me",
 *   aiResponse: "Sure, here's the code...",
 *   topicId: "conversation-123",
 * });
 *
 * // Before generating AI response:
 * const guidelines = await lucid.getGuidelines(userId);
 * // Inject into system prompt
 *
 * // Check user profile:
 * const profile = await lucid.getProfile(userId);
 * // { score: 3200, level: 3, trend: "improving", ... }
 * ```
 */
export class Lucid {
  private store: LucidStore;
  private analyzer?: LucidAnalyzer;
  private debug: boolean;

  constructor(config: LucidConfig) {
    this.store = config.store;
    this.analyzer = config.analyzer;
    this.debug = config.debug || false;
  }

  // ========== PUBLIC API ==========

  /**
   * Track a user-AI message exchange.
   *
   * This is the main entry point — call it after every message.
   * It analyzes the exchange (if an analyzer is configured),
   * updates cognitive scores, session state, and persists everything.
   *
   * If no analyzer is configured, you can pass pre-computed scores
   * via trackManual().
   */
  async track(userId: string, input: TrackInput): Promise<void> {
    if (!this.analyzer) {
      this.log('No analyzer configured, skipping analysis');
      return;
    }

    // Skip very short messages
    if (input.userMessage.length < MIN_MESSAGE_LENGTH) {
      this.log(`Skipped: message too short (${input.userMessage.length} chars)`);
      // Still update session even for short messages
      await this.updateSessionOnly(userId, input.userMessage.length);
      return;
    }

    // Build context for the analyzer
    let context = input.topicContext;
    if (!context && input.topicId) {
      // Auto-build context from topic summary if available
      const topicData = await this.store.getTopic(input.topicId);
      if (topicData?.summary) {
        context = topicData.summary;
      }
    }

    // Analyze with LLM
    const result = await this.analyzer.analyze(
      input.userMessage,
      input.aiResponse,
      context
    );

    if (!result) {
      this.log('Analysis returned null, skipping');
      return;
    }

    this.log(`Analysis: autonomy=${result.cognitive.autonomy_score}, learning=${result.cognitive.learning_score}, engagement=${result.cognitive.engagement_score}`);

    // Save individual track record
    const trackRecord: TrackRecord = {
      id: generateId(),
      userId,
      topicId: input.topicId,
      autonomy_score: result.cognitive.autonomy_score,
      learning_score: result.cognitive.learning_score,
      engagement_score: result.cognitive.engagement_score,
      metacognition_score: result.cognitive.metacognition_score,
      verification_score: result.cognitive.verification_score,
      motivation_type: result.cognitive.motivation_type,
      delegation_count: result.cognitive.delegation_count,
      delegation_type: result.cognitive.delegation_type,
      learning_moments: result.cognitive.learning_moments,
      application_moments: result.cognitive.application_moments,
      userMessageLength: input.userMessage.length,
      summary: result.summary,
      created_at: new Date().toISOString(),
    };
    await this.store.saveTrack(trackRecord);

    // Update topic cognitive data (if topicId provided)
    if (input.topicId) {
      await this.updateTopic(input.topicId, userId, result);
    }

    // Update user cognitive data
    await this.updateUser(userId, input.userMessage.length, result);
  }

  /**
   * Get the cognitive profile for a user.
   * Returns null if no data has been tracked yet.
   */
  async getProfile(userId: string): Promise<CognitiveProfile | null> {
    const data = await this.store.getUser(userId);
    if (!data) return null;

    return {
      userId,
      score: data.score,
      level: data.level,
      levelProgress: getLevelProgress(data.score),
      trend: data.trend,
      autonomy: data.avg_autonomy,
      learning: data.avg_learning,
      engagement: data.avg_engagement,
      metacognition: data.avg_metacognition || 0,
      verification: data.avg_verification || 0,
      dominantMotivation: getDominantMotivation(
        data.motivation_counts || { intrinsic: 0, instrumental: 0, avoidance: 0 }
      ),
      trustCalibration: getTrustCalibration(data.avg_verification || 0),
      totalMessages: data.total_messages,
      isFatigued: data.session?.is_fatigued || false,
      fatigueReason: data.session?.fatigue_reason,
      driftIndex: calculateDriftIndex(data.weekly_history),
      scaffoldingLevel: getScaffoldingLevel(
        data.avg_autonomy,
        data.avg_learning,
        data.avg_metacognition || 0,
        data.total_messages
      ),
      weeklyHistory: data.weekly_history,
      cognitiveData: data,
    };
  }

  /**
   * Get cognitive adaptation guidelines for injection into an AI system prompt.
   *
   * Accepts either a userId (loads from store), a CognitiveProfile (from getProfile),
   * or raw UserCognitiveData. Pass ageGroup for under-25 protections.
   */
  async getGuidelines(userId: string, ageGroup?: AgeGroup): Promise<string>;
  async getGuidelines(profile: CognitiveProfile, ageGroup?: AgeGroup): Promise<string>;
  async getGuidelines(data: UserCognitiveData, ageGroup?: AgeGroup): Promise<string>;
  async getGuidelines(first: string | CognitiveProfile | UserCognitiveData, ageGroup?: AgeGroup): Promise<string> {
    if (typeof first === 'string') {
      const data = await this.store.getUser(first);
      return buildCognitiveGuidelines(data, ageGroup);
    }
    // CognitiveProfile has 'cognitiveData', UserCognitiveData has 'avg_autonomy' directly
    const data = 'cognitiveData' in first ? first.cognitiveData : first;
    return buildCognitiveGuidelines(data, ageGroup);
  }

  /**
   * Get the raw topic cognitive data.
   */
  async getTopicData(topicId: string): Promise<TopicCognitiveData | null> {
    return this.store.getTopic(topicId);
  }

  /**
   * Measure the effectiveness of Lucid's guidelines over time.
   * Compares early weeks vs recent weeks to determine if the user's
   * cognitive engagement is improving, stable, or declining.
   *
   * Requires at least 4 weeks of data for a meaningful report.
   * This is NOT an A/B test — it measures change over time,
   * not against a control group.
   */
  async getEffectiveness(userId: string): Promise<EffectivenessReport> {
    const data = await this.store.getUser(userId);
    const history = data?.weekly_history || [];

    if (history.length < 4) {
      return {
        autonomyDelta: 0,
        learningDelta: 0,
        engagementDelta: 0,
        metacognitionDelta: 0,
        verificationDelta: 0,
        weeksTracked: history.length,
        sufficient: false,
      };
    }

    const mid = Math.floor(history.length / 2);
    const early = history.slice(0, mid);
    const recent = history.slice(mid);

    const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;

    return {
      autonomyDelta: avg(recent.map(w => w.autonomy)) - avg(early.map(w => w.autonomy)),
      learningDelta: avg(recent.map(w => w.learning)) - avg(early.map(w => w.learning)),
      engagementDelta: avg(recent.map(w => w.engagement)) - avg(early.map(w => w.engagement)),
      metacognitionDelta: avg(recent.map(w => w.metacognition)) - avg(early.map(w => w.metacognition)),
      verificationDelta: avg(recent.map(w => w.verification || 0)) - avg(early.map(w => w.verification || 0)),
      weeksTracked: history.length,
      sufficient: true,
    };
  }

  /**
   * Delete all cognitive data for a user.
   * Removes user profile, all topic data, and moderation data.
   * Use for GDPR compliance or account deletion.
   */
  async deleteUser(userId: string): Promise<void> {
    await this.store.deleteUser(userId);
    this.log(`Deleted all cognitive data for user ${userId}`);
  }

  /**
   * Delete all cognitive data for a specific topic/conversation.
   * Automatically recalculates the user's aggregated profile.
   */
  async deleteTopic(topicId: string): Promise<void> {
    // Find the userId from the topic's tracks before deleting
    const tracks = await this.store.getTracksByTopic(topicId);
    const userId = tracks[0]?.userId;

    await this.store.deleteTracksByTopic(topicId);
    await this.store.deleteTopic(topicId);
    this.log(`Deleted cognitive data for topic ${topicId}`);

    if (userId) {
      await this.recalculateUser(userId);
    }
  }

  /**
   * Delete a single track record.
   * Automatically recalculates user and topic aggregates.
   */
  async deleteTrack(trackId: string): Promise<void> {
    // Get the track to know which user/topic to recalculate
    const track = await this.store.getTrack(trackId);
    if (!track) {
      this.log(`Track ${trackId} not found`);
      return;
    }

    await this.store.deleteTrack(trackId);
    this.log(`Deleted track ${trackId}`);

    if (track.topicId) {
      await this.recalculateTopic(track.topicId);
    }
    await this.recalculateUser(track.userId);
  }

  /**
   * Recalculate a user's cognitive profile from all their track records.
   * Call this after deleting tracks to update aggregated scores.
   */
  async recalculateUser(userId: string): Promise<void> {
    const tracks = await this.store.getTracksByUser(userId);

    if (tracks.length === 0) {
      // No tracks left — delete user data
      await this.store.deleteUser(userId);
      this.log(`No tracks left for user ${userId}, deleted profile`);
      return;
    }

    // Replay all tracks through EMA in chronological order
    let avgAutonomy: number | undefined;
    let avgLearning: number | undefined;
    let avgEngagement: number | undefined;
    let avgMetacognition: number | undefined;
    let avgVerification: number | undefined;
    const motivationCounts = { intrinsic: 0, instrumental: 0, avoidance: 0 };
    let totalDelegation = 0;
    let totalDelegationRoutine = 0;
    let totalDelegationCognitive = 0;
    let totalLearningMoments = 0;
    let totalApplicationMoments = 0;

    for (let i = 0; i < tracks.length; i++) {
      const t = tracks[i];
      const alpha = getAdaptiveAlpha(i + 1);
      const cAutonomy = clamp(t.autonomy_score, -1, 1);
      const cLearning = clamp(t.learning_score, 0, 1);
      const cEngagement = clamp(t.engagement_score, 0, 1);
      const cMetacognition = clamp(t.metacognition_score || 0, 0, 1);
      const cVerification = clamp(t.verification_score || 0, 0, 1);

      avgAutonomy = calculateEMA(cAutonomy, avgAutonomy, alpha);
      avgLearning = calculateEMA(cLearning, avgLearning, alpha);
      avgEngagement = calculateEMA(cEngagement, avgEngagement, alpha);
      avgMetacognition = calculateEMA(cMetacognition, avgMetacognition, alpha);
      avgVerification = calculateEMA(cVerification, avgVerification, alpha);

      if (t.motivation_type) motivationCounts[t.motivation_type]++;
      totalDelegation += t.delegation_count;
      totalDelegationRoutine += (t.delegation_type === 'routine' ? 1 : 0);
      totalDelegationCognitive += (t.delegation_type === 'cognitive' ? 1 : 0);
      totalLearningMoments += t.learning_moments;
      totalApplicationMoments += t.application_moments;
    }

    const totalMessages = tracks.length;
    const score = calculateScore(avgAutonomy!, avgLearning!, avgEngagement!, totalMessages, avgMetacognition!, avgVerification!);
    const level = calculateLevel(score);
    const totalTopicsAnalyzed = await this.store.countUserTopics(userId);

    const now = new Date();
    const weekString = getWeekString(now);

    const newData: UserCognitiveData = {
      avg_autonomy: avgAutonomy!,
      avg_learning: avgLearning!,
      avg_engagement: avgEngagement!,
      avg_metacognition: avgMetacognition!,
      avg_verification: avgVerification!,
      motivation_counts: motivationCounts,
      total_messages: totalMessages,
      total_topics_analyzed: totalTopicsAnalyzed,
      total_delegation: totalDelegation,
      total_delegation_routine: totalDelegationRoutine,
      total_delegation_cognitive: totalDelegationCognitive,
      total_learning_moments: totalLearningMoments,
      total_application_moments: totalApplicationMoments,
      total_fatigue_events: 0,
      total_break_suggestions: 0,
      total_breaks_taken: 0,
      session: {
        started_at: now.toISOString(),
        last_message_at: now.toISOString(),
        message_count: 0,
        response_lengths: [],
        is_fatigued: false,
      },
      score,
      level,
      trend: 'stable',
      weekly_history: [{
        week: weekString,
        autonomy: avgAutonomy!,
        learning: avgLearning!,
        engagement: avgEngagement!,
        metacognition: avgMetacognition!,
        verification: avgVerification!,
        messages: totalMessages,
        fatigue_events: 0,
      }],
      last_updated: now.toISOString(),
      version: 1,
    };

    await this.store.saveUser(userId, newData);
    this.log(`Recalculated user ${userId}: ${totalMessages} tracks → score=${score}, level=${level}`);
  }

  /**
   * Recalculate a topic's cognitive data from its track records.
   */
  async recalculateTopic(topicId: string): Promise<void> {
    const tracks = await this.store.getTracksByTopic(topicId);

    if (tracks.length === 0) {
      // No tracks left — delete topic data
      await this.store.deleteTopic(topicId);
      this.log(`No tracks left for topic ${topicId}, deleted`);
      return;
    }

    // Replay EMA
    let autonomy: number | undefined;
    let learning: number | undefined;
    let engagement: number | undefined;
    let delegation = 0;
    let learningMoments = 0;
    let applicationMoments = 0;

    for (let i = 0; i < tracks.length; i++) {
      const t = tracks[i];
      const alpha = getAdaptiveAlpha(i + 1);
      autonomy = calculateEMA(clamp(t.autonomy_score, -1, 1), autonomy, alpha);
      learning = calculateEMA(clamp(t.learning_score, 0, 1), learning, alpha);
      engagement = calculateEMA(clamp(t.engagement_score, 0, 1), engagement, alpha);
      delegation += t.delegation_count;
      learningMoments += t.learning_moments;
      applicationMoments += t.application_moments;
    }

    const lastTrack = tracks[tracks.length - 1];
    const newTopicData: TopicCognitiveData = {
      autonomy_score: autonomy!,
      learning_score: learning!,
      engagement_score: engagement!,
      total_chats: tracks.length,
      delegation_count: delegation,
      learning_moments: learningMoments,
      application_moments: applicationMoments,
      summary: lastTrack.summary || `Analysis of ${tracks.length} messages`,
      last_chat_id: '',
      analyzed_at: new Date().toISOString(),
      version: 1,
    };

    await this.store.saveTopic(topicId, newTopicData);
    this.log(`Recalculated topic ${topicId}: ${tracks.length} tracks`);
  }

  // ========== INTERNAL METHODS ==========

  /**
   * Update only session state (for short messages that skip analysis).
   */
  private async updateSessionOnly(userId: string, messageLength: number): Promise<void> {
    const existing = await this.store.getUser(userId);
    if (!existing) return;

    const now = new Date();
    const session = updateSession(existing.session, messageLength, now);
    const updated: UserCognitiveData = { ...existing, session, last_updated: now.toISOString() };
    await this.store.saveUser(userId, updated);
  }

  /**
   * Update topic-level cognitive data with EMA smoothing.
   */
  private async updateTopic(
    topicId: string,
    _userId: string,
    result: AnalysisResult
  ): Promise<void> {
    const existing = await this.store.getTopic(topicId);
    const messageCount = (existing?.total_chats || 0) + 1;
    const alpha = getAdaptiveAlpha(messageCount);

    const clampedAutonomy = clamp(result.cognitive.autonomy_score, -1, 1);
    const clampedLearning = clamp(result.cognitive.learning_score, 0, 1);
    const clampedEngagement = clamp(result.cognitive.engagement_score, 0, 1);

    const newTopicData: TopicCognitiveData = {
      autonomy_score: calculateEMA(clampedAutonomy, existing?.autonomy_score, alpha),
      learning_score: calculateEMA(clampedLearning, existing?.learning_score, alpha),
      engagement_score: calculateEMA(clampedEngagement, existing?.engagement_score, alpha),
      total_chats: messageCount,
      delegation_count: (existing?.delegation_count || 0) + result.cognitive.delegation_count,
      learning_moments: (existing?.learning_moments || 0) + result.cognitive.learning_moments,
      application_moments: (existing?.application_moments || 0) + result.cognitive.application_moments,
      summary: result.summary || `Analysis of ${messageCount} messages`,
      last_chat_id: '',
      analyzed_at: new Date().toISOString(),
      version: (existing?.version || 0) + 1,
    };

    await this.store.saveTopic(topicId, newTopicData);

    // Handle moderation flags
    if (result.moderation.has_flags && result.moderation.flags.length > 0) {
      const existingMod = await this.store.getTopicModeration(topicId);
      const newFlags = result.moderation.flags
        .filter(f => f.severity !== 'LOW')
        .map(flag => ({
          ...flag,
          chat_id: '',
          chat_index: messageCount,
        }));

      if (newFlags.length > 0) {
        const allFlags = [...(existingMod?.flags || []), ...newFlags];
        const severityOrder = ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
        const maxSeverity = allFlags.reduce(
          (max, flag) =>
            severityOrder.indexOf(flag.severity) > severityOrder.indexOf(max)
              ? flag.severity
              : max,
          'LOW' as (typeof severityOrder)[number]
        );

        const newModeration: TopicModerationData = {
          flags: allFlags,
          max_severity: maxSeverity,
          total_flags: allFlags.length,
          status: existingMod?.status || 'PENDING',
          last_chat_id: '',
          analyzed_at: new Date().toISOString(),
        };

        await this.store.saveTopicModeration(topicId, newModeration);
      }
    }

    this.log(`Topic ${topicId} updated: v${newTopicData.version}`);
  }

  /**
   * Update user-level cognitive data with session tracking.
   */
  private async updateUser(
    userId: string,
    userMessageLength: number,
    result: AnalysisResult
  ): Promise<void> {
    const now = new Date();
    const existing = await this.store.getUser(userId);
    // Session tracking
    const session = updateSession(existing?.session, userMessageLength, now);
    const wasNotFatigued = !existing?.session?.is_fatigued;
    const isNowFatigued = session.is_fatigued;
    const newFatigueEvent = wasNotFatigued && isNowFatigued;

    // Incremental counters
    const totalMessages = (existing?.total_messages || 0) + 1;
    const totalDelegation = (existing?.total_delegation || 0) + result.cognitive.delegation_count;
    const totalDelegationRoutine = (existing?.total_delegation_routine || 0) + (result.cognitive.delegation_type === 'routine' ? 1 : 0);
    const totalDelegationCognitive = (existing?.total_delegation_cognitive || 0) + (result.cognitive.delegation_type === 'cognitive' ? 1 : 0);
    const totalLearningMoments = (existing?.total_learning_moments || 0) + result.cognitive.learning_moments;
    const totalApplicationMoments = (existing?.total_application_moments || 0) + result.cognitive.application_moments;
    const totalFatigueEvents = (existing?.total_fatigue_events || 0) + (newFatigueEvent ? 1 : 0);

    // Motivation counts
    const existingMotivation = existing?.motivation_counts || { intrinsic: 0, instrumental: 0, avoidance: 0 };
    const motivationCounts = {
      intrinsic: existingMotivation.intrinsic + (result.cognitive.motivation_type === 'intrinsic' ? 1 : 0),
      instrumental: existingMotivation.instrumental + (result.cognitive.motivation_type === 'instrumental' ? 1 : 0),
      avoidance: existingMotivation.avoidance + (result.cognitive.motivation_type === 'avoidance' ? 1 : 0),
    };

    // EMA scores with adaptive alpha
    const clampedAutonomy = clamp(result.cognitive.autonomy_score, -1, 1);
    const clampedLearning = clamp(result.cognitive.learning_score, 0, 1);
    const clampedEngagement = clamp(result.cognitive.engagement_score, 0, 1);
    const clampedMetacognition = clamp(result.cognitive.metacognition_score, 0, 1);
    const clampedVerification = clamp(result.cognitive.verification_score, 0, 1);

    const baseAlpha = getAdaptiveAlpha(totalMessages);
    // Detect context changes — boost alpha if current scores deviate significantly
    // from the established profile (e.g., user switching domains)
    const alpha = detectContextChangeAlpha(clampedAutonomy, existing?.avg_autonomy, baseAlpha);

    const avgAutonomy = calculateEMA(clampedAutonomy, existing?.avg_autonomy, alpha);
    const avgLearning = calculateEMA(clampedLearning, existing?.avg_learning, alpha);
    const avgEngagement = calculateEMA(clampedEngagement, existing?.avg_engagement, alpha);
    const avgMetacognition = calculateEMA(clampedMetacognition, existing?.avg_metacognition, alpha);
    const avgVerification = calculateEMA(clampedVerification, existing?.avg_verification, alpha);

    // Score & level
    const score = calculateScore(avgAutonomy, avgLearning, avgEngagement, totalMessages, avgMetacognition, avgVerification);
    const level = calculateLevel(score);
    const trend = calculateTrend(avgAutonomy, existing?.avg_autonomy, existing?.trend);

    // Weekly history (update every 3 messages to reduce writes)
    let weeklyHistory = existing?.weekly_history || [];
    let totalTopicsAnalyzed = existing?.total_topics_analyzed || 0;
    const doFullAggregate = !existing || totalMessages % 3 === 0;

    if (doFullAggregate) {
      totalTopicsAnalyzed = await this.store.countUserTopics(userId);

      const weekString = getWeekString(now);
      const existingWeek = weeklyHistory.find(w => w.week === weekString);
      if (existingWeek) {
        existingWeek.autonomy = avgAutonomy;
        existingWeek.learning = avgLearning;
        existingWeek.engagement = avgEngagement;
        existingWeek.metacognition = avgMetacognition;
        existingWeek.verification = avgVerification;
        existingWeek.messages = totalMessages;
        existingWeek.fatigue_events = totalFatigueEvents;
      } else {
        weeklyHistory = [
          ...weeklyHistory,
          {
            week: weekString,
            autonomy: avgAutonomy,
            learning: avgLearning,
            engagement: avgEngagement,
            metacognition: avgMetacognition,
            verification: avgVerification,
            messages: totalMessages,
            fatigue_events: totalFatigueEvents,
          },
        ];
        if (weeklyHistory.length > 12) {
          weeklyHistory = weeklyHistory.slice(-12);
        }
      }
    }

    // Build final data
    const newData: UserCognitiveData = {
      avg_autonomy: avgAutonomy,
      avg_learning: avgLearning,
      avg_engagement: avgEngagement,
      avg_metacognition: avgMetacognition,
      avg_verification: avgVerification,
      motivation_counts: motivationCounts,
      total_messages: totalMessages,
      total_topics_analyzed: totalTopicsAnalyzed,
      total_delegation: totalDelegation,
      total_delegation_routine: totalDelegationRoutine,
      total_delegation_cognitive: totalDelegationCognitive,
      total_learning_moments: totalLearningMoments,
      total_application_moments: totalApplicationMoments,
      total_fatigue_events: totalFatigueEvents,
      total_break_suggestions: existing?.total_break_suggestions || 0,
      total_breaks_taken: existing?.total_breaks_taken || 0,
      session,
      score,
      level,
      trend,
      weekly_history: weeklyHistory,
      last_updated: now.toISOString(),
      version: (existing?.version || 0) + 1,
    };

    await this.store.saveUser(userId, newData);

    this.log(`User ${userId}: score=${score}, level=${level}, trend=${trend}, α=${alpha.toFixed(3)}`);
  }

  private log(message: string): void {
    if (this.debug) {
      console.log(`[Lucid] ${message}`);
    }
  }
}
