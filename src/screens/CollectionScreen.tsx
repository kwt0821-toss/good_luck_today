import { adaptive } from "@toss/tds-colors";
import { BottomSheet, ListHeader, SegmentedControl, Text, Top } from "@toss/tds-mobile";
import { useMemo, useState } from "react";

import { LuckyCatCard } from "../components/LuckyCatCard";
import { ScreenHeader } from "../components/ScreenHeader";
import { CAT_SPECIES, TOTAL_CAT_COUNT, getCatsBySpecies, starLabel } from "../lib/cats";
import { formatShortDate } from "../lib/date";
import type { Cat, CollectionSort, SpeciesFilter, UserState } from "../types";

type CollectionScreenProps = {
  user: UserState;
  onBack: () => void;
};

export function CollectionScreen({ user, onBack }: CollectionScreenProps) {
  const [filter, setFilter] = useState<SpeciesFilter>("ALL");
  const [sort, setSort] = useState<CollectionSort>("species");
  const [selected, setSelected] = useState<Cat | null>(null);

  const groups = useMemo(() => {
    const speciesList =
      filter === "ALL" ? CAT_SPECIES : CAT_SPECIES.filter((item) => item.id === filter);

    const ordered = [...speciesList].sort((a, b) => {
      if (sort !== "acquired") return 0;
      const aDate = getCatsBySpecies(a.id)
        .map((cat) => user.collection[cat.id]?.unlockedAt)
        .filter(Boolean)
        .sort()[0];
      const bDate = getCatsBySpecies(b.id)
        .map((cat) => user.collection[cat.id]?.unlockedAt)
        .filter(Boolean)
        .sort()[0];
      if (!aDate && !bDate) return 0;
      if (!aDate) return 1;
      if (!bDate) return -1;
      return aDate.localeCompare(bDate);
    });

    return ordered.map((species) => ({
      species,
      cards: getCatsBySpecies(species.id),
      unlockedCount: getCatsBySpecies(species.id).filter((cat) =>
        user.unlockedCatIds.includes(cat.id),
      ).length,
    }));
  }, [filter, sort, user.collection, user.unlockedCatIds]);

  const selectedUnlocked = selected ? user.unlockedCatIds.includes(selected.id) : false;
  const selectedRecord = selected ? user.collection[selected.id] : undefined;

  return (
    <div className="screen">
      <ScreenHeader title="고양이 도감" showBack onBack={onBack} pinkJellyBalance={user.pinkJellyBalance} />
      <Top
        title={
          <Top.TitleParagraph size={22}>
            {user.unlockedCatIds.length}/{TOTAL_CAT_COUNT}장 해금
          </Top.TitleParagraph>
        }
        subtitleBottom={
          <Top.SubtitleParagraph size={15}>
            고양이 종류마다 1성부터 5성 카드를 모아 보세요.
          </Top.SubtitleParagraph>
        }
      />

      <div className="collection-toolbar">
        <div className="grade-filters" role="tablist" aria-label="고양이 종류">
          <button
            type="button"
            role="tab"
            aria-selected={filter === "ALL"}
            className={`grade-filter ${filter === "ALL" ? "is-active" : ""}`}
            onClick={() => setFilter("ALL")}
          >
            전체
          </button>
          {CAT_SPECIES.map((species) => (
            <button
              key={species.id}
              type="button"
              role="tab"
              aria-selected={filter === species.id}
              className={`grade-filter ${filter === species.id ? "is-active" : ""}`}
              onClick={() => setFilter(species.id)}
            >
              {species.name}
            </button>
          ))}
        </div>
        <SegmentedControl
          size="small"
          value={sort}
          onChange={(value) => setSort(value as CollectionSort)}
        >
          <SegmentedControl.Item value="species">종류 순</SegmentedControl.Item>
          <SegmentedControl.Item value="acquired">획득 순</SegmentedControl.Item>
        </SegmentedControl>
      </div>

      {groups.map((group) => (
        <section key={group.species.id} className="species-section">
          <ListHeader
            title={
              <ListHeader.TitleParagraph typography="t5" color={adaptive.grey800} fontWeight="bold">
                {group.species.name} · {group.unlockedCount}/5
              </ListHeader.TitleParagraph>
            }
          />
          <div className="cat-grid is-stars">
            {group.cards.map((cat) => {
              const unlocked = user.unlockedCatIds.includes(cat.id);
              return (
                <button
                  key={cat.id}
                  type="button"
                  className="star-slot"
                  onClick={() => setSelected(cat)}
                  aria-label={`${cat.name} ${starLabel(cat.star)}`}
                >
                  <LuckyCatCard cat={cat} unlocked={unlocked} size="mini" flippable={false} />
                  <span className="star-slot-label">{starLabel(cat.star)}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      <BottomSheet
        open={selected !== null}
        onClose={() => setSelected(null)}
        header={
          <BottomSheet.Header>
            {selected ? `${selected.name} ${starLabel(selected.star)}` : ""}
          </BottomSheet.Header>
        }
        headerDescription={
          selectedUnlocked ? (
            <BottomSheet.HeaderDescription>카드를 누르면 뒷면이 보여요</BottomSheet.HeaderDescription>
          ) : (
            <BottomSheet.HeaderDescription>소환하면 이름과 문구가 열려요.</BottomSheet.HeaderDescription>
          )
        }
        cta={
          <BottomSheet.CTA onClick={() => setSelected(null)}>
            닫기
          </BottomSheet.CTA>
        }
      >
        {selected ? (
          <div className="collection-detail">
            <LuckyCatCard cat={selected} unlocked={selectedUnlocked} />
            {selectedUnlocked ? (
              <Text typography="t6" color={adaptive.grey700} display="block">
                획득일 {selectedRecord ? formatShortDate(selectedRecord.unlockedAt) : "-"} · 총{" "}
                {selectedRecord?.count ?? 1}회 · 중복 {Math.max(0, (selectedRecord?.count ?? 1) - 1)}회
              </Text>
            ) : (
              <Text typography="t6" color={adaptive.grey600} display="block">
                아직 만나지 못한 카드예요.
              </Text>
            )}
          </div>
        ) : null}
      </BottomSheet>
    </div>
  );
}
