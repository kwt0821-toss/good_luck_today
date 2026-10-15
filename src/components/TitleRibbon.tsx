import { achvBadgeSrc } from "../lib/achievements";
import "./TitleRibbon.css";

type TitleRibbonProps = {
  id?: string;
  equippedName?: string | null;
  equippedId?: string | null;
  emptyCopy: string;
  hasClaimable: boolean;
  onOpen: () => void;
};

/** Highlight the first title hint inside empty ribbon copy (e.g. 새내기 집사). */
function EmptyRibbonCopy({ copy }: { copy: string }) {
  const match = copy.match(/^(칭호 없음 · )(.+?)( 받기.*)$/);
  if (!match) return <>{copy}</>;
  return (
    <>
      {match[1]}
      <em>{match[2]}</em>
      {match[3]}
    </>
  );
}

export function TitleRibbon({
  id = "title-ribbon",
  equippedName,
  equippedId,
  emptyCopy,
  hasClaimable,
  onOpen,
}: TitleRibbonProps) {
  const hasTitle = Boolean(equippedId && equippedName);
  return (
    <button
      type="button"
      id={id}
      className={`title-ribbon ${hasTitle ? "" : "is-empty"} ${hasClaimable ? "has-dot" : ""}`}
      onClick={onOpen}
      aria-label={hasTitle ? `칭호 ${equippedName}` : emptyCopy}
    >
      {hasTitle && equippedId ? (
        <img className="title-ribbon-badge" src={achvBadgeSrc(equippedId)} alt="" width={16} height={16} />
      ) : null}
      <span className="title-ribbon-text">
        {hasTitle ? equippedName : <EmptyRibbonCopy copy={emptyCopy} />}
      </span>
      <span className="title-ribbon-chevron" aria-hidden="true">
        ›
      </span>
      {hasClaimable ? <span className="title-ribbon-dot" aria-hidden="true" /> : null}
    </button>
  );
}
