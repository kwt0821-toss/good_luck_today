import { Environment } from "@apps-in-toss/web-framework";

export type PromoTarget = "dex" | "rewards";

const CONSUMED_KEY = "lucky-cat.promo-entry.consumed";

/** Current promotion entry, if this launch asked for the dex or the rewards box. */
export function readPromoTarget(): PromoTarget | null {
  if (typeof window === "undefined") return null;
  const fromLocation = promoTargetFromLocation(window.location.pathname, window.location.search, "");
  if (fromLocation) return fromLocation;
  const fromScheme = promoTargetFromScheme(readSchemeUrl());
  if (!fromScheme || consumedTarget() === fromScheme) return null;
  return fromScheme;
}

/**
 * Drop `/dex` and `/rewards` (and `?screen=dex|rewards`) so a refresh stays on home.
 * A Toss scheme URL is not rewritten by replaceState, so the same target is remembered
 * for this tab and ignored on the next load once the document is back at `/`.
 */
export function clearPromoUrl() {
  if (typeof window === "undefined") return;
  const fromLocation = promoTargetFromLocation(window.location.pathname, window.location.search, "");
  const target = fromLocation ?? promoTargetFromScheme(readSchemeUrl());
  if (target) {
    try {
      sessionStorage.setItem(CONSUMED_KEY, target);
    } catch {
      // Private mode can block storage. The address change below still stops path re-entry.
    }
  }
  if (!fromLocation) return;
  window.history.replaceState(window.history.state, "", "/");
}

function consumedTarget(): string | null {
  try {
    return sessionStorage.getItem(CONSUMED_KEY);
  } catch {
    return null;
  }
}

function readSchemeUrl(): string {
  try {
    return Environment.initialURL || "";
  } catch {
    return "";
  }
}

/** Path or `?screen=` value that opens a promotion destination. */
export function promoTargetFromLocation(
  pathname: string,
  search: string,
  schemeUrl = "",
): PromoTarget | null {
  return (
    promoTargetFromPath(pathname) ??
    promoTargetFromSearch(search) ??
    promoTargetFromScheme(schemeUrl)
  );
}

export function promoTargetFromPath(pathname: string): PromoTarget | null {
  const parts = pathname
    .split("?")[0]
    .split("#")[0]
    .split("/")
    .filter((part) => part.length > 0 && part !== "index.html");
  if (parts.length !== 1) return null;
  return asPromoTarget(parts[0]);
}

export function promoTargetFromSearch(search: string): PromoTarget | null {
  const query = search.startsWith("?") ? search.slice(1) : search;
  return asPromoTarget(new URLSearchParams(query).get("screen"));
}

/** `intoss://lucky-cat/dex` and `intoss://lucky-cat/?screen=rewards`. */
export function promoTargetFromScheme(schemeUrl: string): PromoTarget | null {
  if (!schemeUrl) return null;
  const match = schemeUrl.match(/^[a-z][a-z0-9+.-]*:\/\/[^/?#]+([^#]*)/i);
  if (!match) return null;
  const rest = match[1] ?? "";
  const q = rest.indexOf("?");
  const path = q >= 0 ? rest.slice(0, q) : rest;
  const search = q >= 0 ? rest.slice(q) : "";
  return promoTargetFromPath(path) ?? promoTargetFromSearch(search);
}

function asPromoTarget(value: string | null | undefined): PromoTarget | null {
  if (value === "dex" || value === "rewards") return value;
  return null;
}
