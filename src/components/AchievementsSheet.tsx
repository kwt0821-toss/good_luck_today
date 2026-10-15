import { useEffect, useMemo, useState, type ReactNode } from "react";

import {
  achvBadgeSrc,
  buildAchvClaimRequestId,
  buildAchvProgressList,
  claimableTabs,
  computeAchvMetrics,
  equipAchievementTitle,
  loadAchievementsConfig,
  postAchievementClaim,
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
};

type View = "grid" | "detail" | "celebrate";

export function AchievementsSheet({ ops, onOpsChange, onClose }: AchievementsSheetProps) {
  const [config, setConfig] = useState<AchvConfig | null>(null);
  const [list, setList] = useState<AchvProgress[]>([]);
  const [tab, setTab] = useState<AchvTabId>("all");
  const [view, setView] = useState<View>("grid");
  const [selected, setSelected] = useState<AchvProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const [celebrate, setCelebrate] = useState<AchvProgress | null>(null);

  const refresh = async (state: OpsState) => {
    try {
      const cfg = config ?? (await loadAchievementsConfig());
      if (!config) setConfig(cfg);
      const metrics = await computeAchvMetrics(state);
      setList(buildAchvProgressList(cfg, state, metrics));
    } catch {
      // keep previous list on transient metric failures
    }
  };

  useEffect(() => {
    void refresh(ops);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ops.claimedAchievementIds, ops.equippedTitleId, ops.lifetimeDraws, ops.attendanceDays]);

  const dots = useMemo(() => claimableTabs(list), [list]);
  const filtered = useMemo(
    () => (tab === "all" ? list : list.filter((item) => item.def.tab === tab)),
    [list, tab],
  );

  const runClaim = async (item: AchvProgress) => {
    if (busy || item.status !== "claimable") return;
    setBusy(true);
    try {
      const result = await postAchievementClaim(ops, {
        titleId: item.def.id,
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
      const metrics = await computeAchvMetrics(result.state);
      const cfg = config ?? (await loadAchievementsConfig());
      const nextList = buildAchvProgressList(cfg, result.state, metrics);
      setList(nextList);
      const updated = nextList.find((row) => row.def.id === item.def.id) ?? {
        ...item,
        status: "equipped" as const,
      };
      setCelebrate(updated);
      setView("celebrate");
      nyNotify({
        key: `achv-claim:${item.def.id}`,
        kind: "reward",
        title: `<b>${item.def.nameKo}</b> 칭호 보상`,
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
      await refresh(result.state);
      setSelected((prev) =>
        prev && prev.def.id === item.def.id ? { ...prev, status: "equipped" } : prev,
      );
      nyNotify({
        key: "achv-equip",
        kind: "success",
        title: `<b>${item.def.nameKo}</b> 칭호를 달았어요`,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="achv-root" role="dialog" aria-modal="true" aria-label="칭호">
      <button type="button" className="achv-dim" aria-label="닫기" onClick={onClose} />
      <div className={`achv-sheet ${view !== "grid" ? "is-detail" : ""}`}>
        {view === "grid" ? (
          <>
            <header className="achv-head">
              <div>
                <p className="achv-eyebrow">TITLES</p>
                <h2>칭호</h2>
              </div>
              <button type="button" className="achv-close" aria-label="닫기" onClick={onClose}>
                ✕
              </button>
            </header>
            <div className="achv-tabs" role="tablist" aria-label="칭호 분류">
              {(config?.tabs ?? []).map((row) => {
                const hasDot = row.id === "all" ? dots.size > 0 : dots.has(row.id);
                return (
                  <button
                    key={row.id}
                    type="button"
                    role="tab"
                    aria-selected={tab === row.id}
                    className={`achv-tab ${tab === row.id ? "is-on" : ""} ${hasDot ? "has-dot" : ""}`}
                    onClick={() => setTab(row.id)}
                  >
                    {row.labelKo}
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
                  <span className="achv-cell-name">{item.def.nameKo}</span>
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
          <div className="achv-celebrate">
            <img src={achvBadgeSrc(celebrate.def.id)} alt="" width={88} height={88} />
            <p className="achv-celebrate-eyebrow">칭호 획득</p>
            <h3>{celebrate.def.nameKo}</h3>
            <div className="achv-celebrate-rewards">
              {celebrate.def.reward.nyangCoin > 0 ? (
                <span>
                  <img src={ncoinIcon(18)} alt="" width={18} height={18} />+
                  {celebrate.def.reward.nyangCoin}
                </span>
              ) : null}
              <span>
                <img src="/assets/menu/icon-paw-mini-dark.svg" alt="" width={16} height={16} />+
                {celebrate.def.reward.paw}P
              </span>
            </div>
            <button
              type="button"
              className="achv-cta"
              onClick={() => {
                setCelebrate(null);
                setSelected(celebrate);
                setView("detail");
              }}
            >
              확인
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
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
      ? "받을 수 있어요"
      : item.status === "equipped"
        ? "장착 중"
        : item.status === "owned"
          ? "보유"
          : "진행 중";

  let cta: ReactNode;
  if (item.status === "claimable") {
    cta = (
      <button type="button" className="achv-cta" disabled={busy} onClick={onClaim}>
        보상 받기
      </button>
    );
  } else if (item.status === "owned") {
    cta = (
      <button type="button" className="achv-cta" disabled={busy} onClick={onEquip}>
        달기
      </button>
    );
  } else if (item.status === "equipped") {
    cta = (
      <button type="button" className="achv-cta is-ghost" disabled>
        장착 중
      </button>
    );
  } else {
    cta = (
      <button type="button" className="achv-cta is-ghost" disabled>
        진행 중 · {item.remaining}개 남았어요
      </button>
    );
  }

  return (
    <div className="achv-detail">
      <button type="button" className="achv-back" onClick={onBack} aria-label="뒤로">
        ‹
      </button>
      <img className="achv-detail-badge" src={achvBadgeSrc(item.def.id)} alt="" />
      <span className={`achv-status-chip is-${item.status}`}>{statusLabel}</span>
      <h3>{item.def.nameKo}</h3>
      <p className="achv-detail-cond">{item.def.conditionCopy}</p>
      <div className="achv-progress">
        <div className="achv-progress-bar">
          <i style={{ width: `${Math.min(100, (item.current / item.target) * 100)}%` }} />
        </div>
        <span>
          {item.current}/{item.target}
        </span>
      </div>
      {item.seriesSteps?.length ? (
        <div className="achv-series" aria-label="단계">
          {item.seriesSteps.map((step) => (
            <span
              key={step}
              className={`achv-series-step ${item.current >= step ? "is-on" : ""} ${
                item.target === step ? "is-current" : ""
              }`}
            >
              {step}
            </span>
          ))}
        </div>
      ) : null}
      <div className="achv-reward-row">
        {item.def.reward.nyangCoin > 0 ? (
          <span>
            <img src={ncoinIcon(16)} alt="" width={16} height={16} />
            냥코인 {item.def.reward.nyangCoin}
          </span>
        ) : null}
        <span>
          <img src="/assets/menu/icon-paw-mini-dark.svg" alt="" width={14} height={14} />
          {item.def.reward.paw}P
        </span>
      </div>
      {cta}
    </div>
  );
}
