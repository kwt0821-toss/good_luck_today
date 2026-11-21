import { adoptServerJelly } from "./serverJelly";
import { uploadRoomPhoto } from "./roomPhoto";
import {
  visitGet,
  visitLike,
  visitList,
  visitSetNickname,
  visitSetPublic,
  visitStatus,
  visitSyncLayout,
  type VisitCard,
  type VisitLayout,
  type VisitRoom,
  type VisitStatus,
} from "./serverWallet";
import { PHOTO_DAY_LIMIT, PHOTO_FAIL, ROOM_EMPTY, nicknameIssue } from "./roomVisitNick";

export type { VisitCard, VisitLayout, VisitRoom, VisitStatus };
export type VisitTab = "friends" | "today" | "popular";

const LIST_TTL_MS = 12_000;

const EMPTY_STATUS: VisitStatus = {
  roomId: "",
  nickname: "",
  hasNickname: false,
  isPublic: false,
  photoLive: false,
  hasLayout: false,
  canPublish: false,
  likeJelly: 5,
  photoDays: 30,
  canChangeNickname: true,
};

let status: VisitStatus = EMPTY_STATUS;
let statusAt = 0;
let statusFlight: Promise<VisitStatus> | null = null;

const lists = new Map<VisitTab, { at: number; items: VisitCard[] }>();
const listFlight = new Map<VisitTab, Promise<{ items: VisitCard[]; error: string | null }>>();

function nickError(error: string): string {
  if (error === "nickname_invalid") return "닉네임은 2~8글자, 한글·영문·숫자만 쓸 수 있어요";
  if (error === "nickname_denied") return "이 닉네임은 쓸 수 없어요";
  if (error === "nickname_day_limit") return "닉네임은 하루에 한 번만 바꿀 수 있어요";
  if (error === "blocked") return "지금은 이용할 수 없어요";
  if (error === "local") return "서버가 필요할 때 정할 수 있어요";
  if (error === "network") return "연결을 확인해 주세요";
  return "닉네임을 저장하지 못했어요";
}

function publicError(error: string): string {
  if (error === "need_nickname") return "닉네임을 먼저 정해 주세요";
  if (error === "need_photo") return PHOTO_FAIL;
  if (error === "need_room") return ROOM_EMPTY;
  if (error === "blocked") return "지금은 이용할 수 없어요";
  if (error === "local") return "서버가 필요할 때 공개할 수 있어요";
  if (error === "network") return "연결을 확인해 주세요";
  return "공개 설정을 바꾸지 못했어요";
}

export function likeError(error: string): string {
  if (error === "self_like") return "내 방에는 하트를 누를 수 없어요";
  if (error === "not_found") return "방을 찾지 못했어요";
  if (error === "blocked") return "지금은 이용할 수 없어요";
  if (error === "local") return "서버가 필요할 때 받을 수 있어요";
  if (error === "network") return "연결을 확인해 주세요";
  return "하트를 보내지 못했어요";
}

export function visitStatusNow(): VisitStatus {
  return status;
}

function rememberStatus(next: VisitStatus) {
  status = next;
  statusAt = Date.now();
}

/** Matches publish and nickname from the server. Safe to call when the room screen opens. */
export function refreshVisitStatus(force = false): Promise<VisitStatus> {
  if (!force && statusAt && Date.now() - statusAt < LIST_TTL_MS) return Promise.resolve(status);
  if (statusFlight) return statusFlight;
  statusFlight = (async () => {
    const result = await visitStatus();
    if (result.ok) rememberStatus(result.status);
    return status;
  })().finally(() => {
    statusFlight = null;
  });
  return statusFlight;
}

export async function saveVisitNickname(raw: string): Promise<{ ok: true; status: VisitStatus } | { ok: false; message: string }> {
  const issue = nicknameIssue(raw);
  if (issue) return { ok: false, message: issue };
  const result = await visitSetNickname(raw.trim());
  if (!result.ok) return { ok: false, message: nickError(result.error) };
  rememberStatus(result.status);
  return { ok: true, status: result.status };
}

