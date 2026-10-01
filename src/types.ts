export type CategoryId = "love" | "money" | "work" | "health";

export type ScreenName =
  | "home"
  | "reading"
  | "result"
  | "category"
  | "history"
  | "settings";

export type Screen =
  | { name: "home" }
  | { name: "reading" }
  | { name: "result" }
  | { name: "category"; category: CategoryId }
  | { name: "history" }
  | { name: "settings" };

export type CategoryFortune = {
  id: CategoryId;
  label: string;
  emoji: string;
  score: number;
  title: string;
  summary: string;
  advice: string;
};

export type DailyFortune = {
  dateKey: string;
  score: number;
  grade: "최고" | "좋음" | "무난" | "차분";
  headline: string;
  summary: string;
  luckyColor: string;
  luckyNumber: number;
  luckyTime: string;
  luckyFood: string;
  luckyItem: string;
  categories: CategoryFortune[];
};

export type AppSettings = {
  nickname: string;
};
