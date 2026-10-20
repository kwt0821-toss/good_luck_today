import { Notification } from "@apps-in-toss/web-framework";

import { nyNotify } from "./nyangNotify";

/** Console functional campaign send code. Must stay `lucky-cat-…`. */
export const ATTENDANCE_NOTIFY_TEMPLATE = "lucky-cat-attendance";

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

function attendanceNotifySupported(): boolean {
  try {
    return Notification.requestAgreement.isSupported();
  } catch {
    return false;
  }
}

/** Opens the Toss consent sheet for the daily 9am attendance push. */
export function requestAttendanceNotification() {
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
