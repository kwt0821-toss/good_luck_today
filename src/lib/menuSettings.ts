const KEY = "lucky-cat.menu-settings.v1";

export type MenuSettings = {
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

export function defaultMenuSettings(): MenuSettings {
  return {
    sfx: true,
    haptic: true,
    reduceMotion: prefersReduced(),
  };
}

export function loadMenuSettings(): MenuSettings {
  const base = defaultMenuSettings();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<MenuSettings>;
    return {
      sfx: typeof parsed.sfx === "boolean" ? parsed.sfx : base.sfx,
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
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export function shouldReduceMenuMotion(settings?: MenuSettings): boolean {
  const s = settings ?? loadMenuSettings();
  return s.reduceMotion || prefersReduced();
}
