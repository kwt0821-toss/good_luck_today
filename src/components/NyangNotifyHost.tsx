import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import { haptic } from "../lib/native";
import {
  nyConfirmClose,
  nyHostControls,
  nyNotifyGetSnapshot,
  nyNotifySubscribe,
  nyResolveText,
  type NyKind,
} from "../lib/nyangNotify";
import { AudioManager } from "../audio/AudioManager";
import "../styles/nyang-notify.css";

const CAT = "/assets/notify/cat.png";
const NCOIN = "/assets/notify/ncoin.png";
const PAW = "/assets/menu/icon-paw-mini.svg";
const TICKET = "/assets/menu/icon-ticket.svg";

function Icon({ kind }: { kind: NyKind }) {
  if (kind === "celebrate") {
    return <img src={CAT} alt="" width={62} height={62} />;
  }
  if (kind === "reward") {
    return (
      <div className="ic" aria-hidden="true">
        <img src={NCOIN} alt="" />
      </div>
    );
  }
  if (kind === "success") {
    return (
      <div className="ic" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="11" fill="currentColor" opacity="0.18" />
          <path
            d="M7 12.5 10.2 15.8 17 8.5"
            stroke="var(--ny-mint-d)"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    );
  }
  if (kind === "info") {
    return (
      <div className="ic" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="11" fill="currentColor" opacity="0.2" />
          <path
            d="M12 10.5v6M12 7.5h.01"
            stroke="var(--ny-sky-d)"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
      </div>
    );
  }
  return (
    <div className="ic" aria-hidden="true">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 3.5 21 19.5H3L12 3.5Z"
          fill="currentColor"
          opacity="0.22"
          stroke="var(--ny-coral-d)"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path d="M12 9v5.5M12 17.2h.01" stroke="var(--ny-coral-d)" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    </div>
  );
}

/** Renders `<b>`, `{ncoin}`, `{paw}`, and common bare “냥코인” / “N P” tokens. */
function RichCopy({ text, inlineIcons = true }: { text: string; inlineIcons?: boolean }) {
  let normalized = text;
  if (inlineIcons) {
    normalized = normalized
      .replace(/\{ncoin\}/g, "⟦NCOIN⟧")
      .replace(/\{paw\}/g, "⟦PAW⟧")
      .replace(/냥코인/g, "⟦NCOIN⟧")
      .replace(/(^|[^\w])(\+?\d+)\s*P\b/g, "$1⟦PAW⟧$2");
  }
  const parts = normalized.split(/(<b>.*?<\/b>|⟦NCOIN⟧|⟦PAW⟧)/g).filter(Boolean);
  return (
    <>
      {parts.map((part, index) => {
        if (part === "⟦NCOIN⟧") {
          return <img key={index} className="ny-inline-ic" src={NCOIN} alt="" width={14} height={14} />;
        }
        if (part === "⟦PAW⟧") {
          return <img key={index} className="ny-inline-ic" src={PAW} alt="" width={14} height={14} />;
        }
        const m = part.match(/^<b>(.*?)<\/b>$/);
        if (m) return <b key={index}>{m[1]}</b>;
        return <span key={index}>{part}</span>;
      })}
    </>
  );
}

function rewardIcon(icon?: "ncoin" | "paw" | "ticket" | "cat") {
  if (icon === "paw") return PAW;
  if (icon === "ticket") return TICKET;
  if (icon === "cat") return CAT;
  return NCOIN;
}

