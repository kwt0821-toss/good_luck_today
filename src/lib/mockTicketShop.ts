import { toKstDateKey } from "./date";
import { loadOpsConfig } from "./opsConfig";
import { syncTicketShopWindows } from "./opsState";
import { saveOpsState } from "./opsStorage";
import type { OpsConfig, OpsState, TicketShopLedgerItem } from "./opsTypes";

/**
 * Mock of server POST /shop/tickets/buy.
 * Idempotent on tossUserKey + requestId. Only ticketType "rateUp" is sold.
 */

export type TicketShopBuyRequest = {
  ticketType: "rateUp";
  requestId: string;
};

export type TicketShopBuyOk = {
  ok: true;
  paw: number;
  ticketsHeld: number;
  weekBought: number;
  dayBought: number;
  alreadyProcessed?: boolean;
};

export type TicketShopBuyResponse = TicketShopBuyOk | { ok: false; reason: string };

export type TicketShopStatus = {
  pricePaw: number;
  dayLimit: number;
  weekLimit: number;
  maxHold: number;
  dayBought: number;
  weekBought: number;
  ticketsHeld: number;
  pawBalance: number;
  canBuy: boolean;
  disabledReason: string | null;
  dayRemaining: number;
  weekRemaining: number;
  holdRemaining: number;
};

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function rateUpTicketShopOffer(config: OpsConfig) {
  const offer = config.economy.shop?.tickets?.rateUpTicket;
  const maxHold = config.economy.tickets?.rateUpTicket?.maxHold ?? 3;
  return {
    pricePaw: offer?.pricePaw ?? 200,
    dayLimit: offer?.dayLimit ?? 2,
    weekLimit: offer?.weekLimit ?? 7,
    maxHold,
    nameKo: config.economy.tickets?.rateUpTicket?.nameKo ?? "확률업 이용권",
  };
}

export function getTicketShopStatus(state: OpsState, config: OpsConfig): TicketShopStatus {
  const synced = syncTicketShopWindows(state);
  const offer = rateUpTicketShopOffer(config);
  const dayRemaining = Math.max(0, offer.dayLimit - synced.ticketShopDayBought);
  const weekRemaining = Math.max(0, offer.weekLimit - synced.ticketShopWeekBought);
  const holdRemaining = Math.max(0, offer.maxHold - synced.rateUpTickets);
  let disabledReason: string | null = null;
  if (synced.rateUpTickets >= offer.maxHold) {
    disabledReason = `보유 한도 ${offer.maxHold}장이에요`;
  } else if (dayRemaining <= 0) {
    disabledReason = "오늘 구매 한도에 도달했어요";
  } else if (weekRemaining <= 0) {
    disabledReason = "이번 주 구매 한도에 도달했어요";
  } else if (synced.pawBalance < offer.pricePaw) {
    disabledReason = `포인트가 ${offer.pricePaw}P 필요해요`;
  }
  return {
    pricePaw: offer.pricePaw,
    dayLimit: offer.dayLimit,
    weekLimit: offer.weekLimit,
    maxHold: offer.maxHold,
    dayBought: synced.ticketShopDayBought,
    weekBought: synced.ticketShopWeekBought,
    ticketsHeld: synced.rateUpTickets,
    pawBalance: synced.pawBalance,
    canBuy: disabledReason == null,
    disabledReason,
    dayRemaining,
    weekRemaining,
    holdRemaining,
  };
}

/** True when main rate-up should open the ticket shop (ad used, 0 tickets, limits left). */
export function shouldOfferTicketShopOnRateUp(state: OpsState, config: OpsConfig): boolean {
  const adLeft = Math.max(0, config.economy.draws.rateUpPerDay - state.rateUpUsed);
  if (adLeft > 0) return false;
  if (state.rateUpTickets > 0) return false;
  const status = getTicketShopStatus(state, config);
  return status.dayRemaining > 0 && status.weekRemaining > 0 && status.holdRemaining > 0;
}

export function buildTicketBuyRequestId(): string {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `tix_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return `shop.tickets.rateUp:${id}`;
}

/**
 * POST /shop/tickets/buy { ticketType:'rateUp', requestId }
 * - balance ≥ price, day/week < limits, held < maxHold
 * - one transaction: −paw, +ticket, purchase record
 * - idempotent: tossUserKey + requestId → same result
 */
export async function postShopTicketsBuy(
  state: OpsState,
  body: TicketShopBuyRequest,
): Promise<{ state: OpsState; response: TicketShopBuyResponse }> {
  await delay(40);
  const config = await loadOpsConfig();
  const { ticketType, requestId } = body;

  if (!requestId || typeof requestId !== "string") {
    return { state, response: { ok: false, reason: "requestId가 필요해요" } };
  }
  if (ticketType !== "rateUp") {
    return { state, response: { ok: false, reason: "일반 뽑기권은 판매하지 않아요" } };
  }

  let next = syncTicketShopWindows(state, toKstDateKey());
  const prior = next.ticketShopLedger.find((row) => row.requestId === requestId);
  if (prior) {
    return {
      state: next,
      response: {
        ok: true,
        paw: prior.paw,
        ticketsHeld: prior.ticketsHeld,
        weekBought: prior.weekBought,
        dayBought: prior.dayBought,
        alreadyProcessed: true,
      },
    };
  }

  const offer = rateUpTicketShopOffer(config);
  if (next.rateUpTickets >= offer.maxHold) {
    return { state: next, response: { ok: false, reason: `보유 한도 ${offer.maxHold}장이에요` } };
  }
  if (next.ticketShopDayBought >= offer.dayLimit) {
    return { state: next, response: { ok: false, reason: "오늘 구매 한도에 도달했어요" } };
  }
  if (next.ticketShopWeekBought >= offer.weekLimit) {
    return { state: next, response: { ok: false, reason: "이번 주 구매 한도에 도달했어요" } };
  }
  if (next.pawBalance < offer.pricePaw) {
    return { state: next, response: { ok: false, reason: `포인트가 ${offer.pricePaw}P 필요해요` } };
  }

  const weekBought = next.ticketShopWeekBought + 1;
  const dayBought = next.ticketShopDayBought + 1;
  const ticketsHeld = next.rateUpTickets + 1;
  const paw = next.pawBalance - offer.pricePaw;
  const entry: TicketShopLedgerItem = {
    requestId,
    ticketType: "rateUp",
    createdAt: Date.now(),
    paw,
    ticketsHeld,
    weekBought,
    dayBought,
  };

  next = {
    ...next,
    pawBalance: paw,
    rateUpTickets: ticketsHeld,
    ticketShopWeekBought: weekBought,
    ticketShopDayBought: dayBought,
    ticketShopLedger: [entry, ...next.ticketShopLedger].slice(0, 40),
  };

  await saveOpsState(next);
  return {
    state: next,
    response: { ok: true, paw, ticketsHeld, weekBought, dayBought },
  };
}
