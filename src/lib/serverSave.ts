import { Storage } from "@apps-in-toss/web-framework";

import { isInTossApp } from "./native";
import { isTossApp } from "./tossEnv";
import { ensureGameUserHash } from "./user";

// 서버는 이 JSON을 그대로 보관만 한다. 보상·잔액 검증은 이번 범위가 아니다.

const SAVE_KEYS = [
  "lucky-cat.user-state",
  "lucky-cat.dex-collection",
  "lucky-cat.my-room.v6.rooms",
  "lucky-cat.ops-state.v1",
] as const;

type SaveKey = (typeof SAVE_KEYS)[number];

type SaveBundle = {
  v: 1;
  keys: Record<SaveKey, string | null>;
};

type Meta = { token: string | null; version: number | null };

const META_KEY = "lucky-cat.server-save.v1";
const BACKUP_KEY = "lucky-cat.server-save.local-backup";
const MAX_BYTES = 200 * 1024;
const FETCH_MS = 5000;
const BOOT_MS = 3000;
const DEBOUNCE_MS = 3000;

export type ServerSaveLoadResultName =
  | "empty"
  | "applied-server"
  | "kept-local"
  | "uploaded-local"
  | "skipped"
  | "failed";

export type ServerSaveLoadResult = {
  result: ServerSaveLoadResultName;
  serverVersion: number | null;
  localVersion: number | null;
};

type ServerState = {
  lastError: string | null;
  lastLoadResult: ServerSaveLoadResult | null;
};
const serverState: ServerState = { lastError: null, lastLoadResult: null };
const statusListeners = new Set<() => void>();
let loadReported = false;

let dirty = false;
let debounceTimer: number | null = null;
let inFlight = false;
let runAgain = false;
let lifecycleInstalled = false;
let bootFinished = false;
let bootPromise: Promise<void> | null = null;
/** In-flight key write started before the boot deadline. Boot waits on this before reading state. */
let localWrite: Promise<unknown> = Promise.resolve();
let saveGate: Promise<void> = Promise.resolve();
let saveDepth = 0;

type DropFlag = { current: boolean };

function noteError(code: string, detail?: unknown) {
  serverState.lastError = code;
  if (detail === undefined) console.error("[game-save]", code);
  else console.error("[game-save]", code, detail);
}

export function serverSaveStatus(): ServerState {
  return {
    lastError: serverState.lastError,
    lastLoadResult: serverState.lastLoadResult,
  };
}

