/** Korean particle picked from the last syllable's batchim. */

const HANGUL_BASE = 0xac00;
const HANGUL_LAST = 0xd7a3;

function lastChar(word: string): string {
  const trimmed = word.trim();
  for (let i = trimmed.length - 1; i >= 0; i -= 1) {
    const ch = trimmed[i] ?? "";
    if (ch && !/\s/.test(ch)) return ch;
  }
  return "";
}

/** 0·1·3·6·7·8 are read with a batchim (영·일·삼·육·칠·팔). */
function digitHasBatchim(ch: string): boolean {
  return ch === "0" || ch === "1" || ch === "3" || ch === "6" || ch === "7" || ch === "8";
}

export function hasBatchim(word: string): boolean {
  const ch = lastChar(word);
  if (!ch) return false;
  if (ch >= "0" && ch <= "9") return digitHasBatchim(ch);
  const code = ch.charCodeAt(0);
  if (code < HANGUL_BASE || code > HANGUL_LAST) return false;
  return (code - HANGUL_BASE) % 28 !== 0;
}

export function josa(
  word: string,
  kind: "을를" | "이가" | "은는" | "과와" | "으로로",
): string {
  const batchim = hasBatchim(word);
  if (kind === "으로로") {
    const ch = lastChar(word);
    const code = ch.charCodeAt(0);
    const jong =
      code >= HANGUL_BASE && code <= HANGUL_LAST ? (code - HANGUL_BASE) % 28 : -1;
    // No batchim, or batchim ㄹ, takes 로.
    if (!batchim || jong === 8) return "로";
    return "으로";
  }
  if (kind === "을를") return batchim ? "을" : "를";
  if (kind === "이가") return batchim ? "이" : "가";
  if (kind === "은는") return batchim ? "은" : "는";
  return batchim ? "과" : "와";
}

export function withJosa(
  word: string,
  kind: "을를" | "이가" | "은는" | "과와" | "으로로",
): string {
  return `${word}${josa(word, kind)}`;
}
