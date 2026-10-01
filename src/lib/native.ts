import {
  Clipboard,
  Device,
  NavigationBar,
  Share,
  getAppsInTossGlobals,
} from "@apps-in-toss/web-framework";

export function isInTossApp(): boolean {
  try {
    getAppsInTossGlobals();
    return true;
  } catch {
    return false;
  }
}

export async function configureNavigationBar(options: {
  withBackButton?: boolean;
}): Promise<void> {
  try {
    await NavigationBar.setOptions({
      withBackButton: options.withBackButton ?? false,
      withHomeButton: true,
      withTitle: true,
      theme: "light",
    });
  } catch {
    // 브라우저 미리보기에서는 네이티브 내비게이션이 없어요.
  }
}

export async function haptic(type: "tap" | "success" | "softMedium" = "tap"): Promise<void> {
  try {
    await Device.triggerHaptic({ type });
  } catch {
    // 웹 미리보기에서는 햅틱을 건너뛰어요.
  }
}

export async function shareText(message: string): Promise<"shared" | "copied"> {
  try {
    await Share.sendMessage({ message });
    return "shared";
  } catch {
    if (navigator.share) {
      try {
        await navigator.share({ text: message, title: "오늘의 행운" });
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
