import { useEffect, useRef } from "react";

import {
  attendanceNotifySupported,
  recordAttendanceNotifyLater,
  recordAttendanceNotifyResult,
  requestAttendanceNotification,
} from "../lib/attendanceNotify";
import "./AttendanceNotifyCard.css";

type AttendanceNotifyCardProps = {
  onClose: () => void;
};

/** Bottom card after a check-in reward. The Toss sheet opens only from 알림 받기. */
export function AttendanceNotifyCard({ onClose }: AttendanceNotifyCardProps) {
  const acceptRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    acceptRef.current?.focus({ preventScroll: true });
  }, []);

  if (!attendanceNotifySupported()) return null;

  return (
    <div className="att-notify-host">
      <section
        className="att-notify-card"
        role="dialog"
        aria-labelledby="att-notify-title"
        aria-describedby="att-notify-desc"
      >
        <h2 id="att-notify-title">내일도 잊지 않게 알려드릴까요?</h2>
        <p id="att-notify-desc">
          매일 오전 9시에 출석 알림을 보내드려요. 토스 설정에서 언제든 끌 수 있어요.
        </p>
        <div className="att-notify-actions">
          <button
            type="button"
            className="att-notify-later"
            onClick={() => {
              recordAttendanceNotifyLater();
              onClose();
            }}
          >
            다음에
          </button>
          <button
            ref={acceptRef}
            type="button"
            className="att-notify-accept"
            onClick={() => {
              requestAttendanceNotification({
                onResult: (type) => {
                  recordAttendanceNotifyResult(type);
                  onClose();
                },
                onError: () => {
                  onClose();
                },
              });
            }}
          >
            알림 받기
          </button>
        </div>
      </section>
    </div>
  );
}
