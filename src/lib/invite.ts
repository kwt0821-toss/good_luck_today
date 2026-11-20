import { Clipboard, Environment, Share, isMinVersionSupported } from "@apps-in-toss/web-framework";
import type { MenuRowView } from "./menuTypes";
import type { OpsState } from "./opsTypes";
import { adoptServerJelly } from "./serverJelly";
import { saveToServer } from "./serverSave";
import {
  acceptInvite,
  claimInvite,
  fetchInviteStatus,
  type InviteClaimResult,
  type InviteStatus,
} from "./serverWallet";

const PENDING_KEY = "lucky-cat.invite-pending.v1";
const OPENED_KEY = "lucky-cat.invite-opened.v1";
const WELCOME_KEY = "lucky-cat.invite-welcome.v1";
const CLAIM_GAP_MS = 30_000;
const TICKET_MEMORY = 50;

export type InviteSnap =
  | { phase: "loading" }
  | { phase: "off" }
  | { phase: "ready"; status: InviteStatus; opened: boolean };

export type InviterGiftView = {
  friends: number;
  jelly: number;
  tickets: number;
  monthCount: number;
  monthLimit: number;
};

type Host = {
  getOps: () => OpsState | null;
  commit: (next: OpsState) => void;
  onWelcome: () => void;
  onGift: (gift: InviterGiftView) => void;
  onInvitee: (jelly: number, tickets: number) => void;
  maxHold: () => number;
};

const CLEAR_ERRORS = new Set(["already", "self", "not_new", "code_invalid"]);

let snap: InviteSnap = { phase: "loading" };
const listeners = new Set<(next: InviteSnap) => void>();
let host: Host | null = null;
let welcomeDue = false;
/** Last ops this module wrote. React may still be on the previous render. */
let shadowOps: OpsState | null = null;
let lastClaimAt = 0;
let claimLock: Promise<void> = Promise.resolve();
let linkTried = false;

export function readInviteSnap(): InviteSnap {
  return snap;
}

export function subscribeInviteSnap(listener: (next: InviteSnap) => void): () => void {
  listeners.add(listener);
  listener(snap);
  return () => listeners.delete(listener);
}

function publish(next: InviteSnap) {
  snap = next;
  listeners.forEach((listener) => listener(next));
}

export function bindInviteHost(next: Host) {
  host = next;
}

function rememberWelcome() {
  welcomeDue = true;
  try {
    localStorage.setItem(WELCOME_KEY, "1");
  } catch {
    // ignore
  }
}

