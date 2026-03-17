// ============================================================
// Lucid SDK — Cognitive Protection for AI Agents
// Types & Interfaces
// ============================================================

// ========== COGNITIVE LEVELS ==========

/** Cognitive levels range from 0 to 10 */
export const MIN_LEVEL = 0;
export const MAX_LEVEL = 10;

// ========== ANALYSIS RESULT ==========

/**
 * Raw result from LLM analysis of a single message exchange.
 */
export interface AnalysisResult {
  /** Dense summary of the conversation exchange */
  summary: string;
  /** Cognitive scores for this specific message */
  cognitive: {
    /** Independence vs delegation (0-1) */
    autonomy_score: number;
    /** Is the user trying to learn/understand? (0-1) */
    learning_score: number;
    /** Quality of user participation (0-1) */
    engagement_score: number;
    /** Self-awareness about own thinking process (0-1) */
    metacognition_score: number;
    /** Does the user verify/question AI outputs? (0-1) */
    verification_score: number;
    /** Why is the user using AI? */
    motivation_type: MotivationType;
    /** 1 if user delegated a task, 0 otherwise */
    delegation_count: number;
    /** Type of delegation: routine (formatting, translating) vs cognitive (reasoning, deciding, creating) */
    delegation_type: 'none' | 'routine' | 'cognitive';
    /** 1 if user showed curiosity or asked "why", 0 otherwise */
    learning_moments: number;
    /** 1 if user applied previous knowledge, 0 otherwise */
    application_moments: number;
  };
  /** Content moderation flags */
  moderation: {
    has_flags: boolean;
    flags: ModerationFlag[];
  };
}

export interface ModerationFlag {
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  category: string;
  reason: string;
  confidence: number;
}

// ========== AGE GROUP ==========

/**
 * Age-based protection tier.
 * Under-25 users get stricter fatigue thresholds and more protective guidelines,
 * based on neuroplasticity research showing higher cognitive vulnerability in younger users.
 */
export type AgeGroup = 'under25' | 'adult';

// ========== SESSION ==========

/**
 * Tracks the current cognitive session for fatigue detection.
 * A session resets after a configurable gap of inactivity.
 */
export interface SessionData {
  started_at: string;
  last_message_at: string;
  message_count: number;
  /** Last N user message lengths for shortening detection */
  response_lengths: number[];
  is_fatigued: boolean;
  fatigue_reason?: string;
}

// ========== TOPIC COGNITIVE DATA ==========

/**
 * Cognitive data for a single conversation/topic.
 * Scores are EMA-smoothed across all messages in the topic.
 */
export interface TopicCognitiveData {
  autonomy_score: number;
  learning_score: number;
  engagement_score: number;
  total_chats: number;
  delegation_count: number;
  learning_moments: number;
  application_moments: number;
  summary: string;
  last_chat_id: string;
  analyzed_at: string;
  version: number;
}

// ========== USER COGNITIVE DATA ==========

/**
 * Aggregated cognitive profile for a user across all conversations.
 * This is the core data structure that Lucid manages.
 */
export interface UserCognitiveData {
  // EMA-smoothed scores
  avg_autonomy: number;
  avg_learning: number;
  avg_engagement: number;
  avg_metacognition: number;
  avg_verification: number;

  // Motivation tracking
  /** Count of each motivation type observed */
  motivation_counts: {
    intrinsic: number;
    instrumental: number;
    avoidance: number;
  };

  // Cumulative counters (never reset)
  total_messages: number;
  total_topics_analyzed: number;
  total_delegation: number;
  total_delegation_routine: number;
  total_delegation_cognitive: number;
  total_learning_moments: number;
  total_application_moments: number;
  total_fatigue_events: number;
  total_break_suggestions: number;
  total_breaks_taken: number;

  // Current session
  session: SessionData;

