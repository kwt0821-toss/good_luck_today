import { formatShortDate } from "./date";
import type { CategoryFortune, CategoryId, DailyFortune } from "../types";

const OVERALL_LINES = [
  {
    headline: "오늘은 작은 시도가 잘 통하는 날이에요",
    summary: "미뤄 둔 일을 오전에 조금만 건드려도, 오후에는 생각보다 빨리 풀려요. 거창한 계획보다 한 걸음이 행운을 불러와요.",
  },
  {
    headline: "좋은 사람이 가까이에 있어요",
    summary: "혼자 고민하기보다 한 번만 물어보면 답이 분명해져요. 가벼운 안부 메시지가 예상보다 큰 힘이 될 수 있어요.",
  },
  {
    headline: "흐름을 타면 일이 수월해져요",
    summary: "막히는 구간은 잠시 내려놓고, 잘 되는 쪽을 먼저 밀어보세요. 속도보다 방향이 맞는 하루예요.",
  },
  {
    headline: "나를 아껴 주는 선택이 행운이에요",
    summary: "무리한 약속은 줄이고, 컨디션을 먼저 챙기면 나머지 운도 따라와요. 쉬는 것도 오늘의 전략이에요.",
  },
  {
    headline: "뜻밖의 기회가 스쳐 지나가요",
    summary: "평소라면 넘겼을 제안도 오늘은 한 번 더 들여다보세요. 작은 호기심이  ind 좋은 결과로 이어질 수 있어요.",
  },
  {
    headline: "정리가 행운을 부르는 날이에요",
    summary: "머릿속과 책상만 비워도 선택이 쉬워져요. 끝내지 못한 일 하나를 마무리하면 기분이 확 달라져요.",
  },
];

const CATEGORY_COPY: Record<
  CategoryId,
  { titles: string[]; summaries: string[]; advices: string[] }
> = {
  love: {
    titles: [
      "따뜻한 말이 잘 전해져요",
      "먼저 다가가면 분위기가 바뀌어요",
      "솔직함이 매력으로 보여요",
      "여유 있는 태도가 돋보여요",
    ],
    summaries: [
      "가벼운 칭찬이나 안부가 상대에게 오래 남아요.",
      "오해가 있었다면 오늘은 풀기 좋아요.",
      "감정을 돌려 말하지 않아도 충분히 전해져요.",
      "너무 급하게 답을 재촉하지 않는 게 좋아요.",
    ],
    advices: [
      "짧게라도 ‘오늘 어땠어요?’라고 물어보세요. 대화가 자연스럽게 이어질 가능성이 커요.",
      "마음에 있는 말을 돌려 말하지 말고, 한 문장으로 전해 보세요.",
      "약속은 거창하게 잡지 말고 산책이나 커피처럼 부담 없는 시간이 좋아요.",
      "상대의 속도를 존중하면 관계가 한결 편해져요.",
    ],
  },
  money: {
    titles: [
      "새는 돈을 막기 좋은 날이에요",
      "작은 수입의 힌트가 보여요",
      "충동구매만 피해도 이득이에요",
      "계산이 밝아지는 하루예요",
    ],
    summaries: [
      "구독이나 고정비를 한 번만 점검해도 기분이 가벼워져요.",
      "평소 관심 있던 부업·혜택을 찾아보면 길이 보여요.",
      "큰 지출은 하루만 미뤄도 후회가 줄어요.",
      "가계부를 열어보면 의외의 여유가 보여요.",
    ],
    advices: [
      "오늘 꼭 필요하지 않은 결제는 장바구니에만 담아 두세요.",
      "받지 않고 있던 혜택이나 포인트를 한 번 확인해 보세요.",
      "큰돈 결정은 저녁 이후에 하지 않는 게 좋아요.",
      "고정 지출 하나를 줄이면 이번 달 운이 실제로 좋아져요.",
    ],
  },
  work: {
    titles: [
      "집중력이 오전에 몰려 있어요",
      "협업이 예상보다 잘 풀려요",
      "성과는 작게 나눠 보여주는 게 좋아요",
      "막힌 일은 관점을 바꾸면 열려요",
    ],
    summaries: [
      "중요한 일은 점심 전에 처리하면 완성도가 올라가요.",
      "도움을 구하는 메시지가 분위기 좋게 받아들여져요.",
      "완벽한 보고보다 중간 공유가 신뢰를 만들어요.",
      "같은 문제를 다른 순서로 접근해 보세요.",
    ],
    advices: [
      "가장 어려운 일 하나를 오전에 30분만 손대 보세요.",
      "막히면 혼자 붙잡지 말고 한 명에게만 짧게 물어보세요.",
      "오늘 끝낼 일을 세 가지로 줄이면 성취감이 커요.",
      "회의 전에는 한 줄 요약만 준비해도 충분해요.",
    ],
  },
  health: {
    titles: [
      "몸이 보내는 신호에 귀 기울여요",
      "가벼운 움직임이 컨디션을 올려요",
      "수면이 운의 핵심이에요",
      "과한 일정은 조금 덜어내도 돼요",
    ],
    summaries: [
      "무리한 일정 대신 리듬을 지키는 게 더 큰 행운이에요.",
      "짧은 산책이나 스트레칭만으로도 머리가 맑아져요.",
      "늦게까지 붙잡지 말고 내일의 컨디션을 남겨 두세요.",
      "카페인과 야식만 줄여도 내일 운이 달라져요.",
    ],
    advices: [
      "물을 자주 마시고, 한 끼는 따뜻한 음식으로 챙겨 보세요.",
      "점심 뒤에 10분만 걸어 보세요. 오후의 집중력이 달라져요.",
      "잠들기 한 시간 전에는 화면을 멀리하는 게 좋아요.",
      "오늘은 운동 강도를 높이지 말고, 몸을 푸는 데 집중하세요.",
    ],
  },
};

