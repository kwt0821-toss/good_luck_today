export type MenuBadge =
  | { type: "none" }
  | { type: "dot" }
  | { type: "pill"; text: string; tone?: "hot" | "muted" }
  | { type: "pill-new"; text: string };

export type MenuRowDef = {
  label: string;
  icon: string;
  enabled: boolean;
  open?: string;
  meta?: string;
  data?: string;
  badge?: { type: string; text?: string; when?: string };
  hideWhen?: string;
  disabledWhen?: string;
  disabledMeta?: string;
  disabledPill?: string;
  enableWhen?: string;
  required?: boolean;
  items?: Array<{
    id: string;
    label: string;
    type: "toggle" | "action" | "link" | "text";
    default?: boolean | string;
    storage?: string;
    action?: string;
    url?: string;
    value?: string;
  }>;
};

export type MenuConfig = {
  _version: string;
  panel: {
    side: string;
    widthPt: number;
    openMs: number;
    closeMs: number;
    easingOpen: string;
    easingClose: string;
    dimOpacity: number;
    swipeToCloseThresholdPt: number;
  };
  header: {
    title: string;
    subtitle: string;
    stats: Array<{
      id: string;
      label: string;
      value: string;
      total?: string;
      format?: string;
      icon?: string;
      showProgressBar?: boolean;
      tapTo?: string;
      source?: string;
    }>;
  };
  sections: Array<{ id: string; label: string; rows: string[] }>;
  rows: Record<string, MenuRowDef>;
  menuIconBadge: { type: string; on: string; when: string };
  attendanceOnlyTag?: {
    label: string;
    style?: Record<string, string | number>;
  };
  sheets: {
    attendance: {
      title: string;
      eyebrow: string;
      desc?: string;
      cta?: string;
      ctaDone?: string;
      note?: string;
      thumbs?: string;
      states?: {
        firstWeek: {
          when?: string;
          mockup?: string;
          desc: string;
          cta: string;
          ctaDone: string;
          note: string;
          thumbs?: string;
          grid?: string;
        };
        weeklyCycle: {
          when?: string;
          mockup?: string;
          desc: string;
          cta: string;
          ctaDone: string;
          note: string;
          summaryCard?: {
            title: string;
            value: string;
            milestone: string;
            badge: string;
          };
          weekGrid?: string;
        };
      };
    };
    rates: {
      title: string;
      eyebrow: string;
      desc: string;
      tabs: string[];
      rows: Array<[string, string, number]>;
      highlight: string[];
      perCardDecimals: number;
      note: string;
    };
    exchange: { title: string; eyebrow: string; desc: string; cta: string };
    ticketShop: {
      title: string;
      eyebrow: string;
      desc: string;
      mockup?: string;
      cardTitle: string;
      cardDesc: string;
      priceLabel: string;
      limits: Array<{ id: string; label: string; format: string }>;
      balanceLabel: string;
      ctaBuy: string;
      ctaDraw: string;
      toastBought: string;
      disabled: { paw: string; day: string; week: string; hold: string };
      note?: string;
    };
    rewards: {
      title: string;
      eyebrow: string;
      desc: string;
      cta: string;
      dexShortcut?: {
        label: string;
        cta: string;
        when?: string;
      };
      wallet?: RewardsWalletSheet;
    };
  };
};

export type MenuRowView = {
  id: string;
  label: string;
  icon: string;
  enabled: boolean;
  hidden: boolean;
  meta: string;
  badge: MenuBadge;
  open: string;
  chevron: boolean;
};

export type MenuSheetId =
  | "attendance"
  | "rates"
  | "exchange"
  | "ticketShop"
  | "rewards"
  | "notice"
  | "settings"
  | null;

export type RewardInboxItem = {
  id: string;
  label: string;
  paw: number;
  nyangCoin: number;
  collected: boolean;
};

export type RewardsWalletSheet = {
  title: string;
  withdrawCta: string;
  disabledHint: string;
  dailyLimitHint?: string;
  dailyDoneHint?: string;
  lowBalanceHint?: string;
  remainAfterHint?: string;
  confirmTitle: string;
  confirmDesc: string;
  successTitle: string;
  successDesc: string;
  historyTitle: string;
  status: { done: string; pending: string; failed: string };
  /** @deprecated chips replaced by stepper */
  chipStep: number;
  stepper?: {
    step: number;
    minHit: number;
    longPressMs: number;
    repeatMs: number;
  };
};