  // Derived metrics
  /** Cognitive score 0-10000 */
  score: number;
  /** Cognitive level 0-10 */
  level: number;
  /** Direction of cognitive engagement */
  trend: 'improving' | 'stable' | 'declining';

  // History
  weekly_history: WeeklySnapshot[];

  last_updated: string;
  version: number;
}

/** Weekly cognitive snapshot for trend and drift analysis */
export interface WeeklySnapshot {
  week: string; // "2024-W05"
  autonomy: number;
  learning: number;
  engagement: number;
  metacognition: number;
  verification: number;
  messages: number;
  fatigue_events: number;
}

// ========== MODERATION DATA ==========

export interface TopicModerationData {
  flags: Array<ModerationFlag & {
    chat_id: string;
    chat_index: number;
  }>;
  max_severity: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  total_flags: number;
  status: 'PENDING' | 'REVIEWED' | 'DISMISSED' | 'ACTIONED';
  last_chat_id: string;
  analyzed_at: string;
}

export interface UserModerationData {
  total_flags: number;
  flags_by_severity: {
    NONE: number;
    LOW: number;
    MEDIUM: number;
    HIGH: number;
    CRITICAL: number;
  };
  flags_by_category: Record<string, number>;
  topics_with_flags: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  last_updated: string;
}

// ========== TRACK RECORD ==========

/**
 * Individual track record — a single analyzed message exchange.
 * Stored individually to allow granular deletion and recalculation.
 */
export interface TrackRecord {
  id: string;
  userId: string;
  topicId?: string;
  autonomy_score: number;
  learning_score: number;
  engagement_score: number;
  metacognition_score: number;
  verification_score: number;
  motivation_type: MotivationType;
  delegation_count: number;
  delegation_type: 'none' | 'routine' | 'cognitive';
  learning_moments: number;
  application_moments: number;
  userMessageLength: number;
  summary: string;
  created_at: string;
}

// ========== PUBLIC API TYPES ==========

/**
 * The public cognitive profile returned by lucid.getProfile()
 */
/** Type of delegation: routine (mechanical) vs cognitive (thinking) */
export type DelegationType = 'none' | 'routine' | 'cognitive';

/**
 * Why the user is engaging with AI (Self-Determination Theory, AIMS Scale 2025).
 * - intrinsic: Genuine curiosity, exploration, learning for its own sake
 * - instrumental: Pragmatic efficiency — using AI as a tool to get work done
 * - avoidance: Avoiding cognitive effort, using AI to escape thinking
 */
export type MotivationType = 'intrinsic' | 'instrumental' | 'avoidance';

/**
 * Trust calibration level — derived from verification patterns.
 * Based on metacognitive sensitivity research (PNAS Nexus, 2025).
 * - calibrated: User appropriately questions some outputs, accepts others
 * - over_trust: User accepts everything without verification (dangerous)
 * - under_trust: User questions everything, even obvious answers (inefficient)
 */
export type TrustCalibration = 'calibrated' | 'over_trust' | 'under_trust';

/** Scaffolding level determines how much AI support is provided */
export type ScaffoldingLevel = 'full' | 'guided' | 'hints' | 'challenge';

/**
 * Effectiveness metrics — measures if Lucid's guidelines are working.
 * Compares early vs recent cognitive scores over time.
 */
export interface EffectivenessReport {
  /** Change in autonomy score (positive = improving) */
  autonomyDelta: number;
  /** Change in learning score */
  learningDelta: number;
  /** Change in engagement score */
  engagementDelta: number;
  /** Change in metacognition score */
  metacognitionDelta: number;
  /** Change in verification score */
  verificationDelta: number;
  /** Number of weeks tracked */
  weeksTracked: number;
  /** Whether there's enough data for a meaningful report (>= 4 weeks) */
  sufficient: boolean;
}

