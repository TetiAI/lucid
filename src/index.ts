// ============================================================
// Lucid SDK — Public API
// Cognitive Health Protection for AI Agents
// ============================================================

// Main class
export { Lucid } from './lucid';

// Store adapters
export { MemoryStore } from './store/memory';
export { PrismaStore } from './store/prisma';
export { RedisStore } from './store/redis';

// Analyzers
export { LLMAnalyzer } from './analyzer/llm';
export { ANALYSIS_PROMPT, formatAnalysisInput } from './analyzer/prompt';

// Guidelines
export { buildCognitiveGuidelines } from './guidelines';

// Scoring utilities (for custom implementations)
export {
  getAdaptiveAlpha,
  calculateEMA,
  clamp,
  calculateQualityScore,
  calculateExperienceFactor,
  calculateScore,
  calculateLevel,
  getLevelProgress,
  calculateTrend,
  getWeekString,
  getScaffoldingLevel,
  getTrustCalibration,
  getDominantMotivation,
  detectContextChangeAlpha,
  // Constants
  EMA_ALPHA_BASE,
  EMA_ALPHA_MIN,
  EXPERIENCE_MESSAGES_MAX,
  MAX_SCORE,
  POINTS_PER_LEVEL,
  MAX_LEVEL,
  QUALITY_WEIGHTS,
} from './scoring';

// Session utilities
export {
  detectFatigue,
  updateSession,
  createEmptySession,
  SESSION_GAP_MINUTES,
  FATIGUE_SESSION_MINUTES,
  FATIGUE_SESSION_MINUTES_UNDER25,
  FATIGUE_MESSAGE_COUNT,
  FATIGUE_MESSAGE_COUNT_UNDER25,
} from './session';

// Drift detection
export {
  calculateDriftIndex,
  DRIFT_MIN_WEEKS,
  DRIFT_WARNING_THRESHOLD,
  DRIFT_SEVERE_THRESHOLD,
} from './drift';

// Types
export type {
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
  ModerationFlag,
  SessionData,
  WeeklySnapshot,
  TrackRecord,
  AgeGroup,
  DelegationType,
  MotivationType,
  TrustCalibration,
  ScaffoldingLevel,
  EffectivenessReport,
} from './types';

export { MIN_LEVEL, MAX_LEVEL as MAX_COGNITIVE_LEVEL } from './types';
