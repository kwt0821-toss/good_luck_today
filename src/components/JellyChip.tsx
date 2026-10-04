export const PINK_JELLY_SRC = "/pink-jelly.png";

type PinkJellyIconProps = {
  className?: string;
};

export function PinkJellyIcon({ className }: PinkJellyIconProps) {
  return <img className={className} src={PINK_JELLY_SRC} alt="" draggable={false} />;
}

type JellyChipProps = {
  count: number;
};

export function JellyChip({ count }: JellyChipProps) {
  return (
    <div className="jelly-chip" aria-label={`핑크젤리 ${count}개`}>
      <PinkJellyIcon className="jelly-chip-icon" />
      <strong>{count.toLocaleString("ko-KR")}</strong>
    </div>
  );
}
