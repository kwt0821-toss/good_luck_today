/** User-facing 발바닥 젤리 amount. "+10P" → "젤리 +10", "1,500P" → "젤리 1,500". */
export function jellyLabel(amount: number, plus = false): string {
  const text = amount.toLocaleString("ko-KR");
  return plus ? `젤리 +${text}` : `젤리 ${text}`;
}
