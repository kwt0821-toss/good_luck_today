import { dexAsset } from "../lib/dexCatalog";
import type { DexCard, DexOwnedRecord } from "../lib/dexTypes";
import { ncoinIcon } from "../lib/ncoinIcon";

type SlotKind = "breed" | "special" | "character" | "legend" | "soon";

type DexCardSlotProps = {
  kind: SlotKind;
  card?: DexCard;
  record?: DexOwnedRecord;
  onClick?: () => void;
  /** Manual claim badge (economy.dexRewards.claimMode = manual). */
  claimable?: boolean;
  onClaim?: () => void;
  claimBusy?: boolean;
  /** Tutorial pulse (scale 1→1.06→1). */
  pulse?: boolean;
  /** When false, claim badge ignores taps (tutorial gate). */
  claimEnabled?: boolean;
};

function starsLabel(count: number): string {
  return "★".repeat(count);
}

export function DexCardSlot({
  kind,
  card,
  record,
  onClick,
  claimable = false,
  onClaim,
  claimBusy = false,
  pulse = false,
  claimEnabled = true,
}: DexCardSlotProps) {
  const owned = (record?.count ?? 0) > 0;
  const comingSoon = kind === "soon";
  const name = card?.type === "breed" ? card.breed?.en : card?.name?.ko;
  const alt = owned && name ? name : "아직 만나지 못한 고양이";

  return (
    <button
      type="button"
      id={card?.id ? `dex-slot-${card.id}` : undefined}
      className={`dex-slot dex-slot-${kind} ${owned ? "is-owned" : "is-locked"} ${comingSoon ? "is-soon" : ""} ${claimable ? "has-claim" : ""} ${pulse ? "is-tut-pulse" : ""}`}
      onClick={comingSoon ? undefined : onClick}
      disabled={comingSoon}
      aria-label={comingSoon ? "곧 만나요" : owned ? name : "잠긴 카드"}
    >
      {owned && card ? (
        <img
          className="dex-slot-img"
          src={dexAsset(kind === "breed" ? card.thumb : card.front)}
          alt={alt}
          loading="lazy"
        />
      ) : comingSoon ? (
        <>
          <img className="dex-slot-glyph" src={dexAsset("locked/glyph-plus.svg")} alt="" />
          <span className="dex-slot-caption">COMING SOON</span>
        </>
      ) : (
        <>
          {kind === "legend" ? (
            <>
              <img className="dex-slot-sparkle s1" src={dexAsset("icons/icon-sparkle.svg")} alt="" />
              <img className="dex-slot-sparkle s2" src={dexAsset("icons/icon-sparkle.svg")} alt="" />
              <img className="dex-slot-sparkle s3" src={dexAsset("icons/icon-sparkle.svg")} alt="" />
              <img className="dex-slot-sparkle s4" src={dexAsset("icons/icon-sparkle.svg")} alt="" />
              <img className="dex-slot-glyph legend-q" src={dexAsset("locked/glyph-legend-q.svg")} alt="" />
            </>
          ) : (
            <img
              className="dex-slot-glyph"
              src={dexAsset(`locked/glyph-${kind === "breed" ? "breed" : kind}.svg`)}
              alt=""
            />
          )}
          {kind === "breed" && card?.stars ? (
            <span className="dex-slot-stars">{starsLabel(card.stars)}</span>
          ) : null}
          {kind === "special" ? <span className="dex-slot-caption">SPECIAL</span> : null}
          {kind === "character" ? <span className="dex-slot-caption">CHARACTER</span> : null}
          {kind === "legend" ? <span className="dex-slot-caption">LEGEND</span> : null}
        </>
      )}
      {owned ? <span className="dex-slot-shine" aria-hidden="true" /> : null}
      {owned && record?.isNew ? <span className="dex-tag-new">NEW</span> : null}
      {owned && (record?.count ?? 0) >= 2 ? <span className="dex-badge-dup">×{record?.count}</span> : null}
      {owned && claimable && card ? (
        <span
          role="button"
          tabIndex={0}
          id={`dex-claim-${card.id}`}
          className={`dex-claim-badge ${claimBusy ? "is-busy" : ""}`}
          aria-label="보상 받기"
          onClick={(event) => {
            event.stopPropagation();
            if (!claimBusy && claimEnabled) onClaim?.();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              event.stopPropagation();
              if (!claimBusy && claimEnabled) onClaim?.();
            }
          }}
        >
          <img src={ncoinIcon(14)} alt="" width={14} height={14} />
        </span>
      ) : null}
    </button>
  );
}
