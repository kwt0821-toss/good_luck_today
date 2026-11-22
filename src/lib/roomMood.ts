/** 방 분위기. 폰에만 두고 서버 저장본에는 넣지 않는다. */
export const ROOM_MOOD_KEY = "lucky-cat.room-mood.v1";

export type RoomBright = "bright" | "normal" | "cozy";

export type RoomMood = {
  bright: RoomBright;
  sound: boolean;
};

const DEFAULT_MOOD: RoomMood = { bright: "normal", sound: false };

export const AMBIENCE_LABEL: Record<string, string> = {
  moon_bedroom: "귀뚜라미 · 시계 째깍",
  cat_cafe: "카페 웅성임 · 컵 소리",
  sakura_greenhouse: "새소리 · 살랑 바람",
  winter_cabin: "벽난로 타닥 · 창밖 바람",
};

export function ambienceLabel(roomId: string): string {
  return AMBIENCE_LABEL[roomId] ?? "이 방의 소리";
}

export type RoomPeriod = "morning" | "day" | "sunset" | "night";

export type MoodWash = {
  background: string;
  blend: "soft-light";
};

/** Interior wash that replaces the old whole-island brightness filter. */
export function moodWash(bright: RoomBright, period: RoomPeriod): MoodWash | null {
  if (bright === "bright") {
    return {
      background: period === "night" ? "rgba(255,250,244,.34)" : "rgba(255,255,250,.62)",
      blend: "soft-light",
    };
  }
  if (bright !== "cozy") return null;
  const background = {
    morning: "linear-gradient(180deg, rgba(255,196,140,.85), rgba(255,170,120,.5))",
    day: "linear-gradient(180deg, rgba(255,206,150,.75), rgba(255,180,120,.5))",
    sunset: "linear-gradient(180deg, rgba(255,176,104,.78), rgba(255,140,110,.45))",
    night: "linear-gradient(180deg, rgba(255,184,118,.46), rgba(255,150,100,.3))",
  }[period];
  return { background, blend: "soft-light" };
}

export function moodClassName(bright: RoomBright): string {
  if (bright === "bright") return "is-mood-bright";
  if (bright === "cozy") return "is-mood-cozy";
  return "";
}

function asBright(value: unknown): RoomBright {
  return value === "bright" || value === "cozy" ? value : "normal";
}

export function parseRoomMoods(raw: string | null): Record<string, RoomMood> {
  if (!raw) return {};
  try {
    const data = JSON.parse(raw) as unknown;
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    const out: Record<string, RoomMood> = {};
    for (const [roomId, value] of Object.entries(data as Record<string, unknown>)) {
      if (!value || typeof value !== "object") continue;
      const row = value as { bright?: unknown; sound?: unknown };
      out[roomId] = { bright: asBright(row.bright), sound: row.sound === true };
    }
    return out;
  } catch {
    return {};
  }
}

export function readRoomMoods(): Record<string, RoomMood> {
  if (typeof localStorage === "undefined") return {};
  try {
    return parseRoomMoods(localStorage.getItem(ROOM_MOOD_KEY));
  } catch {
    return {};
  }
}

export function readRoomMood(roomId: string): RoomMood {
  return readRoomMoods()[roomId] ?? DEFAULT_MOOD;
}

export function writeRoomMood(roomId: string, patch: Partial<RoomMood>): RoomMood {
  const all = readRoomMoods();
  const next: RoomMood = { ...DEFAULT_MOOD, ...all[roomId], ...patch };
  all[roomId] = next;
  try {
    localStorage.setItem(ROOM_MOOD_KEY, JSON.stringify(all));
  } catch {
    /* private mode */
  }
  return next;
}
