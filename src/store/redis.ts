// ============================================================
// Lucid SDK — Redis Store
// Persistent storage using Redis (ioredis or any compatible client).
// Uses JSON serialization with key prefixes per data type.
// ============================================================

import type {
  LucidStore,
  UserCognitiveData,
  TopicCognitiveData,
  TopicModerationData,
  UserModerationData,
  TrackRecord,
} from '../types';

/** Key prefixes for different data types */
const KEYS = {
  USER_COGNITIVE: 'lucid:user:cognitive:',
  TOPIC_COGNITIVE: 'lucid:topic:cognitive:',
  TOPIC_MODERATION: 'lucid:topic:moderation:',
  USER_MODERATION: 'lucid:user:moderation:',
  USER_TOPICS: 'lucid:user:topics:',       // Set of topicIds per user
  TRACK: 'lucid:track:',                   // Individual track record
  USER_TRACKS: 'lucid:user:tracks:',       // Sorted set of trackIds per user
  TOPIC_TRACKS: 'lucid:topic:tracks:',     // Sorted set of trackIds per topic
} as const;

/**
 * Redis store adapter for Lucid SDK.
 *
 * Works with any Redis client that implements `get`, `set`, `sadd`, `scard`
 * (e.g., ioredis, redis, @upstash/redis).
 *
 * @example
 * ```typescript
 * import Redis from 'ioredis';
 *
 * const redis = new Redis(process.env.REDIS_URL);
 * const store = new RedisStore(redis);
 *
 * const lucid = new Lucid({
 *   store,
 *   analyzer: new LLMAnalyzer({ client }),
 * });
 * ```
 *
 * @example
 * ```typescript
 * // With Upstash Redis (serverless)
 * import { Redis } from '@upstash/redis';
 *
 * const redis = new Redis({
 *   url: process.env.UPSTASH_REDIS_REST_URL,
 *   token: process.env.UPSTASH_REDIS_REST_TOKEN,
 * });
 * const store = new RedisStore(redis);
 * ```
 */
export class RedisStore implements LucidStore {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private redis: any;
  /** Optional TTL in seconds for all keys (0 = no expiry) */
  private ttl: number;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(redis: any, options?: { ttl?: number }) {
    this.redis = redis;
    this.ttl = options?.ttl || 0;
  }

  // ========== USER COGNITIVE ==========

  async getUser(userId: string): Promise<UserCognitiveData | null> {
    const data = await this.redis.get(KEYS.USER_COGNITIVE + userId);
    if (!data) return null;
    return typeof data === 'string' ? JSON.parse(data) : data;
  }

  async saveUser(userId: string, data: UserCognitiveData): Promise<void> {
    const key = KEYS.USER_COGNITIVE + userId;
    const value = JSON.stringify(data);
    if (this.ttl > 0) {
      await this.redis.set(key, value, 'EX', this.ttl);
    } else {
      await this.redis.set(key, value);
    }
  }

  // ========== TOPIC COGNITIVE ==========

  async getTopic(topicId: string): Promise<TopicCognitiveData | null> {
    const data = await this.redis.get(KEYS.TOPIC_COGNITIVE + topicId);
    if (!data) return null;
    return typeof data === 'string' ? JSON.parse(data) : data;
  }

  async saveTopic(topicId: string, data: TopicCognitiveData, userId?: string): Promise<void> {
    const key = KEYS.TOPIC_COGNITIVE + topicId;
    const value = JSON.stringify(data);
    if (this.ttl > 0) {
      await this.redis.set(key, value, 'EX', this.ttl);
    } else {
      await this.redis.set(key, value);
    }
    // Track topic ownership for countUserTopics
    if (userId) {
      await this.redis.sadd(KEYS.USER_TOPICS + userId, topicId);
    }
  }

  // ========== TOPIC MODERATION ==========

  async getTopicModeration(topicId: string): Promise<TopicModerationData | null> {
    const data = await this.redis.get(KEYS.TOPIC_MODERATION + topicId);
    if (!data) return null;
    return typeof data === 'string' ? JSON.parse(data) : data;
  }

  async saveTopicModeration(topicId: string, data: TopicModerationData): Promise<void> {
    const key = KEYS.TOPIC_MODERATION + topicId;
    const value = JSON.stringify(data);
    if (this.ttl > 0) {
      await this.redis.set(key, value, 'EX', this.ttl);
    } else {
      await this.redis.set(key, value);
    }
  }

  // ========== USER MODERATION ==========

  async getUserModeration(userId: string): Promise<UserModerationData | null> {
    const data = await this.redis.get(KEYS.USER_MODERATION + userId);
    if (!data) return null;
    return typeof data === 'string' ? JSON.parse(data) : data;
  }

  async saveUserModeration(userId: string, data: UserModerationData): Promise<void> {
    const key = KEYS.USER_MODERATION + userId;
    const value = JSON.stringify(data);
    if (this.ttl > 0) {
      await this.redis.set(key, value, 'EX', this.ttl);
    } else {
      await this.redis.set(key, value);
    }
  }

  // ========== COUNTS ==========

