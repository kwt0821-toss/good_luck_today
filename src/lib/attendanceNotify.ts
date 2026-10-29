import { Notification } from "@apps-in-toss/web-framework";

import { nyNotify } from "./nyangNotify";
import type { NotifyAttendanceState, OpsState } from "./opsTypes";

/** Console functional campaign send code. Must stay `lucky-cat-…`. */
export const ATTENDANCE_NOTIFY_TEMPLATE = "lucky-cat-attendance";

export type AttendanceNotifyResult = "newAgreement" | "alreadyAgreed" | "agreementRejected";

/** Set when the member agrees (or was already agreed). */
const AGREED_KEY = "lucky-cat:notifyAgreed";
/** Set when they decline the Toss sheet or choose 다음에. */
const ASKED_AT_KEY = "lucky-cat:notifyAskedAt";
/**
 * How many times the bottom card (or a sheet decline) has been answered.
 * After 2, the card stays hidden and only the settings row can open the sheet.
 */
const ASK_COUNT_KEY = "lucky-cat:notifyAskCount";
const ASK_RETRY_MS = 7 * 24 * 60 * 60 * 1000;

/** App merges this into the live ops object and saves through the existing ops-state path. */
export const ATTENDANCE_NOTIFY_STATE_EVENT = "lucky-notify-attendance";

export const EMPTY_NOTIFY_ATTENDANCE: NotifyAttendanceState = {
  agreed: false,
  askCount: 0,
  askedAt: 0,
};

/** Latest consent written this session. Stamped onto every ops save so a stale write cannot drop it. */
let cachedNotify: NotifyAttendanceState = { ...EMPTY_NOTIFY_ATTENDANCE };
let cacheReady = false;

function readStore(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStore(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private mode — the card can show again next claim.
  }
}

function finiteCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

export function normalizeNotifyAttendance(value: unknown): NotifyAttendanceState {
  if (!value || typeof value !== "object") return { ...EMPTY_NOTIFY_ATTENDANCE };
  const raw = value as Record<string, unknown>;
  return {
    agreed: raw.agreed === true,
    askCount: finiteCount(raw.askCount),
    askedAt: finiteCount(raw.askedAt),
  };
}

export function mergeNotifyAttendance(
  a: NotifyAttendanceState | undefined,
  b: NotifyAttendanceState | undefined,
): NotifyAttendanceState {
  const left = a ?? EMPTY_NOTIFY_ATTENDANCE;
  const right = b ?? EMPTY_NOTIFY_ATTENDANCE;
  return {
    agreed: left.agreed || right.agreed,
    askCount: Math.max(left.askCount, right.askCount),
    askedAt: Math.max(left.askedAt, right.askedAt),
  };
}

function readLocalNotify(): NotifyAttendanceState {
  const count = Number(readStore(ASK_COUNT_KEY) || "0");
  const askedAt = Number(readStore(ASKED_AT_KEY) || "0");
  return {
    agreed: readStore(AGREED_KEY) === "true",
    askCount: Number.isFinite(count) && count > 0 ? count : 0,
    askedAt: Number.isFinite(askedAt) && askedAt > 0 ? askedAt : 0,
  };
}

function writeLocalNotify(state: NotifyAttendanceState) {
  if (state.agreed) writeStore(AGREED_KEY, "true");
  writeStore(ASKED_AT_KEY, String(state.askedAt));
  writeStore(ASK_COUNT_KEY, String(state.askCount));
}

function rememberNotify(next: NotifyAttendanceState) {
  cachedNotify = next;
  cacheReady = true;
  writeLocalNotify(next);
  try {
    window.dispatchEvent(new CustomEvent(ATTENDANCE_NOTIFY_STATE_EVENT, { detail: next }));
  } catch {
    // Storage still holds the result if the window event cannot fire.
  }
}

function currentNotify(): NotifyAttendanceState {
  return mergeNotifyAttendance(cacheReady ? cachedNotify : undefined, readLocalNotify());
}

/**
 * Align localStorage with ops-state on boot.
 * Agreement in either store sticks. askCount and askedAt keep the larger value.
 */
export function hydrateAttendanceNotify(
  fromOps: NotifyAttendanceState | undefined,
): NotifyAttendanceState {
  const merged = mergeNotifyAttendance(readLocalNotify(), normalizeNotifyAttendance(fromOps));
  cachedNotify = merged;
  cacheReady = true;
  writeLocalNotify(merged);
  return merged;
}

/** Fold the latest consent into an ops snapshot at save time. */
export function stampNotifyAttendance(state: OpsState): OpsState {
  if (!cacheReady) return state;
  const notifyAttendance = mergeNotifyAttendance(state.notifyAttendance, cachedNotify);
  const prev = state.notifyAttendance;
  if (
    prev &&
    prev.agreed === notifyAttendance.agreed &&
    prev.askCount === notifyAttendance.askCount &&
    prev.askedAt === notifyAttendance.askedAt
  ) {
    return state;
  }
  return { ...state, notifyAttendance };
}

