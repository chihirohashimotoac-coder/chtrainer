export type UUID = string;
export type ISODateTime = string;

export type BoardType = "steel" | "soft";

export type Ring =
  | "inner_single"
  | "outer_single"
  | "double"
  | "triple"
  | "outer_bull"
  | "inner_bull"
  | "outboard"
  | "bounce_out"
  | "unknown";

export type PositionPrecision =
  | "coordinate"
  | "segment_approximation"
  | "direction_only"
  | "unknown";

export type DailyCondition = "better_than_usual" | "usual" | "worse_than_usual";

export type MissDirection =
  | "center"
  | "up"
  | "up_right"
  | "right"
  | "down_right"
  | "down"
  | "down_left"
  | "left"
  | "up_left";

export type OutboardDirection =
  | "up"
  | "up_right"
  | "right"
  | "down_right"
  | "down"
  | "down_left"
  | "left"
  | "up_left"
  | "unknown";

export type InputMethod = "simple" | "coordinate";

export type TrainingMode =
  | "zero_one"
  | "cricket"
  | "bull"
  | "random"
  | "skill_check"
  // 以下は旧バージョンで記録されたセッションとの互換用
  | "same_target"
  | "per_dart_targets"
  | "sequence"
  | "double"
  | "triple"
  | "number";

export type RandomVariant = "balanced" | "pure";

/** 永続データ共通のスキーマバージョン */
export const SCHEMA_VERSION = 1;

