import { useEffect, useMemo, useState, type ReactNode } from "react";

import { AudioManager } from "../audio/AudioManager";
import {
  EMPTY_RIBBON_COPY,
  achvBadgeSrc,
  buildAchvClaimRequestId,
  buildAchvProgressList,
  claimableAchvCount,
  claimableCategories,
  computeAchvMetrics,
  equipAchievementTitle,
  loadAchievementsConfig,
  postAchievementClaim,
  type AchvCategory,
  type AchvConfig,
  type AchvProgress,
  type AchvTabId,
} from "../lib/achievements";
import { ncoinIcon } from "../lib/ncoinIcon";
import { nyNotify } from "../lib/nyangNotify";
import type { OpsState } from "../lib/opsTypes";
import "./AchievementsSheet.css";

type AchievementsSheetProps = {
  ops: OpsState;
  onOpsChange: (next: OpsState) => void;
  onClose: () => void;
  /** Open directly on a title detail (from snackbar CTA). */
  initialTitleId?: string | null;
};

type View = "grid" | "detail" | "celebrate";

const TABS: Array<{ id: AchvTabId; label: string }> = [
  { id: "all", label: "전체" },
  { id: "수집", label: "수집" },
  { id: "뽑기", label: "뽑기" },
  { id: "출석", label: "출석" },
  { id: "방꾸미기", label: "방꾸미기" },
  { id: "교환", label: "교환" },
];

