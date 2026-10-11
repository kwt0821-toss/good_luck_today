import type { DexCard, DexCardType } from "./dexTypes";

export type OpsEconomy = {
  currency: {
    paw: { nameKo: string; startBalance: number };
    toss: { nameKo: string; unit: string };
  };
  pawSources: {
    rewardedAd: {
      pawPerAd: number;
      maxPerDay: number;
      maxPawPerDay: number;
      adType: string;
      grantOn: string;
    };
    newCardFirstGet: { paw: number; toss: number };
    duplicateConvert: {
      common_1to2star: number;
      rare_3to5star: number;
      special: number;
      character: number;
      legend: number;
      auto: boolean;
    };
    setComplete: {
      breed_1to5star: { paw: number; toss: number; count: number };
      special: { paw: number; toss: number };
      character: { paw: number; toss: number };
      legend: { paw: number; toss: number };
      fullDex: { paw: number; toss: number };
    };
    attendance?: string;
  };
  tickets?: {
    rateUpTicket: {
      nameKo: string;
      grantsRateUpWithoutAd: boolean;
      separateDailyCap: boolean;
      maxHold: number;
      note?: string;
    };
  };
  shop?: {
    excludeSources: string[];
    note?: string;
  };
  tossPayout: {
    maxPerUserKRW: number;
    oncePerTossAccount: boolean;
    serverVerified: boolean;
    idempotencyKey: string;
  };
  draws: {
    resetTimeKST: string;
    normalPerDay: number;
    rateUpPerDay: number;
    tutorialFirstDrawFree: boolean;
    rates_proposal: {
      normal: Record<string, number>;
      rateUp: Record<string, number>;
      keys: string;
      disclosure: string;
    };
  };
  ads: {
    short: { use: string[] };
    long: { use: string[] };
    dailyCaps: { drawAds: number; rateUpAds: number; pawAds: number };
  };
  cozy: {
    pointsPerTier: Record<string, number>;
    levels: { lv: number; minCozy: number }[];
    beyondLv10: string;
  };
  rooms: Array<{
    id: string;
    nameKo?: string;
    unlock: { type?: string; paw?: number; cozyLevel?: number };
    grantItems?: string[];
    grantDefaultTiles?: boolean;
  }>;
  events: {
    weekendDoublePaw: {
      enabled: boolean;
      days: string[];
      multiplier: number;
      appliesTo: string[];
    };
    friendInvite?: {
      enabled: boolean;
      inviterPaw?: number;
      inviteePaw?: number;
      maxPerMonth?: number;
      grantOn?: string;
    };
  };
};

export type PriceTier = "small" | "normal" | "large" | "wall" | "tile" | "legend";

export type PriceItem = {
  id: string;
  nameKo: string;
  tier: PriceTier;
  price: number;
  cozy: number;
  flags?: string[];
  source?: string;
  room?: string;
  category?: string;
  placement?: string;
};

export type OpsPrices = {
  tiers: Record<PriceTier, { nameKo: string; cozy: number; range: (number | null)[] }>;
  items: PriceItem[];
  limitedItems: string[];
  attendanceOnly?: { ids: string[]; note?: string };
};

export type AttendanceConfig = {
  noReset: boolean;
  rule?: string;
  firstWeek: Array<{ day: number; itemId: string; tier: string }>;
  weeklyCycle: {
    days: Array<{ day: number; paw: number }>;
    day7: {
      mode: "alternate" | string;
      itemBox: { pool: string[]; fallbackWhenAllOwned: { paw: number } };
      rateUpTicket: boolean;
      note?: string;
    };
  };
  milestones: Array<{ days: number; itemId: string; badgeId: string; labelKo?: string }>;
};

export type OpsStarter = {
  startPaw: number;
  firstRoom: {
    roomId: string;
    floor: string;
    wall: { L: string; R: string };
    placed: Array<Record<string, unknown>>;
  };
  drawer: string[];
  /** @deprecated use attendance */
  attendance7?: Array<{ day: number; itemId: string; tier: string }>;
  attendance?: AttendanceConfig;
};

export type TutorialStep = {
  step: number;
  screen: string;
  target: string;
  copy: string;
  sub?: string;
  toast?: { id: string; text: string };
  action?: string;
  gesture?: string;
  then?: { screen?: string; target: string; copy: string };
  complete?: string;
};

export type FeatureIntro = {
  day: number;
  id: string;
  target: string;
  copy: string;
  condition?: string;
};

export type OpsTutorial = {
  maxDurationSec: number;
  skip: {
    button: { id: string; label: string; position: string };
    onSkip: string;
    resume: string;
  };
  steps: TutorialStep[];
  featureIntros: {
    ui: string;
    schedule: FeatureIntro[];
    rule: string;
  };
};

export type OpsConfig = {
  economy: OpsEconomy;
  prices: OpsPrices;
  starter: OpsStarter;
  tutorial: OpsTutorial;
};

export type DrawSlotKind = "tutorial" | "normal" | "rateUp";

export type DrawRarityKey =
  | "b1"
  | "b2"
  | "b3"
  | "b4"
  | "b5"
  | "special"
  | "character"
  | "legend";

export type DrawReservation = {
  drawId: string;
  cardId: string;
  slot: DrawSlotKind;
  rateUp: boolean;
  rarity: DrawRarityKey;
  isNew: boolean;
  dupPaw: number;
  frontUrl: string;
  backUrl: string;
  thumbUrl: string;
  nameKo: string;
  starsLabel: string;
  remainingAfter: number;
  createdAt: number;
  confirmed: boolean;
};

export type OpsState = {
  userId: string;
  pawBalance: number;
  tossBalance: number;
  /** KST date of last daily counter reset */
  dateKey: string;
  normalDrawsUsed: number;
  rateUpUsed: number;
  pawAdsUsed: number;
  /** Lifetime: tutorial first free draw already consumed */
  tutorialFirstDrawUsed: boolean;
  tutorialDone: boolean;
  tutorialStep: number;
  tutorialInterruptions: number;
  installDateKey: string;
  /** Cumulative attendance days (never resets) */
  attendanceDays: number;
  lastAttendDateKST: string;
  /** @deprecated migrated from attendanceDays */
  attendanceClaimed: number;
  /** @deprecated use lastAttendDateKST */
  lastAttendanceDateKey: string;
  rateUpTickets: number;
  attendanceBadges: string[];
  claimedMilestoneDays: number[];
  featureIntrosSeen: string[];
  /** tossUserKey+rewardId style ids already granted */
  grantedTossRewardIds: string[];
  grantedSetRewardIds: string[];
  ownedItemIds: string[];
  unlockedRoomIds: string[];
  pendingDraw: DrawReservation | null;
  /** Rewards granted to balance but not yet collected from the inbox UI */
  rewardInbox: Array<{ id: string; label: string; paw: number; toss: number; collected: boolean }>;
  lastSeenNoticeId: string;
};

export type ConfirmDrawResult = {
  state: OpsState;
  reservation: DrawReservation;
  card: DexCard;
  toast: string | null;
  setRewards: Array<{ id: string; paw: number; toss: number; label: string }>;
};

export type DupConvertKey = DexCardType | "common" | "rare";
