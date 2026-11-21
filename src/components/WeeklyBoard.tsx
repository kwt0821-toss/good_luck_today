import { menuAsset } from "../lib/menuConfig";
import type { OpsEconomy, OpsState } from "../lib/opsTypes";
import {
  FALLBACK_WEEKLY_RULES,
  chestMailboxLabel,
  recountWeekly,
  weekRangeLabel,
  weeklyChestViews,
  weeklyMissionRows,
  WEEKLY_STAMP_MAX,
} from "../lib/weeklyMissions";
import { refreshWeekly } from "../lib/weeklySync";

type Props = {
  ops: OpsState;
  economy: OpsEconomy;
};

export function WeeklyBoard({ ops, economy }: Props) {
  const view = refreshWeekly(ops, economy);
  const bag = view.weekly;
  const log = bag?.current;
  if (!log || !bag) return null;
  const rules = bag.rules ?? FALLBACK_WEEKLY_RULES;
  const progress = recountWeekly(log);
  const chests = weeklyChestViews(log, bag.claimed, rules);
  const missions = weeklyMissionRows(log);
  const invite = chestMailboxLabel(log.inviteDone, bag.claimed.includes("invite"), bag.mailbox?.current?.invite);

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
        {chests.map((chest) => {
          const mail = chestMailboxLabel(chest.state === "ready", chest.state === "claimed", bag.mailbox?.current?.[chest.kind]);
          return (
            <div key={chest.kind} className={`wm-chest is-${mail.state}`}>
              <span className="wm-chest-need">{chest.need}</span>
              <span className="wm-chest-lines">
                {chest.lines.map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </span>
              <span className="wm-chest-action">{mail.label}</span>
            </div>
          );
        })}
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
          <span className={`wm-bonus is-${invite.state}`}>
            {invite.state === "locked" ? `선택 · 젤리 ${rules.inviteJelly}` : invite.label}
          </span>
        </li>
      </ul>
    </div>
  );
}
