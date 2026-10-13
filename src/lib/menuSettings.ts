import { AudioManager, audioStorageKeys } from "../audio/AudioManager";

const KEY = "lucky-cat.menu-settings.v1";
const audioKeys = audioStorageKeys();

/** Fired after saveMenuSettings so open screens can drop .is-reduce live. */
export const MENU_SETTINGS_EVENT = "lucky-cat:menu-settings";

export type MenuSettings = {
  bgm: boolean;
  sfx: boolean;
  haptic: boolean;
  reduceMotion: boolean;
};

function prefersReduced(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function readAudioFlag(key: string, defaultOn: boolean): boolean {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return defaultOn;
    return raw === "1";
  } catch {
    return defaultOn;
  }
}

export function defaultMenuSettings(): MenuSettings {
  return {
    bgm: false,
    sfx: true,
    haptic: true,
    reduceMotion: prefersReduced(),
  };
}

export function loadMenuSettings(): MenuSettings {
  const base = defaultMenuSettings();
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<MenuSettings>) : {};
    return {
      bgm: readAudioFlag(audioKeys.bgm, base.bgm),
      sfx: readAudioFlag(audioKeys.sfx, typeof parsed.sfx === "boolean" ? parsed.sfx : base.sfx),
      haptic: typeof parsed.haptic === "boolean" ? parsed.haptic : base.haptic,
      reduceMotion:
        typeof parsed.reduceMotion === "boolean" ? parsed.reduceMotion : base.reduceMotion,
    };
  } catch {
    return base;
  }
}

export function saveMenuSettings(next: MenuSettings): void {
  try {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        haptic: next.haptic,
        reduceMotion: next.reduceMotion,
        sfx: next.sfx,
      }),
    );
  } catch {
    // ignore
  }
  AudioManager.setBgmEnabled(next.bgm);
  AudioManager.setSfxEnabled(next.sfx);
  try {
    window.dispatchEvent(new CustomEvent(MENU_SETTINGS_EVENT, { detail: next }));
  } catch {
    // ignore
  }
}

/**
 * In-app "움직임 줄이기" is the source of truth once loaded/saved.
 * Defaults still seed from prefers-reduced-motion when unset, but an
 * explicit OFF must win — otherwise OS reduce-motion keeps freezing the
 * main cat even after the user turns the toggle off.
 */
export function shouldReduceMenuMotion(settings?: MenuSettings): boolean {
  const s = settings ?? loadMenuSettings();
  return s.reduceMotion;
}

/** Apply stored audio flags to AudioManager (call once at boot). */
export function syncAudioSettingsFromStorage() {
  const s = loadMenuSettings();
  AudioManager.setBgmEnabled(s.bgm);
  AudioManager.setSfxEnabled(s.sfx);
}