export async function turnVisitPrivate(): Promise<{ ok: true; status: VisitStatus } | { ok: false; message: string }> {
  const result = await visitSetPublic(false);
  if (!result.ok) return { ok: false, message: publicError(result.error) };
  rememberStatus(result.status);
  return { ok: true, status: result.status };
}

/**
 * Upload the room photo, then ask the server to publish.
 * A failed upload does not turn publishing on.
 */
export async function turnVisitPublic(
  jpegBase64: string | null,
): Promise<{ ok: true; status: VisitStatus } | { ok: false; message: string }> {
  if (!status.hasNickname) return { ok: false, message: "닉네임을 먼저 정해 주세요" };
  if (!jpegBase64) return { ok: false, message: PHOTO_FAIL };
  const uploaded = await uploadRoomPhoto(jpegBase64);
  if (!uploaded.ok) {
    if (uploaded.limit) return { ok: false, message: PHOTO_DAY_LIMIT };
    if (uploaded.error === "local") return { ok: false, message: "서버가 필요할 때 공개할 수 있어요" };
    return { ok: false, message: PHOTO_FAIL };
  }
  const result = await visitSetPublic(true);
  if (!result.ok) return { ok: false, message: publicError(result.error) };
  rememberStatus(result.status);
  return { ok: true, status: result.status };
}

export function loadVisitList(tab: VisitTab, force = false): Promise<{ items: VisitCard[]; error: string | null }> {
  const cached = lists.get(tab);
  if (!force && cached && Date.now() - cached.at < LIST_TTL_MS) {
    return Promise.resolve({ items: cached.items, error: null });
  }
  const pending = listFlight.get(tab);
  if (pending) return pending;
  const flight = (async () => {
    const result = await visitList(tab);
    if (!result.ok) return { items: cached?.items ?? [], error: result.error };
    lists.set(tab, { at: Date.now(), items: result.items });
    return { items: result.items, error: null };
  })().finally(() => {
    listFlight.delete(tab);
  });
  listFlight.set(tab, flight);
  return flight;
}

export async function loadVisitRoom(roomId: string): Promise<{ ok: true; room: VisitRoom } | { ok: false; message: string }> {
  const result = await visitGet(roomId);
  if (!result.ok) {
    if (result.error === "not_found") return { ok: false, message: "방을 찾지 못했어요" };
    if (result.error === "local") return { ok: false, message: "local" };
    if (result.error === "network") return { ok: false, message: "연결을 확인해 주세요" };
    return { ok: false, message: "방을 불러오지 못했어요" };
  }
  return { ok: true, room: result.room };
}

export type VisitLikeOutcome = {
  ok: boolean;
  message: string | null;
  grantAmount: number | null;
  likes: number | null;
  likedByMe: boolean | null;
};

/** Applies jellyBalance when the server sends one. Never adds a reward locally. */
export async function likeVisitRoom(roomId: string, alreadyLiked: boolean): Promise<VisitLikeOutcome> {
  if (alreadyLiked) {
    return { ok: true, message: null, grantAmount: null, likes: null, likedByMe: true };
  }
  const result = await visitLike(roomId);
  if (!result.ok) {
    return { ok: false, message: likeError(result.error), grantAmount: null, likes: null, likedByMe: null };
  }
  const like = result.like;
  if (typeof like.jellyBalance === "number") adoptServerJelly(like.jellyBalance);
  const granted = !like.already && (like.jellyGranted || like.jelly > 0);
  const amount = like.jelly > 0 ? like.jelly : like.likeJelly || 5;
  return {
    ok: true,
    message: null,
    grantAmount: granted ? amount : null,
    likes: like.likes,
    likedByMe: like.likedByMe,
  };
}

/** After a successful room save, while the room is public. Failure leaves the save as-is. */
export async function syncVisitLayoutIfPublic(): Promise<void> {
  try {
    if (!statusAt) await refreshVisitStatus();
    if (!status.isPublic) return;
    await visitSyncLayout();
  } catch {
    /* the room save already succeeded */
  }
}
