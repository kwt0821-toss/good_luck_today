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

export function moodFilter(bright: RoomBright): string {
  if (bright === "bright") return "brightness(1.1)";
  if (bright === "cozy") return "brightness(0.8) saturate(1.05)";
  return "none";
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
