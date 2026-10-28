import { Environment } from "@apps-in-toss/web-framework";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { isDebugSaveRequest } from "../lib/debugSaveQuery";
import { serverSaveStatus, subscribeServerSave } from "../lib/serverSave";
import { resolveWalletMode, serverWalletStatus, subscribeServerWallet } from "../lib/serverWallet";

function debugSaveEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return isDebugSaveRequest(window.location.search, readSchemeUrl());
}

function readSchemeUrl(): string {
  try {
    return Environment.initialURL || "";
  } catch {
    return "";
  }
}

/** Visible only with ?debugSave=1. Shows the boot load result. */
export function ServerSaveDebug() {
  const enabled = debugSaveEnabled();
  const [, bump] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const bumpSave = subscribeServerSave(() => bump((n) => n + 1));
    const bumpWallet = subscribeServerWallet(() => bump((n) => n + 1));
    void resolveWalletMode();
    return () => {
      bumpSave();
      bumpWallet();
    };
  }, [enabled]);

  if (!enabled) return null;

  const load = serverSaveStatus().lastLoadResult;
  const line = load
    ? `load result=${load.result} serverVersion=${load.serverVersion ?? "null"} localVersion=${load.localVersion ?? "null"}`
    : "load result=pending";
  const wallet = serverWalletStatus();
  const walletLine =
    wallet.mode === "local"
      ? "wallet mode=local"
      : wallet.last
        ? `wallet mode=${wallet.mode} last=${wallet.last}${wallet.balance != null ? ` bal=${wallet.balance}` : ""}${wallet.remainingToday != null ? ` rem=${wallet.remainingToday}` : ""}`
        : `wallet mode=${wallet.mode} last=pending`;

  return createPortal(
    <div
      data-server-save-debug=""
      aria-hidden="true"
      style={{
        position: "fixed",
        left: 8,
        top: "calc(8px + env(safe-area-inset-top, 0px))",
        zIndex: 2147483000,
        width: 220,
        padding: "3px 6px",
        borderRadius: 4,
        background: "rgba(20, 16, 28, 0.92)",
        color: "#f4efe4",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 10,
        lineHeight: 1.35,
        pointerEvents: "none",
      }}
    >
      {line}
      <br />
      {walletLine}
    </div>,
    document.body,
  );
}