export function NyangNotifyHost() {
  const [, bump] = useState(0);
  const dragY = useRef<number | null>(null);
  const playedKey = useRef<string | null>(null);

  useEffect(() => nyNotifySubscribe(() => bump((n) => n + 1)), []);

  const snap = nyNotifyGetSnapshot();
  const { current, phase, sheet, durationMs } = snap;
  const controls = nyHostControls();

  useEffect(() => {
    if (!current || phase !== "in") return;
    const sig = `${current.key}:${current.count}:${current.kind}`;
    if (playedKey.current === sig) return;
    playedKey.current = sig;
    // Play feedback only when the caller didn't already (keyed once per show).
    if (current.kind === "reward" || current.kind === "celebrate") {
      AudioManager.playSfx("reward-coin");
    }
    if (current.kind === "error") {
      void haptic("softMedium");
    }
  }, [current, phase]);

  useEffect(() => {
    if (!sheet) return;
    const prev = document.activeElement as HTMLElement | null;
    const root = document.getElementById("ny-sheet");
    const focusable = root?.querySelector<HTMLElement>("button, [href], [tabindex]:not([tabindex='-1'])");
    focusable?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        nyConfirmClose(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [sheet]);

  const onPointerDown = (event: ReactPointerEvent) => {
    dragY.current = event.clientY;
    controls.pauseTimer();
  };
  const onPointerUp = (event: ReactPointerEvent) => {
    const start = dragY.current;
    dragY.current = null;
    if (start != null && start - event.clientY > 36) {
      controls.dismiss();
      return;
    }
    controls.resumeTimer();
  };
  const onTapDismiss = () => {
    controls.dismiss();
  };

  const livePlain = (title: string, sub?: string, count = 1) =>
    `${nyResolveText(title, count).replace(/<\/?b>/g, "")}${
      sub ? ` ${nyResolveText(sub, count).replace(/<\/?b>/g, "")}` : ""
    }`;
  const politeText =
    current && current.kind !== "error" && !(current.assertive ?? false)
      ? livePlain(current.title, current.sub, current.count)
      : "";
  const assertiveText =
    current && (current.kind === "error" || current.assertive)
      ? livePlain(current.title, current.sub, current.count)
      : "";

  return (
    <div className="ny-host" aria-hidden={false}>
      <div id="ny-live" className="ny-sr" aria-live="polite" aria-atomic="true">
        {politeText}
      </div>
      <div id="ny-live-alert" className="ny-sr" aria-live="assertive" aria-atomic="true">
        {assertiveText}
      </div>

      {current && phase !== "idle" ? (
        current.kind === "celebrate" ? (
          <div
            className={`ny-celebrate ${phase === "in" ? "in" : "out"}`}
            role="status"
            style={{ top: 115 }}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={() => {
              dragY.current = null;
              controls.resumeTimer();
            }}
            onClick={onTapDismiss}
          >
            <Icon kind="celebrate" />
            <div>
              <div className="t">
                <RichCopy text={nyResolveText(current.title, current.count)} />
              </div>
              {current.rewards?.length ? (
                <div className="rw">
                  {current.rewards.map((reward) => (
                    <span key={reward.label}>
                      <img src={rewardIcon(reward.icon)} alt="" width={14} height={14} />
                      <RichCopy text={reward.label} inlineIcons={false} />
                    </span>
                  ))}
                </div>
              ) : current.sub ? (
                <div className="s" style={{ marginTop: 4, color: "var(--ny-sub)", fontSize: 13 }}>
                  <RichCopy text={nyResolveText(current.sub, current.count)} />
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div
            className={`ny-snack ny-${current.kind} ${phase === "in" ? "in" : "out"}`}
            role={current.kind === "error" || current.assertive ? "alert" : "status"}
            style={{ top: 115, ["--ny-bar" as string]: `${durationMs || 2600}ms` }}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={() => {
              dragY.current = null;
              controls.resumeTimer();
            }}
            onClick={(event) => {
              if ((event.target as HTMLElement).closest(".act")) return;
              onTapDismiss();
            }}
          >
            <Icon kind={current.kind} />
            <div className="tx">
              <div className="t">
                <RichCopy text={nyResolveText(current.title, current.count)} />
              </div>
              {current.sub ? (
                <div className="s">
                  <RichCopy text={nyResolveText(current.sub, current.count)} />
                </div>
              ) : null}
            </div>
            {current.action ? (
              <button
                type="button"
                className="act"
                onClick={(event) => {
                  event.stopPropagation();
                  const run = current.action?.onClick;
                  controls.dismiss();
                  run?.();
                }}
              >
                {current.action.label}
              </button>
            ) : null}
            <div className="bar" aria-hidden="true">
              <i key={`${current.key}-${current.count}-${durationMs}`} />
            </div>
          </div>
        )
      ) : null}

      {sheet ? (
        <>
          <button
            type="button"
            className="ny-dim"
            aria-label="닫기"
            onClick={() => nyConfirmClose(false)}
          />
          <div
            className="ny-sheet"
            id="ny-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ny-t"
          >
            <img className="cat" src={CAT} alt="" />
            <h3 id="ny-t">{sheet.title}</h3>
            <p>{sheet.body}</p>
            {sheet.badge ? (
              <div className="ny-sheet-badge">
                <img src={PAW} alt="" width={16} height={16} />
                {sheet.badge}
              </div>
            ) : null}
            <div className="btns">
              <button type="button" className="c" onClick={() => nyConfirmClose(false)}>
                {sheet.cancelLabel ?? "취소"}
              </button>
              <button type="button" className="o" onClick={() => nyConfirmClose(true)}>
                {sheet.confirmLabel ?? "확인"}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
