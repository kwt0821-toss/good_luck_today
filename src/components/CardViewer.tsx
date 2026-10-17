import type { ReactNode, Ref } from "react";

import "./CardViewer.css";

type CardViewerProps = {
  /** 오늘의 한 줄 */
  line?: string;
  showingBack?: boolean;
  children: ReactNode;
  className?: string;
  captionRef?: Ref<HTMLDivElement>;
  captionClassName?: string;
};

/** Shared draw + dex chrome: card, fortune under it, flip hint. */
export function CardViewer({
  line = "",
  showingBack = false,
  children,
  className,
  captionRef,
  captionClassName,
}: CardViewerProps) {
  const hint = showingBack ? "뒤집어서 앞면 보기" : "뒤집어서 뒷면 보기";
  return (
    <div className={["card-viewer", className ?? ""].filter(Boolean).join(" ")}>
      {children}
      <div ref={captionRef} className={["card-viewer-caption", captionClassName ?? ""].filter(Boolean).join(" ")}>
        {line ? <p className="card-viewer-line">{line}</p> : null}
        <p className="card-viewer-hint">
          <span>톡,</span> {hint}
        </p>
      </div>
    </div>
  );
}

/** Same fortune, pinned to the top of the card back. */
export function CardBackLine({ line }: { line?: string }) {
  if (!line) return null;
  return <p className="card-back-line">{line}</p>;
}
