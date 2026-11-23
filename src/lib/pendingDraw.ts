import type { DrawReservation, DrawRarityKey, DrawSlotKind } from "./opsTypes";

const SLOTS = new Set<DrawSlotKind>(["tutorial", "normal", "rateUp"]);
const RARITIES = new Set<DrawRarityKey>([
  "b1",
  "b2",
  "b3",
  "b4",
  "b5",
  "special",
  "character",
  "legend",
]);

function nonEmpty(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Read a saved draw reservation. Returns null when the payload is not a reservation. */
export function parsePendingDraw(value: unknown): DrawReservation | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const drawId = nonEmpty(raw.drawId);
  const cardId = nonEmpty(raw.cardId);
  const nameKo = nonEmpty(raw.nameKo);
  const frontUrl = nonEmpty(raw.frontUrl);
  const backUrl = nonEmpty(raw.backUrl);
  const thumbUrl = nonEmpty(raw.thumbUrl);
  const starsLabel = nonEmpty(raw.starsLabel);
  const createdAt = finite(raw.createdAt);
  const remainingAfter = finite(raw.remainingAfter);
  const dupPaw = finite(raw.dupPaw);
  if (
    !drawId ||
    !cardId ||
    !nameKo ||
    !frontUrl ||
    !backUrl ||
    !thumbUrl ||
    !starsLabel ||
    createdAt == null ||
    remainingAfter == null ||
    dupPaw == null
  ) {
    return null;
  }
  if (typeof raw.slot !== "string" || !SLOTS.has(raw.slot as DrawSlotKind)) return null;
  if (typeof raw.rarity !== "string" || !RARITIES.has(raw.rarity as DrawRarityKey)) return null;

  const reservation: DrawReservation = {
    drawId,
    cardId,
    slot: raw.slot as DrawSlotKind,
    rateUp: raw.rateUp === true,
    rarity: raw.rarity as DrawRarityKey,
    isNew: raw.isNew === true,
    dupPaw,
    frontUrl,
    backUrl,
    thumbUrl,
    nameKo,
    starsLabel,
    remainingAfter,
    createdAt,
    confirmed: raw.confirmed === true,
  };
  if (typeof raw.usedAd === "boolean") reservation.usedAd = raw.usedAd;
  if (typeof raw.adNyangCoin === "number" && Number.isFinite(raw.adNyangCoin)) {
    reservation.adNyangCoin = raw.adNyangCoin;
  }
  return reservation;
}

/** A confirmed card the player has not dismissed yet. Unconfirmed reservations are not resumed. */
export function shouldResumeReveal(reservation: DrawReservation | null | undefined): boolean {
  return Boolean(reservation?.confirmed && reservation.drawId && reservation.cardId);
}