export interface CognitiveProfile {
  userId: string;
  score: number;
  /** Cognitive level 0-10 */
  level: number;
  /** Progress to next level (0-1) */
  levelProgress: number;
  trend: 'improving' | 'stable' | 'declining';
  autonomy: number;
  learning: number;
  engagement: number;
  metacognition: number;
  verification: number;
  /** Dominant motivation pattern */
  dominantMotivation: MotivationType;
  /** Trust calibration derived from verification patterns */
  trustCalibration: TrustCalibration;
  totalMessages: number;
  isFatigued: boolean;
  fatigueReason?: string;
  /** Cognitive drift index (0-1). 0 = stable, >0.3 = drifting, >0.6 = severe */
  driftIndex: number;
  /** Current scaffolding level based on cognitive profile */
  scaffoldingLevel: ScaffoldingLevel;
  weeklyHistory: WeeklySnapshot[];
  /** Full cognitive data — pass this to getGuidelines() to avoid a second store query */
  cognitiveData: UserCognitiveData;
}

/**
 * Input for tracking a message exchange.
 */
export interface TrackInput {
  userMessage: string;
  aiResponse: string;
  topicId?: string;
  /**
   * Optional topic context — accumulated summary of the conversation so far.
   * When provided, the LLM analyzer uses this to calibrate scores more accurately.
   * Without context, each message is analyzed in isolation.
   */
  topicContext?: string;
}

/**
 * Configuration for the Lucid SDK.
 */
export interface LucidConfig {
  /** Storage adapter for persisting cognitive data */
  store: LucidStore;
  /** LLM analyzer for scoring messages (optional — can track manually) */
  analyzer?: LucidAnalyzer;
  /** Enable debug logging (default: false) */
  debug?: boolean;
}

// ========== STORE INTERFACE ==========

/**
 * Storage adapter interface. Implement this to use any database.
 */
export interface LucidStore {
  /** Get user cognitive data */
  getUser(userId: string): Promise<UserCognitiveData | null>;
  /** Save user cognitive data */
  saveUser(userId: string, data: UserCognitiveData): Promise<void>;
  /** Get topic cognitive data */
  getTopic(topicId: string): Promise<TopicCognitiveData | null>;
  /** Save topic cognitive data */
  saveTopic(topicId: string, data: TopicCognitiveData): Promise<void>;
  /** Get topic moderation data */
  getTopicModeration(topicId: string): Promise<TopicModerationData | null>;
  /** Save topic moderation data */
  saveTopicModeration(topicId: string, data: TopicModerationData): Promise<void>;
  /** Get user moderation data */
  getUserModeration(userId: string): Promise<UserModerationData | null>;
  /** Save user moderation data */
  saveUserModeration(userId: string, data: UserModerationData): Promise<void>;
  /** Count topics with cognitive data for a user */
  countUserTopics(userId: string): Promise<number>;
  /** Delete all cognitive data for a user (GDPR) */
  deleteUser(userId: string): Promise<void>;
  /** Delete all cognitive data for a topic */
  deleteTopic(topicId: string): Promise<void>;

  // ========== TRACK RECORDS ==========
  /** Get a single track record by ID */
  getTrack(trackId: string): Promise<TrackRecord | null>;
  /** Save an individual track record */
  saveTrack(record: TrackRecord): Promise<void>;
  /** Get all track records for a user, ordered by creation time */
  getTracksByUser(userId: string): Promise<TrackRecord[]>;
  /** Get all track records for a topic, ordered by creation time */
  getTracksByTopic(topicId: string): Promise<TrackRecord[]>;
  /** Delete a single track record by ID */
  deleteTrack(trackId: string): Promise<void>;
  /** Delete all track records for a topic */
  deleteTracksByTopic(topicId: string): Promise<void>;
}

// ========== ANALYZER INTERFACE ==========

/**
 * LLM analyzer interface. Implement this to use any LLM provider.
 */
export interface LucidAnalyzer {
  /** Analyze a user-AI message exchange and return cognitive scores */
  analyze(userMessage: string, aiResponse: string, context?: string): Promise<AnalysisResult | null>;
}
