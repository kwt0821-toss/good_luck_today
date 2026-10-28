import { useEffect, useMemo, useRef, useState } from "react";

import { AudioManager } from "../audio/AudioManager";
import { CoinBurst } from "../components/CoinBurst";
import { cardThumbUrl, decodeImage } from "../lib/cardArt";
import { resolveFrame } from "../lib/cardFrames";
import { useBackHandler } from "../hooks/useBackHandler";
import { useLoadingHold, useOverlayVisible } from "../lib/loadingGate";
import { jellyLabel } from "../lib/jellyLabel";
import { ncoinIcon } from "../lib/ncoinIcon";
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
import { unseenDexRewardIds } from "../lib/dexSeen";
import { track } from "../lib/analytics";
import { haptic } from "../lib/native";
import { nyConfirm, nyNotify } from "../lib/nyangNotify";
import { NyChip } from "../components/NyChip";
import type { DexCard, DexCatalog, DexOwnedMap, DexTab } from "../lib/dexTypes";
import { buildDupExchangeRequestId, postDupExchange } from "../lib/dupExchange";
import { dupPawForCard } from "../lib/drawRates";
import { loadOpsConfig } from "../lib/opsConfig";
import type { OpsEconomy, OpsState } from "../lib/opsTypes";
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

/** Every bitmap the dex paints, so the grid can appear in one frame. */
function dexPaintUrls(catalog: DexCatalog, owned: DexOwnedMap): string[] {
  const urls = new Set<string>([
    dexAsset("bg-dex.webp"),
    dexAsset("logo-collection.svg"),
    dexAsset("locked/glyph-breed.svg"),
    dexAsset("locked/glyph-special.svg"),
    dexAsset("locked/glyph-character.svg"),
    dexAsset("locked/glyph-legend.svg"),
    dexAsset("locked/glyph-plus.svg"),
    dexAsset("locked/glyph-legend-q.svg"),
    dexAsset("icons/icon-sparkle.svg"),
  ]);
  for (const card of catalog.cards) {
    if ((owned[card.id]?.count ?? 0) <= 0) continue;
    urls.add(cardThumbUrl(card));
    const frame = resolveFrame(card);
    urls.add(frame.frameSrc);
    urls.add(frame.windowSrc);
  }
  return [...urls];
}

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
  const [imagesReady, setImagesReady] = useState(false);
  const [artProgress, setArtProgress] = useState(0);
  const [claimAllBusy, setClaimAllBusy] = useState(false);
  const [economy, setEconomy] = useState<OpsEconomy | null>(null);
  const [owned, setOwned] = useState<DexOwnedMap>({});
  const [claimable, setClaimable] = useState<DexReward[]>([]);
  const [tab, setTab] = useState<DexTab>(() => {
    const value = new URLSearchParams(window.location.search).get("tab");
    if (value === "special" || value === "character" || value === "legend" || value === "breed") {
      return value;
    }
    return "breed";
  });
  const [openCard, setOpenCard] = useState<DexCard | null>(null);
  const claimBusyRef = useRef(false);
  const [claimBusy, setClaimBusy] = useState(false);
  const [burstToken, setBurstToken] = useState(0);
  const [burstConfetti, setBurstConfetti] = useState(false);
  const [celebrate, setCelebrate] = useState<CelebrateState | null>(null);
  const [scrollLock, setScrollLock] = useState(false);
  const [pulseSlotId, setPulseSlotId] = useState<string | null>(null);
  const [slotChip, setSlotChip] = useState<{ cardId: string; text: string } | null>(null);
  const slotChipTimer = useRef(0);
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
    let cancelled = false;
    void Promise.all([loadDexCatalog(), loadDexOwned(), loadOpsConfig()]).then(async ([nextCatalog, nextOwned, config]) => {
      if (cancelled) return;
      setCatalog(nextCatalog);
      setOwned(nextOwned);
      setEconomy(config.economy);
      void refreshClaimable(ops, nextOwned);
      const cardId = focusCardId ?? new URLSearchParams(window.location.search).get("card");
      if (cardId) {
        const found = nextCatalog.cards.find((item) => item.id === cardId);
        if (found) {
          setTab(found.type);
          if (!focusCardId && (nextOwned[found.id]?.count ?? 0) > 0) setOpenCard(found);
        }
      }
      const urls = dexPaintUrls(nextCatalog, nextOwned);
      let done = 0;
      const bump = () => {
        done += 1;
        if (!cancelled) setArtProgress(urls.length ? done / urls.length : 1);
      };
      await Promise.all(urls.map((url) => decodeImage(url).then(bump, bump)));
      if (!cancelled) setImagesReady(true);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- boot once; ops claim refresh via claim handlers
  }, []);

  useEffect(() => {
    if (!focusCardId || !catalog) return;
    const found = catalog.cards.find((item) => item.id === focusCardId);
    if (!found) return;
    setTab(found.type);
    // Reveal CTA "도감에서 보기" — open the card when not mid-tutorial.
    if (!tutorialPhase) setOpenCard(found);
  }, [focusCardId, catalog, tutorialPhase]);

  useEffect(() => {
    void refreshClaimable(ops, owned);
  }, [ops.claimedDexRewardIds, owned]);

  useEffect(() => {
    const el = tabRefs.current[tab];
    if (!el) return;
    setUnderline({ left: el.offsetLeft, width: el.offsetWidth });
  }, [tab, catalog, owned, claimable]);

  const onTutorialScrollDoneRef = useRef(onTutorialScrollDone);
  onTutorialScrollDoneRef.current = onTutorialScrollDone;

  /** Tutorial 3-1: scroll focused slot to center, then notify (no coach during scroll). */
  useEffect(() => {
    if (tutorialPhase !== "scroll" || !focusCardId || !catalog) return;
    const focus = catalog.cards.find((item) => item.id === focusCardId);
    if (!focus) {
      onTutorialScrollDoneRef.current?.();
      return;
    }
    if (tab !== focus.type) return;
    if (scrollDoneRef.current) return;

    let cancelled = false;
    let timer = 0;
    setScrollLock(true);
    const scrollMs = reduceMotion ? 0 : 400;

    const finish = () => {
      if (cancelled || scrollDoneRef.current) return;
      scrollDoneRef.current = true;
      setScrollLock(false);
      onTutorialScrollDoneRef.current?.();
    };

    const attempt = (left: number) => {
      if (cancelled) return;
      const el = document.getElementById(`dex-slot-${focusCardId}`);
      const rect = el?.getBoundingClientRect();
      if (!el || !rect || rect.width < 1 || rect.height < 1) {
        if (left > 0) {
          timer = window.setTimeout(() => attempt(left - 1), 50);
          return;
        }
        finish();
        return;
      }
      el.scrollIntoView({
        block: "center",
        behavior: reduceMotion ? "auto" : "smooth",
        inline: "nearest",
      });
      timer = window.setTimeout(finish, scrollMs);
    };

    const raf = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => attempt(20));
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, [tutorialPhase, focusCardId, catalog, tab, reduceMotion]);

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

  const playClaimFx = (rewards: DexReward[]) => {
    const full = rewards.some((item) => item.kind === "fullDex");
    setBurstConfetti(full);
    setBurstToken((n) => n + 1);
    AudioManager.playSfx("reward-coin");
    void haptic("success");
  };

  const runClaim = async (rewardIds: string[] | "all", celebrateAfter?: CelebrateKind) => {
    if (claimBusyRef.current) return;
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
    claimBusyRef.current = true;
    setClaimBusy(true);
    if (rewardIds === "all") setClaimAllBusy(true);
    try {
      const result = await postDexRewardsClaim(ops, {
        rewardIds,
        requestId: buildDexClaimRequestId(),
      });
      if (!result.response.ok) {
        nyNotify({
          key: "dex-claim-fail",
          kind: "error",
          title: "보상을 받지 못했어요",
          sub: result.response.reason,
          action: { label: "다시 시도", onClick: () => void runClaim(rewardIds, celebrateAfter) },
        });
        return;
      }
      const prevNyang = ops.nyangCoinBalance;
      onOpsChange(result.state);
      const claimed = result.claimed;
      if (claimed.length) {
        const kinds = [...new Set(claimed.map((item) => item.kind))];
        for (const rewardType of kinds) {
          track("dex_reward_claim", {
            reward_type: rewardType,
            count: claimed.filter((item) => item.kind === rewardType).length,
          });
        }
        const breeds = new Set<string>();
        for (const item of claimed) {
          if (item.kind !== "breedSet" || !item.breedId || breeds.has(item.breedId)) continue;
          breeds.add(item.breedId);
          track("set_complete", { breed: item.breedId });
        }
      }
      await refreshClaimable(result.state, owned);
      playClaimFx(claimed);
      if (prevNyang < 10 && result.state.nyangCoinBalance >= 10) {
        nyNotify({
          key: "ncoin-10",
          kind: "reward",
          title: "{ncoin} 10개!",
          sub: "냥코인을 받을 수 있어요",
          action: {
            label: "보상함",
            onClick: () => {
              window.dispatchEvent(new CustomEvent("lucky-open-rewards"));
            },
          },
        });
      }

      if (
        tutorialPhase === "claim" &&
        focusCardId &&
        claimed.some((item) => item.cardId === focusCardId || item.id === `newCard:${focusCardId}`)
      ) {
        const sum = summarizeClaimable(claimed);
        nyNotify({
          key: "ncoin",
          kind: "reward",
          title:
            sum.nyangCoin > 0
              ? `{ncoin} <b>{n}개</b> + {paw}<b>${sum.paw}</b> 받았어요`
              : `{paw} <b>+${sum.paw}</b> 받았어요`,
          count: sum.nyangCoin > 0 ? sum.nyangCoin : sum.paw,
        });
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
        if (rewardIds === "all" || claimed.length >= 2) {
          nyNotify({
            key: "dex-claim-all",
            kind: "celebrate",
            title: `보상 ${claimed.length}개를 받았어요`,
            rewards: [
              ...(sum.nyangCoin > 0 ? [{ label: `+${sum.nyangCoin} 냥코인`, icon: "ncoin" as const }] : []),
              ...(sum.paw > 0 ? [{ label: jellyLabel(sum.paw, true), icon: "paw" as const }] : []),
            ],
            sub: sum.nyangCoin > 0 ? `{ncoin}+${sum.nyangCoin} + {paw}+${sum.paw}` : `{paw}+${sum.paw}`,
          });
        } else {
          nyNotify({
            key: "ncoin",
            kind: "reward",
            title:
              sum.nyangCoin > 0
                ? `{ncoin} <b>{n}개</b> + {paw}<b>${sum.paw}</b> 받았어요`
                : `{paw} <b>+${sum.paw}</b> 받았어요`,
            count: sum.nyangCoin > 0 ? sum.nyangCoin : sum.paw,
            sub: claimed[0]?.label,
          });
        }
      }
    } finally {
      claimBusyRef.current = false;
      setClaimBusy(false);
      setClaimAllBusy(false);
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
  const claimTabs = tabsWithClaimable(
    claimable.filter(
      (item) => unseenDexRewardIds([item.id], ops.seenDexClaimableIds).length > 0,
    ),
  );
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
    window.clearTimeout(slotChipTimer.current);
    setSlotChip({ cardId: card.id, text: "아직 못 만난 고양이예요" });
    slotChipTimer.current = window.setTimeout(() => setSlotChip(null), 1800);
  };

  const overlayVisible = useOverlayVisible();
  const [artOverlay, setArtOverlay] = useState(false);
  useEffect(() => {
    if (!imagesReady && overlayVisible) setArtOverlay(true);
    if (imagesReady && !overlayVisible) setArtOverlay(false);
  }, [imagesReady, overlayVisible]);
  // The preparing class hides the grid, so the coach has nothing to point at.
  const preparing = tutorialPhase == null && (!imagesReady || artOverlay);
  useBackHandler(true, () => {
    if (tutLocked) return;
    if (openCard) {
      setOpenCard(null);
      return;
    }
    if (celebrate) {
      setCelebrate(null);
      return;
    }
    const pending = claimable.length;
    const sum = summarizeClaimable(claimable);
    onBack();
    if (pending > 0) {
      nyNotify({
        key: "dex-pending",
        kind: "info",
        title: `더 받을 보상이 <b>{n}개</b> 있어요`,
        anchor: "menu",
        count: pending,
        sub:
          sum.nyangCoin > 0
            ? `도감에서 {ncoin}${sum.nyangCoin} + {paw}${sum.paw} 받기`
            : `도감에서 {paw}+${sum.paw} 받기`,
        action: {
          label: "보러 가기",
          onClick: () => {
            window.dispatchEvent(new CustomEvent("lucky-open-dex"));
          },
        },
      });
    }
  });
  useLoadingHold("dex-art", !imagesReady, imagesReady ? undefined : artProgress);
  useLoadingHold("dex-claim", claimBusy && !claimAllBusy);
  useLoadingHold("dex-claim-all", claimAllBusy, undefined, undefined, true);

  return (
    <div className={`dex-screen ${preparing ? "is-preparing" : ""}`}>
      <img className="dex-bg" src={dexAsset("bg-dex.webp")} alt="" />
      <div className="dex-grain" aria-hidden="true" />

      <header className="dex-header">
        <div className="dex-title-row">
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
                    <img src={ncoinIcon(14)} alt="" width={14} height={14} />
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
                    냥코인 {fullDexReward.nyangCoin} + 젤리 {fullDexReward.paw}
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
                        완성 보상 · 냥코인 {setReward.nyangCoin} + 젤리 {setReward.paw}
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
                          claimNyang={cardReward?.nyangCoin}
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
          dupUnitPaw={economy ? dupPawForCard(openCard, economy) : 0}
          onClose={() => setOpenCard(null)}
          onChangeCard={setOpenCard}
          onConvertDuplicate={async (card, qty) => {
            const unit = economy ? dupPawForCard(card, economy) : 0;
            const ok = await nyConfirm({
              key: "dex-dup",
              title: `중복 카드 ${qty}장을 바꿀까요?`,
              body: "젤리로 바꾸면 되돌릴 수 없어요",
              badge: unit > 0 ? `+${unit * qty} 젤리` : undefined,
              cancelLabel: "취소",
              confirmLabel: "바꾸기",
            });
            if (!ok) return;
            const result = await postDupExchange(ops, {
              mode: "card",
              cardId: card.id,
              qty,
              requestId: buildDupExchangeRequestId("card", card.id),
            });
            if (!result.response.ok) {
              nyNotify({
                key: "dex-dup-fail",
                kind: "error",
                title: "바꾸지 못했어요",
                sub: result.response.reason,
              });
              return;
            }
            onOpsChange(result.state);
            setOwned(result.owned);
            nyNotify({
              key: "dup-exchange-done",
              kind: "reward",
              title: `{paw} <b>+${result.response.gained}</b> 받았어요`,
              count: result.response.gained,
            });
            void haptic("success");
            AudioManager.playSfx("reward-coin");
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
                  <img src={ncoinIcon(18)} alt="" width={18} height={18} />
                  냥코인 +{celebrate.nyangCoin}
                </span>
              ) : null}
              <span>{jellyLabel(celebrate.paw, true)}</span>
            </div>
            <button
              type="button"
              className="dex-celebrate-cta"
              onClick={() => {
                const c = celebrate;
                setCelebrate(null);
                if (!c) return;
                nyNotify({
                  key: `dex-set-${c.kind}`,
                  kind: "celebrate",
                  title: c.sub.includes("완성") ? `${c.sub}! 🎉` : `${c.sub} 세트 완성! 🎉`,
                  rewards: [
                    ...(c.nyangCoin > 0
                      ? [{ label: `+${c.nyangCoin} 냥코인`, icon: "ncoin" as const }]
                      : []),
                    ...(c.paw > 0 ? [{ label: jellyLabel(c.paw, true), icon: "paw" as const }] : []),
                  ],
                });
              }}
            >
              좋아요
            </button>
          </div>
        </div>
      ) : null}

      <CoinBurst token={burstToken} confetti={burstConfetti} count={burstConfetti ? 32 : 12} />

      {slotChip ? (
        <div className="ny-chip-anchor dex-slot-chip">
          <NyChip arrow="up" arrowX={28}>
            {slotChip.text}
          </NyChip>
        </div>
      ) : null}

      {floatingToast ? (
        <div className="draw-reveal-toast dex-floating-toast" id="dex-toast" role="status">
          <div className="ic" aria-hidden="true">
            <img src={ncoinIcon(18)} alt="" width={18} height={18} />
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
              냥코인 {typeReward.nyangCoin} + 젤리 {typeReward.paw}
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
                claimNyang={cardReward?.nyangCoin}
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