export function subscribeServerSave(listener: () => void): () => void {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

function emitStatus() {
  statusListeners.forEach((listener) => listener());
}

function versionText(version: number | null): string {
  return version == null ? "null" : String(version);
}

function reportLoad(
  result: ServerSaveLoadResultName,
  serverVersion: number | null,
  localVersion: number | null,
) {
  if (loadReported) return;
  loadReported = true;
  serverState.lastLoadResult = { result, serverVersion, localVersion };
  console.info(
    `[serverSave] load result=${result} serverVersion=${versionText(serverVersion)} localVersion=${versionText(localVersion)}`,
  );
  emitStatus();
}

function reportSaveOk(version: number) {
  console.info(`[serverSave] save ok version=${version}`);
}

function reportSaveFailed(code: string) {
  console.info(`[serverSave] save failed code=${code}`);
}

export function functionEndpoint(name: "game-save" | "wallet"): { url: string; apikey: string } | null {
  const rawUrl = import.meta.env.VITE_SUPABASE_URL;
  const rawKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const url = typeof rawUrl === "string" ? rawUrl.trim().replace(/\/$/, "") : "";
  const apikey = typeof rawKey === "string" ? rawKey.trim() : "";
  if (!url || !apikey) return null;
  return { url: `${url}/functions/v1/${name}`, apikey };
}

function endpoint(): { url: string; apikey: string } | null {
  return functionEndpoint("game-save");
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function readKey(key: string): Promise<string | null> {
  if (isInTossApp()) {
    try {
      return await withTimeout(Storage.getItem(key), 800);
    } catch {
      // 브라우저 미리보기에서는 토스 Storage가 응답하지 않을 수 있어요.
    }
  }
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

async function writeKey(key: string, value: string): Promise<void> {
  if (isInTossApp()) {
    try {
      await withTimeout(Storage.setItem(key, value), 800);
      return;
    } catch {
      // 웹 미리보기는 localStorage로 저장해요.
    }
  }
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // 저장에 실패해도 화면은 유지해요.
  }
}

async function removeKey(key: string): Promise<void> {
  if (isInTossApp()) {
    try {
      await withTimeout(Storage.removeItem(key), 800);
      return;
    } catch {
      // fall through
    }
  }
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

async function readBundle(): Promise<SaveBundle> {
  const keys = {} as Record<SaveKey, string | null>;
  for (const key of SAVE_KEYS) keys[key] = await readKey(key);
  return { v: 1, keys };
}

function localHasData(bundle: SaveBundle): boolean {
  return SAVE_KEYS.some((key) => bundle.keys[key] != null);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseBundle(value: unknown): SaveBundle | null {
  if (!isRecord(value) || value.v !== 1 || !isRecord(value.keys)) return null;
  const keys = {} as Record<SaveKey, string | null>;
  for (const key of SAVE_KEYS) {
    const item = value.keys[key];
    if (item == null) keys[key] = null;
    else if (typeof item === "string") keys[key] = item;
    else return null;
  }
  return { v: 1, keys };
}

async function readMeta(): Promise<Meta> {
  const raw = await readKey(META_KEY);
  if (!raw) return { token: null, version: null };
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return { token: null, version: null };
    const token = typeof parsed.token === "string" && parsed.token ? parsed.token : null;
    const version = typeof parsed.version === "number" ? parsed.version : null;
    return { token, version };
  } catch {
    return { token: null, version: null };
  }
}

async function writeMeta(meta: Meta): Promise<void> {
  await writeKey(META_KEY, JSON.stringify({ token: meta.token, version: meta.version }));
}

async function rememberToken(token: string | undefined) {
  if (!token) return;
  const meta = await readMeta();
  await writeMeta({ token, version: meta.version });
}

export async function readSaveToken(): Promise<string | null> {
  return (await readMeta()).token;
}

/** Ask the server for a fresh save token. Does not apply the snapshot or reload. */
export async function refreshSaveToken(): Promise<string | null> {
  const gate = await gameHash();
  if (gate.kind !== "hash") return null;
  const loaded = await requestLoad(gate.hash, undefined);
  if (!loaded || loaded.empty || !loaded.saveToken) return null;
  await rememberToken(loaded.saveToken);
  return loaded.saveToken;
}

async function backupLocalOnce() {
  if ((await readKey(BACKUP_KEY)) != null) return;
  const bundle = await readBundle();
  await writeKey(BACKUP_KEY, JSON.stringify(bundle));
}

async function applySnapshot(
  data: unknown,
  version: number,
  saveToken: string | undefined,
  drop?: DropFlag,
): Promise<boolean> {
  if (drop?.current) return false;
  const bundle = parseBundle(data);
  if (!bundle) {
    noteError("invalid_payload");
    return false;
  }
  const job = applySnapshotNow(bundle, version, saveToken);
  localWrite = job;
  return job;
}

async function applySnapshotNow(bundle: SaveBundle, version: number, saveToken?: string): Promise<boolean> {
  await backupLocalOnce();
  for (const key of SAVE_KEYS) {
    const value = bundle.keys[key];
    if (value == null) await removeKey(key);
    else await writeKey(key, value);
  }
  const meta = await readMeta();
  await writeMeta({ token: saveToken || meta.token, version });
  if (bootFinished) window.location.reload();
  return true;
}

type HashGate = { kind: "hash"; hash: string } | { kind: "skip" } | { kind: "fail" };

async function gameHash(): Promise<HashGate> {
  if (!endpoint() || !isTossApp()) return { kind: "skip" };
  const identity = await ensureGameUserHash();
  if (!identity.ok || !identity.hash || identity.hash === "local-dev") {
    return identity.ok ? { kind: "skip" } : { kind: "fail" };
  }
  return { kind: "hash", hash: identity.hash };
}

type PostResult = { kind: "http"; status: number; json: unknown } | { kind: "aborted" } | { kind: "network" };

async function postGameSave(body: unknown, signal: AbortSignal, keepalive: boolean): Promise<PostResult> {
  const target = endpoint();
  if (!target) return { kind: "network" };
  try {
    const response = await fetch(target.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: target.apikey,
      },
      body: JSON.stringify(body),
      signal,
      keepalive,
    });
    let json: unknown = null;
    try {
      json = await response.json();
    } catch {
      json = null;
    }
    return { kind: "http", status: response.status, json };
  } catch (error) {
    if (signal.aborted) return { kind: "aborted" };
    noteError("network", error);
    return { kind: "network" };
  }
}

function errorCode(result: PostResult): string | null {
  if (result.kind === "aborted") return null;
  if (result.kind === "network") return "network";
  const json = result.json;
  if (isRecord(json) && json.ok === true) return null;
  if (isRecord(json) && json.ok === false && typeof json.error === "string") return json.error;
  if (result.status === 409) return "version_conflict";
  if (result.status === 403) return "save_token_invalid";
  if (result.status >= 400) return `http_${result.status}`;
  return "bad_response";
}

function fieldString(json: unknown, key: string): string | undefined {
  if (!isRecord(json) || typeof json[key] !== "string") return undefined;
  return json[key];
}

function fieldNumber(json: unknown, key: string): number | undefined {
  if (!isRecord(json) || typeof json[key] !== "number") return undefined;
  return json[key];
}

export function linkedSignal(parent: AbortSignal | undefined, ms: number): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), ms);
  const onParent = () => controller.abort();
  parent?.addEventListener("abort", onParent);
  return {
    signal: controller.signal,
    cancel: () => {
      window.clearTimeout(timer);
      parent?.removeEventListener("abort", onParent);
    },
  };
}