const LUCKY_COLORS = [
  "코랄 핑크",
  "민트 그린",
  "크림 옐로",
  "스카이 블루",
  "라벤더",
  "피치 오렌지",
  "아이보리",
  "세이지 그린",
];

const LUCKY_TIMES = [
  "오전 7시~9시",
  "오전 11시 전후",
  "점심 직후",
  "오후 3시~4시",
  "퇴근길",
  "저녁 8시 무렵",
];

const LUCKY_FOODS = [
  "따뜻한 국물",
  "제철 과일",
  "달걀요리",
  "녹차",
  "초콜릿",
  "김밥",
  "요거트",
];

const LUCKY_ITEMS = [
  "손수건",
  "텀블러",
  "이어폰",
  "노트",
  "열쇠고리",
  "향 좋은 핸드크림",
  "여분의 충전기",
];

const CATEGORY_META: { id: CategoryId; label: string; emoji: string }[] = [
  { id: "love", label: "연애운", emoji: "💕" },
  { id: "money", label: "금전운", emoji: "💰" },
  { id: "work", label: "직장운", emoji: "💼" },
  { id: "health", label: "건강운", emoji: "💪" },
];

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(random: () => number, list: T[]): T {
  return list[Math.floor(random() * list.length)]!;
}

function scoreFromRandom(random: () => number, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

function gradeFromScore(score: number): DailyFortune["grade"] {
  if (score >= 90) return "최고";
  if (score >= 80) return "좋음";
  if (score >= 70) return "무난";
  return "차분";
}

function buildCategory(
  random: () => number,
  meta: (typeof CATEGORY_META)[number],
  overallScore: number,
): CategoryFortune {
  const copy = CATEGORY_COPY[meta.id];
  const variance = scoreFromRandom(random, -12, 10);
  const score = Math.min(98, Math.max(58, overallScore + variance));

  return {
    id: meta.id,
    label: meta.label,
    emoji: meta.emoji,
    score,
    title: pick(random, copy.titles),
    summary: pick(random, copy.summaries),
    advice: pick(random, copy.advices),
  };
}

export function getDailyFortune(dateKey: string): DailyFortune {
  const random = mulberry32(hashString(`good-luck-today:${dateKey}`));
  const score = scoreFromRandom(random, 64, 96);
  const overall = pick(random, OVERALL_LINES);

  return {
    dateKey,
    score,
    grade: gradeFromScore(score),
    headline: overall.headline,
    summary: overall.summary,
    luckyColor: pick(random, LUCKY_COLORS),
    luckyNumber: scoreFromRandom(random, 1, 9),
    luckyTime: pick(random, LUCKY_TIMES),
    luckyFood: pick(random, LUCKY_FOODS),
    luckyItem: pick(random, LUCKY_ITEMS),
    categories: CATEGORY_META.map((meta) => buildCategory(random, meta, score)),
  };
}

export function getCategory(fortune: DailyFortune, id: CategoryId): CategoryFortune {
  return fortune.categories.find((category) => category.id === id) ?? fortune.categories[0]!;
}

export function getShareMessage(fortune: DailyFortune, nickname: string): string {
  const who = nickname.trim() || "나";
  return `${who}의 ${formatShortDate(fortune.dateKey)} 행운 지수는 ${fortune.score}점이에요. ${fortune.headline}`;
}

export function getHistoryFortunes(dateKeys: string[]): DailyFortune[] {
  return [...dateKeys]
    .sort((left, right) => (left < right ? 1 : -1))
    .map((dateKey) => getDailyFortune(dateKey));
}
