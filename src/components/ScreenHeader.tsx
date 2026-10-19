import { JellyChip } from "./JellyChip";

type ScreenHeaderProps = {
  pinkJellyBalance: number;
};

/** Balance chip only. The Toss nav bar already shows the screen chrome and back button. */
export function ScreenHeader({ pinkJellyBalance }: ScreenHeaderProps) {
  return (
    <div className="jelly-chip-bar">
      <JellyChip count={pinkJellyBalance} />
    </div>
  );
}
