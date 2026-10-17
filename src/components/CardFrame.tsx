import { forwardRef, useEffect, useLayoutEffect, useRef, useState } from "react";

import { PLATE_GRADE_COLOR, boxStyle, miniRibbonLabel, resolveFrame, type FrameSubject } from "../lib/cardFrames";
import { loadPlainCat } from "../lib/plainCat";
import "./CardFrame.css";

type CardFrameProps = {
  card: FrameSubject;
  catSrc: string;
  name?: string;
  /** "No.023" — cards.json order, full cards only. */
  dexNo?: string;
  variant?: "full" | "mini";
  className?: string;
};

/** 50% of the ribbon height, then shrink so one line plus the 2px stroke stays inside. */
function useFitRibbon(label: string, active: boolean) {
  const boxRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    if (!active) return;
    const box = boxRef.current;
    const text = textRef.current;
    if (!box || !text) return;

    let cancelled = false;
    const fit = () => {
      if (cancelled) return;
      const height = box.clientHeight;
      const width = box.clientWidth;
      if (height < 1 || width < 1) return;
      const stroke = 2;
      let size = height * 0.5;
      text.style.fontSize = `${size}px`;
      const available = Math.max(1, width - stroke * 2);
      const needed = text.scrollWidth;
      if (needed > available) {
        size *= available / needed;
        text.style.fontSize = `${size}px`;
      }
    };

    fit();
    const fonts = document.fonts;
    if (fonts) void fonts.ready.then(fit);
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [label, active]);

  return { boxRef, textRef };
}

export const CardFrame = forwardRef<HTMLDivElement, CardFrameProps>(function CardFrame(
  { card, catSrc, name = "", dexNo = "", variant = "full", className },
  ref,
) {
  const frame = resolveFrame(card);
  const mini = variant === "mini";
  const grade = miniRibbonLabel(card);
  const [artSrc, setArtSrc] = useState(catSrc);
  const showName = !mini && Boolean(name);
  const { boxRef, textRef } = useFitRibbon(name, showName);

  useEffect(() => {
    if (mini) {
      setArtSrc(catSrc);
      return;
    }
    let cancel = false;
    setArtSrc(catSrc);
    void loadPlainCat(catSrc).then((url) => {
      if (!cancel) setArtSrc(url);
    });
    return () => {
      cancel = true;
    };
  }, [catSrc, mini]);

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
        <img className="cat" src={artSrc} alt="" draggable={false} />
        {!mini && dexNo ? (
          <span className="stamp" style={{ color: frame.nameColor }}>
            {dexNo}
          </span>
        ) : null}
      </div>
      <img className="frame" src={frame.frameSrc} srcSet={frame.frameSrcSet} alt="" draggable={false} />
      {!mini ? (
        <div className="plate" style={{ ...boxStyle(frame.layout.plate), color: PLATE_GRADE_COLOR }}>
          <span>{grade}</span>
        </div>
      ) : null}
      {mini ? (
        <div className="name">{grade}</div>
      ) : showName ? (
        <div ref={boxRef} className="name" style={{ ...boxStyle(frame.layout.ribbon), color: frame.nameColor }}>
          <span ref={textRef} className="name-text">
            {name}
          </span>
        </div>
      ) : null}
    </div>
  );
});