type LoadBody =
  | { ok: true; empty: true }
  | { ok: true; empty: false; data: unknown; version: number; saveToken?: string };

async function requestLoad(hash: string, parent: AbortSignal | undefined): Promise<LoadBody | null> {
  const meta = await readMeta();
  const link = linkedSignal(parent, FETCH_MS);
  try {
    const result = await postGameSave(
      { action: "load", hash, ...(meta.token ? { saveToken: meta.token } : {}) },
      link.signal,
      false,
    );
    if (result.kind === "aborted") return null;
    const code = errorCode(result);
    if (code) {
      if (code !== "network") noteError(code);
      return null;
    }
    const json = result.kind === "http" ? result.json : null;
    if (!isRecord(json) || json.empty === true) return { ok: true, empty: true };
    const version = fieldNumber(json, "version");
    if (version == null || !("data" in json)) {
      noteError("invalid_payload");
      return null;
    }
    return { ok: true, empty: false, data: json.data, version, saveToken: fieldString(json, "saveToken") };
  } finally {
    link.cancel();
  }
}

async function shouldTakeServer(serverVersion: number): Promise<boolean> {
  const meta = await readMeta();
  return meta.version == null || serverVersion > meta.version;
}

async function performSave(
  signal: AbortSignal | undefined,
  keepalive: boolean,
  tokenRetry: boolean,
  baseVersionOverride?: number,
  drop?: DropFlag,
): Promise<boolean> {
  if (saveDepth > 0) return saveOnce(signal, keepalive, tokenRetry, baseVersionOverride, drop);
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const waitFor = saveGate;
  saveGate = gate;
  await waitFor;
  saveDepth += 1;
  try {
    return await saveOnce(signal, keepalive, tokenRetry, baseVersionOverride, drop);
  } finally {
    saveDepth -= 1;
    release();
  }
}

