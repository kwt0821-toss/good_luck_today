import { useEffect, useMemo, useRef, useState } from "react";

import { AudioManager } from "../audio/AudioManager";
import { CoinBurst } from "../components/CoinBurst";
import { DexCardSlot } from "../components/DexCardSlot";
import { DexDetailSheet } from "../components/DexDetailSheet";
import {
  TAB_COPY,
  TAB_META,
  cardsOfType,
  dexAsset,
  groupBreedRows,
  groupForCard,
  loadDexCatalog,
  ownedCount,
  shuffleBreedRows,
  shuffleCards,
} from "../lib/dexCatalog";
import { loadDexOwned, markDexCardViewed } from "../lib/dexCollection";
import {
  buildDexClaimRequestId,
  claimableBreedSet,
  claimableForCard,
  claimableTypeSet,
  dexClaimChipLabel,
  listClaimableDexRewards,
  postDexRewardsClaim,
  summarizeClaimable,
  tabsWithClaimable,
  type DexReward,
} from "../lib/dexRewards";
import { haptic } from "../lib/native";
import type { DexCard, DexCatalog, DexOwnedMap, DexTab } from "../lib/dexTypes";
import { convertDuplicate } from "../lib/opsRewards";
import type { OpsState } from "../lib/opsTypes";
import "./DexScreen.css";

export type DexTutorialPhase = "scroll" | "slot" | "claim" | "toast" | "ncoin-after" | null;

type DexScreenProps = {
  onBack: () => void;
  ops: OpsState;
  onOpsChange: (next: OpsState) => void;
  /** Carry-over toast from draw-reveal (tutorial step 2 → 3). */
  floatingToast?: string | null;
  /** Tutorial: drawn card to focus (tab + scroll + claim gate). */
  focusCardId?: string | null;
  tutorialPhase?: DexTutorialPhase;
  reduceMotion?: boolean;
  onTutorialScrollDone?: () => void;
  onTutorialClaimed?: () => void;
};

type CelebrateKind = "breedSet" | "typeSet" | "fullDex";

type CelebrateState = {
  kind: CelebrateKind;
  title: string;
  sub: string;
  paw: number;
  nyangCoin: number;
};

