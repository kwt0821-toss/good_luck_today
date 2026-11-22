import type { MenuRowView } from "./menuTypes";
import { grantRoomOwned } from "./roomStore";
import { nyNotify } from "./nyangNotify";
import type { OpsState } from "./opsTypes";
import { adoptServerJelly } from "./serverJelly";
import {
  claimMailboxAll,
  claimMailboxLetter,
  fetchMailboxList,
  walletGet,
  type MailboxLetter,
} from "./serverWallet";
import { applyChestTicketKeys } from "./weeklyMissions";

export type MailboxSnap = {
  items: MailboxLetter[];
  unclaimedCount: number;
  ttlDays: number;
  today: string;
};

const CACHE_KEY = "lucky-cat.mailbox.v1";

const EMPTY: MailboxSnap = { items: [], unclaimedCount: 0, ttlDays: 30, today: "" };

let snap: MailboxSnap = readCache();
const listeners = new Set<(next: MailboxSnap) => void>();
let refreshFlight: Promise<MailboxSnap> | null = null;

function readCache(): MailboxSnap {
  if (typeof sessionStorage === "undefined") return EMPTY;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<MailboxSnap>;
    if (!parsed || !Array.isArray(parsed.items)) return EMPTY;
    return {
      items: parsed.items,
      unclaimedCount: Math.max(0, Math.floor(parsed.unclaimedCount ?? 0) || 0),
      ttlDays: Math.max(1, Math.floor(parsed.ttlDays ?? 30) || 30),
      today: typeof parsed.today === "string" ? parsed.today : "",
    };
  } catch {
    return EMPTY;
  }
}

function publish(next: MailboxSnap) {
  snap = next;
  listeners.forEach((listener) => listener(next));
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(next));
  } catch {
    // private mode
  }
}

export function readMailboxSnap(): MailboxSnap {
  return snap;
}

export function mailboxUnclaimed(): number {
  return snap.unclaimedCount;
}

export function subscribeMailbox(listener: (next: MailboxSnap) => void): () => void {
  listeners.add(listener);
  listener(snap);
  return () => listeners.delete(listener);
}

export function remainLabel(days: number): string {
  const safe = Math.floor(days);
  if (safe <= 0) return "오늘까지";
  return `${safe}일 남음`;
}

export function mailboxRowView(row: MenuRowView, unclaimed: number): MenuRowView {
  if (unclaimed <= 0) return { ...row, meta: "", badge: { type: "none" } };
  return { ...row, meta: `안 받은 ${unclaimed}통`, badge: { type: "dot" } };
}

/** Pull the server list. A local or offline failure keeps the last list. */
export function refreshMailbox(): Promise<MailboxSnap> {
  if (refreshFlight) return refreshFlight;
  refreshFlight = fetchMailboxList()
    .then((result) => {
      if (!result.ok) return snap;
      const next: MailboxSnap = {
        items: result.items,
        unclaimedCount: result.unclaimedCount,
        ttlDays: result.ttlDays || 30,
        today: result.today,
      };
      publish(next);
      return next;
    })
    .finally(() => {
      refreshFlight = null;
    });
  return refreshFlight;
}

type Paid = {
  jellyBalance: number | null;
  nyangCoinBalance: number | null;
  ticketKeys: string[];
  ticketsHeldAfter?: number | null;
  cozyItems?: string[];
};

function applyPaid(state: OpsState, paid: Paid): OpsState {
  let next = state;
  if (paid.jellyBalance != null) {
    adoptServerJelly(paid.jellyBalance);
    next = { ...next, pawBalance: paid.jellyBalance };
  }
  if (paid.nyangCoinBalance != null) {
    next = { ...next, nyangCoinBalance: paid.nyangCoinBalance };
    void walletGet();
  }
  const tickets = applyChestTicketKeys(next.rateUpTickets, next.inviteTicketKeys ?? [], paid.ticketKeys);
  let held = tickets.held;
  if (typeof paid.ticketsHeldAfter === "number" && paid.ticketsHeldAfter > held) held = paid.ticketsHeldAfter;
  const cozyItems = paid.cozyItems ?? [];
  const ownedItemIds = cozyItems.length
    ? [...new Set([...next.ownedItemIds, ...cozyItems])]
    : next.ownedItemIds;
  return { ...next, rateUpTickets: held, inviteTicketKeys: tickets.keys, ownedItemIds };
}

function mailError(error: string): string {
  if (error === "local") return "서버가 필요할 때 받을 수 있어요";
  if (error === "expired") return "기한이 지나 받을 수 없어요";
  if (error === "not_found") return "편지를 찾지 못했어요";
  if (error === "blocked") return "지금은 받을 수 없어요";
  return "다시 시도해 주세요";
}

function claimMessage(already: boolean, heldBack: boolean, granted: boolean, cozyItems: string[]): string {
  if (cozyItems.length > 0) return "COZY 한정 소품을 받았어요 · 서랍 보유 탭에 있어요";
  if (heldBack) return "뽑기권이 가득 차서 권만 남겨 두었어요";
  if (already) return "이미 받은 선물이에요";
  if (granted) return "선물을 받았어요";
  return "";
}

const COZY_ITEMS_EVENT = "lucky-cozy-items";

async function keepCozyItems(ids: string[]): Promise<void> {
  if (!ids.length) return;
  await grantRoomOwned(ids);
  window.dispatchEvent(new CustomEvent(COZY_ITEMS_EVENT, { detail: { ids } }));
}

export async function claimMailboxOne(
  state: OpsState,
  letterId: string,
): Promise<{ state: OpsState; message: string }> {
  const result = await claimMailboxLetter({ letterId, ticketsHeld: state.rateUpTickets });
  if (!result.ok) return { state, message: mailError(result.error) };
  const next = applyPaid(state, result);
  await keepCozyItems(result.cozyItems);
  publish({ ...snap, unclaimedCount: result.unclaimedCount });
  await refreshMailbox();
  const granted = result.jelly > 0 || result.nyangCoin > 0 || result.tickets > 0;
  return { state: next, message: claimMessage(result.already, result.ticketHeldBack, granted, result.cozyItems) };
}

export async function claimMailboxEvery(state: OpsState): Promise<{ state: OpsState; message: string }> {
  const result = await claimMailboxAll({ ticketsHeld: state.rateUpTickets });
  if (!result.ok) return { state, message: mailError(result.error) };
  const next = applyPaid(state, result);
  await keepCozyItems(result.cozyItems);
  publish({ ...snap, unclaimedCount: result.unclaimedCount });
  await refreshMailbox();
  const granted = result.claimed > 0 && (result.jelly > 0 || result.nyangCoin > 0 || result.tickets > 0);
  return { state: next, message: claimMessage(false, result.ticketHeldBack, granted, result.cozyItems) };
}

export function hintMailboxIfGrew(before: number) {
  if (mailboxUnclaimed() > before) {
    nyNotify({ key: "mailbox-hint", kind: "info", title: "편지함을 확인해 주세요" });
  }
}
