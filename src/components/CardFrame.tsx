import { forwardRef } from "react";

import {
  PLATE_GRADE_COLOR,
  boxStyle,
  miniRibbonLabel,
  plateGradeFontSize,
  resolveFrame,
  ribbonNameFontSize,
  type FrameSubject,
} from "../lib/cardFrames";
import "./CardFrame.css";

type CardFrameProps = {
  card: FrameSubject;
  catSrc: string;
  name?: string;
  variant?: "full" | "mini";
  className?: string;
};

export const CardFrame = forwardRef<HTMLDivElement, CardFrameProps>(function CardFrame(
  { card, catSrc, name = "", variant = "full", className },
  ref,
) {
  const frame = resolveFrame(card);
  const mini = variant === "mini";
  const grade = miniRibbonLabel(card);
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
      {!mini ? (
        <div
          className="plate"
          style={{
            ...boxStyle(frame.layout.plate),
            color: PLATE_GRADE_COLOR,
            fontSize: plateGradeFontSize(frame.layout.plate),
          }}
        >
          {grade}
        </div>
      ) : null}
      {mini ? (
        <div className="name">{grade}</div>
      ) : name ? (
        <div
          className="name"
          style={{
            ...boxStyle(frame.layout.ribbon),
            color: frame.nameColor,
            fontSize: ribbonNameFontSize(frame.layout.ribbon, name),
          }}
        >
          {name}
        </div>
      ) : null}
    </div>
  );
});