export function AchievementsSheet({
  ops,
  onOpsChange,
  onClose,
  initialTitleId = null,
}: AchievementsSheetProps) {
  const [config, setConfig] = useState<AchvConfig | null>(null);
  const [list, setList] = useState<AchvProgress[]>([]);
  const [tab, setTab] = useState<AchvTabId>("all");
  const [view, setView] = useState<View>("grid");
  const [selected, setSelected] = useState<AchvProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const [celebrate, setCelebrate] = useState<AchvProgress | null>(null);
  const [openedInitial, setOpenedInitial] = useState(false);

  const refresh = async (state: OpsState) => {
    try {
      const cfg = config ?? (await loadAchievementsConfig());
      if (!config) setConfig(cfg);
      const metrics = await computeAchvMetrics(state);
      const next = buildAchvProgressList(cfg, state, metrics);
      setList(next);
      return next;
    } catch {
      return list;
    }
  };

  useEffect(() => {
    void refresh(ops);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ops.claimedAchievementIds, ops.equippedTitleId, ops.lifetimeDraws, ops.attendanceDays]);

  useEffect(() => {
    if (openedInitial || !initialTitleId || !list.length) return;
    const row = list.find((item) => item.def.id === initialTitleId);
    if (!row) return;
    setSelected(row);
    setView("detail");
    setOpenedInitial(true);
  }, [initialTitleId, list, openedInitial]);

  const dots = useMemo(() => claimableCategories(list), [list]);
  const claimable = claimableAchvCount(list);
  const ownedCount = list.filter(
    (item) => item.status === "owned" || item.status === "equipped",
  ).length;
  const equipped = list.find((item) => item.status === "equipped") ?? null;
  const filtered = useMemo(
    () => (tab === "all" ? list : list.filter((item) => item.def.category === tab)),
    [list, tab],
  );

  const runClaim = async (item: AchvProgress) => {
    if (busy || item.status !== "claimable") return;
    setBusy(true);
    try {
      const result = await postAchievementClaim(ops, {
        ids: [item.def.id],
        requestId: buildAchvClaimRequestId(),
      });
      if (!result.response.ok) {
        nyNotify({
          key: "achv-claim-fail",
          kind: "error",
          title: result.response.reason,
        });
        return;
      }
      onOpsChange(result.state);
      const nextList = await refresh(result.state);
      const updated =
        nextList.find((row) => row.def.id === item.def.id) ??
        ({ ...item, status: "owned" as const } satisfies AchvProgress);
      setCelebrate(updated);
      setSelected(updated);
      setView("celebrate");
      AudioManager.playSfx("reward-coin");
      nyNotify({
        key: `achv-claim:${item.def.id}`,
        kind: "reward",
        title: `<b>${item.def.title}</b> 칭호 보상`,
        sub:
          item.def.reward.nyangCoin > 0
            ? `{ncoin}+${item.def.reward.nyangCoin} · {paw}+${item.def.reward.paw}P`
            : `{paw}+${item.def.reward.paw}P`,
        duration: 3200,
      });
    } finally {
      setBusy(false);
    }
  };

  const runEquip = async (item: AchvProgress) => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await equipAchievementTitle(ops, item.def.id);
      if (!result.ok) {
        nyNotify({
          key: "achv-equip-fail",
          kind: "error",
          title: result.reason ?? "장착할 수 없어요",
        });
        return;
      }
      onOpsChange(result.state);
      const nextList = await refresh(result.state);
      const updated = nextList.find((row) => row.def.id === item.def.id) ?? {
        ...item,
        status: "equipped" as const,
      };
      setSelected(updated);
      setCelebrate(null);
      setView("detail");
      nyNotify({
        key: "achv-equip",
        kind: "success",
        title: `<b>${item.def.title}</b> 칭호를 달았어요`,
      });
    } finally {
      setBusy(false);
    }
  };

  const ringPct = list.length ? Math.min(100, (ownedCount / list.length) * 100) : 0;

  return (
    <div className="achv-root" role="dialog" aria-modal="true" aria-label="칭호">
      <button type="button" className="achv-dim" aria-label="닫기" onClick={onClose} />
      <div id="sheet-title" className={`achv-sheet ${view !== "grid" ? "is-detail" : ""}`}>
        {view === "grid" ? (
          <>
            <div className="achv-handle" aria-hidden="true" />
            <header className="achv-head">
              <div className="achv-head-copy">
                <h2>칭호</h2>
                <p className="achv-head-sub">
                  달고 있는 칭호 ·{" "}
                  <em>{equipped?.def.title ?? EMPTY_RIBBON_COPY.split(" · ")[0]}</em>
                  {claimable > 0 ? ` · 받을 보상 ${claimable}개` : null}
                </p>
              </div>
              <div
                className="achv-ring"
                style={{ background: `conic-gradient(#3ecf9a ${ringPct}%, #e6ddd0 ${ringPct}%)` }}
                aria-label={`${ownedCount}/${list.length || 20}`}
              >
                <span>
                  {ownedCount}/{list.length || 20}
                </span>
              </div>
              <button type="button" className="achv-close" aria-label="닫기" onClick={onClose}>
                ✕
              </button>
            </header>
            <div className="achv-tabs" role="tablist" aria-label="칭호 분류">
              {TABS.map((row) => {
                const hasDot =
                  row.id === "all" ? dots.size > 0 : dots.has(row.id as AchvCategory);
                return (
                  <button
                    key={row.id}
                    type="button"
                    id={`title-tab-${row.id === "all" ? "all" : categoryTabSlug(row.id)}`}
                    role="tab"
                    aria-selected={tab === row.id}
                    className={`achv-tab ${tab === row.id ? "is-on" : ""} ${hasDot ? "has-dot" : ""}`}
                    onClick={() => setTab(row.id)}
                  >
                    {row.label}
                    {hasDot ? <i /> : null}
                  </button>
                );
              })}
            </div>
            <div className="achv-grid">
              {filtered.map((item) => (
                <button
                  key={item.def.id}
                  type="button"
                  id={`title-tile-${item.def.id}`}
                  className={`achv-cell ${item.status === "claimable" ? "is-claimable" : ""} ${
                    item.status === "locked" ? "is-locked" : ""
                  } ${item.status === "equipped" ? "is-equipped" : ""}`}
                  onClick={() => {
                    setSelected(item);
                    setView("detail");
                  }}
                >
                  <span className="achv-cell-badge-wrap">
                    <img src={achvBadgeSrc(item.def.id)} alt="" />
                    {item.status === "claimable" ? <i className="achv-cell-dot" /> : null}
                  </span>
                  <span className="achv-cell-name">{item.def.title}</span>
                  {item.status === "equipped" ? <em className="achv-equip-tag">장착</em> : null}
                </button>
              ))}
            </div>
          </>
        ) : null}

        {view === "detail" && selected ? (
          <AchvDetail
            item={selected}
            busy={busy}
            onBack={() => setView("grid")}
            onClaim={() => void runClaim(selected)}
            onEquip={() => void runEquip(selected)}
          />
        ) : null}

        {view === "celebrate" && celebrate ? (
          <div id="sheet-achv-claim" className="achv-celebrate">
            <div className="achv-celebrate-rays" aria-hidden="true" />
            <img src={achvBadgeSrc(celebrate.def.id)} alt="" width={132} height={132} />
            <p className="achv-celebrate-eyebrow">NEW TITLE</p>
            <h3>새 칭호를 얻었어요</h3>
            <div className="achv-celebrate-pill">
              <img src={achvBadgeSrc(celebrate.def.id)} alt="" width={22} height={22} />
              <span>{celebrate.def.title}</span>
            </div>
            <p className="achv-celebrate-cond">
              {celebrate.def.name} 업적을 달성했어요
            </p>
            <div className="achv-celebrate-rewards">
              {celebrate.def.reward.nyangCoin > 0 ? (
                <span>
                  <img src={ncoinIcon(18)} alt="" width={18} height={18} />+
                  {celebrate.def.reward.nyangCoin} 냥코인
                </span>
              ) : null}
              <span>
                <img src="/assets/menu/icon-paw-mini-dark.svg" alt="" width={16} height={16} />+
                {celebrate.def.reward.paw} 포인트
              </span>
            </div>
            <div className="achv-celebrate-actions">
              <button
                type="button"
                className="achv-cta is-soft"
                onClick={() => {
                  setCelebrate(null);
                  setView("detail");
                }}
              >
                닫기
              </button>
              <button
                type="button"
                className="achv-cta is-mint"
                disabled={busy}
                onClick={() => void runEquip(celebrate)}
              >
                칭호 달기
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function categoryTabSlug(id: AchvTabId) {
  switch (id) {
    case "수집":
      return "collect";
    case "뽑기":
      return "draw";
    case "출석":
      return "attend";
    case "방꾸미기":
      return "room";
    case "교환":
      return "exchange";
    default:
      return "all";
  }
}

function AchvDetail({
  item,
  busy,
  onBack,
  onClaim,
  onEquip,
}: {
  item: AchvProgress;
  busy: boolean;
  onBack: () => void;
  onClaim: () => void;
  onEquip: () => void;
}) {
  const statusLabel =
    item.status === "claimable"
      ? "달성! 보상을 받을 수 있어요"
      : item.status === "equipped" || item.status === "owned"
        ? "얻은 칭호"
        : "진행 중";

  let cta: ReactNode;
  if (item.status === "claimable") {
    cta = (
      <button
        type="button"
        id={`btn-achv-claim-${item.def.id}`}
        className="achv-cta is-mint"
        disabled={busy}
        onClick={onClaim}
      >
        보상 받기
      </button>
    );
  } else if (item.status === "owned") {
    cta = (
      <button
        type="button"
        id={`btn-title-equip-${item.def.id}`}
        className="achv-cta is-navy"
        disabled={busy}
        onClick={onEquip}
      >
        달기
      </button>
    );
  } else if (item.status === "equipped") {
    cta = (
      <button type="button" className="achv-cta is-ghost" disabled>
        달고 있어요
      </button>
    );
  } else {
    cta = (
      <button type="button" className="achv-cta is-ghost" disabled>
        진행 중 · {item.remaining}
        {item.unit} 남았어요
      </button>
    );
  }

  const seriesValue = item.currentRaw;

  return (
    <div id={`title-detail-${item.def.id}`} className="achv-detail">
      <div className="achv-handle" aria-hidden="true" />
      <button type="button" className="achv-back" onClick={onBack}>
        ‹ 칭호 목록
      </button>
      <div className={`achv-detail-badge-wrap ${item.status === "claimable" ? "is-glow" : ""}`}>
        <img
          className={`achv-detail-badge ${item.status === "locked" ? "is-locked" : ""}`}
          src={achvBadgeSrc(item.def.id)}
          alt=""
        />
      </div>
      <span className={`achv-status-chip is-${item.status}`}>{statusLabel}</span>
      <h3>{item.def.title}</h3>
      <p className="achv-detail-cond">
        {item.def.category} · {item.def.name} ({item.def.condition})
      </p>
      <div className="achv-progress-card">
        <div className="achv-progress">
          <div className="achv-progress-bar">
            <i style={{ width: `${Math.min(100, (item.current / Math.max(1, item.target)) * 100)}%` }} />
          </div>
          <span>
            {item.current}/{item.target}
          </span>
        </div>
        {item.seriesSteps?.length ? (
          <div className="achv-series" aria-label="단계">
            <p className="achv-series-label">
              단계 · 지금 {seriesValue}
              {item.unit}
            </p>
            <div className="achv-series-track">
              {item.seriesSteps.map((step, index) => {
                const done = seriesValue >= step.target;
                const current = step.id === item.def.id;
                return (
                  <div
                    key={step.id}
                    className={`achv-series-node ${done ? "is-on" : ""} ${
                      current ? "is-current" : ""
                    }`}
                  >
                    {index > 0 ? <i className="achv-series-line" /> : null}
                    <span className="achv-series-dot">{done ? "✓" : step.target}</span>
                    <em>{step.title}</em>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
      <div className="achv-reward-block">
        <p>보상</p>
        <div className="achv-reward-row">
          {item.def.reward.nyangCoin > 0 ? (
            <span>
              <img src={ncoinIcon(16)} alt="" width={16} height={16} />+
              {item.def.reward.nyangCoin} 냥코인
            </span>
          ) : null}
          <span>
            <img src="/assets/menu/icon-paw-mini-dark.svg" alt="" width={14} height={14} />+
            {item.def.reward.paw} P
          </span>
        </div>
      </div>
      <div className="achv-detail-cta">{cta}</div>
    </div>
  );
}
