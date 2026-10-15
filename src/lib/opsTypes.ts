import type { DexCard, DexCardType } from "./dexTypes";

export type NyangCoinReward = { paw: number; nyangCoin: number };

export type OpsEconomy = {
  currency: {
    paw: { nameKo: string; startBalance: number };
    nyangCoin: { nameKo: string; unit: string; note?: string };
  };
  pawSources: {
    rewardedAd: {
      pawPerAd: number;
      maxPerDay: number;
      maxPawPerDay: number;
      adType: string;
      grantOn: string;
    };
    newCardFirstGet: NyangCoinReward;
    duplicateConvert: {
      common_1to2star: number;
      rare_3to5star: number;
      special: number;
      character: number;
      legend: number;
      auto: boolean;
    };
    setComplete: {
      breed_1to5star: NyangCoinReward & { count: number };
      special: NyangCoinReward;
      character: NyangCoinReward;
      legend: NyangCoinReward;
      fullDex: NyangCoinReward;
    };
    attendance?: string;
  };
  /** Manual claim from dex (claimMode: manual). Amounts still come from pawSources. */
  dexRewards?: {
    claimMode: "manual" | "auto";
    note?: string;
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
    tickets?: {
      rateUpTicket: {
        ticketType: "rateUp";
        pricePaw: number;
        dayLimit: number;
        weekLimit: number;
        weekReset?: string;
        note?: string;
      };
    };
  };
  /** Was tossPayout — withdraw / payout rules for 냥코인 → 토스포인트 */
  nyangCoin: {
    nameKo?: string;
    maxPerUserKRW: number;
    oncePerTossAccount: boolean;
    serverVerified: boolean;
    idempotencyKey: string;
    toTossPointRate?: number;
    /** @deprecated use withdraw.min / withdraw.unit */
    withdrawMin?: number;
    /** @deprecated use withdraw.unit */
    withdrawStep?: number;
    withdraw?: {
      min: number;
      unit: number;
      dailyLimit: number;
      resetTimeKST?: string;
      note?: string;
    };
  };
  draws: {
    resetTimeKST: string;
    /** Per-slot draw schedule; slot "up" may include adSeconds for long ads. */
    daily?: Array<{
      slot: number | "up" | string;
      type: string;
      ad?: string;
      adSeconds?: number;
      perDay?: number;
      note?: string;
    }>;
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
    short: {
      use: string[];
      rewardOn?: string;
      /** 앱인토스 콘솔 광고 그룹 ID (짧은 광고). */
      adGroupId?: string;
      note?: string;
    };
    long: {
      use: string[];
      /** 앱인토스 콘솔 광고 그룹 ID (30초 리워드). */
      adGroupId?: string;
      adSeconds?: number;
      note?: string;
    };
    dailyCaps: { drawAds: number; rateUpAds: number; pawAds: number };
    ecpmKRW?: { short: number | null; long: number | null; source?: string };
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

export type TutorialLine = {
  icon?: string;
  text: string;
  muted?: boolean;
  dividerAbove?: boolean;
  when?: string;
  copy?: string;
};

export type NcoinIntroThen = {
  id: "ncoin-intro";
  delayAfterToastMs?: number;
  title: string;
  lines: TutorialLine[];
  cta?: string;
  dismissToastWithCta?: boolean;
  next?: { target: string; copy: string };
};

export type TutorialStepThen =
  | NcoinIntroThen
  | { screen?: string; target: string; fallbackTarget?: string; copy: string; id?: string };

/** Shared tutorial substep fields (dex step 3, room step 4). */
export type TutorialSubstep = {
  id: string;
  target: string;
  fallbackTarget?: string;
  copy?: string;
  /** Smaller supporting line under copy (e.g. ※ 하루 최대 50원). */
  sub?: string;
  title?: string;
  cta?: string;
  ackOnly?: boolean;
  showFinger?: boolean;
  claimGate?: boolean;
  scrollIntoView?: {
    block?: ScrollLogicalPosition;
    behavior?: ScrollBehavior;
    ms?: number;
  };
  pulseMs?: number;
  toast?: {
    id?: string;
    text: string;
    autoHideMs?: number;
  };
  /** Optional conditional lines (e.g. step 5-3 low balance hint). */
  lines?: TutorialLine[];
  /** Prefer bubble above/below the hole. */
  bubble?: "above" | "below";
  /** Room 4-1: long-press duration to pick from drawer. */
  longPressMs?: number;
  /** Room: only the highlighted drawer item may move. */
  lockItem?: boolean;
  ghostFollow?: boolean;
  dragHint?: boolean;
  suggestTile?: { c: number; r: number };
  invalidToast?: string;
  placeFx?: {
    sfx?: string;
    bounceMs?: number;
    sparkles?: boolean;
  };
  /** @deprecated prefer dedicated 3-3 substep */
  afterClaim?: {
    id: string;
    title: string;
    cta?: string;
    copy?: string;
  };
};

/** @deprecated use TutorialSubstep */
export type DexTutorialSubstep = TutorialSubstep;

export type TutorialStep = {
  step: number;
  screen: string;
  /** UI badge e.g. "STEP 3/4" — substeps keep the same label. */
  stepLabel?: string;
  target: string;
  copy: string;
  sub?: string;
  toast?: {
    id: string;
    text: string;
    autoHideMs?: number;
    holdDuringTutorial?: boolean;
  };
  action?: string;
  gesture?: string;
  suggestTile?: { c: number; r: number };
  then?: TutorialStepThen;
  /** Step 3: 3-1…3-3; step 4: 4-1…4-4. */
  substeps?: TutorialSubstep[];
  complete?: string;
};

export type FeatureIntro = {
  day: number;
  id: string;
  target: string;
  copy: string;
  condition?: string;
};

export type TutFlagStatus = "unseen" | "seen" | "skipped";

export type RewardsIntroStep = {
  id: string;
  target: string;
  copy?: string;
  bubble?: "above" | "below";
  lines?: TutorialLine[];
  action?: string;
};

export type RewardsIntroConfig = {
  id: string;
  flag: string;
  once?: boolean;
  gate?: string;
  triggers: Array<{ when: string; from: string; note?: string }>;
  lockDismiss?: boolean;
  steps: RewardsIntroStep[];
};

/** Active coach mark rendered by TutorialCoach (main + contextual). */
export type CoachMark = {
  id: string;
  target: string;
  copy?: string;
  sub?: string;
  title?: string;
  lines?: TutorialLine[];
  cta?: string;
  bubble?: "above" | "below";
  showFinger?: boolean;
  /** When true, dim/hole taps do not advance — only CTA. */
  ackOnly?: boolean;
  /** Shown in the bubble (e.g. STEP 3/4). */
  stepLabel?: string;
  /** Hole click activates the target element (claim badge) instead of advancing. */
  activateTarget?: boolean;
  /** Hole lets pointers through to the real target (long-press / drag). */
  passThrough?: boolean;
  /** Hide the skip control (e.g. room step 4-3 completion). */
  hideSkip?: boolean;
  /** When false, no dim overlay (drag phase needs free interaction). */
  dim?: boolean;
  /** Extra selectors merged into the spotlight hole (kept bright with the target). */
  alsoHighlight?: string[];
};

export type OpsTutorial = {
  maxDurationSec: number;
  skip: {
    button: { id: string; label: string; position: string };
    onSkip: string;
    resume: string;
  };
  steps: TutorialStep[];
  contextual?: {
    "rewards-intro"?: RewardsIntroConfig;
  };
  replay?: {
    from?: string;
    includes?: string[];
    regrantRewards?: boolean;
  };
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

export type WalletWithdrawStatus = "pending" | "done" | "failed";

export type WalletHistoryItem = {
  requestId: string;
  amount: number;
  status: WalletWithdrawStatus;
  createdAt: number;
  updatedAt: number;
  failReason?: string;
};

export type OpsState = {
  userId: string;
  pawBalance: number;
  /** 냥코인 잔액 (1냥코인 = 토스포인트 1원) */
  nyangCoinBalance: number;
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
  /** Server flag tut.rewardsIntro — contextual rewards coach once */
  tut: {
    rewardsIntro: TutFlagStatus;
  };
  installDateKey: string;
  /** Cumulative attendance days (never resets) */
  attendanceDays: number;
  lastAttendDateKST: string;
  /** @deprecated migrated from attendanceDays */
  attendanceClaimed: number;
  /** @deprecated use lastAttendDateKST */
  lastAttendanceDateKey: string;
  rateUpTickets: number;
  /** KST Monday date key for shop.tickets week window */
  ticketShopWeekKey: string;
  ticketShopWeekBought: number;
  /** KST date key for shop.tickets day window */
  ticketShopDayKey: string;
  ticketShopDayBought: number;
  /** Idempotent purchase ledger (tossUserKey + requestId) */
  ticketShopLedger: TicketShopLedgerItem[];
  /** Idempotent ledger for POST /dex/duplicates/exchange (tossUserKey + requestId) */
  dupExchangeLedger: Array<{
    requestId: string;
    createdAt: number;
    mode: "all" | "card";
    cardId?: string;
    converted: number;
    gained: number;
    pawBalance: number;
  }>;
  attendanceBadges: string[];
  claimedMilestoneDays: number[];
  featureIntrosSeen: string[];
  /** tossUserKey+rewardId style ids already granted as 냥코인 */
  grantedNyangCoinRewardIds: string[];
  /** @deprecated set rewards now use claimedDexRewardIds via POST /dex/rewards/claim */
  grantedSetRewardIds: string[];
  /** Dex reward ids claimed once per account (newCard:*, set:breed:*, set:*, fullDex) */
  claimedDexRewardIds: string[];
  /** Idempotent ledger for POST /dex/rewards/claim (tossUserKey + requestId) */
  dexClaimLedger: Array<{
    requestId: string;
    rewardIds: string[];
    createdAt: number;
    paw: number;
    nyangCoin: number;
    pawBalance: number;
    nyangCoinBalance: number;
  }>;
  ownedItemIds: string[];
  unlockedRoomIds: string[];
  pendingDraw: DrawReservation | null;
  /** @deprecated inbox auto-grant removed; use claimedDexRewardIds */
  rewardInbox: Array<{
    id: string;
    label: string;
    paw: number;
    nyangCoin: number;
    collected: boolean;
  }>;
  walletHistory: WalletHistoryItem[];
  lastSeenNoticeId: string;
};

export type TicketShopLedgerItem = {
  requestId: string;
  ticketType: "rateUp";
  createdAt: number;
  paw: number;
  ticketsHeld: number;
  weekBought: number;
  dayBought: number;
};

export type ConfirmDrawResult = {
  state: OpsState;
  reservation: DrawReservation;
  card: DexCard;
  toast: string | null;
  setRewards: Array<{ id: string; paw: number; nyangCoin: number; label: string }>;
};

export type DupConvertKey = DexCardType | "common" | "rare";
