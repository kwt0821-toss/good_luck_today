/** True when the page address or the Toss launch scheme asked for the save debug line. */
export function isDebugSaveRequest(search: string, schemeUrl: string): boolean {
  if (searchHasDebugSave(search)) return true;
  if (!schemeUrl) return false;
  if (textHasDebugSave(schemeUrl)) return true;
  const queryIndex = schemeUrl.indexOf("?");
  if (queryIndex < 0) return false;
  const query = schemeUrl.slice(queryIndex + 1);
  if (searchHasDebugSave(query)) return true;
  const raw = new URLSearchParams(query).get("queryParams");
  return raw != null && textHasDebugSave(raw);
}

function searchHasDebugSave(search: string): boolean {
  const query = search.startsWith("?") ? search.slice(1) : search;
  return new URLSearchParams(query).get("debugSave") === "1";
}

function textHasDebugSave(value: string): boolean {
  const text = safeDecode(value);
  if (/(?:^|[?&#])debugSave=1(?:&|#|$)/.test(text)) return true;
  if (/"debugSave"\s*:\s*"1"/.test(text)) return true;
  if (/"debugSave"\s*:\s*1(?!\d)/.test(text)) return true;
  return false;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
