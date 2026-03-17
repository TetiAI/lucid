// ============================================================
// Lucid SDK — In-Memory Store
// Simple in-memory storage for development and testing.
// Data is lost when the process exits.
// ============================================================

import type {
  LucidStore,
  UserCognitiveData,
  TopicCognitiveData,
  TopicModerationData,
  UserModerationData,
  TrackRecord,
} from '../types';

/**
 * In-memory store for development, testing, and prototyping.
 *
 * @example
 * ```typescript
 * const lucid = new Lucid({
 *   store: new MemoryStore(),
 *   analyzer: new LLMAnalyzer({ client }),
 * });
 * ```
 */
export class MemoryStore implements LucidStore {
  private users = new Map<string, UserCognitiveData>();
  private topics = new Map<string, TopicCognitiveData>();
  private topicModeration = new Map<string, TopicModerationData>();
  private userModeration = new Map<string, UserModerationData>();
  /** Maps userId → Set of topicIds with cognitive data */
  private userTopics = new Map<string, Set<string>>();
  /** All track records, keyed by ID */
  private tracks = new Map<string, TrackRecord>();

  async getUser(userId: string): Promise<UserCognitiveData | null> {
    return this.users.get(userId) || null;
  }

  async saveUser(userId: string, data: UserCognitiveData): Promise<void> {
    this.users.set(userId, data);
  }

  async getTopic(topicId: string): Promise<TopicCognitiveData | null> {
    return this.topics.get(topicId) || null;
  }

  async saveTopic(topicId: string, data: TopicCognitiveData, userId?: string): Promise<void> {
    this.topics.set(topicId, data);
    if (userId) {
      const set = this.userTopics.get(userId) || new Set();
      set.add(topicId);
      this.userTopics.set(userId, set);
    }
  }

  async getTopicModeration(topicId: string): Promise<TopicModerationData | null> {
    return this.topicModeration.get(topicId) || null;
  }

  async saveTopicModeration(topicId: string, data: TopicModerationData): Promise<void> {
    this.topicModeration.set(topicId, data);
  }

  async getUserModeration(userId: string): Promise<UserModerationData | null> {
    return this.userModeration.get(userId) || null;
  }

  async saveUserModeration(userId: string, data: UserModerationData): Promise<void> {
    this.userModeration.set(userId, data);
  }

  async countUserTopics(userId: string): Promise<number> {
    return this.userTopics.get(userId)?.size || 0;
  }

  async deleteUser(userId: string): Promise<void> {
    this.users.delete(userId);
    this.userModeration.delete(userId);
    const topicIds = this.userTopics.get(userId);
    if (topicIds) {
      for (const topicId of topicIds) {
        this.topics.delete(topicId);
        this.topicModeration.delete(topicId);
      }
    }
    this.userTopics.delete(userId);
    // Delete all tracks for this user
    for (const [id, track] of this.tracks) {
      if (track.userId === userId) this.tracks.delete(id);
    }
  }

  async deleteTopic(topicId: string): Promise<void> {
    this.topics.delete(topicId);
    this.topicModeration.delete(topicId);
    for (const [, set] of this.userTopics) {
      set.delete(topicId);
    }
    // Delete all tracks for this topic
    for (const [id, track] of this.tracks) {
      if (track.topicId === topicId) this.tracks.delete(id);
    }
  }

  // ========== TRACK RECORDS ==========

  async getTrack(trackId: string): Promise<TrackRecord | null> {
    return this.tracks.get(trackId) || null;
  }

  async saveTrack(record: TrackRecord): Promise<void> {
    this.tracks.set(record.id, record);
  }

  async getTracksByUser(userId: string): Promise<TrackRecord[]> {
    const results: TrackRecord[] = [];
    for (const track of this.tracks.values()) {
      if (track.userId === userId) results.push(track);
    }
    return results.sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  async getTracksByTopic(topicId: string): Promise<TrackRecord[]> {
    const results: TrackRecord[] = [];
    for (const track of this.tracks.values()) {
      if (track.topicId === topicId) results.push(track);
    }
    return results.sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  async deleteTrack(trackId: string): Promise<void> {
    this.tracks.delete(trackId);
  }

  async deleteTracksByTopic(topicId: string): Promise<void> {
    for (const [id, track] of this.tracks) {
      if (track.topicId === topicId) this.tracks.delete(id);
    }
  }

  /** Clear all data (useful for testing) */
  clear(): void {
    this.users.clear();
    this.topics.clear();
    this.topicModeration.clear();
    this.userModeration.clear();
    this.userTopics.clear();
    this.tracks.clear();
  }
}
