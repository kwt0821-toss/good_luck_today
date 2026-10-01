import { adaptive } from "@toss/tds-colors";
import { Button, Text } from "@toss/tds-mobile";
import { useEffect, useState } from "react";

import type { AdKind } from "../types";

const AD_DURATION: Record<AdKind, number> = {
  interstitial: 3,
  rewarded: 30,
};

type AdModalProps = {
  open: boolean;
  kind: AdKind;
  onComplete: () => void;
  onCancel: () => void;
};

export function AdModal({ open, kind, onComplete, onCancel }: AdModalProps) {
  const duration = AD_DURATION[kind];
  const [remaining, setRemaining] = useState(duration);

  useEffect(() => {
    if (!open) return;
    setRemaining(duration);
    const timer = window.setInterval(() => {
      setRemaining((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [open, duration]);

  if (!open) return null;

  const done = remaining <= 0;
  const title = kind === "rewarded" ? "확률업 리워드 광고" : "전면 광고";
  const subtitle =
    kind === "rewarded"
      ? "30초 리워드 광고를 보면 고급 등급 확률이 올라가요."
      : "짧은 전면 광고를 보면 고양이를 소환할 수 있어요.";

  return (
    <div className="ad-modal" role="dialog" aria-modal="true" aria-labelledby="ad-modal-title">
      <div className="ad-modal-card">
        <Text typography="t4" fontWeight="bold" color={adaptive.grey800} display="block">
          {title}
        </Text>
        <Text typography="t6" color={adaptive.grey600} display="block">
          {subtitle}
        </Text>

        <div className="ad-mock" aria-hidden="true">
          <div className="ad-mock-badge">AD</div>
          <p className="ad-mock-brand">럭키캣 Mock Ad</p>
          <p className="ad-mock-copy">토스 미니앱 SDK 연동 전 미리보기 광고예요.</p>
          <div className="ad-progress">
            <div
              className="ad-progress-bar"
              style={{ width: `${((duration - remaining) / duration) * 100}%` }}
            />
          </div>
          <p className="ad-countdown">{done ? "광고가 끝났어요" : `${remaining}초 남음`}</p>
        </div>

        <Button disabled={!done} onClick={onComplete}>
          {done ? "광고 종료 후 소환하기" : "광고를 끝까지 봐 주세요"}
        </Button>
        <Button color="dark" variant="weak" onClick={onCancel}>
          닫기
        </Button>
        <button className="ad-skip" type="button" onClick={onComplete}>
          미리보기에서 건너뛰기
        </button>
      </div>
    </div>
  );
}
