import type { Cat } from "../types";

type CatPortraitProps = {
  cat: Cat;
  unlocked?: boolean;
  size?: "hero" | "card";
};

export function CatPortrait({ cat, unlocked = true, size = "card" }: CatPortraitProps) {
  return (
    <div className={`cat-portrait cat-portrait-${size} ${unlocked ? "" : "is-locked"}`}>
      <img className="cat-portrait-photo" src={cat.imageUrl} alt="" />
    </div>
  );
}
