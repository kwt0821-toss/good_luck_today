import type { Cat, Grade } from "../types";

const GRADE_HUE: Record<Grade, number> = {
  SSS: 42,
  S: 280,
  A: 210,
  B: 168,
  C: 220,
};

const FACES = ["😺", "😸", "😻", "😽", "😼", "🐱", "🐈", "🐈‍⬛"] as const;

function hashId(id: string): number {
  return id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

type CatPortraitProps = {
  cat: Cat;
  unlocked?: boolean;
  size?: "hero" | "card";
};

export function CatPortrait({ cat, unlocked = true, size = "card" }: CatPortraitProps) {
  const hue = GRADE_HUE[cat.grade] + (hashId(cat.id) % 18);
  const face = FACES[hashId(cat.id) % FACES.length];

  return (
    <div
      className={`cat-portrait cat-portrait-${size} ${unlocked ? "" : "is-locked"}`}
      style={{
        background: `linear-gradient(160deg, hsl(${hue} 82% 92%), hsl(${hue} 70% 78%))`,
      }}
      aria-hidden="true"
    >
      {unlocked ? (
        <img
          className="cat-portrait-photo"
          src={cat.imageUrl}
          alt=""
          loading="lazy"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      ) : null}
      <span className="cat-portrait-face">{unlocked ? face : "🐾"}</span>
    </div>
  );
}
