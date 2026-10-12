import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import { AudioManager } from "../audio/AudioManager";
import { menuAsset } from "../lib/menuConfig";
import {
  attendanceSheetState,
  buildMenuViewModel,
  daysToMilestone,
  type MenuViewModel,
} from "../lib/menuModel";
import {
  loadMenuSettings,
  saveMenuSettings,
  shouldReduceMenuMotion,
  type MenuSettings,
} from "../lib/menuSettings";
import {
  claimAttendanceGift,
  collectAllRewards,
  convertAllDuplicates,
} from "../lib/opsRewards";
import type { OpsState } from "../lib/opsTypes";
import type { MenuSheetId } from "../lib/menuTypes";
import { haptic } from "../lib/native";
import "./MenuPanel.css";

type MenuPanelProps = {
  open: boolean;
  ops: OpsState;
  onClose: () => void;
  onOpsChange: (next: OpsState) => void;
  onOpenDex: () => void;
  onOpenRoom: () => void;
  onPawAd: () => void;
  onReplayTutorial: () => void;
};

function formatMeta(text: string) {
  // Highlight trailing numbers / fractions for amber weight via <b>
  const parts = text.split(/(\d+(?:\/\d+)?%?|장)/g);
  return parts.map((part, index) =>
    /^\d/.test(part) || part === "장" ? <b key={index}>{part}</b> : <span key={index}>{part}</span>,
  );
}

