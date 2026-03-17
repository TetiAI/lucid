// ============================================================
// Lucid SDK — Prisma Store
// Persistent storage using Prisma ORM.
// Uses a dedicated `lucid_cognitive` table.
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
 * Prisma store adapter for Lucid SDK.
 *
 * Uses a single `lucid_cognitive` table with a `kind` discriminator
 * to store all cognitive data types. This means you only need ONE table
 * regardless of how many data types Lucid manages.
 *
 * @example
 * ```typescript
 * import { PrismaClient } from '@prisma/client';
 *
 * const prisma = new PrismaClient();
 * const store = new PrismaStore(prisma);
 *
 * const lucid = new Lucid({
 *   store,
 *   analyzer: new LLMAnalyzer({ client }),
 * });
 * ```
 */
export class PrismaStore implements LucidStore {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private prisma: any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(prisma: any) {
    this.prisma = prisma;
  }

  // ========== USER COGNITIVE ==========

  async getUser(userId: string): Promise<UserCognitiveData | null> {
    const record = await this.prisma.lucidCognitive.findUnique({
      where: { kind_externalId: { kind: 'user_cognitive', externalId: userId } },
    });
    return record?.data as UserCognitiveData | null;
  }

  async saveUser(userId: string, data: UserCognitiveData): Promise<void> {
    await this.prisma.lucidCognitive.upsert({
      where: { kind_externalId: { kind: 'user_cognitive', externalId: userId } },
      create: {
        kind: 'user_cognitive',
        externalId: userId,
        data: data as object,
      },
      update: {
        data: data as object,
        updatedAt: new Date(),
      },
    });
  }

  // ========== TOPIC COGNITIVE ==========

  async getTopic(topicId: string): Promise<TopicCognitiveData | null> {
    const record = await this.prisma.lucidCognitive.findUnique({
      where: { kind_externalId: { kind: 'topic_cognitive', externalId: topicId } },
    });
    return record?.data as TopicCognitiveData | null;
  }

  async saveTopic(topicId: string, data: TopicCognitiveData): Promise<void> {
    await this.prisma.lucidCognitive.upsert({
      where: { kind_externalId: { kind: 'topic_cognitive', externalId: topicId } },
      create: {
        kind: 'topic_cognitive',
        externalId: topicId,
        data: data as object,
      },
      update: {
        data: data as object,
        updatedAt: new Date(),
      },
    });
  }

  // ========== TOPIC MODERATION ==========

  async getTopicModeration(topicId: string): Promise<TopicModerationData | null> {
    const record = await this.prisma.lucidCognitive.findUnique({
      where: { kind_externalId: { kind: 'topic_moderation', externalId: topicId } },
    });
    return record?.data as TopicModerationData | null;
  }

  async saveTopicModeration(topicId: string, data: TopicModerationData): Promise<void> {
    await this.prisma.lucidCognitive.upsert({
      where: { kind_externalId: { kind: 'topic_moderation', externalId: topicId } },
      create: {
        kind: 'topic_moderation',
        externalId: topicId,
        data: data as object,
      },
      update: {
        data: data as object,
        updatedAt: new Date(),
      },
    });
  }

  // ========== USER MODERATION ==========

  async getUserModeration(userId: string): Promise<UserModerationData | null> {
    const record = await this.prisma.lucidCognitive.findUnique({
      where: { kind_externalId: { kind: 'user_moderation', externalId: userId } },
    });
    return record?.data as UserModerationData | null;
  }

  async saveUserModeration(userId: string, data: UserModerationData): Promise<void> {
    await this.prisma.lucidCognitive.upsert({
      where: { kind_externalId: { kind: 'user_moderation', externalId: userId } },
      create: {
        kind: 'user_moderation',
        externalId: userId,
        data: data as object,
      },
      update: {
        data: data as object,
        updatedAt: new Date(),
      },
    });
  }

  // ========== COUNTS ==========

  async countUserTopics(userId: string): Promise<number> {
    const count = await this.prisma.lucidCognitive.count({
      where: {
        kind: 'topic_cognitive',
        userId: userId,
      },
    });
    return count;
  }

  async deleteUser(userId: string): Promise<void> {
    // Delete user cognitive + moderation data
    await this.prisma.lucidCognitive.deleteMany({
      where: {
        OR: [
          { kind: 'user_cognitive', externalId: userId },
          { kind: 'user_moderation', externalId: userId },
        ],
      },
    });
    // Delete all topics owned by this user
    await this.prisma.lucidCognitive.deleteMany({
      where: { userId: userId },
    });
  }

  async deleteTopic(topicId: string): Promise<void> {
    await this.prisma.lucidCognitive.deleteMany({
      where: {
        OR: [
          { kind: 'topic_cognitive', externalId: topicId },
          { kind: 'topic_moderation', externalId: topicId },
          { kind: 'track', externalId: topicId },
        ],
      },
    });
  }

  // ========== TRACK RECORDS ==========

  async getTrack(trackId: string): Promise<TrackRecord | null> {
    const record = await this.prisma.lucidCognitive.findUnique({
      where: { id: trackId },
    });
    if (!record || record.kind !== 'track') return null;
    return record.data as TrackRecord;
  }

  async saveTrack(record: TrackRecord): Promise<void> {
    await this.prisma.lucidCognitive.create({
      data: {
        id: record.id,
        kind: 'track',
        externalId: record.topicId || record.userId,
        userId: record.userId,
        data: record as object,
      },
    });
  }

  async getTracksByUser(userId: string): Promise<TrackRecord[]> {
    const records = await this.prisma.lucidCognitive.findMany({
      where: { kind: 'track', userId },
      orderBy: { createdAt: 'asc' },
    });
    return records.map((r: { data: unknown }) => r.data as TrackRecord);
  }

  async getTracksByTopic(topicId: string): Promise<TrackRecord[]> {
    const records = await this.prisma.lucidCognitive.findMany({
      where: { kind: 'track', externalId: topicId },
      orderBy: { createdAt: 'asc' },
    });
    return records.map((r: { data: unknown }) => r.data as TrackRecord);
  }

  async deleteTrack(trackId: string): Promise<void> {
    await this.prisma.lucidCognitive.delete({
      where: { id: trackId },
    }).catch(() => {
      // Record may not exist
    });
  }

  async deleteTracksByTopic(topicId: string): Promise<void> {
    await this.prisma.lucidCognitive.deleteMany({
      where: { kind: 'track', externalId: topicId },
    });
  }
}