export function DexScreen({
  onBack,
  ops,
  onOpsChange,
  floatingToast = null,
  focusCardId = null,
  tutorialPhase = null,
  reduceMotion = false,
  onTutorialScrollDone,
  onTutorialClaimed,
}: DexScreenProps) {
  const [catalog, setCatalog] = useState<DexCatalog | null>(null);
  const [owned, setOwned] = useState<DexOwnedMap>({});
  const [claimable, setClaimable] = useState<DexReward[]>([]);
  const [tab, setTab] = useState<DexTab>(() => {
    const value = new URLSearchParams(window.location.search).get("tab");
    if (value === "special" || value === "character" || value === "legend" || value === "breed") {
      return value;
    }
    return "breed";
  });
  const [toast, setToast] = useState<string | null>(null);
  const [openCard, setOpenCard] = useState<DexCard | null>(null);
  const [claimBusy, setClaimBusy] = useState(false);
  const [burstToken, setBurstToken] = useState(0);
  const [burstConfetti, setBurstConfetti] = useState(false);
  const [celebrate, setCelebrate] = useState<CelebrateState | null>(null);
  const [scrollLock, setScrollLock] = useState(false);
  const [pulseSlotId, setPulseSlotId] = useState<string | null>(null);
  const toastTimer = useRef(0);
  const scrollDoneRef = useRef(false);
  const tabRefs = useRef<Record<DexTab, HTMLButtonElement | null>>({
    breed: null,
    special: null,
    character: null,
    legend: null,
  });
  const [underline, setUnderline] = useState({ left: 0, width: 56 });
  const tutLocked = Boolean(
    focusCardId && tutorialPhase && tutorialPhase !== "ncoin-after" && tutorialPhase !== "toast",
  );

  const refreshClaimable = async (state: OpsState, map?: DexOwnedMap) => {
    const list = await listClaimableDexRewards(state, map);
    setClaimable(list);
    return list;
  };

  useEffect(() => {
    void Promise.all([loadDexCatalog(), loadDexOwned()]).then(([nextCatalog, nextOwned]) => {
      setCatalog(nextCatalog);
      setOwned(nextOwned);
      void refreshClaimable(ops, nextOwned);
      const cardId = focusCardId ?? new URLSearchParams(window.location.search).get("card");
      if (cardId) {
        const found = nextCatalog.cards.find((item) => item.id === cardId);
        if (found) {
          setTab(found.type);
          if (!focusCardId && (nextOwned[found.id]?.count ?? 0) > 0) setOpenCard(found);
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- boot once; ops claim refresh via claim handlers
  }, []);

  useEffect(() => {
    if (!focusCardId || !catalog) return;
    const found = catalog.cards.find((item) => item.id === focusCardId);
    if (found && tab !== found.type) setTab(found.type);
  }, [focusCardId, catalog, tab]);

  useEffect(() => {
    void refreshClaimable(ops, owned);
  }, [ops.claimedDexRewardIds, owned]);

  useEffect(() => {
    const el = tabRefs.current[tab];
    if (!el) return;
    setUnderline({ left: el.offsetLeft, width: el.offsetWidth });
  }, [tab, catalog, owned, claimable]);

  /** Tutorial 3-1: scroll focused slot to center, then notify (no coach during scroll). */
  useEffect(() => {
    if (tutorialPhase !== "scroll" || !focusCardId || !catalog) return;
    const focus = catalog.cards.find((item) => item.id === focusCardId);
    if (!focus) {
      onTutorialScrollDone?.();
      return;
    }
    if (tab !== focus.type) return;
    if (scrollDoneRef.current) return;

    let cancelled = false;
    setScrollLock(true);
    const scrollMs = reduceMotion ? 0 : 400;

    const run = () => {
      const el = document.getElementById(`dex-slot-${focusCardId}`);
      if (!el) {
        setScrollLock(false);
        onTutorialScrollDone?.();
        return;
      }
      el.scrollIntoView({
        block: "center",
        behavior: reduceMotion ? "auto" : "smooth",
        inline: "nearest",
      });
      window.setTimeout(() => {
        if (cancelled) return;
        scrollDoneRef.current = true;
        setScrollLock(false);
        onTutorialScrollDone?.();
      }, scrollMs);
    };

    const raf = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(run);
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
    };
  }, [tutorialPhase, focusCardId, catalog, tab, reduceMotion, onTutorialScrollDone]);

  useEffect(() => {
    if (tutorialPhase !== "scroll") scrollDoneRef.current = false;
  }, [tutorialPhase]);

  /** Tutorial 3-1: one pulse when the slot coach appears. */
  useEffect(() => {
    if (tutorialPhase !== "slot" || !focusCardId || reduceMotion) {
      setPulseSlotId(null);
      return;
    }
    setPulseSlotId(focusCardId);
    const timer = window.setTimeout(() => setPulseSlotId(null), 400);
    return () => window.clearTimeout(timer);
  }, [tutorialPhase, focusCardId, reduceMotion]);

  const showToast = (message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1600);
  };

  const playClaimFx = (rewards: DexReward[]) => {
    const full = rewards.some((item) => item.kind === "fullDex");
    setBurstConfetti(full);
    setBurstToken((n) => n + 1);
    AudioManager.playSfx("reward-coin");
    void haptic("success");
  };

  const runClaim = async (rewardIds: string[] | "all", celebrateAfter?: CelebrateKind) => {
    if (claimBusy) return;
    if (tutLocked && tutorialPhase !== "claim") return;
    if (
      tutLocked &&
      tutorialPhase === "claim" &&
      focusCardId &&
      rewardIds !== "all" &&
      !rewardIds.some((id) => id.includes(focusCardId))
    ) {
      return;
    }
    setClaimBusy(true);
    try {
      const result = await postDexRewardsClaim(ops, {
        rewardIds,
        requestId: buildDexClaimRequestId(),
      });
      if (!result.response.ok) {
        showToast(result.response.reason);
        return;
      }
      onOpsChange(result.state);
      const claimed = result.claimed;
      await refreshClaimable(result.state, owned);
      playClaimFx(claimed);

      if (
        tutorialPhase === "claim" &&
        focusCardId &&
        claimed.some((item) => item.cardId === focusCardId || item.id === `newCard:${focusCardId}`)
      ) {
        const sum = summarizeClaimable(claimed);
        showToast(
          sum.nyangCoin > 0
            ? `냥코인 ${sum.nyangCoin}개 + ${sum.paw}포인트 받았어요`
            : `+${sum.paw}포인트 받았어요`,
        );
        onTutorialClaimed?.();
        return;
      }

      if (celebrateAfter && claimed.length) {
        const totalPaw = claimed.reduce((sum, item) => sum + item.paw, 0);
        const totalNyang = claimed.reduce((sum, item) => sum + item.nyangCoin, 0);
        const label = claimed[0]?.label ?? "세트 완성";
        setCelebrate({
          kind: celebrateAfter,
          title:
            celebrateAfter === "fullDex"
              ? "도감을 모두 모았어요!"
              : celebrateAfter === "typeSet"
                ? "세트를 완성했어요!"
                : "완성 보상을 받았어요",
          sub: label,
          paw: totalPaw,
          nyangCoin: totalNyang,
        });
      } else if (claimed.length) {
        const sum = summarizeClaimable(claimed);
        showToast(
          sum.nyangCoin > 0
            ? `냥코인 +${sum.nyangCoin} · +${sum.paw}P`
            : `+${sum.paw}P`,
        );
      }
    } finally {
      setClaimBusy(false);
    }
  };

  const totals = catalog?.counts ?? { breed: 0, special: 0, character: 0, legend: 0 };
  const totalCards = catalog?.total ?? 107;
  const breedCards = useMemo(() => (catalog ? cardsOfType(catalog, "breed") : []), [catalog]);
  const specialCards = useMemo(
    () => (catalog ? shuffleCards(cardsOfType(catalog, "special"), "special") : []),
    [catalog],
  );
  const characterCards = useMemo(
    () => (catalog ? shuffleCards(cardsOfType(catalog, "character"), "character") : []),
    [catalog],
  );
  const legendCards = useMemo(
    () => (catalog ? shuffleCards(cardsOfType(catalog, "legend"), "legend") : []),
    [catalog],
  );
  const breedRows = useMemo(() => shuffleBreedRows(groupBreedRows(breedCards)), [breedCards]);

  const tabCounts: Record<DexTab, { owned: number; total: number }> = {
    breed: { owned: ownedCount(breedCards, owned), total: totals.breed },
    special: { owned: ownedCount(specialCards, owned), total: totals.special },
    character: { owned: ownedCount(characterCards, owned), total: totals.character },
    legend: { owned: ownedCount(legendCards, owned), total: totals.legend },
  };
  const ownedTotal =
    tabCounts.breed.owned + tabCounts.special.owned + tabCounts.character.owned + tabCounts.legend.owned;
  const percent = totalCards ? Math.round((ownedTotal / totalCards) * 100) : 0;
  const claimSummary = summarizeClaimable(claimable);
  const claimTabs = tabsWithClaimable(claimable);
  const fullDexReward = claimable.find((item) => item.kind === "fullDex") ?? null;

  const openOwned = (card: DexCard) => {
    setOpenCard(card);
    void haptic("tap");
    void markDexCardViewed(owned, card.id).then(setOwned);
  };

  const onSlot = (card: DexCard) => {
    if (tutLocked) return;
    if ((owned[card.id]?.count ?? 0) > 0) {
      openOwned(card);
      return;
    }
    void haptic("softMedium");
    showToast("아직 만나지 못한 고양이예요");
  };

  return (
    <div className="dex-screen">
      <img className="dex-bg" src={dexAsset("bg-dex.webp")} alt="" />
      <div className="dex-grain" aria-hidden="true" />

      <header className="dex-header">
        <div className="dex-title-row">
          <button
            type="button"
            className="dex-back"
            onClick={onBack}
            aria-label="뒤로 가기"
            disabled={tutLocked}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M15 5l-7 7 7 7"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <p className="dex-eyebrow">고양이 도감</p>
        </div>
        <img className="dex-logo" src={dexAsset("logo-collection.svg")} alt="COLLECTION." />
        <div className="dex-progress-row">
          <p>
            모은 카드 <strong>{ownedTotal}</strong>
            <span> / {totalCards}</span>
          </p>
          <span className="dex-percent">{percent}%</span>
        </div>
        <div className="dex-progress-track">
          <div className="dex-progress-fill" style={{ width: `${percent}%` }} />
        </div>
        {claimSummary.count > 0 ? (
          <div className="dex-claim-chip-row">
            <button
              type="button"
              id="dex-claim-all"
              className="dex-claim-chip"
              disabled={claimBusy || tutLocked}
              aria-label={dexClaimChipLabel(
                claimSummary.count,
                claimSummary.nyangCoin,
                claimSummary.paw,
              )}
              onClick={() => void runClaim("all")}
            >
              <span className="dex-claim-chip-copy">
                <span>받을 보상 {claimSummary.count}개</span>
                {claimSummary.nyangCoin > 0 ? (
                  <span className="dex-claim-chip-reward">
                    <img src="/assets/ncoin/ncoin-16@3x.svg" alt="" width={14} height={14} />
                    <span className="dex-claim-chip-x">x</span>
                    <span className="dex-claim-chip-qty">{claimSummary.nyangCoin}</span>
                  </span>
                ) : null}
                {claimSummary.paw > 0 ? (
                  <span className="dex-claim-chip-reward">
                    <img src="/assets/menu/icon-paw-mini.svg" alt="" width={14} height={14} />
                    <span className="dex-claim-chip-x">x</span>
                    <span className="dex-claim-chip-qty">{claimSummary.paw}</span>
                  </span>
                ) : null}
              </span>
              <em>모두 받기</em>
            </button>
          </div>
        ) : null}
      </header>

      <div className="dex-tabs" role="tablist" aria-label="도감 분류">
        {TAB_META.map((item) => {
          const count = tabCounts[item.id];
          const active = tab === item.id;
          const hasDot = claimTabs.has(item.id);
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`dex-tab ${active ? "is-active" : ""} ${hasDot ? "has-claim-dot" : ""}`}
              ref={(el) => {
                tabRefs.current[item.id] = el;
              }}
              onClick={() => {
                if (!tutLocked) setTab(item.id);
              }}
              disabled={tutLocked}
            >
              {item.label}
              <sup>
                {count.owned}/{count.total}
              </sup>
              {hasDot ? <i className="dex-tab-dot" aria-hidden="true" /> : null}
            </button>
          );
        })}
        <span className="dex-tab-underline" style={{ left: underline.left, width: underline.width }} />
      </div>

      <div className="dex-body" key={tab}>
        {tab === "breed" ? (
          <div className="dex-breed-list">
            {fullDexReward ? (
              <div className="dex-set-claim-banner is-full">
                <div>
                  <p className="dex-set-claim-title">도감 전체 완성</p>
                  <p className="dex-set-claim-meta">
                    냥코인 {fullDexReward.nyangCoin} + {fullDexReward.paw}P
                  </p>
                </div>
                <button
                  type="button"
                  className="dex-set-claim-btn"
                  disabled={claimBusy}
                  onClick={() => void runClaim([fullDexReward.id], "fullDex")}
                >
                  완성 보상 받기
                </button>
              </div>
            ) : null}
            {breedRows.map((row) => {
              const have = row.slots.filter((slot) => (owned[slot.id]?.count ?? 0) > 0).length;
              const complete = have === 5;
              const nameUnlocked = have > 0;
              const setReward = claimableBreedSet(claimable, row.breedId);
              return (
                <section key={row.breedId} className="dex-breed-row">
                  <div className="dex-row-head">
                    <h2 className={nameUnlocked ? "" : "is-locked-name"}>
                      {nameUnlocked ? row.en : "???"}{" "}
                      <span>{nameUnlocked ? row.ko : "???"}</span>
                    </h2>
                    {complete ? (
                      <span className="dex-complete">COMPLETE</span>
                    ) : (
                      <p className="dex-row-count">
                        <b>{have}</b> / 5
                      </p>
                    )}
                  </div>
                  {setReward ? (
                    <div className="dex-set-claim-row">
                      <p>
                        완성 보상 · 냥코인 {setReward.nyangCoin} + {setReward.paw}P
                      </p>
                      <button
                        type="button"
                        className="dex-set-claim-btn is-inline"
                        disabled={claimBusy || tutLocked}
                        onClick={() => void runClaim([setReward.id], "breedSet")}
                      >
                        완성 보상 받기
                      </button>
                    </div>
                  ) : null}
                  <div className="dex-breed-slots">
                    {row.slots.map((card) => {
                      const cardReward = claimableForCard(claimable, card.id);
                      return (
                        <DexCardSlot
                          key={card.id}
                          kind="breed"
                          card={card}
                          record={owned[card.id]}
                          claimable={Boolean(cardReward)}
                          claimBusy={claimBusy}
                          pulse={pulseSlotId === card.id}
                          claimEnabled={
                            !tutLocked ||
                            (tutorialPhase === "claim" && focusCardId === card.id)
                          }
                          onClaim={() => {
                            if (cardReward) void runClaim([cardReward.id]);
                          }}
                          onClick={() => onSlot(card)}
                        />
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        ) : null}

        {tab === "special" || tab === "character" || tab === "legend" ? (
          <GridTab
            tab={tab}
            cards={tab === "special" ? specialCards : tab === "character" ? characterCards : legendCards}
            owned={owned}
            count={tabCounts[tab]}
            claimable={claimable}
            claimBusy={claimBusy}
            typeReward={tutLocked ? null : claimableTypeSet(claimable, tab)}
            pulseSlotId={pulseSlotId}
            focusCardId={focusCardId}
            claimGate={tutorialPhase === "claim"}
            tutLocked={tutLocked}
            onClaimCard={(rewardId) => void runClaim([rewardId])}
            onClaimSet={(rewardId) => void runClaim([rewardId], "typeSet")}
            onSlot={onSlot}
          />
        ) : null}
      </div>

      {scrollLock ? <div className="dex-scroll-lock" aria-hidden="true" /> : null}

      <div className="dex-fade" aria-hidden="true" />

      {openCard && catalog ? (
        <DexDetailSheet
          card={openCard}
          group={groupForCard(catalog, openCard)}
          owned={owned}
          onClose={() => setOpenCard(null)}
          onChangeCard={setOpenCard}
          onConvertDuplicate={(card) => {
            void (async () => {
              const result = await convertDuplicate(ops, card);
              if ("error" in result) {
                showToast(result.error);
                return;
              }
              onOpsChange(result.state);
              setOwned(result.owned);
              showToast(`중복 카드 → +${result.gained}포인트`);
              void haptic("success");
            })();
          }}
        />
      ) : null}

      {celebrate ? (
        <div
          className={`dex-celebrate ${celebrate.kind === "fullDex" ? "is-fullscreen" : ""} ${celebrate.kind === "typeSet" ? "is-big" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="dex-celebrate-title"
        >
          <button
            type="button"
            className="dex-celebrate-dim"
            aria-label="닫기"
            onClick={() => setCelebrate(null)}
          />
          <div className="dex-celebrate-sheet">
            <p className="dex-celebrate-eyebrow">
              {celebrate.kind === "fullDex"
                ? "FULL COLLECTION"
                : celebrate.kind === "typeSet"
                  ? "SET COMPLETE"
                  : "REWARD"}
            </p>
            <h3 id="dex-celebrate-title">{celebrate.title}</h3>
            <p className="dex-celebrate-sub">{celebrate.sub}</p>
            <div className="dex-celebrate-loot">
              {celebrate.nyangCoin > 0 ? (
                <span>
                  <img src="/assets/ncoin/ncoin-16@3x.svg" alt="" width={18} height={18} />
                  냥코인 +{celebrate.nyangCoin}
                </span>
              ) : null}
              <span>+{celebrate.paw}P</span>
            </div>
            <button type="button" className="dex-celebrate-cta" onClick={() => setCelebrate(null)}>
              좋아요
            </button>
          </div>
        </div>
      ) : null}

      <CoinBurst token={burstToken} confetti={burstConfetti} count={burstConfetti ? 32 : 12} />

      {toast ? (
        <div className="local-toast" role="status">
          {toast}
        </div>
      ) : null}

      {floatingToast ? (
        <div className="draw-reveal-toast dex-floating-toast" id="dex-toast" role="status">
          <div className="ic" aria-hidden="true">
            <img src="/assets/ncoin/ncoin-16@3x.svg" alt="" width={18} height={18} />
          </div>
          <div>{floatingToast}</div>
        </div>
      ) : null}
    </div>
  );
}

function GridTab({
  tab,
  cards,
  owned,
  count,
  claimable,
  claimBusy,
  typeReward,
  pulseSlotId,
  focusCardId,
  claimGate,
  tutLocked,
  onClaimCard,
  onClaimSet,
  onSlot,
}: {
  tab: Exclude<DexTab, "breed">;
  cards: DexCard[];
  owned: DexOwnedMap;
  count: { owned: number; total: number };
  claimable: DexReward[];
  claimBusy: boolean;
  typeReward: DexReward | null;
  pulseSlotId: string | null;
  focusCardId: string | null;
  claimGate: boolean;
  tutLocked: boolean;
  onClaimCard: (rewardId: string) => void;
  onClaimSet: (rewardId: string) => void;
  onSlot: (card: DexCard) => void;
}) {
  const copy = TAB_COPY[tab];
  const comingSoon = tab === "character" ? 2 : 0;

  return (
    <section className={`dex-grid-wrap is-${tab}`}>
      <div className="dex-row-head">
        <h2>
          {copy.en} <span>{copy.ko}</span>
        </h2>
        <p className="dex-row-count">
          <b>{count.owned}</b> / {count.total}
        </p>
      </div>
      <p className="dex-note">{copy.note}</p>
      {typeReward ? (
        <div className="dex-set-claim-banner">
          <div>
            <p className="dex-set-claim-title">{typeReward.label}</p>
            <p className="dex-set-claim-meta">
              냥코인 {typeReward.nyangCoin} + {typeReward.paw}P
            </p>
          </div>
          <button
            type="button"
            className="dex-set-claim-btn"
            disabled={claimBusy || tutLocked}
            onClick={() => onClaimSet(typeReward.id)}
          >
            완성 보상 받기
          </button>
        </div>
      ) : null}
      <div className={`dex-grid dex-grid-${tab}`}>
        {cards.map((card) => {
          const cardReward = claimableForCard(claimable, card.id);
          return (
            <div key={card.id} className="dex-cell">
              <DexCardSlot
                kind={tab}
                card={card}
                record={owned[card.id]}
                claimable={Boolean(cardReward)}
                claimBusy={claimBusy}
                pulse={pulseSlotId === card.id}
                claimEnabled={!tutLocked || (claimGate && focusCardId === card.id)}
                onClaim={() => {
                  if (cardReward) onClaimCard(cardReward.id);
                }}
                onClick={() => onSlot(card)}
              />
              <p className={`dex-cell-name ${owned[card.id] ? "" : "is-locked"}`}>
                {owned[card.id] ? card.name?.ko : "???"}
              </p>
            </div>
          );
        })}
        {Array.from({ length: comingSoon }, (_, index) => (
          <div key={`soon-${index}`} className="dex-cell">
            <DexCardSlot kind="soon" />
            <p className="dex-cell-name is-soon">곧 만나요</p>
          </div>
        ))}
      </div>
    </section>
  );
}
