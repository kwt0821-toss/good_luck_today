import { forwardRef } from "react";

import { boxStyle, miniRibbonLabel, resolveFrame, type FrameSubject } from "../lib/cardFrames";
import "./CardFrame.css";

type CardFrameProps = {
  card: FrameSubject;
  catSrc: string;
  name?: string;
  line?: string;
  variant?: "full" | "mini";
  className?: string;
};

export const CardFrame = forwardRef<HTMLDivElement, CardFrameProps>(function CardFrame(
  { card, catSrc, name = "", line = "", variant = "full", className },
  ref,
) {
  const frame = resolveFrame(card);
  const mini = variant === "mini";
  const ribbon = mini ? miniRibbonLabel(card) : name;
  const classes = [
    "card-frame",
    mini ? "is-mini" : "",
    frame.foil ? "foil" : "",
    frame.glit ? "glit" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={ref} className={classes}>
      <div className="win" style={boxStyle(frame.layout.win)}>
        <img className="bg" src={frame.windowSrc} srcSet={frame.windowSrcSet} alt="" draggable={false} />
        <img className="cat" src={catSrc} alt="" draggable={false} />
      </div>
      <img className="frame" src={frame.frameSrc} srcSet={frame.frameSrcSet} alt="" draggable={false} />
      {!mini && line ? (
        <div className="line" style={{ ...boxStyle(frame.layout.plate), color: frame.lineColor }}>
          {line}
        </div>
      ) : null}
      {ribbon ? (
        <div
          className="name"
          style={mini ? undefined : { ...boxStyle(frame.layout.ribbon), color: frame.nameColor }}
        >
          {ribbon}
        </div>
      ) : null}
    </div>
  );
});