export function inviteWelcomeDue(): boolean {
  if (welcomeDue) return true;
  try {
    if (localStorage.getItem(WELCOME_KEY) === "1") {
      welcomeDue = true;
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

export function takeInviteWelcome(): void {
  welcomeDue = false;
  try {
    localStorage.removeItem(WELCOME_KEY);
  } catch {
    // ignore
  }
}

export function normalizeInviteCode(raw: string): string {
  return raw
    .replace(/[\s-]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}

export function inviteDaysLeft(enterUntil: number | null, now = Date.now()): number {
  if (enterUntil == null) return 1;
  const left = enterUntil - now;
  if (left <= 0) return 1;
  return Math.max(1, Math.ceil(left / 86_400_000));
}

export function inviteErrorText(error: string): string {
  switch (error) {
    case "code_invalid":
      return "없는 초대 코드예요. 친구에게 받은 코드를 다시 확인해 주세요.";
    case "already":
      return "이미 초대 코드를 등록했어요. 초대 선물은 한 번만 받을 수 있어요.";
    case "self":
      return "내 초대 코드는 넣을 수 없어요. 친구에게 받은 코드를 넣어 주세요.";
    case "not_new":
      return "처음 시작하고 3일 안에만 넣을 수 있어요.";
    case "inviter_full_day":
      return "이 친구는 오늘 초대할 수 있는 인원을 다 채웠어요. 내일 다시 넣어 주세요.";
    case "inviter_full_month":
      return "이 친구는 이번 달 초대할 수 있는 인원을 다 채웠어요.";
    case "rate_limited":
      return "잠시 후 다시 넣어 주세요.";
    default:
      return "지금은 확인할 수 없어요. 잠시 후 다시 넣어 주세요.";
  }
}

export function inviteRowView(row: MenuRowView, current: InviteSnap): MenuRowView {
  if (current.phase !== "ready" || !current.status.enabled) {
    return {
      ...row,
      enabled: false,
      chevron: false,
      meta: "",
      badge: { type: "pill", text: "준비 중", tone: "muted" },
    };
  }
  const status = current.status;
  if (status.canEnterCode) {
    return {
      ...row,
      enabled: true,
      chevron: true,
      meta: `초대 코드 입력 · ${inviteDaysLeft(status.enterUntil)}일`,
      badge: { type: "dot" },
    };
  }
  const gift = status.pendingInviter > 0 || status.inviteeState === "ready";
  return {
    ...row,
    enabled: true,
    chevron: true,
    meta: `친구도 나도 젤리 ${status.rules.jelly}`,
    badge: gift || !current.opened ? { type: "dot" } : { type: "none" },
  };
}

function readOpened(): boolean {
  try {
    return localStorage.getItem(OPENED_KEY) === "1";
  } catch {
    return false;
  }
}

export function markInviteOpened() {
  try {
    localStorage.setItem(OPENED_KEY, "1");
  } catch {
    // ignore
  }
  if (snap.phase === "ready") publish({ ...snap, opened: true });
}

function readPending(): string | null {
  try {
    const value = localStorage.getItem(PENDING_KEY);
    const code = value ? normalizeInviteCode(value) : "";
    return code.length === 6 ? code : null;
  } catch {
    return null;
  }
}

function writePending(code: string) {
  try {
    if (localStorage.getItem(PENDING_KEY)) return;
    localStorage.setItem(PENDING_KEY, code);
  } catch {
    // ignore
  }
}

function clearPending() {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    // ignore
  }
}

function codeFromText(raw: string): string | null {
  if (!raw) return null;
  const hashAt = raw.indexOf("#");
  const queryAt = raw.indexOf("?");
  const query =
    queryAt >= 0 ? raw.slice(queryAt + 1, hashAt > queryAt ? hashAt : undefined) : "";
  const hash = hashAt >= 0 ? raw.slice(hashAt + 1).replace(/^\?/, "") : "";
  const fromQuery = new URLSearchParams(query).get("invite");
  const fromHash = new URLSearchParams(hash).get("invite");
  const code = normalizeInviteCode(fromQuery || fromHash || "");
  return code.length === 6 ? code : null;
}

/** Read `invite` from the page address and the Toss launch URL. Keep the first code. */
export function captureInviteFromLaunch() {
  if (typeof window === "undefined") return;
  const here = codeFromText(`${window.location.pathname}${window.location.search}${window.location.hash}`);
  let scheme = "";
  try {
    scheme = Environment.initialURL || "";
  } catch {
    scheme = "";
  }
  const code = here || codeFromText(scheme);
  if (code) writePending(code);
}

function applyTicketKeys(state: OpsState, keys: string[], maxHold: number): OpsState {
  const seen = new Set(state.inviteTicketKeys ?? []);
  let tickets = state.rateUpTickets;
  let changed = false;
  for (const key of keys) {
    if (!key || seen.has(key)) continue;
    seen.add(key);
    changed = true;
    if (tickets < maxHold) tickets += 1;
  }
  if (!changed) return state;
  return {
    ...state,
    rateUpTickets: tickets,
    inviteTicketKeys: [...seen].slice(-TICKET_MEMORY),
  };
}

function liveOps(fallback: OpsState): OpsState {
  const live = host?.getOps() ?? fallback;
  if (!shadowOps) return live;
  const liveKeys = new Set(live.inviteTicketKeys ?? []);
  const shadowAhead = (shadowOps.inviteTicketKeys ?? []).some((key) => !liveKeys.has(key));
  return shadowAhead ? shadowOps : live;
}

function commitTickets(state: OpsState, keys: string[]): OpsState {
  if (!host || keys.length === 0) return liveOps(state);
  const base = liveOps(state);
  const next = applyTicketKeys(base, keys, host.maxHold());
  if (next !== base) {
    shadowOps = next;
    host.commit(next);
  }
  return next;
}

async function refreshStatus(): Promise<InviteStatus | null> {
  const result = await fetchInviteStatus();
  if (!result.ok) {
    if (snap.phase === "ready" && result.network) return snap.status;
    publish({ phase: "off" });
    return null;
  }
  if (!result.enabled) {
    publish({ phase: "off" });
    return null;
  }
  publish({ phase: "ready", status: result, opened: readOpened() });
  return result;
}

async function runClaim(state: OpsState, status: InviteStatus | null, force = false): Promise<void> {
  const now = Date.now();
  if (!force && now - lastClaimAt < CLAIM_GAP_MS) return;
  lastClaimAt = now;
  const result = await claimInvite(state.rateUpTickets);
  if (!result.ok) {
    if (result.network) lastClaimAt = 0;
    return;
  }
  await applyClaim(state, result, status);
}

async function applyClaim(state: OpsState, result: InviteClaimResult, status: InviteStatus | null) {
  if (!host) return;
  if (result.jelly != null) adoptServerJelly(result.jelly);
  const withTickets = commitTickets(state, result.ticketKeys);
  if (result.asInvitee) {
    host.onInvitee(result.asInvitee.jelly, result.asInvitee.tickets);
  }
  if (result.asInviter) {
    const fresh = (await refreshStatus()) ?? status;
    host.onGift({
      friends: result.asInviter.friends,
      jelly: result.asInviter.jelly,
      tickets: result.asInviter.tickets,
      monthCount: fresh?.monthCount ?? status?.monthCount ?? result.asInviter.friends,
      monthLimit: fresh?.rules.monthLimit ?? status?.rules.monthLimit ?? 10,
    });
  }
  void withTickets;
}

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = claimLock.then(task, task);
  claimLock = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function refreshInvite(reason: "boot" | "menu"): Promise<void> {
  return enqueue(async () => {
    const state = host?.getOps();
    const status = await refreshStatus();
    if (!status || !state || !host) return;
    const withTickets = commitTickets(state, status.ticketKeys);
    if (reason === "boot") await acceptPendingLink();
    const current = liveOps(withTickets);
    const again = snap.phase === "ready" ? snap.status : status;
    if (again.pendingInviter > 0) await runClaim(current, again);
  });
}

async function acceptPendingLink() {
  if (linkTried) return;
  const code = readPending();
  if (!code) return;
  linkTried = true;
  const result = await acceptInvite(code, "link");
  if (!result.ok) {
    if (result.network) {
      linkTried = false;
      return;
    }
    if (CLEAR_ERRORS.has(result.error)) clearPending();
    return;
  }
  clearPending();
  rememberWelcome();
  host?.onWelcome();
  const state = host?.getOps();
  if (state && (state.lifetimeDraws ?? 0) > 0) {
    const status = await refreshStatus();
    if (status && status.invited && status.inviteeState !== "claimed" && status.inviteeState !== "none") {
      await runClaim(liveOps(state), status, true);
    }
  } else {
    await refreshStatus();
  }
}

export function submitInviteCode(
  code: string,
  lifetimeDraws: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return enqueue(async () => {
    const result = await acceptInvite(code, "code");
    if (!result.ok) return { ok: false as const, error: result.error };
    const state = host?.getOps();
    const status = await refreshStatus();
    if (state && lifetimeDraws > 0 && status && status.invited && status.inviteeState !== "claimed") {
      await runClaim(liveOps(state), status, true);
    }
    return { ok: true as const };
  });
}

export function noteInviteDraw(state: OpsState): Promise<void> {
  return enqueue(async () => {
    await saveToServer();
    const status = await refreshStatus();
    if (!status || !status.invited || status.inviteeState === "none" || status.inviteeState === "claimed") {
      return;
    }
    const withTickets = commitTickets(state, status.ticketKeys);
    await runClaim(withTickets, status, true);
  });
}

export function inviteShareMessage(code: string, link: string, jelly: number): string {
  return `행운냥에서 같이 고양이 카드 모아요!
이 링크로 처음 시작해서 첫 카드를 뽑으면 우리 둘 다 젤리 ${jelly}개랑 확률업 뽑기권 1장을 받아요.
링크가 안 열리면 행운냥 친구 초대에서 코드 ${code} 를 넣어 줘!
${link}`;
}

function ogImageUrl(): string | undefined {
  try {
    if (!isMinVersionSupported({ android: "5.240.0", ios: "5.239.0" })) return undefined;
    const href = new URL("/assets/invite/og-invite.jpg", window.location.origin).href;
    return href.startsWith("https://") ? href : undefined;
  } catch {
    return undefined;
  }
}

export async function sendInvite(code: string, jelly: number): Promise<"shared" | "copied"> {
  const path = `intoss://lucky-cat?invite=${code}`;
  let link = path;
  try {
    const og = ogImageUrl();
    link = await Share.createLink(og ? { path, ogImageUrl: og } : { path });
  } catch {
    link = path;
  }
  const message = inviteShareMessage(code, link || path, jelly);
  try {
    await Share.sendMessage({ message });
    return "shared";
  } catch {
    await copyPlain(message);
    return "copied";
  }
}

export async function copyInviteCode(code: string): Promise<void> {
  await copyPlain(code);
}

async function copyPlain(text: string): Promise<void> {
  try {
    await Clipboard.setText(text);
    return;
  } catch {
    // Browser preview has no Toss clipboard.
  }
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // Permission can block the browser clipboard.
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  } catch {
    // The share text is still shown in the notice.
  }
}