export interface EquipmentProfile {
  schemaVersion: number;
  id: UUID;
  name: string;
  barrel?: {
    maker?: string;
    model?: string;
    weightG?: number;
    lengthMm?: number;
    maxDiameterMm?: number;
  };
  shaft?: {
    maker?: string;
    model?: string;
    lengthMm?: number;
  };
  flight?: {
    maker?: string;
    model?: string;
    shape?: string;
    colors?: string[];
  };
  point?: {
    maker?: string;
    model?: string;
    lengthMm?: number;
  };
  notes?: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type DominantEye = "right" | "left" | "unknown";

export type PlayerGoal =
  | "recovery"
  | "zero_one"
  | "cricket"
  | "pro"
  | "form_check"
  | "bull";
export type Stance = "closed" | "middle" | "open";

export interface PlayerProfile {
  schemaVersion: number;
  id: UUID;
  displayName: string;
  dominantHand: "right" | "left" | "ambidextrous";
  /** 利き目(任意・後から追加されたフィールド) */
  dominantEye?: DominantEye;
  /** スタンス(任意・後から追加されたフィールド) */
  stance?: Stance;
  /** 練習の目的(任意) */
  goal?: PlayerGoal;
  /** 現在のレベル(自由記述・自己申告) */
  currentLevel?: string;
  /** 目標レベル(自由記述) */
  targetLevel?: string;
  /** 直近の悩み・重点課題(自由記述) */
  concern?: string;
  defaultBoardType: BoardType;
  defaultEquipmentProfileId?: UUID;
  /** 1投目・2投目・3投目の識別用フライト色 */
  dartColors: [string, string, string];
  defaultInputMethod: InputMethod;
  vibrationEnabled: boolean;
  soundEnabled: boolean;
  autoAdvanceEnabled: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type TargetType =
  | "exact_segment"
  | "number_sector"
  | "bull_any"
  | "custom_selection";

export interface TargetArea {
  number?: number;
  ring: Ring;
}

export interface TargetDefinition {
  id: UUID;
  label: string;
  type: TargetType;
  number?: number;
  ring?: Ring;
  /** 投擲画面に表示する、狙い方と測定内容の説明(スキル診断等で使用) */
  instruction?: string;
  /** custom_selection 用: 命中と見なす複数エリア */
  areas?: TargetArea[];
  /** 誤差計算用の代表点(正規化座標) */
  representativePoint: {
    x: number;
    y: number;
  };
}

export interface SelfAssessment {
  timing: "before" | "middle" | "after";
  recordedAt: ISODateTime;
  /** 0-10 */
  fatigue: number;
  concentration: number;
  pain: number;
  confidence: number;
  conditionChange?: "better" | "same" | "worse";
  /** メンタル評価(任意): 投げる前の不安 0-10 */
  anxiety?: number;
  /** メンタル評価(任意): リリースの怖さ・違和感 0-10 */
  releaseFear?: number;
  /** メンタル評価(任意): ルーティンを守れた度 0-10 */
  routineAdherence?: number;
  note?: string;
}

export interface SessionEnvironment {
  location?: string;
  boardName?: string;
  lighting?: string;
  temperatureC?: number;
  ocheNote?: string;
  formChangeNote?: string;
  gripChangeNote?: string;
  stanceChangeNote?: string;
  otherNote?: string;
}

export interface TrainingPlan {
  schemaVersion: number;
  id: UUID;
  name: string;
  trainingMode: TrainingMode;
  randomVariant?: RandomVariant;
  /** セットごとに3つのターゲット、または全セット共通ターゲットの素 */
  targets: TargetDefinition[];
  setCount: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface TrainingSession {
  schemaVersion: number;
  id: UUID;
  playerId: UUID;
  boardType: BoardType;
  boardProfileId: string;
  equipmentProfileId?: UUID;
  trainingMode: TrainingMode;
  randomVariant?: RandomVariant;
  /** 出題方式 (balanced/pure/same_per_set/fixed_three/cycle) */
  arrangement?: string;
  inputMethod: InputMethod;
  dominantHand: "right" | "left" | "ambidextrous";
  setCount: number;
  plannedThrowCount: number;
  /** セットごとの出題ターゲット3件 x setCount (開始時に確定) */
  plannedTargets: TargetDefinition[][];
  startedAt: ISODateTime;
  endedAt?: ISODateTime;
  dailyCondition: DailyCondition;
  dailyConditionNote?: string;
  environment?: SessionEnvironment;
  assessments: SelfAssessment[];
  sessionNote?: string;
  status: "active" | "completed" | "aborted";
  /** 進行状態の復元用 */
  progress: {
    currentSetNumber: number;
    middleAssessmentDone: boolean;
  };
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface ThrowSet {
  schemaVersion: number;
  id: UUID;
  sessionId: UUID;
  setNumber: number;
  startedAt?: ISODateTime;
  completedAt?: ISODateTime;
}

export interface LandingRecord {
  number?: number;
  ring: Ring;
  score?: number;
  x?: number;
  y?: number;
  radius?: number;
  angleDeg?: number;
  outboardDirection?: OutboardDirection;
  positionPrecision: PositionPrecision;
}

export interface DerivedRecord {
  exactHit: boolean;
  errorX?: number;
  errorY?: number;
  errorDistance?: number;
  errorAngleDeg?: number;
  missDirection?: MissDirection;
  targetChangedFromPrevious: boolean;
  previousThrowWasHit?: boolean;
  /** 0-1 */
  sessionProgress: number;
}

export interface ThrowRecord {
  schemaVersion: number;
  id: UUID;
  sessionId: UUID;
  setId: UUID;
  globalThrowNumber: number;
  dartInSet: 1 | 2 | 3;
  dartColor?: string;
  target: TargetDefinition;
  thrownAt: ISODateTime;
  /** セッション開始からの経過ミリ秒 */
  elapsedMs: number;
  landing: LandingRecord;
  derived: DerivedRecord;
  note?: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface DartOrderStats {
  throwCount: number;
  hitCount: number;
  hitRate: number;
  averageErrorDistance?: number;
  outboardCount: number;
  outboardRate: number;
}

export interface TargetStats {
  label: string;
  throwCount: number;
  hitCount: number;
  hitRate: number;
  averageErrorDistance?: number;
  mainMissDirection?: MissDirection;
  outboardCount: number;
}

export interface HalfStats {
  throwCount: number;
  hitCount: number;
  hitRate: number;
  averageErrorDistance?: number;
  outboardCount: number;
  outboardRate: number;
}

export interface ErrorStats {
  sampleCount: number;
  averageErrorDistance?: number;
  medianErrorDistance?: number;
  averageErrorX?: number;
  averageErrorY?: number;
  byDirection: Record<MissDirection, number>;
}

/** クリケット専用統計 (マーク換算: T=3, D=2, S=1, IB=2, OB=1) */
export interface CricketStats {
  totalMarks: number;
  /** 3投あたり平均マーク (MPR相当) */
  marksPerThreeDarts: number;
  /** 1マーク以上を得た投擲の割合 (有効マーク率) */
  effectiveMarkRate: number;
  /** マーク0の投擲の割合 */
  noMarkRate: number;
  byTarget: Record<
    string,
    {
      throwCount: number;
      totalMarks: number;
      marksPerThreeDarts: number;
      noMarkRate: number;
    }
  >;
}

/** 01練習専用統計 */
export interface ZeroOneStats {
  bullThrowCount: number;
  bullHitRate?: number;
  tripleThrowCount: number;
  tripleHitRate?: number;
  doubleThrowCount: number;
  doubleHitRate?: number;
  /** 3投すべて命中したセットの割合 (フィニッシュ成立率) */
  allHitSetRate?: number;
}

export interface SessionStatistics {
  schemaVersion: number;
  sessionId: UUID;
  totalThrows: number;
  completedThrows: number;
  exactHits: number;
  exactHitRate: number;
  outboardCount: number;
  outboardRate: number;
  bounceOutCount: number;
  coordinateInputCount: number;
  approximateInputCount: number;
  /** 座標入力のみの誤差統計 */
  coordinateError: ErrorStats;
  /** 簡易入力の概算を含む誤差統計 */
  combinedError: ErrorStats;
  byDartInSet: Record<"1" | "2" | "3", DartOrderStats>;
  byTarget: Record<string, TargetStats>;
  byDirection: Record<MissDirection, number>;
  firstHalf: HalfStats;
  secondHalf: HalfStats;
  /** クリケット練習セッションのみ */
  cricket?: CricketStats;
  /** 01練習セッションのみ */
  zeroOne?: ZeroOneStats;
  calculatedAt: ISODateTime;
}

export interface AppSettings {
  schemaVersion: number;
  id: "app";
  onboardingCompleted: boolean;
  activePlayerId?: UUID;
  updatedAt: ISODateTime;
}

export interface BackupFile {
  format: "darts-training-analyzer-backup";
  backupVersion: number;
  createdAt: ISODateTime;
  appVersion: string;
  counts: Record<string, number>;
  data: {
    settings: AppSettings[];
    players: PlayerProfile[];
    equipmentProfiles: EquipmentProfile[];
    trainingPlans: TrainingPlan[];
    sessions: TrainingSession[];
    throwSets: ThrowSet[];
    throws: ThrowRecord[];
    sessionStatistics: SessionStatistics[];
  };
}
