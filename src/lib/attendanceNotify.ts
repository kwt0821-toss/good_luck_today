import { Notification } from "@apps-in-toss/web-framework";

import { nyNotify } from "./nyangNotify";

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
  if (readStore(AGREED_KEY) === "true") return false;
  const count = Number(readStore(ASK_COUNT_KEY) || "0");
  if (!Number.isFinite(count) || count <= 0) return true;
  if (count >= 2) return false;
  const askedAt = Number(readStore(ASKED_AT_KEY) || "0");
  if (!Number.isFinite(askedAt) || askedAt <= 0) return false;
  return now - askedAt >= ASK_RETRY_MS;
}

export function recordAttendanceNotifyLater(now = Date.now()) {
  const count = Number(readStore(ASK_COUNT_KEY) || "0");
  const next = Number.isFinite(count) && count > 0 ? count + 1 : 1;
  writeStore(ASKED_AT_KEY, String(now));
  writeStore(ASK_COUNT_KEY, String(next));
}

export function recordAttendanceNotifyResult(type: AttendanceNotifyResult, now = Date.now()) {
  if (type === "newAgreement" || type === "alreadyAgreed") {
    writeStore(AGREED_KEY, "true");
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
export function requestAttendanceNotification(options?: {
  onResult?: (type: AttendanceNotifyResult) => void;
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
        notify("attendance-notify-error", "error", errorTitle(error));
      },
    });
  } catch (error) {
    endAgreement();
    notify("attendance-notify-error", "error", errorTitle(error));
  }
}