  async countUserTopics(userId: string): Promise<number> {
    return await this.redis.scard(KEYS.USER_TOPICS + userId) || 0;
  }

  async deleteUser(userId: string): Promise<void> {
    const topicIds: string[] = await this.redis.smembers(KEYS.USER_TOPICS + userId) || [];
    // Get all track IDs for this user
    const trackIds: string[] = await this.redis.smembers(KEYS.USER_TRACKS + userId) || [];

    const keysToDelete = [
      KEYS.USER_COGNITIVE + userId,
      KEYS.USER_MODERATION + userId,
      KEYS.USER_TOPICS + userId,
      KEYS.USER_TRACKS + userId,
    ];

    for (const topicId of topicIds) {
      keysToDelete.push(KEYS.TOPIC_COGNITIVE + topicId);
      keysToDelete.push(KEYS.TOPIC_MODERATION + topicId);
      keysToDelete.push(KEYS.TOPIC_TRACKS + topicId);
    }
    for (const trackId of trackIds) {
      keysToDelete.push(KEYS.TRACK + trackId);
    }

    if (keysToDelete.length > 0) {
      await this.redis.del(...keysToDelete);
    }
  }

  async deleteTopic(topicId: string): Promise<void> {
    // Get all track IDs for this topic
    const trackIds: string[] = await this.redis.smembers(KEYS.TOPIC_TRACKS + topicId) || [];
    const keysToDelete = [
      KEYS.TOPIC_COGNITIVE + topicId,
      KEYS.TOPIC_MODERATION + topicId,
      KEYS.TOPIC_TRACKS + topicId,
    ];
    for (const trackId of trackIds) {
      keysToDelete.push(KEYS.TRACK + trackId);
    }
    if (keysToDelete.length > 0) {
      await this.redis.del(...keysToDelete);
    }
  }

  // ========== TRACK RECORDS ==========

  async getTrack(trackId: string): Promise<TrackRecord | null> {
    const data = await this.redis.get(KEYS.TRACK + trackId);
    if (!data) return null;
    return typeof data === 'string' ? JSON.parse(data) : data;
  }

  async saveTrack(record: TrackRecord): Promise<void> {
    const value = JSON.stringify(record);
    if (this.ttl > 0) {
      await this.redis.set(KEYS.TRACK + record.id, value, 'EX', this.ttl);
    } else {
      await this.redis.set(KEYS.TRACK + record.id, value);
    }
    // Index by user and topic
    await this.redis.sadd(KEYS.USER_TRACKS + record.userId, record.id);
    if (record.topicId) {
      await this.redis.sadd(KEYS.TOPIC_TRACKS + record.topicId, record.id);
    }
  }

  async getTracksByUser(userId: string): Promise<TrackRecord[]> {
    const trackIds: string[] = await this.redis.smembers(KEYS.USER_TRACKS + userId) || [];
    if (trackIds.length === 0) return [];
    const keys = trackIds.map(id => KEYS.TRACK + id);
    const values = await this.redis.mget(...keys);
    const records: TrackRecord[] = [];
    for (const v of values) {
      if (v) records.push(typeof v === 'string' ? JSON.parse(v) : v);
    }
    return records.sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  async getTracksByTopic(topicId: string): Promise<TrackRecord[]> {
    const trackIds: string[] = await this.redis.smembers(KEYS.TOPIC_TRACKS + topicId) || [];
    if (trackIds.length === 0) return [];
    const keys = trackIds.map(id => KEYS.TRACK + id);
    const values = await this.redis.mget(...keys);
    const records: TrackRecord[] = [];
    for (const v of values) {
      if (v) records.push(typeof v === 'string' ? JSON.parse(v) : v);
    }
    return records.sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  async deleteTrack(trackId: string): Promise<void> {
    // Get the record to find userId and topicId for index cleanup
    const raw = await this.redis.get(KEYS.TRACK + trackId);
    if (raw) {
      const record: TrackRecord = typeof raw === 'string' ? JSON.parse(raw) : raw;
      await this.redis.srem(KEYS.USER_TRACKS + record.userId, trackId);
      if (record.topicId) {
        await this.redis.srem(KEYS.TOPIC_TRACKS + record.topicId, trackId);
      }
    }
    await this.redis.del(KEYS.TRACK + trackId);
  }

  async deleteTracksByTopic(topicId: string): Promise<void> {
    const trackIds: string[] = await this.redis.smembers(KEYS.TOPIC_TRACKS + topicId) || [];
    if (trackIds.length > 0) {
      const keysToDelete = trackIds.map(id => KEYS.TRACK + id);
      keysToDelete.push(KEYS.TOPIC_TRACKS + topicId);
      await this.redis.del(...keysToDelete);
      // Remove from user indexes
      for (const id of trackIds) {
        const raw = await this.redis.get(KEYS.TRACK + id);
        if (raw) {
          const record: TrackRecord = typeof raw === 'string' ? JSON.parse(raw) : raw;
          await this.redis.srem(KEYS.USER_TRACKS + record.userId, id);
        }
      }
    }
  }
}