export function MenuPanel({
  open,
  ops,
  onClose,
  onOpsChange,
  onOpenDex,
  onOpenRoom,
  onPawAd,
  onReplayTutorial,
}: MenuPanelProps) {
  const [model, setModel] = useState<MenuViewModel | null>(null);
  const [closing, setClosing] = useState(false);
  const [sheet, setSheet] = useState<MenuSheetId>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [ratesTab, setRatesTab] = useState<"normal" | "rateUp">("normal");
  const [settings, setSettings] = useState<MenuSettings>(() => loadMenuSettings());
  const [toast, setToast] = useState<string | null>(null);
  const [stampDay, setStampDay] = useState<number | null>(null);
  const [popDay, setPopDay] = useState<number | null>(null);
  const [creditsText, setCreditsText] = useState<string | null>(null);
  const reduce = shouldReduceMenuMotion(settings);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const sheetDrag = useRef<{ y: number; active: boolean }>({ y: 0, active: false });
  const toastTimer = useRef(0);

  useEffect(() => {
    if (!open) return;
    setClosing(false);
    void buildMenuViewModel(ops).then(setModel);
    AudioManager.playSfx("sheet-open");
    AudioManager.setScreen("menu");
  }, [open, ops]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sheet]);

  const requestClose = () => {
    if (sheet) {
      closeSheet();
      return;
    }
    setClosing(true);
    AudioManager.playSfx("sheet-close");
    window.setTimeout(() => {
      setClosing(false);
      onClose();
    }, reduce ? 150 : 220);
  };

  const openSheet = (id: MenuSheetId) => {
    setSheet(id);
    AudioManager.playSfx("sheet-open");
    requestAnimationFrame(() => setSheetOpen(true));
  };

  const closeSheet = () => {
    setSheetOpen(false);
    AudioManager.playSfx("sheet-close");
    window.setTimeout(() => setSheet(null), reduce ? 150 : 280);
  };

  const showToast = (message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1800);
  };

  const onPanelPointerDown = (event: ReactPointerEvent) => {
    swipeStart.current = { x: event.clientX, y: event.clientY };
  };

  const onPanelPointerUp = (event: ReactPointerEvent) => {
    if (!swipeStart.current || !model) return;
    const dx = event.clientX - swipeStart.current.x;
    const dy = Math.abs(event.clientY - swipeStart.current.y);
    swipeStart.current = null;
    if (dx > model.menu.panel.swipeToCloseThresholdPt && dy < 80) requestClose();
  };

  const onSheetPointerDown = (event: ReactPointerEvent) => {
    sheetDrag.current = { y: event.clientY, active: true };
  };

  const onSheetPointerUp = (event: ReactPointerEvent) => {
    if (!sheetDrag.current.active) return;
    const dy = event.clientY - sheetDrag.current.y;
    sheetDrag.current.active = false;
    if (dy > 120) closeSheet();
  };

  const onRow = (open: string, enabled: boolean, id: string) => {
    if (!enabled && id !== "points" && id !== "exchange") return;
    if (open === "action:rewardedAd(paw)") {
      if (!enabled) {
        showToast("내일 다시 열려요");
        return;
      }
      onPawAd();
      return;
    }
    if (open.startsWith("sheet:")) {
      openSheet(open.slice(6) as MenuSheetId);
      return;
    }
    if (open === "page:settings") openSheet("settings");
  };

  const claimAttendance = async () => {
    const result = await claimAttendanceGift(ops);
    if (result.error) {
      showToast(result.error);
      return;
    }
    const day =
      result.response?.phase === "firstWeek"
        ? result.state.attendanceDays
        : (result.response?.cycleDay ?? result.state.attendanceDays);
    setPopDay(day);
    setStampDay(day);
    onOpsChange(result.state);
    void haptic("success");
    window.setTimeout(() => AudioManager.playSfx("stamp"), 180);
    const itemReward = result.response?.rewards.find((reward) => reward.kind === "item");
    const pawReward = result.response?.rewards.find((reward) => reward.kind === "paw");
    const ticketReward = result.response?.rewards.find((reward) => reward.kind === "rateUpTicket");
    window.setTimeout(() => {
      setPopDay(null);
      if (pawReward || ticketReward) AudioManager.playSfx("reward-coin");
      if (itemReward) showToast("서랍에 쏙 넣었어요");
      else if (ticketReward) showToast("확률업 이용권을 받았어요");
      else if (pawReward) showToast(`포인트 +${pawReward.paw}`);
      else showToast("출석 완료!");
    }, 320);
  };

  const doExchange = async () => {
    const result = await convertAllDuplicates(ops);
    if ("error" in result) {
      showToast(result.error);
      return;
    }
    onOpsChange(result.state);
    showToast(`중복 ${result.converted}장 → +${result.gained}P`);
    AudioManager.playSfx("reward-coin");
    void haptic("success");
    closeSheet();
  };

  const doCollectRewards = async () => {
    const result = await collectAllRewards(ops);
    onOpsChange(result.state);
    showToast(result.count ? `보상 ${result.count}개를 받았어요` : "받을 보상이 없어요");
    if (result.count) {
      AudioManager.playSfx("reward-coin");
      void haptic("success");
    }
    closeSheet();
  };

  const patchSettings = (patch: Partial<MenuSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveMenuSettings(next);
  };

  const ratesRows = useMemo(() => {
    if (!model) return [];
    const table =
      ratesTab === "rateUp"
        ? model.config.economy.draws.rates_proposal.rateUp
        : model.config.economy.draws.rates_proposal.normal;
    return model.menu.sheets.rates.rows.map(([key, label, count]) => {
      const rate = table[key] ?? 0;
      const perCard = rate / count;
      const decimals = model.menu.sheets.rates.perCardDecimals;
      const pct = rate * 100;
      return {
        key,
        label,
        count,
        rate,
        percent: Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(1)}%`,
        perCard: `${(perCard * 100).toFixed(decimals)}%`,
        highlight: model.menu.sheets.rates.highlight.includes(key),
      };
    });
  }, [model, ratesTab]);

  const highlightSum = useMemo(() => {
    if (!model) return 0;
    const table =
      ratesTab === "rateUp"
        ? model.config.economy.draws.rates_proposal.rateUp
        : model.config.economy.draws.rates_proposal.normal;
    return model.menu.sheets.rates.highlight.reduce((sum, key) => sum + (table[key] ?? 0), 0);
  }, [model, ratesTab]);

  const rateUpHighlightSum = useMemo(() => {
    if (!model) return 0;
    const table = model.config.economy.draws.rates_proposal.rateUp;
    return model.menu.sheets.rates.highlight.reduce((sum, key) => sum + (table[key] ?? 0), 0);
  }, [model]);

  const formatGradePct = (rate: number) => {
    const pct = rate * 100;
    return Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(1)}%`;
  };

  if (!open && !closing) return null;

  const attState = model ? attendanceSheetState(model.attendance) : "firstWeek";
  const attCopy = model?.menu.sheets.attendance.states?.[attState];
  const attCta = model
    ? model.attendance.canClaimToday
      ? (attCopy?.cta ?? model.menu.sheets.attendance.cta ?? "오늘 출석하기").replace(
          "{todayRewardLabel}",
          model.attendance.todayRewardLabel,
        )
      : (attCopy?.ctaDone ?? model.menu.sheets.attendance.ctaDone ?? "오늘 출석했어요")
    : "";
  const milestoneDaysLeft = model ? daysToMilestone(model.attendance) : null;

  return (
    <div
      className={`menu-root ${open && !closing ? "is-open" : ""} ${closing ? "is-closing" : ""} ${reduce ? "is-reduce" : ""}`}
    >
      <button type="button" className="menu-dim" aria-label="메뉴 닫기" onClick={requestClose} />
      <aside
        className="menu-panel"
        role="dialog"
        aria-modal="true"
        aria-label="메뉴"
        onPointerDown={onPanelPointerDown}
        onPointerUp={onPanelPointerUp}
      >
        {model ? (
          <>
            <div className="menu-panel-head">
              <h2 className="menu-title">
                MENU<span className="dot">.</span>
              </h2>
              <p className="menu-sub">{model.menu.header.subtitle}</p>
              <button type="button" className="menu-close" aria-label="닫기" onClick={requestClose}>
                <img src={menuAsset("icon-close.svg")} alt="" />
              </button>

              <div className="menu-stats">
                <div className="menu-stat">
                  <div className="menu-stat-value">
                    <img src={menuAsset("icon-paw-mini.svg")} alt="" />
                    {model.pawBalance.toLocaleString("ko-KR")}
                  </div>
                  <div className="menu-stat-label">내 포인트</div>
                </div>
                <button
                  type="button"
                  className="menu-stat is-tap"
                  onClick={() => {
                    requestClose();
                    onOpenDex();
                  }}
                >
                  <div className="menu-stat-value">
                    {model.dexOwned}
                    <small>/ {model.dexTotal}</small>
                  </div>
                  <div className="menu-stat-label">도감</div>
                  <div className="menu-stat-bar">
                    <i style={{ width: `${model.dexTotal ? (model.dexOwned / model.dexTotal) * 100 : 0}%` }} />
                  </div>
                </button>
                <button
                  type="button"
                  className="menu-stat is-tap"
                  onClick={() => {
                    requestClose();
                    onOpenRoom();
                  }}
                >
                  <div className="menu-stat-value">Lv.{model.cozyLevel}</div>
                  <div className="menu-stat-label">방 레벨</div>
                </button>
              </div>
            </div>

            <div className="menu-scroll">
              {model.sections.map((section) => (
                <section key={section.id}>
                  <p className="menu-section-label">{section.label}</p>
                  {section.rows.map((row, index) => (
                    <button
                      key={row.id}
                      type="button"
                      className={`menu-row ${row.enabled ? "" : "is-disabled"}`}
                      style={{ animationDelay: reduce ? "0ms" : `${index * 30}ms` }}
                      onClick={() => onRow(row.open, row.enabled, row.id)}
                    >
                      <span className="menu-row-icon">
                        <img src={row.icon} alt="" />
                        {row.badge.type === "dot" ? <span className="menu-dot" /> : null}
                      </span>
                      <span className="menu-row-label">{row.label}</span>
                      <span className="menu-row-meta">
                        {row.badge.type === "pill" || row.badge.type === "pill-new" ? (
                          <span
                            className={`menu-pill ${row.badge.type === "pill-new" ? "is-new" : ""} ${row.badge.type === "pill" && row.badge.tone === "muted" ? "is-muted" : ""}`}
                          >
                            {row.badge.text}
                          </span>
                        ) : null}
                        {row.meta ? <span>{formatMeta(row.meta)}</span> : null}
                      </span>
                      {row.chevron ? (
                        <img className="menu-chevron" src={menuAsset("icon-chevron.svg")} alt="" />
                      ) : (
                        <span />
                      )}
                    </button>
                  ))}
                </section>
              ))}
            </div>

            <div className="menu-footer">
              <span>LUCKY CAT · v1.0.0</span>
              <button type="button" onClick={() => showToast("문의 링크는 곧 연결돼요")}>
                문의하기
              </button>
            </div>
          </>
        ) : null}

        {sheet && model ? (
          <div className={`menu-sheet-root ${sheetOpen ? "is-open" : ""}`}>
            <button type="button" className="menu-sheet-dim" aria-label="시트 닫기" onClick={closeSheet} />
            <div
              className="menu-sheet"
              onPointerDown={onSheetPointerDown}
              onPointerUp={onSheetPointerUp}
              style={{
                minHeight:
                  sheet === "attendance"
                    ? attState === "weeklyCycle"
                      ? 520
                      : 560
                    : sheet === "rates"
                      ? 640
                      : sheet === "settings"
                        ? 520
                        : 420,
              }}
            >
              <div className="menu-grab" />
              <div className="menu-sheet-head">
                <p className="menu-sheet-eye">
                  {sheet === "attendance"
                    ? model.menu.sheets.attendance.eyebrow
                    : sheet === "rates"
                      ? model.menu.sheets.rates.eyebrow
                      : sheet === "exchange"
                        ? model.menu.sheets.exchange.eyebrow
                        : sheet === "rewards"
                          ? model.menu.sheets.rewards.eyebrow
                          : sheet === "settings"
                            ? "SETTINGS"
                            : "NOTICE"}
                </p>
                <h3 className="menu-sheet-title">
                  {sheet === "attendance"
                    ? model.menu.sheets.attendance.title
                    : sheet === "rates"
                      ? model.menu.sheets.rates.title
                      : sheet === "exchange"
                        ? model.menu.sheets.exchange.title
                        : sheet === "rewards"
                          ? model.menu.sheets.rewards.title
                          : sheet === "settings"
                            ? "설정"
                            : "공지·이벤트"}
                </h3>
                <p className="menu-sheet-desc">
                  {sheet === "attendance"
                    ? (attCopy?.desc ?? model.menu.sheets.attendance.desc ?? "").replace(
                        "{day7.nameKo}",
                        model.attendance.firstWeekGifts[6]?.nameKo ?? "캣타워",
                      )
                    : sheet === "rates"
                      ? model.menu.sheets.rates.desc
                      : sheet === "exchange"
                        ? model.menu.sheets.exchange.desc
                        : sheet === "rewards"
                          ? model.menu.sheets.rewards.desc
                          : sheet === "settings"
                            ? "소리·진동·움직임과 계정 안내를 관리해요."
                            : "이벤트와 공지를 확인해요."}
                </p>
                <button
                  type="button"
                  className="menu-close menu-sheet-close"
                  aria-label="닫기"
                  onClick={closeSheet}
                >
                  <img src={menuAsset("icon-close.svg")} alt="" />
                </button>
              </div>

              <div className="menu-sheet-body">
                {sheet === "attendance" && attState === "firstWeek" ? (
                  <>
                    <div className="att-grid">
                      {model.attendance.firstWeekGifts.map((gift) => (
                        <div
                          key={gift.day}
                          className={`att-cell ${gift.day === 7 ? "is-day7" : ""} ${gift.claimed ? "is-claimed" : ""} ${gift.isToday ? "is-today" : ""} ${!gift.claimed && !gift.isToday ? "is-locked" : ""} ${stampDay === gift.day ? "is-stamping" : ""} ${popDay === gift.day ? "is-pop" : ""}`}
                        >
                          <span className="att-day">DAY {gift.day}</span>
                          <img className="att-thumb" src={gift.thumb} alt="" />
                          <span className="att-name">{gift.nameKo}</span>
                          {gift.attendanceOnly ? (
                            <span className="att-only-tag">
                              {model.menu.attendanceOnlyTag?.label ?? "출석 한정"}
                            </span>
                          ) : null}
                          {gift.day === 7 ? <span className="att-day7-note">마지막 날 큰 선물</span> : null}
                          {gift.claimed || stampDay === gift.day ? (
                            <img className="att-stamp" src={menuAsset("icon-stamp.svg")} alt="" />
                          ) : null}
                          {gift.isToday ? (
                            <>
                              <span className="menu-dot" />
                              <span className="att-today-tag">오늘</span>
                            </>
                          ) : null}
                        </div>
                      ))}
                    </div>
                    <div className="att-progress">
                      <span>출석 진행</span>
                      <b>{Math.min(model.attendance.attendanceDays, 7)} / 7일</b>
                    </div>
                    <div className="att-bar">
                      <i
                        style={{
                          width: `${(Math.min(model.attendance.attendanceDays, 7) / 7) * 100}%`,
                        }}
                      />
                    </div>
                  </>
                ) : null}

                {sheet === "attendance" && attState === "weeklyCycle" ? (
                  <>
                    <div className="att-cycle-card">
                      <div>
                        <p className="att-cycle-label">
                          {attCopy && "summaryCard" in attCopy
                            ? attCopy.summaryCard?.title ?? "누적 출석"
                            : "누적 출석"}
                        </p>
                        <p className="att-cycle-value">{model.attendance.attendanceDays}일</p>
                      </div>
                      <div className="att-cycle-meta">
                        {model.attendance.nextMilestone && milestoneDaysLeft != null ? (
                          <p>
                            {(attCopy && "summaryCard" in attCopy
                              ? attCopy.summaryCard?.milestone
                              : "{milestoneLabel}까지 {daysToMilestone}일")
                              ?.replace(
                                "{milestoneLabel}",
                                model.attendance.nextMilestone.labelKo ??
                                  `${model.attendance.nextMilestone.days}일`,
                              )
                              .replace("{daysToMilestone}", String(milestoneDaysLeft))}
                          </p>
                        ) : (
                          <p>다음 기념일을 기다려 주세요</p>
                        )}
                        {model.attendance.nextMilestone?.badgeId || model.attendance.badges[0] ? (
                          <span className="att-badge-pill">
                            {model.attendance.nextMilestone?.labelKo ?? "출석 배지"}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <p className="att-week-label">
                      {model.attendance.cycleNo != null
                        ? `${model.attendance.cycleNo}번째 주`
                        : "이번 주"}
                    </p>
                    <div className="att-week-grid">
                      {model.attendance.weekCells.map((cell) => (
                        <div
                          key={cell.day}
                          className={`att-week-cell ${cell.claimed ? "is-claimed" : ""} ${cell.isToday ? "is-today" : ""} ${stampDay === cell.day ? "is-stamping" : ""} ${popDay === cell.day ? "is-pop" : ""}`}
                        >
                          <span className="att-day">{cell.label}</span>
                          <strong>{cell.rewardLabel}</strong>
                          {cell.claimed || stampDay === cell.day ? (
                            <img className="att-stamp" src={menuAsset("icon-stamp.svg")} alt="" />
                          ) : null}
                          {cell.isToday ? <span className="att-today-tag">오늘</span> : null}
                        </div>
                      ))}
                    </div>
                  </>
                ) : null}

                {sheet === "rates" ? (
                  <>
                    <div className="rates-tabs">
                      {model.menu.sheets.rates.tabs.map((label, index) => (
                        <button
                          key={label}
                          type="button"
                          className={ratesTab === (index === 0 ? "normal" : "rateUp") ? "is-on" : ""}
                          onClick={() => setRatesTab(index === 0 ? "normal" : "rateUp")}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <table className="rates-table">
                      <thead>
                        <tr>
                          <th style={{ width: 74 }}>등급</th>
                          <th> </th>
                          <th style={{ width: 60, textAlign: "right" }}>등급 확률</th>
                          <th style={{ width: 64, textAlign: "right" }}>카드 1장</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ratesRows.map((row) => (
                          <tr key={row.key} className={row.highlight ? "is-hi" : ""}>
                            <td>
                              {row.label}
                              <small className="rates-count"> ({row.count}장)</small>
                            </td>
                            <td>
                              <div className="rates-bar">
                                <i style={{ width: `${Math.min(100, row.rate * 100 * 2)}%` }} />
                              </div>
                            </td>
                            <td className="rates-pct">{row.percent}</td>
                            <td className="rates-one">{row.perCard}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="rates-sum">
                      <span>5성 + 스페셜 + 캐릭터 + 레전드</span>
                      <b>{formatGradePct(highlightSum)}</b>
                    </div>
                    <p className="rates-note">
                      {ratesTab === "normal" ? (
                        <>
                          확률업 뽑기에선 이 합계가 {formatGradePct(rateUpHighlightSum)}로 올라가요
                          <br />
                        </>
                      ) : null}
                      {model.menu.sheets.rates.note}
                    </p>
                  </>
                ) : null}

                {sheet === "exchange" ? (
                  <>
                    <div className="menu-list-row">
                      <span>중복 카드</span>
                      <b>{model.exchange.duplicateCount}장</b>
                    </div>
                    <div className="menu-list-row">
                      <span>받을 포인트</span>
                      <b>{model.exchange.totalPaw.toLocaleString("ko-KR")}P</b>
                    </div>
                  </>
                ) : null}

                {sheet === "rewards" ? (
                  model.rewards.items.length ? (
                    model.rewards.items.map((item) => (
                      <div key={item.id} className={`menu-list-row ${item.collected ? "is-done" : ""}`}>
                        <span>{item.label}</span>
                        <b>
                          {item.paw ? `+${item.paw}P` : ""}
                          {item.paw && item.toss ? " · " : ""}
                          {item.toss ? `토스 ${item.toss}원` : ""}
                          {item.collected ? " · 완료" : ""}
                        </b>
                      </div>
                    ))
                  ) : (
                    <p className="rates-note">아직 받을 보상이 없어요.</p>
                  )
                ) : null}

                {sheet === "notice" ? (
                  <div className="menu-list-row">
                    <span>{model.latestNotice?.title ?? "공지 없음"}</span>
                    <b>NEW</b>
                  </div>
                ) : null}

                {sheet === "settings" ? (
                  <>
                    {(model.menu.rows.settings.items ?? []).map((item) => {
                      if (item.type === "toggle") {
                        const key = item.id as keyof MenuSettings;
                        const on = Boolean(settings[key]);
                        return (
                          <div key={item.id} className="settings-row">
                            <span>{item.label}</span>
                            <button
                              type="button"
                              className={`settings-toggle ${on ? "is-on" : ""}`}
                              aria-pressed={on}
                              onClick={() => patchSettings({ [key]: !on })}
                            >
                              <i />
                            </button>
                          </div>
                        );
                      }
                      if (item.type === "action") {
                        return (
                          <div key={item.id} className="settings-row">
                            <button
                              type="button"
                              className="link"
                              onClick={() => {
                                closeSheet();
                                requestClose();
                                onReplayTutorial();
                              }}
                            >
                              {item.label}
                            </button>
                          </div>
                        );
                      }
                      if (item.type === "text") {
                        return (
                          <div key={item.id} className="settings-row">
                            <span>{item.label}</span>
                            <span>v1.0.0</span>
                          </div>
                        );
                      }
                      return (
                        <div key={item.id} className="settings-row">
                          <button
                            type="button"
                            className="link"
                            onClick={() => {
                              if (item.id === "credits" || item.url?.includes("LICENSES")) {
                                void fetch(item.url ?? "/assets/audio/LICENSES.md")
                                  .then((res) => (res.ok ? res.text() : "라이선스 파일을 찾지 못했어요."))
                                  .then(setCreditsText);
                                return;
                              }
                              showToast("링크는 곧 연결돼요");
                            }}
                          >
                            {item.label}
                          </button>
                        </div>
                      );
                    })}
                    {creditsText ? (
                      <pre className="menu-credits">{creditsText}</pre>
                    ) : null}
                  </>
                ) : null}
              </div>

              {sheet === "attendance" ? (
                <>
                  <button
                    type="button"
                    className="menu-sheet-cta"
                    disabled={!model.attendance.canClaimToday}
                    onClick={() => void claimAttendance()}
                  >
                    {attCta}
                  </button>
                  <p className="menu-sheet-note">
                    {attCopy?.note ?? model.menu.sheets.attendance.note ?? ""}
                  </p>
                </>
              ) : null}

              {sheet === "exchange" ? (
                <button
                  type="button"
                  className="menu-sheet-cta"
                  disabled={model.exchange.duplicateCount <= 0}
                  onClick={() => void doExchange()}
                >
                  {model.menu.sheets.exchange.cta.replace(
                    "{total}",
                    String(model.exchange.totalPaw),
                  )}
                </button>
              ) : null}

              {sheet === "rewards" ? (
                <button
                  type="button"
                  className="menu-sheet-cta"
                  disabled={model.rewards.unclaimedCount <= 0}
                  onClick={() => void doCollectRewards()}
                >
                  {model.menu.sheets.rewards.cta}
                </button>
              ) : null}

              {sheet === "notice" ? (
                <button
                  type="button"
                  className="menu-sheet-cta"
                  onClick={() => {
                    onOpsChange({
                      ...ops,
                      lastSeenNoticeId: model.latestNotice?.id ?? ops.lastSeenNoticeId,
                    });
                    closeSheet();
                  }}
                >
                  확인했어요
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {toast ? <div className="menu-toast">{toast}</div> : null}
      </aside>
    </div>
  );
}
