/** True when the page address or the Toss launch scheme asked for the save debug line. */
export function isDebugSaveRequest(search: string, schemeUrl: string): boolean {
  return isDebugFlagRequest("debugSave", search, schemeUrl);
}

/** True when the page address or the Toss launch scheme asked for placement hit outlines. */
export function isDebugHitRequest(search: string, schemeUrl: string): boolean {
  return isDebugFlagRequest("debugHit", search, schemeUrl);
}

function isDebugFlagRequest(flag: string, search: string, schemeUrl: string): boolean {
  if (searchHasFlag(search, flag)) return true;
  if (!schemeUrl) return false;
  if (textHasFlag(schemeUrl, flag)) return true;
  const queryIndex = schemeUrl.indexOf("?");
  if (queryIndex < 0) return false;
  const query = schemeUrl.slice(queryIndex + 1);
  if (searchHasFlag(query, flag)) return true;
  const raw = new URLSearchParams(query).get("queryParams");
  return raw != null && textHasFlag(raw, flag);
}

function searchHasFlag(search: string, flag: string): boolean {
  const query = search.startsWith("?") ? search.slice(1) : search;
  return new URLSearchParams(query).get(flag) === "1";
}

function textHasFlag(value: string, flag: string): boolean {
  const text = safeDecode(value);
  const name = flag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new RegExp(`(?:^|[?&#])${name}=1(?:&|#|$)`).test(text)) return true;
  if (new RegExp(`"${name}"\\s*:\\s*"1"`).test(text)) return true;
  if (new RegExp(`"${name}"\\s*:\\s*1(?!\\d)`).test(text)) return true;
  return false;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
