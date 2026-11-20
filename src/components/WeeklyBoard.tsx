import { useState } from "react";

import { menuAsset } from "../lib/menuConfig";
import { nyNotify } from "../lib/nyangNotify";
import type { OpsEconomy, OpsState } from "../lib/opsTypes";
import {
  FALLBACK_WEEKLY_RULES,
  recountWeekly,
  weekRangeLabel,
  weeklyChestViews,
  weeklyMissionRows,
  WEEKLY_STAMP_MAX,
  type WeeklyChestKind,
} from "../lib/weeklyMissions";
import { claimWeeklyFromBoard, refreshWeekly } from "../lib/weeklySync";

type Props = {
  ops: OpsState;
  economy: OpsEconomy;
  onOpsChange: (next: OpsState) => void;
};

export function WeeklyBoard({ ops, economy, onOpsChange }: Props) {
  const [busy, setBusy] = useState<WeeklyChestKind | "invite" | null>(null);
  const view = refreshWeekly(ops, economy);
  const bag = view.weekly;
  const log = bag?.current;
  if (!log || !bag) return null;
  const rules = bag.rules ?? FALLBACK_WEEKLY_RULES;
  const progress = recountWeekly(log);
  const chests = weeklyChestViews(log, bag.claimed, rules);
  const missions = weeklyMissionRows(log);
  const inviteClaimed = bag.claimed.includes("invite");

  const claim = async (kind: WeeklyChestKind) => {
    if (busy) return;
    setBusy(kind);
    try {
      const result = await claimWeeklyFromBoard(ops, kind, economy);
      onOpsChange(result.state);
      if (result.message) {
        nyNotify({ key: "weekly-claim", kind: "info", title: result.message });
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="wm-board">
      <div className="wm-summary">
        <div>
          <p className="wm-range">{weekRangeLabel(log.weekKey)}</p>
          <p className="wm-stamps">
            도장 <b>{progress.stamps}</b>/{WEEKLY_STAMP_MAX}
          </p>
        </div>
        <p className="wm-reset">월요일 0시에 리셋</p>
      </div>
      <div className="wm-chests">
        {chests.map((chest) => (
          <button
            key={chest.kind}
            type="button"
            className={`wm-chest is-${chest.state}`}
            disabled={chest.state !== "ready" || busy != null}
            onClick={() => void claim(chest.kind)}
          >
            <span className="wm-chest-need">{chest.need}</span>
            <span className="wm-chest-lines">
              {chest.lines.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </span>
            <span className="wm-chest-action">
              {chest.state === "claimed" ? "받음" : chest.state === "ready" ? "받기" : "잠김"}
            </span>
          </button>
        ))}
      </div>
      <ul className="wm-list">
        {missions.map((mission) => (
          <li key={mission.id} className={mission.done ? "is-done" : undefined}>
            <img src={menuAsset(mission.icon)} alt="" />
            <span className="wm-copy">
              <span className="wm-title">{mission.title}</span>
              <span className="wm-count">
                {mission.current}/{mission.target}
              </span>
            </span>
            <span className={`wm-stamp${mission.done ? " is-done" : ""}`}>도장 {mission.stamps}</span>
          </li>
        ))}
        <li className={log.inviteDone ? "is-done" : undefined}>
          <img src={menuAsset("icon-invite.svg")} alt="" />
          <span className="wm-copy">
            <span className="wm-title">친구 초대하기</span>
            <span className="wm-count">{log.inviteDone ? "1/1" : "0/1"}</span>
          </span>
          {log.inviteDone && !inviteClaimed ? (
            <button type="button" className="wm-bonus is-ready" disabled={busy != null} onClick={() => void claim("invite")}>
              받기
            </button>
          ) : (
            <span className={`wm-bonus${inviteClaimed ? " is-done" : ""}`}>
              {inviteClaimed ? "받음" : `선택 · 젤리 ${rules.inviteJelly}`}
            </span>
          )}
        </li>
      </ul>
    </div>
  );
}