export function attendanceNotifySupported(): boolean {
  try {
    return Notification.requestAgreement.isSupported();
  } catch {
    return false;
  }
}

/** Agree → never ask again. Decline / 다음에 → one more card after 7 days, then settings only. */
export function shouldOfferAttendanceNotify(now = Date.now()): boolean {
  if (!attendanceNotifySupported()) return false;
  const state = currentNotify();
  if (state.agreed) return false;
  if (state.askCount <= 0) return true;
  if (state.askCount >= 2) return false;
  if (state.askedAt <= 0) return false;
  return now - state.askedAt >= ASK_RETRY_MS;
}

export function recordAttendanceNotifyLater(now = Date.now()) {
  const base = currentNotify();
  rememberNotify({
    agreed: base.agreed,
    askCount: base.askCount > 0 ? base.askCount + 1 : 1,
    askedAt: now,
  });
}

export function recordAttendanceNotifyResult(type: AttendanceNotifyResult, now = Date.now()) {
  if (type === "newAgreement" || type === "alreadyAgreed") {
    const base = currentNotify();
    rememberNotify({ ...base, agreed: true });
    return;
  }
  recordAttendanceNotifyLater(now);
}

let releaseAgreement: (() => void) | null = null;

function endAgreement() {
  const release = releaseAgreement;
  releaseAgreement = null;
  release?.();
}

function notify(key: string, kind: "success" | "info" | "error", title: string, sub?: string) {
  nyNotify({ key, kind, title, sub, anchor: "menu" });
}

export type AttendanceNotifyErrorKind = "cancel" | "terms" | "other";

function errorCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    return String((error as { code: unknown }).code);
  }
  return "";
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "";
}

/** Cancel closes the card only. TERMS_DISAGREED_MEMBER counts as one 다음에. */
export function classifyAttendanceNotifyError(error: unknown): AttendanceNotifyErrorKind {
  const code = errorCode(error);
  if (code === "TERMS_DISAGREED_MEMBER") return "terms";
  const message = errorMessage(error);
  if (
    message.includes("취소") ||
    code === "USER_CANCELED" ||
    code === "USER_CANCELLED" ||
    code === "CANCELED" ||
    code === "CANCELLED"
  ) {
    return "cancel";
  }
  return "other";
}

function errorTitle(error: unknown): string {
  const code =
    error && typeof error === "object" && "code" in error ? String(error.code) : "";
  if (code === "UNSUPPORTED_APP_VERSION") {
    return error instanceof Error && error.message
      ? error.message
      : "토스앱 5.255.0 이상에서 사용할 수 있어요.";
  }
  if (code === "TERMS_DISAGREED_MEMBER") {
    return "토스 설정의 사용자 최적화 제품 동의가 필요해요.";
  }
  return "알림 동의를 열지 못했어요.";
}

/** Opens the Toss consent sheet for the daily 9am attendance push. */
function handleAgreementError(
  error: unknown,
  onError?: (kind: AttendanceNotifyErrorKind) => void,
) {
  const kind = classifyAttendanceNotifyError(error);
  if (kind === "terms") recordAttendanceNotifyLater();
  if (kind !== "cancel") {
    notify("attendance-notify-error", "error", errorTitle(error));
  }
  try {
    onError?.(kind);
  } catch {
    // Closing the card must not surface a second error.
  }
}

/** Opens the Toss consent sheet for the daily 9am attendance push. */
export function requestAttendanceNotification(options?: {
  onResult?: (type: AttendanceNotifyResult) => void;
  /** Card closes for every error. Cancel does not change consent; terms counts as 다음에. */
  onError?: (kind: AttendanceNotifyErrorKind) => void;
}) {
  endAgreement();
  if (!attendanceNotifySupported()) {
    notify(
      "attendance-notify-unsupported",
      "info",
      "토스앱 5.255.0 이상에서 사용할 수 있어요.",
    );
    return;
  }
  try {
    releaseAgreement = Notification.requestAgreement({
      options: { templateCode: ATTENDANCE_NOTIFY_TEMPLATE },
      onEvent: ({ type }) => {
        endAgreement();
        try {
          options?.onResult?.(type);
        } catch {
          // Storage failures still show the result toast.
        }
        if (type === "newAgreement") {
          notify("attendance-notify-on", "success", "출석 알림을 받을게요.", "매일 오전 9시에 알려줘요.");
          return;
        }
        if (type === "alreadyAgreed") {
          notify("attendance-notify-already", "info", "이미 출석 알림을 받고 있어요.");
          return;
        }
        notify("attendance-notify-off", "info", "출석 알림을 받지 않기로 했어요.");
      },
      onError: (error) => {
        endAgreement();
        handleAgreementError(error, options?.onError);
      },
    });
  } catch (error) {
    endAgreement();
    handleAgreementError(error, options?.onError);
  }
}
