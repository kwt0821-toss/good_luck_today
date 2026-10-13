import { loadDexCatalog } from "./dexCatalog";
import { loadDexOwned } from "./dexCollection";
import {
  cardImageUrls,
  cardTitle,
  dupPawForCard,
  pickCardFromCatalog,
  starsLabel,
} from "./drawRates";
import { loadOpsConfig } from "./opsConfig";
import {
  applyOpsDailyReset,
  nextDrawSlot,
  remainingTotalDraws,
} from "./opsState";
import { saveOpsState } from "./opsStorage";
import type { DrawReservation, DrawSlotKind, OpsState } from "./opsTypes";
import { toKstDateKey } from "./date";

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function newDrawId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `draw_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

/**
 * Mock `POST /draw` — server decides the card and reserves the reward.
 * Quotas are not consumed until `confirmDrawAfterAd` (ad complete callback).
 */
export async function reserveDraw(
  state: OpsState,
  opts?: { forceSlot?: DrawSlotKind; latencyMs?: number },
): Promise<{ state: OpsState; reservation: DrawReservation | null; error?: string }> {
  await delay(opts?.latencyMs ?? 120 + Math.random() * 180);
  const config = await loadOpsConfig();
  const today = toKstDateKey();
  let next = applyOpsDailyReset(state, today);
  const slot = opts?.forceSlot ?? nextDrawSlot(next, config);
  if (!slot) {
    return { state: next, reservation: null, error: "오늘 뽑기를 모두 썼어요" };
  }

  const catalog = await loadDexCatalog();
  const owned = await loadDexOwned();
  if (!catalog.cards.length) {
    return { state: next, reservation: null, error: "카드 목록을 불러오지 못했어요" };
  }

  const rateUp = slot === "rateUp";
  const { card, rarity } = pickCardFromCatalog(catalog, config.economy, rateUp);
  const isNew = (owned[card.id]?.count ?? 0) <= 0;
  const urls = cardImageUrls(card);
  const remainingAfter = Math.max(0, remainingTotalDraws(next, config) - 1);

  const reservation: DrawReservation = {
    drawId: newDrawId(),
    cardId: card.id,
    slot,
    rateUp,
    rarity,
    isNew,
    dupPaw: isNew ? 0 : dupPawForCard(card, config.economy),
    frontUrl: urls.frontUrl,
    backUrl: urls.backUrl,
    thumbUrl: urls.thumbUrl,
    nameKo: cardTitle(card),
    starsLabel: starsLabel(card),
    remainingAfter,
    createdAt: Date.now(),
    confirmed: false,
  };

  next = { ...next, pendingDraw: reservation };
  await saveOpsState(next);
  return { state: next, reservation };
}

export async function cancelDrawReservation(state: OpsState): Promise<OpsState> {
  if (!state.pendingDraw) return state;
  const next = { ...state, pendingDraw: null };
  await saveOpsState(next);
  return next;
}

export async function preloadDrawImages(reservation: DrawReservation): Promise<"full" | "thumb" | "none"> {
  const tryDecode = async (url: string) => {
    const img = new Image();
    img.src = url;
    if (img.decode) await img.decode();
    else await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });
  };
  try {
    await tryDecode(reservation.frontUrl);
    await tryDecode(reservation.backUrl).catch(() => undefined);
    return "full";
  } catch {
    try {
      await tryDecode(reservation.thumbUrl);
      return "thumb";
    } catch {
      return "none";
    }
  }
}

/** Re-fetch the same reserved draw (idempotent by drawId). */
export async function resumeDraw(state: OpsState): Promise<DrawReservation | null> {
  return state.pendingDraw;
}
