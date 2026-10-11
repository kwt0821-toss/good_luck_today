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
  sheets: {
    attendance: {
      title: string;
      eyebrow: string;
      desc: string;
      cta: string;
      ctaDone: string;
      note: string;
      thumbs: string;
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
    rewards: { title: string; eyebrow: string; desc: string; cta: string };
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

export type MenuSheetId = "attendance" | "rates" | "exchange" | "rewards" | "notice" | "settings" | null;

export type RewardInboxItem = {
  id: string;
  label: string;
  paw: number;
  toss: number;
  collected: boolean;
};
