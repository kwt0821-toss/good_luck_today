import { adaptive } from "@toss/tds-colors";
import { ListRow } from "@toss/tds-mobile";
import type { ReactNode } from "react";

type EmojiAssetProps = {
  children: ReactNode;
  backgroundColor?: string;
  size?: "xsmall" | "small" | "medium";
};

export function EmojiAsset({
  children,
  backgroundColor = adaptive.greyOpacity100,
  size = "medium",
}: EmojiAssetProps) {
  return (
    <ListRow.AssetText shape="squircle" size={size} backgroundColor={backgroundColor}>
      {children}
    </ListRow.AssetText>
  );
}
