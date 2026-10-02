import { TopNavigation, TopNavigationBackButton } from "@toss/tds-mobile";

import { isInTossApp } from "../lib/native";
import { JellyChip } from "./JellyChip";

type ScreenHeaderProps = {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  pinkJellyBalance: number;
};

export function ScreenHeader({
  title,
  showBack = false,
  onBack,
  pinkJellyBalance,
}: ScreenHeaderProps) {
  const chip = <JellyChip count={pinkJellyBalance} />;

  if (isInTossApp()) {
    return <div className="jelly-chip-bar">{chip}</div>;
  }

  return (
    <TopNavigation
      withSafeAreaTop={false}
      leading={showBack ? <TopNavigationBackButton aria-label="뒤로 가기" onClick={onBack} /> : null}
      content={title}
      trailing={chip}
    />
  );
}
