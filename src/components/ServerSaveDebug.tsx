import { useEffect, useState } from "react";

import { serverSaveStatus, subscribeServerSave } from "../lib/serverSave";

function debugSaveEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("debugSave") === "1";
}

/** Visible only with ?debugSave=1. Shows the boot load result. */
export function ServerSaveDebug() {
  const enabled = debugSaveEnabled();
  const [, bump] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    return subscribeServerSave(() => bump((n) => n + 1));
  }, [enabled]);

  if (!enabled) return null;

  const load = serverSaveStatus().lastLoadResult;
  const line = load
    ? `load result=${load.result} serverVersion=${load.serverVersion ?? "null"} localVersion=${load.localVersion ?? "null"}`
    : "load result=pending";

  return (
    <div
      data-server-save-debug=""
      aria-hidden="true"
      style={{
        position: "fixed",
        left: 8,
        bottom: "calc(72px + env(safe-area-inset-bottom, 0px))",
        zIndex: 1200,
        width: 168,
        padding: "3px 6px",
        borderRadius: 4,
        background: "rgba(20, 16, 28, 0.72)",
        color: "#f4efe4",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 10,
        lineHeight: 1.35,
        pointerEvents: "none",
      }}
    >
      {line}
    </div>
  );
}
