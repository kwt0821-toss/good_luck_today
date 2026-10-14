import type { CSSProperties, ReactNode } from "react";

type NyChipProps = {
  children: ReactNode;
  action?: { label: string; onClick: () => void };
  /** Arrow points up (default) or down toward the target. */
  arrow?: "up" | "down";
  /** Horizontal offset of the arrow tip. */
  arrowX?: number;
  className?: string;
  style?: CSSProperties;
  wide?: boolean;
};

export function NyChip({
  children,
  action,
  arrow = "up",
  arrowX = 28,
  className = "",
  style,
  wide,
}: NyChipProps) {
  return (
    <div
      className={`ny-chip ${arrow === "down" ? "dn" : ""} ${wide ? "wide" : ""} ${className}`.trim()}
      role="alert"
      style={{ ["--ny-arrow" as string]: `${arrowX}px`, ...style }}
    >
      <span className="pw" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <ellipse cx="7" cy="8" rx="2.2" ry="3" fill="#fff" />
          <ellipse cx="12" cy="5.5" rx="2.2" ry="3" fill="#fff" />
          <ellipse cx="17" cy="8" rx="2.2" ry="3" fill="#fff" />
          <path
            d="M6.5 14.5c0-2.4 2.3-4 5.5-4s5.5 1.6 5.5 4c0 2.6-2.2 4.2-5.5 4.2S6.5 17.1 6.5 14.5Z"
            fill="#fff"
          />
        </svg>
      </span>
      <span className="ny-chip-text">{children}</span>
      {action ? (
        <a
          href="#ny-chip-action"
          onClick={(event) => {
            event.preventDefault();
            action.onClick();
          }}
        >
          {action.label}
        </a>
      ) : null}
    </div>
  );
}
