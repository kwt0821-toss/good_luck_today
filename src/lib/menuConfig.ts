import type { MenuConfig } from "./menuTypes";

/**
 * Menu config loader. Today reads `/assets/menu/menu.json`.
 * Later swap CONFIG_BASE / fetch target for `GET /config/menu`.
 */
const MENU_CONFIG_URL =
  (import.meta.env.VITE_MENU_CONFIG_URL as string | undefined) ?? "/assets/menu/menu.json";

let cache: Promise<MenuConfig> | null = null;

export function loadMenuConfig(): Promise<MenuConfig> {
  if (!cache) {
    cache = fetch(MENU_CONFIG_URL, { cache: "no-cache" }).then(async (res) => {
      if (!res.ok) throw new Error("menu config missing");
      return (await res.json()) as MenuConfig;
    });
  }
  return cache;
}

export function clearMenuConfigCache() {
  cache = null;
}

export function menuAsset(relative: string): string {
  if (relative.startsWith("/assets/")) return relative;
  return `/assets/menu/${relative.replace(/^\//, "")}`;
}
