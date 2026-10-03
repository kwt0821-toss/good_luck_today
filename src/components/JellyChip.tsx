type JellyChipProps = {
  count: number;
};

export function JellyChip({ count }: JellyChipProps) {
  return (
    <div className="jelly-chip" aria-label={`핑크젤리 ${count}개`}>
      <span className="jelly-chip-icon" aria-hidden="true">
        🍬
      </span>
      <strong>{count.toLocaleString("ko-KR")}</strong>
    </div>
  );
}
