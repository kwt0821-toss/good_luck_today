import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useBackHandler } from "../hooks/useBackHandler";
import { NCOIN_ICON } from "../lib/ncoinIcon";
import type { RewardsWalletSheet } from "../lib/menuTypes";
import "./WithdrawCelebration.css";

/** Same sentences as public/assets/menu/menu.json sheets.rewards.wallet. */
export const WITHDRAW_COPY = {
  sendingCta: "보내는 중…",
  celebratePill: "냥코인 {coins}개 → {coins}원",
  celebrateTitle: "냥코인 {coins}개를\n토스로 보냈어요!",
  celebrateDesc: "토스 앱에서 바로 확인할 수 있어요",
  celebrateLeft: "남은 냥코인 {left}개",
  celebrateLeftDone: "오늘은 다 보냈어요",
  celebrateOk: "확인",
  pendingPill: "냥코인 {coins}개 •••",
  pendingTitle: "토스로 보내는 중이에요",
  pendingDesc: "토스에서 확인하고 있어요. 조금만 기다려 주세요.",
  pendingNote: "확인이 끝나면 지급 내역에 '완료'로 바뀌어요. 버튼을 다시 누르지 않아도 돼요.",
  pendingHistory: "지급 내역 보기",
  doneSheetTitle: "토스로 보냈어요",
  doneSheetDesc: "냥코인 {coins}개를 토스로 보냈어요. 토스 앱에서 확인할 수 있어요.",
  pendingSheetTitle: "보내는 중이에요",
  pendingSheetDesc: "냥코인 {coins}개를 토스로 보내고 있어요. 잠시 후 지급 내역에서 확인해 주세요.",
  failTitle: "보내지 못해 냥코인을 돌려드렸어요",
  failSub: "잠시 후 다시 시도해 주세요",
  dailyLimitTitle: "하루에 보낼 수 있는 한도({dailyLimit}원)에 도달했어요",
  dailyLimitDesc: "내일 0시에 다시 보낼 수 있어요",
} as const;

export type WithdrawCopyKey = keyof typeof WITHDRAW_COPY;

const FAIL_FORBIDDEN = /포인트|출금|인출|전환|(^|[^A-Za-z])P([^A-Za-z]|$)/;

export function fillWithdraw(template: string, vars: Record<string, string | number>): string {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    out = out.split(`{${key}}`).join(String(value));
  }
  return out;
}

export function walletCopy(
  sheet: RewardsWalletSheet | undefined,
  key: WithdrawCopyKey,
  vars?: Record<string, string | number>,
): string {
  const raw = sheet?.[key] || WITHDRAW_COPY[key];
  return vars ? fillWithdraw(raw, vars) : raw;
}

/** Empty or forbidden server wording becomes the approved fallback. */
export function withdrawFailSub(reason: string | undefined, fallback: string): string {
  const text = (reason ?? "").trim();
  if (!text || FAIL_FORBIDDEN.test(text)) return fallback;
  return text;
}

const CONFETTI = [
  { x: -92, y: -28, r: -36, c: "#f3a0c4" },
  { x: -64, y: -58, r: 24, c: "#7ec8f0" },
  { x: -28, y: -72, r: -12, c: "#ffe08a" },
  { x: 18, y: -64, r: 40, c: "#8fd18a" },
  { x: 62, y: -48, r: -28, c: "#f0a24a" },
  { x: 96, y: -18, r: 18, c: "#f48fb1" },
  { x: -108, y: 8, r: 32, c: "#6ec6ff" },
  { x: 108, y: 16, r: -22, c: "#ffd54f" },
  { x: -48, y: 22, r: 16, c: "#81c784" },
  { x: 46, y: 28, r: -34, c: "#ff8a80" },
  { x: -16, y: -40, r: 8, c: "#ce93d8" },
  { x: 78, y: -70, r: 26, c: "#80deea" },
];

const SPARKLES = [
  { x: -78, y: -50 },
  { x: -20, y: -78 },
  { x: 36, y: -70 },
  { x: 84, y: -36 },
  { x: 8, y: -24 },
];