async function saveOnce(
  signal: AbortSignal | undefined,
  keepalive: boolean,
  tokenRetry: boolean,
  baseVersionOverride: number | undefined,
  drop: DropFlag | undefined,
): Promise<boolean> {
  const gate = await gameHash();
  if (gate.kind === "skip") return true;
  if (gate.kind === "fail") {
    noteError("hash_unavailable");
    reportSaveFailed("hash_unavailable");
    return false;
  }
  const hash = gate.hash;
  const bundle = await readBundle();
  const bytes = new TextEncoder().encode(JSON.stringify(bundle)).length;
  if (bytes > MAX_BYTES) {
    noteError("data_too_large", bytes);
    reportSaveFailed("data_too_large");
    return true;
  }
  const meta = await readMeta();
  const link = linkedSignal(signal, FETCH_MS);
  try {
    const result = await postGameSave(
      {
        action: "save",
        hash,
        baseVersion: baseVersionOverride ?? meta.version ?? 0,
        data: bundle,
        ...(meta.token ? { saveToken: meta.token } : {}),
      },
      link.signal,
      keepalive,
    );
    if (result.kind === "aborted") {
      noteError("aborted");
      reportSaveFailed("aborted");
      return false;
    }
    const code = errorCode(result);
    if (!code && result.kind === "http") {
      const version = fieldNumber(result.json, "version");
      const saveToken = fieldString(result.json, "saveToken");
      if (version == null) {
        noteError("invalid_payload");
        reportSaveFailed("invalid_payload");
        return false;
      }
      const saved = (async () => {
        const next = await readMeta();
        await writeMeta({ token: saveToken || next.token, version });
      })();
      localWrite = saved;
      await saved;
      reportSaveOk(version);
      return true;
    }
    if (code === "version_conflict") {
      noteError(code);
      reportSaveFailed(code);
      if (drop?.current) return false;
      const json = result.kind === "http" ? result.json : null;
      const version = fieldNumber(json, "version");
      const data = isRecord(json) ? json.data : undefined;
      const saveToken = fieldString(json, "saveToken");
      if (saveToken) await rememberToken(saveToken);
      if (drop?.current) return false;
      if (version != null && data !== undefined) {
        return applySnapshot(data, version, saveToken, drop);
      }
      if (version != null) {
        const next = await readMeta();
        await writeMeta({ token: saveToken || next.token, version });
      }
      return false;
    }
    if (code === "save_token_invalid" && tokenRetry) {
      noteError(code);
      reportSaveFailed(code);
      if (drop?.current) return false;
      const loaded = await requestLoad(hash, signal);
      if (drop?.current || !loaded) return false;
      if (loaded.empty) return performSave(signal, keepalive, false, 0, drop);
      await rememberToken(loaded.saveToken);
      if (drop?.current) return false;
      if (await shouldTakeServer(loaded.version)) {
        return applySnapshot(loaded.data, loaded.version, loaded.saveToken, drop);
      }
      return performSave(signal, keepalive, false, undefined, drop);
    }
    if (code && code !== "network") noteError(code);
    reportSaveFailed(code ?? "bad_response");
    return false;
  } finally {
    link.cancel();
  }
}

export async function loadFromServer(signal?: AbortSignal): Promise<LoadBody | null> {
  const gate = await gameHash();
  if (gate.kind === "skip") return null;
  if (gate.kind === "fail") {
    noteError("hash_unavailable");
    return null;
  }
  return requestLoad(gate.hash, signal);
}

export function saveToServer(options?: {
  keepalive?: boolean;
  signal?: AbortSignal;
  baseVersion?: number;
  drop?: DropFlag;
}): Promise<boolean> {
  return performSave(options?.signal, !!options?.keepalive, true, options?.baseVersion, options?.drop);
}

