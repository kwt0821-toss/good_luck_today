import {
  Clipboard,
  Device,
  File as TossFile,
  NavigationBar,
  Share,
  getAppsInTossGlobals,
} from "@apps-in-toss/web-framework";

import { loadMenuSettings } from "./menuSettings";
import { TOSS_NAV_BG } from "./tossTheme";

export function isInTossApp(): boolean {
  try {
    return getAppsInTossGlobals() != null;
  } catch {
    return false;
  }
}

export async function configureNavigationBar(options: {
  withBackButton?: boolean;
}): Promise<void> {
  try {
    // Opaque title bar: webview content starts below it (layout-spec §0).
    await NavigationBar.setOptions({
      withBackButton: options.withBackButton ?? false,
      withHomeButton: true,
      withTitle: true,
      transparentBackground: false,
      backgroundColor: TOSS_NAV_BG,
      theme: "dark",
    });
  } catch {
    // 브라우저 미리보기에서는 네이티브 내비게이션이 없어요.
  }
}

export async function haptic(type: "tap" | "success" | "softMedium" = "tap"): Promise<void> {
  if (!loadMenuSettings().haptic) return;
  try {
    await Promise.race([
      Device.triggerHaptic({ type }),
      new Promise<void>((resolve) => {
        window.setTimeout(resolve, 120);
      }),
    ]);
  } catch {
    // 웹 미리보기에서는 햅틱을 건너뛰어요.
  }
}

const ROOM_SHARE_PATH = "intoss://lucky-cat";
const BRIDGE_MS = 1200;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
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

function shareCancelled(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/** Save a card PNG. Newer Toss apps open the device save sheet. Older ones share the file or download it. */
export async function savePhotoBase64(data: string, fileName: string, blob: Blob): Promise<"sheet" | "download"> {
  const payload = data.replace(/^data:image\/png;base64,/, "");
  try {
    if (TossFile.saveBase64.isSupported()) {
      await withTimeout(TossFile.saveBase64({ data: payload, fileName, mimeType: "image/png" }), BRIDGE_MS);
      return "sheet";
    }
  } catch {
    // Browser preview and older Toss builds have no device-save bridge.
  }
  const file = new globalThis.File([blob], fileName, { type: "image/png" });
  if (canShareFiles(file)) {
    try {
      await navigator.share({ files: [file], title: "행운냥" });
      return "sheet";
    } catch (error) {
      if (shareCancelled(error)) return "sheet";
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
  return "download";
}

/**
 * Share the card image when the browser can attach files.
 * Otherwise send the text (and an optional Toss link) through Share.sendMessage,
 * then copy the same text if that bridge is missing.
 */
export async function shareRoomCard(file: globalThis.File, message: string): Promise<"shared" | "copied" | "cancelled"> {
  if (canShareFiles(file)) {
    try {
      await navigator.share({ files: [file], title: "행운냥", text: message });
      return "shared";
    } catch (error) {
      if (shareCancelled(error)) return "cancelled";
    }
  }
  const text = await withRoomLink(message);
  try {
    await withTimeout(Share.sendMessage({ message: text }), BRIDGE_MS);
    return "shared";
  } catch {
    try {
      await Clipboard.setText(text);
    } catch {
      await navigator.clipboard.writeText(text);
    }
    return "copied";
  }
}

function canShareFiles(file: globalThis.File): boolean {
  return typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
}

async function withRoomLink(message: string): Promise<string> {
  try {
    const link = await withTimeout(Share.createLink({ path: ROOM_SHARE_PATH }), BRIDGE_MS);
    if (link && !message.includes(link)) return `${message}\n${link}`;
  } catch {
    // A link is optional. The message still shares on its own.
  }
  return message;
}

export async function shareText(message: string): Promise<"shared" | "copied"> {
  try {
    await Share.sendMessage({ message });
    return "shared";
  } catch {
    if (navigator.share) {
      try {
        await navigator.share({ text: message, title: "행운냥" });
        return "shared";
      } catch {
        // 사용자가 공유를 취소한 경우에는 복사로 이어가지 않아요.
      }
    }

    try {
      await Clipboard.setText(message);
    } catch {
      await navigator.clipboard.writeText(message);
    }
    return "copied";
  }
}
