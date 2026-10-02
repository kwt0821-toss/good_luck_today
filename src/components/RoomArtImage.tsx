import { useEffect, useState } from "react";

import { customArtUrl } from "../lib/roomArt";
import type { ShopItem } from "../types";

type RoomArtImageProps = {
  item: Pick<ShopItem, "id" | "category" | "imageUrl">;
  className?: string;
  alt?: string;
};

export function RoomArtImage({ item, className, alt = "" }: RoomArtImageProps) {
  const custom = customArtUrl(item);
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