type Props = {
  mode: "done" | "pending";
  coins: number;
  left: number;
  allDone: boolean;
  copy: RewardsWalletSheet | undefined;
  onClose: () => void;
  onHistory: () => void;
};

export function WithdrawCelebration({ mode, coins, left, allDone, copy, onClose, onHistory }: Props) {
  const okRef = useRef<HTMLButtonElement>(null);
  const done = mode === "done";
  useBackHandler(true, onClose, 60);

  useEffect(() => {
    okRef.current?.focus();
  }, []);

  useEffect(() => {
    const body = document.body;
    const root = document.documentElement;
    const prevBody = body.style.overflow;
    const prevRoot = root.style.overflow;
    body.style.overflow = "hidden";
    root.style.overflow = "hidden";
    return () => {
      body.style.overflow = prevBody;
      root.style.overflow = prevRoot;
    };
  }, []);

  const title = walletCopy(copy, done ? "celebrateTitle" : "pendingTitle", { coins });
  const lines = title.split("\n");
  const pill = walletCopy(copy, done ? "celebratePill" : "pendingPill", { coins }).replace(
    /\s*[•.…]{2,}\s*$/u,
    "",
  );
  const leftLine = done
    ? allDone
      ? `${walletCopy(copy, "celebrateLeft", { left })} · ${walletCopy(copy, "celebrateLeftDone")}`
      : walletCopy(copy, "celebrateLeft", { left })
    : "";

  const node = (
    <div className={`wcel ${done ? "is-done" : "is-pending"}`}>
      <button type="button" className="wcel-backdrop" aria-label="닫기" onClick={onClose} />
      <div
        className="wcel-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wcel-title"
      >
        <div className="wcel-cat">
          <img
            className="wcel-cat-img"
            src={done ? "/assets/withdraw/celebrate-cat.webp" : "/assets/withdraw/pending-cat.webp"}
            alt=""
            width={220}
            height={220}
          />
        </div>
        {done ? (
          <div className="wcel-fx" aria-hidden="true">
            {CONFETTI.map((bit, index) => (
              <span
                key={index}
                className="wcel-bit"
                style={{
                  ["--x" as string]: `${bit.x}px`,
                  ["--y" as string]: `${bit.y}px`,
                  ["--r" as string]: `${bit.r}deg`,
                  ["--c" as string]: bit.c,
                  animationDelay: `${index * 0.02}s`,
                }}
              />
            ))}
            {SPARKLES.map((bit, index) => (
              <span
                key={index}
                className="wcel-spark"
                style={{
                  ["--x" as string]: `${bit.x}px`,
                  ["--y" as string]: `${bit.y}px`,
                  ["--r" as string]: "0deg",
                  animationDelay: `${index * 0.04}s`,
                }}
              >
                ✦
              </span>
            ))}
          </div>
        ) : null}
        <p className="wcel-pill">
          <img src={NCOIN_ICON.md} alt="" width={18} height={18} />
          <span>{pill}</span>
          {done ? null : (
            <span className="wcel-dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          )}
        </p>
        <h2 id="wcel-title" className="wcel-title">
          {lines.map((line, index) => (
            <span key={index} className={index > 0 ? "is-accent" : undefined}>
              {line}
              {index < lines.length - 1 ? <br /> : null}
            </span>
          ))}
        </h2>
        <p className="wcel-desc">{walletCopy(copy, done ? "celebrateDesc" : "pendingDesc")}</p>
        {done ? <p className="wcel-left">{leftLine}</p> : null}
        {done ? null : <p className="wcel-note">{walletCopy(copy, "pendingNote")}</p>}
        <button ref={okRef} type="button" className="wcel-ok" onClick={onClose}>
          {walletCopy(copy, "celebrateOk")}
        </button>
        {done ? null : (
          <button type="button" className="wcel-history" onClick={onHistory}>
            {walletCopy(copy, "pendingHistory")}
          </button>
        )}
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
