import { useEffect, useMemo, useRef, useState } from "react";

import { DexCardSlot } from "../components/DexCardSlot";
import { DexDetailSheet } from "../components/DexDetailSheet";
import {
  TAB_COPY,
  TAB_META,
  cardsOfType,
  dexAsset,
  groupBreedRows,
  groupForCard,
  loadDexCatalog,
  ownedCount,
  sortBreedRowsAz,
  sortCardsAz,
} from "../lib/dexCatalog";
import { loadDexOwned, markDexCardViewed } from "../lib/dexCollection";
import { haptic, isInTossApp } from "../lib/native";
import type { DexCard, DexCatalog, DexOwnedMap, DexTab } from "../lib/dexTypes";
import "./DexScreen.css";

type DexScreenProps = {
  onBack: () => void;
};

export function DexScreen({ onBack }: DexScreenProps) {
  const [catalog, setCatalog] = useState<DexCatalog | null>(null);
  const [owned, setOwned] = useState<DexOwnedMap>({});
  const [tab, setTab] = useState<DexTab>(() => {
    const value = new URLSearchParams(window.location.search).get("tab");
    if (value === "special" || value === "character" || value === "legend" || value === "breed") {
      return value;
    }
    return "breed";
  });
  const [toast, setToast] = useState<string | null>(null);
  const [openCard, setOpenCard] = useState<DexCard | null>(null);
  const toastTimer = useRef(0);
  const tabRefs = useRef<Record<DexTab, HTMLButtonElement | null>>({
    breed: null,
    special: null,
    character: null,
    legend: null,
  });
  const [underline, setUnderline] = useState({ left: 0, width: 56 });

  useEffect(() => {
    void Promise.all([loadDexCatalog(), loadDexOwned()]).then(([nextCatalog, nextOwned]) => {
      setCatalog(nextCatalog);
      setOwned(nextOwned);
      const cardId = new URLSearchParams(window.location.search).get("card");
      if (cardId) {
        const found = nextCatalog.cards.find((item) => item.id === cardId);
        if (found && (nextOwned[found.id]?.count ?? 0) > 0) setOpenCard(found);
      }
    });
  }, []);

  useEffect(() => {
    const el = tabRefs.current[tab];
    if (!el) return;
    setUnderline({ left: el.offsetLeft, width: el.offsetWidth });
  }, [tab, catalog, owned]);

  const showToast = (message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1600);
  };

  const totals = catalog?.counts ?? { breed: 0, special: 0, character: 0, legend: 0 };
  const totalCards = catalog?.total ?? 107;
  const breedCards = catalog ? cardsOfType(catalog, "breed") : [];
  const specialCards = catalog ? sortCardsAz(cardsOfType(catalog, "special"), "special") : [];
  const characterCards = catalog ? sortCardsAz(cardsOfType(catalog, "character"), "character") : [];
  const legendCards = catalog ? sortCardsAz(cardsOfType(catalog, "legend"), "legend") : [];
  const breedRows = useMemo(() => sortBreedRowsAz(groupBreedRows(breedCards)), [breedCards]);

  const tabCounts: Record<DexTab, { owned: number; total: number }> = {
    breed: { owned: ownedCount(breedCards, owned), total: totals.breed },
    special: { owned: ownedCount(specialCards, owned), total: totals.special },
    character: { owned: ownedCount(characterCards, owned), total: totals.character },
    legend: { owned: ownedCount(legendCards, owned), total: totals.legend },
  };
  const ownedTotal =
    tabCounts.breed.owned + tabCounts.special.owned + tabCounts.character.owned + tabCounts.legend.owned;
  const percent = totalCards ? Math.round((ownedTotal / totalCards) * 100) : 0;

  const openOwned = async (card: DexCard) => {
    await haptic("tap");
    setOpenCard(card);
    const next = await markDexCardViewed(owned, card.id);
    setOwned(next);
  };

  const onSlot = (card: DexCard) => {
    if ((owned[card.id]?.count ?? 0) > 0) {
      void openOwned(card);
      return;
    }
    void haptic("softMedium");
    showToast("아직 만나지 못한 고양이예요");
  };

  return (
    <div className="dex-screen">
      <img className="dex-bg" src={dexAsset("bg-dex.webp")} alt="" />
      <div className="dex-grain" aria-hidden="true" />

      <header className="dex-header">
        {!isInTossApp() ? (
          <button type="button" className="dex-back" onClick={onBack} aria-label="뒤로 가기">
            ←
          </button>
        ) : null}
        <p className="dex-eyebrow">고양이 도감</p>
        <img className="dex-logo" src={dexAsset("logo-collection.svg")} alt="COLLECTION." />
        <div className="dex-progress-row">
          <p>
            모은 카드 <strong>{ownedTotal}</strong>
            <span> / {totalCards}</span>
          </p>
          <span className="dex-percent">{percent}%</span>
        </div>
        <div className="dex-progress-track">
          <div className="dex-progress-fill" style={{ width: `${percent}%` }} />
        </div>
      </header>

      <div className="dex-tabs" role="tablist" aria-label="도감 분류">
        {TAB_META.map((item) => {
          const count = tabCounts[item.id];
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`dex-tab ${active ? "is-active" : ""}`}
              ref={(el) => {
                tabRefs.current[item.id] = el;
              }}
              onClick={() => setTab(item.id)}
            >
              {item.label}
              <sup>
                {count.owned}/{count.total}
              </sup>
            </button>
          );
        })}
        <span className="dex-sort">A–Z</span>
        <span className="dex-tab-underline" style={{ left: underline.left, width: underline.width }} />
      </div>

      <div className="dex-body" key={tab}>
        {tab === "breed" ? (
          <div className="dex-breed-list">
            {breedRows.map((row) => {
              const have = row.slots.filter((slot) => (owned[slot.id]?.count ?? 0) > 0).length;
              const complete = have === 5;
              return (
                <section key={row.breedId} className="dex-breed-row">
                  <div className="dex-row-head">
                    <h2>
                      {row.en} <span>{row.ko}</span>
                    </h2>
                    {complete ? (
                      <span className="dex-complete">COMPLETE</span>
                    ) : (
                      <p className="dex-row-count">
                        <b>{have}</b> / 5
                      </p>
                    )}
                  </div>
                  <div className="dex-breed-slots">
                    {row.slots.map((card) => (
                      <DexCardSlot
                        key={card.id}
                        kind="breed"
                        card={card}
                        record={owned[card.id]}
                        onClick={() => onSlot(card)}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        ) : null}

        {tab === "special" || tab === "character" || tab === "legend" ? (
          <GridTab
            tab={tab}
            cards={tab === "special" ? specialCards : tab === "character" ? characterCards : legendCards}
            owned={owned}
            count={tabCounts[tab]}
            onSlot={onSlot}
          />
        ) : null}
      </div>

      <div className="dex-fade" aria-hidden="true" />

      {openCard && catalog ? (
        <DexDetailSheet
          card={openCard}
          group={groupForCard(catalog, openCard)}
          owned={owned}
          onClose={() => setOpenCard(null)}
          onChangeCard={setOpenCard}
        />
      ) : null}

      {toast ? (
        <div className="local-toast" role="status">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function GridTab({
  tab,
  cards,
  owned,
  count,
  onSlot,
}: {
  tab: Exclude<DexTab, "breed">;
  cards: DexCard[];
  owned: DexOwnedMap;
  count: { owned: number; total: number };
  onSlot: (card: DexCard) => void;
}) {
  const copy = TAB_COPY[tab];
  const comingSoon = tab === "character" ? 2 : 0;

  return (
    <section className={`dex-grid-wrap is-${tab}`}>
      <div className="dex-row-head">
        <h2>
          {copy.en} <span>{copy.ko}</span>
        </h2>
        <p className="dex-row-count">
          <b>{count.owned}</b> / {count.total}
        </p>
      </div>
      <p className="dex-note">{copy.note}</p>
      <div className={`dex-grid dex-grid-${tab}`}>
        {cards.map((card) => (
          <div key={card.id} className="dex-cell">
            <DexCardSlot kind={tab} card={card} record={owned[card.id]} onClick={() => onSlot(card)} />
            <p className={`dex-cell-name ${owned[card.id] ? "" : "is-locked"}`}>
              {owned[card.id] ? card.name?.ko : "???"}
            </p>
          </div>
        ))}
        {Array.from({ length: comingSoon }, (_, index) => (
          <div key={`soon-${index}`} className="dex-cell">
            <DexCardSlot kind="soon" />
            <p className="dex-cell-name is-soon">곧 만나요</p>
          </div>
        ))}
      </div>
    </section>
  );
}
