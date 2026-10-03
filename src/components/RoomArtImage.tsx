import { useEffect, useState } from "react";

import { customArtUrl } from "../lib/roomArt";
import type { ShopItem } from "../types";

type RoomArtImageProps = {
  item: Pick<ShopItem, "id" | "category" | "imageUrl">;
  className?: string;
  alt?: string;
};

function preferredSrc(item: RoomArtImageProps["item"]): string {
  if (item.imageUrl.startsWith("data:")) return item.imageUrl;
  return customArtUrl(item);
}

export function RoomArtImage({ item, className, alt = "" }: RoomArtImageProps) {
  const custom = preferredSrc(item);
  const [src, setSrc] = useState(custom);

  useEffect(() => {
    setSrc(custom);
  }, [custom, item.imageUrl]);

  return (
    <img
      className={className}
      src={src}
      alt={alt}
      draggable={false}
      onError={() => {
        if (src !== item.imageUrl) setSrc(item.imageUrl);
      }}
    />
  );
}
