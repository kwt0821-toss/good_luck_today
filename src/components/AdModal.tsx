import { adaptive } from "@toss/tds-colors";
import { Button, Text } from "@toss/tds-mobile";
import { useEffect, useState } from "react";

import { mockAdDurationSec, type MockAdKind } from "../lib/mockAds";

type AdModalProps = {
  open: boolean;
  kind: MockAdKind;
  title?: string;
  subtitle?: string;
  onComplete: () => void;
  onCancel: () => void;
};

export function AdModal({ open, kind, title, subtitle, onComplete, onCancel }: AdModalProps) {
  const duration = mockAdDurationSec(kind);
  const [remaining, setRemaining] = useState(duration);

  useEffect(() => {
    if (!open) return;
    const totalMs = duration * 1000;
    let elapsed = 0;
    let last = Date.now();
    setRemaining(duration);
    const tick = () => {
      const now = Date.now();
      const delta = now - last;
      // Ignore a clock jump so the wait cannot be rewound or skipped.
      if (delta > 0 && delta <= 2000) elapsed += delta;
      last = now;
      setRemaining(Math.max(0, Math.ceil((totalMs - elapsed) / 1000)));
    };
    const timer = window.setInterval(tick, 200);
    return () => window.clearInterval(timer);
  }, [open, duration]);

  if (!open) return null;

  const done = remaining <= 0;
  const resolvedTitle = title ?? (kind === "long" ? "확률업 리워드 광고" : "짧은 광고");
  const resolvedSubtitle =
    subtitle ??
    (kind === "long"
      ? "긴 광고를 끝까지 보면 확률업 뽑기를 할 수 있어요."
      : "짧은 광고를 끝까지 보면 보상을 받을 수 있어요.");

  return (
    <div className="ad-modal" role="dialog" aria-modal="true" aria-labelledby="ad-modal-title">
      <div className="ad-modal-card">
        <Text id="ad-modal-title" typography="t4" fontWeight="bold" color={adaptive.grey800} display="block">
          {resolvedTitle}
        </Text>
        <Text typography="t6" color={adaptive.grey600} display="block">
          {resolvedSubtitle}
        </Text>

        <div className="ad-mock" aria-hidden="true">
          <div className="ad-mock-badge">AD</div>
          <p className="ad-mock-brand">잠시만 기다려 주세요</p>
          <p className="ad-mock-copy">광고를 불러오지 못해 잠시 기다려 주세요.</p>
          <div className="ad-progress">
            <div
              className="ad-progress-bar"
              style={{ width: `${((duration - remaining) / duration) * 100}%` }}
            />
          </div>
          <p className="ad-countdown">{done ? "광고가 끝났어요" : `${remaining}초 남음`}</p>
        </div>

        <Button disabled={!done} onClick={onComplete}>
          {done ? "광고 종료 후 계속" : "광고를 끝까지 봐 주세요"}
        </Button>
        <Button color="dark" variant="weak" onClick={onCancel}>
          닫기
        </Button>
        {import.meta.env.DEV ? (
          <button className="ad-skip" type="button" onClick={onComplete}>
            미리보기에서 건너뛰기
          </button>
        ) : null}
      </div>
    </div>
  );
}
