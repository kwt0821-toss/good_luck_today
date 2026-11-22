import { isDebugFlagRequest } from "../debugSaveQuery.ts";

/** Matches package.json. A new version retries canvas after a stored failure. */
export const ROOM_RENDERER_VERSION = "0.1.0";

export const ROOM_RENDERER_FAIL_KEY = "lucky-cat.room-renderer-failed";

export type RoomRenderConfig = {
  renderer?: string;
  tiles?: boolean;
  backdrop?: boolean;
  depth?: boolean;
  fx?: boolean;
};

export type RoomRenderFlags = {
  canvas: boolean;
  tiles: boolean;
  backdrop: boolean;
  depth: boolean;
  fx: boolean;
};

const DOM_FLAGS: RoomRenderFlags = {
  canvas: false,
  tiles: false,
  backdrop: false,
  depth: false,
  fx: false,
};

export function roomRendererFailed(version = ROOM_RENDERER_VERSION): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    return localStorage.getItem(ROOM_RENDERER_FAIL_KEY) === version;
  } catch {
    return false;
  }
}

export function markRoomRendererFailed(version = ROOM_RENDERER_VERSION) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(ROOM_RENDERER_FAIL_KEY, version);
  } catch {
    /* private mode */
  }
}

export function canvas2dSupported(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const ok = Boolean(canvas.getContext("2d"));
    canvas.width = 0;
    canvas.height = 0;
    return ok;
  } catch {
    return false;
  }
}

/**
 * Flags for one room visit. `renderer: "dom"`, `roomDom=1`, or a stored failure
 * for this app version all keep the old DOM tiles.
 */
export function roomRenderFlags(input: {
  config?: RoomRenderConfig | null;
  search?: string;
  schemeUrl?: string;
  version?: string;
  failed?: boolean;
  canvasSupported?: boolean;
} = {}): RoomRenderFlags {
  const version = input.version ?? ROOM_RENDERER_VERSION;
  const search = input.search ?? "";
  const schemeUrl = input.schemeUrl ?? "";
  if (isDebugFlagRequest("roomDom", search, schemeUrl)) return { ...DOM_FLAGS };
  const failed = input.failed ?? roomRendererFailed(version);
  if (failed) return { ...DOM_FLAGS };
  const config = input.config;
  if (!config || config.renderer !== "canvas") return { ...DOM_FLAGS };
  const supported = input.canvasSupported ?? true;
  if (!supported) return { ...DOM_FLAGS };
  return {
    canvas: true,
    tiles: config.tiles === true,
    backdrop: config.backdrop === true,
    depth: config.depth === true,
    fx: config.fx === true,
  };
}

/** Read once when the room screen mounts. A missing 2D context is remembered. */
export function readRoomRenderFlags(
  config: RoomRenderConfig | null | undefined,
  search: string,
  schemeUrl: string,
): RoomRenderFlags {
  const supported = canvas2dSupported();
  const flags = roomRenderFlags({
    config,
    search,
    schemeUrl,
    canvasSupported: supported,
  });
  if (config?.renderer === "canvas" && !supported && !isDebugFlagRequest("roomDom", search, schemeUrl)) {
    markRoomRendererFailed();
  }
  return flags;
}

export function roomRenderLabel(flags: RoomRenderFlags): string {
  if (!flags.canvas) return "dom";
  const stages = (["tiles", "backdrop", "depth", "fx"] as const).filter((name) => flags[name]);
  return stages.length ? `canvas ${stages.join(" ")}` : "canvas";
}