async function reconcile(signal: AbortSignal, drop: DropFlag) {
  const gate = await gameHash();
  const localVersion = (await readMeta()).version;
  if (gate.kind === "skip") {
    reportLoad("skipped", null, localVersion);
    return;
  }
  if (gate.kind === "fail") {
    noteError("hash_unavailable");
    reportLoad("failed", null, localVersion);
    return;
  }
  const loaded = await requestLoad(gate.hash, signal);
  if (!loaded || signal.aborted || drop.current) {
    if (!serverState.lastError) noteError(signal.aborted || drop.current ? "timeout" : "load_failed");
    reportLoad("failed", null, localVersion);
    return;
  }
  if (loaded.empty) {
    const local = await readBundle();
    if (!localHasData(local) || drop.current) {
      if (drop.current && !serverState.lastError) noteError("timeout");
      reportLoad(drop.current ? "failed" : "empty", null, localVersion);
      return;
    }
    const ok = await saveToServer({ signal, baseVersion: 0, drop });
    if (!ok || serverState.lastError === "data_too_large") {
      if (!ok) dirty = true;
      if (!serverState.lastError) noteError("save_failed");
      reportLoad("failed", null, localVersion);
      return;
    }
    reportLoad("uploaded-local", (await readMeta()).version, localVersion);
    return;
  }
  await rememberToken(loaded.saveToken);
  if (drop.current) {
    if (!serverState.lastError) noteError("timeout");
    reportLoad("failed", loaded.version, localVersion);
    return;
  }
  if (await shouldTakeServer(loaded.version)) {
    const applied = await applySnapshot(loaded.data, loaded.version, loaded.saveToken, drop);
    if (!applied && !serverState.lastError) noteError(drop.current ? "timeout" : "invalid_payload");
    reportLoad(applied ? "applied-server" : "failed", loaded.version, localVersion);
    return;
  }
  reportLoad("kept-local", loaded.version, localVersion);
}

/** Loading screen waits at most 3s. A miss keeps the local keys. */
export function syncGameSaveOnBoot(): Promise<void> {
  if (!bootPromise) {
    bootPromise = (async () => {
      const controller = new AbortController();
      const drop: DropFlag = { current: false };
      let done = false;
      const timer = window.setTimeout(() => controller.abort(), BOOT_MS);
      const work = reconcile(controller.signal, drop).finally(() => {
        done = true;
      });
      try {
        await Promise.race([
          work,
          new Promise<void>((resolve) => {
            window.setTimeout(resolve, BOOT_MS);
          }),
        ]);
        if (!done) {
          drop.current = true;
          controller.abort();
          await localWrite;
          if (!loadReported) {
            if (!serverState.lastError) noteError("timeout");
            reportLoad("failed", null, (await readMeta()).version);
          }
        }
      } catch (error) {
        if (!controller.signal.aborted) noteError("boot_failed", error);
      } finally {
        window.clearTimeout(timer);
        bootFinished = true;
        if (!loadReported) {
          if (!serverState.lastError) noteError("boot_failed");
          reportLoad("failed", null, null);
        }
      }
    })();
  }
  return bootPromise;
}

async function flush(keepalive: boolean) {
  if (debounceTimer != null) {
    window.clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (!dirty) return;
  if (inFlight) {
    runAgain = true;
    return;
  }
  dirty = false;
  inFlight = true;
  let ok = false;
  try {
    ok = await saveToServer({ keepalive });
    if (!ok) dirty = true;
  } catch (error) {
    dirty = true;
    noteError("save_failed", error);
    reportSaveFailed("save_failed");
  } finally {
    inFlight = false;
    if (runAgain) {
      runAgain = false;
      dirty = true;
      if (ok) void flush(keepalive);
    }
  }
}

/** One of the four local keys was written. Upload 3s later. */
export function markDirty() {
  if (!endpoint() || !isTossApp()) return;
  dirty = true;
  if (debounceTimer != null) window.clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(() => {
    debounceTimer = null;
    void flush(false);
  }, DEBOUNCE_MS);
}

export function installServerSaveLifecycle() {
  if (lifecycleInstalled || typeof document === "undefined") return;
  lifecycleInstalled = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flush(true);
  });
  window.addEventListener("pagehide", () => {
    void flush(true);
  });
}
