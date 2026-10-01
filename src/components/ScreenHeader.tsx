import {
  TopNavigation,
  TopNavigationBackButton,
  TopNavigationIconButton,
} from "@toss/tds-mobile";

import { isInTossApp } from "../lib/native";

type ScreenHeaderProps = {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  accessoryName?: string;
  accessoryLabel?: string;
  onAccessoryClick?: () => void;
};

export function ScreenHeader({
  title,
  showBack = false,
  onBack,
  accessoryName,
  accessoryLabel,
  onAccessoryClick,
}: ScreenHeaderProps) {
  if (isInTossApp()) {
    return null;
  }

  return (
    <TopNavigation
      withSafeAreaTop={false}
      leading={
        showBack ? (
          <TopNavigationBackButton aria-label="뒤로 가기" onClick={onBack} />
        ) : null
      }
      content={title}
      trailing={
        accessoryName && accessoryLabel ? (
          <TopNavigationIconButton
            name={accessoryName}
            aria-label={accessoryLabel}
            onClick={onAccessoryClick}
          />
        ) : null
      }
    />
  );
}
