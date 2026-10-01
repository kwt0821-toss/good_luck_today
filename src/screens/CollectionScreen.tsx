import { adaptive } from "@toss/tds-colors";
import { BottomSheet, ListHeader, SegmentedControl, Text, Top } from "@toss/tds-mobile";
import { useMemo, useState } from "react";

import { CatPortrait } from "../components/CatPortrait";
import { ScreenHeader } from "../components/ScreenHeader";
import { CATS, TOTAL_CAT_COUNT } from "../lib/cats";
import { formatShortDate } from "../lib/date";
import { GradeBadge } from "../components/GradeBadge";
import type { Cat, CollectionSort, Grade, GradeFilter, UserState } from "../types";

const GRADE_TABS: GradeFilter[] = ["ALL", "SSS", "S", "A", "B", "C"];
const GRADE_RANK: Record<Grade, number> = { SSS: 0, S: 1, A: 2, B: 3, C: 4 };

type CollectionScreenProps = {
  user: UserState;
  onBack: () => void;
};

export function CollectionScreen({ user, onBack }: CollectionScreenProps) {
  const [filter, setFilter] = useState<GradeFilter>("ALL");
  const [sort, setSort] = useState<CollectionSort>("acquired");
  const [selected, setSelected] = useState<Cat | null>(null);

  const cats = useMemo(() => {
    const filtered = CATS.filter((cat) => (filter === "ALL" ? true : cat.grade === filter));
    return [...filtered].sort((a, b) => {
      const aUnlocked = user.unlockedCatIds.includes(a.id);
      const bUnlocked = user.unlockedCatIds.includes(b.id);
      if (sort === "acquired") {
        if (aUnlocked !== bUnlocked) return aUnlocked ? -1 : 1;
        const aDate = user.collection[a.id]?.unlockedAt ?? "9999-99-99";
        const bDate = user.collection[b.id]?.unlockedAt ?? "9999-99-99";
        if (aDate !== bDate) return aDate.localeCompare(bDate);
        return a.id.localeCompare(b.id);
      }
      if (GRADE_RANK[a.grade] !== GRADE_RANK[b.grade]) {
        return GRADE_RANK[a.grade] - GRADE_RANK[b.grade];
      }
      if (aUnlocked !== bUnlocked) return aUnlocked ? -1 : 1;
      return a.id.localeCompare(b.id);
    });
  }, [filter, sort, user.collection, user.unlockedCatIds]);

  const selectedUnlocked = selected ? user.unlockedCatIds.includes(selected.id) : false;
  const selectedRecord = selected ? user.collection[selected.id] : undefined;

  return (
    <div className="screen">
      <ScreenHeader title="고양이 도감" showBack onBack={onBack} />
      <Top
        title={
          <Top.TitleParagraph size={22}>
            {user.unlockedCatIds.length}/{TOTAL_CAT_COUNT}마리 해금
          </Top.TitleParagraph>
        }
        subtitleBottom={
          <Top.SubtitleParagraph size={15}>
            핑크젤리 {user.pinkJellyBalance}개 · 처음 만난 고양이만 젤리를 받아요
          </Top.SubtitleParagraph>
        }
      />

      <div className="collection-toolbar">
        <div className="grade-filters" role="tablist" aria-label="등급 필터">
          {GRADE_TABS.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={filter === item}
              className={`grade-filter ${filter === item ? "is-active" : ""}`}
              onClick={() => setFilter(item)}
            >
              {item === "ALL" ? "전체" : item}
            </button>
          ))}
        </div>
        <SegmentedControl
          size="small"
          value={sort}
          onChange={(value) => setSort(value as CollectionSort)}
        >
          <SegmentedControl.Item value="grade">등급 순</SegmentedControl.Item>
          <SegmentedControl.Item value="acquired">획득 순</SegmentedControl.Item>
        </SegmentedControl>
      </div>

      <ListHeader
        title={
          <ListHeader.TitleParagraph typography="t5" color={adaptive.grey800} fontWeight="bold">
            {filter === "ALL" ? "모든 고양이" : `${filter} 등급`}
          </ListHeader.TitleParagraph>
        }
      />

      <div className="cat-grid">
        {cats.map((cat) => {
          const unlocked = user.unlockedCatIds.includes(cat.id);
          const record = user.collection[cat.id];
          return (
            <button
              key={cat.id}
              type="button"
              className={`cat-card ${unlocked ? "" : "is-locked"}`}
              onClick={() => setSelected(cat)}
            >
              <CatPortrait cat={cat} unlocked={unlocked} />
              <div className="cat-card-meta">
                {unlocked ? <GradeBadge grade={cat.grade} /> : null}
                <strong>{unlocked ? cat.name : "???"}</strong>
                <span>
                  {unlocked && record
                    ? `${formatShortDate(record.unlockedAt)} · 중복 ${Math.max(0, record.count - 1)}`
                    : "아직 만나지 못했어요"}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <BottomSheet
        open={selected !== null}
        onClose={() => setSelected(null)}
        header={
          <BottomSheet.Header>{selectedUnlocked ? selected?.name : "아직 해금되지 않았어요"}</BottomSheet.Header>
        }
        headerDescription={
          selected ? (
            <BottomSheet.HeaderDescription>
              {selectedUnlocked ? selected.description : "소환하면 이름과 행운의 한마디가 열려요."}
            </BottomSheet.HeaderDescription>
          ) : undefined
        }
        cta={
          <BottomSheet.CTA onClick={() => setSelected(null)}>
            닫기
          </BottomSheet.CTA>
        }
      >
        {selected ? (
          <div className="collection-detail">
            <CatPortrait cat={selected} unlocked={selectedUnlocked} size="hero" />
            {selectedUnlocked ? (
              <>
                <GradeBadge grade={selected.grade} size="large" />
                <Text typography="t6" color={adaptive.grey700} display="block">
                  획득일 {selectedRecord ? formatShortDate(selectedRecord.unlockedAt) : "-"} · 총{" "}
                  {selectedRecord?.count ?? 1}회 · 중복 {Math.max(0, (selectedRecord?.count ?? 1) - 1)}회
                </Text>
              </>
            ) : (
              <Text typography="t6" color={adaptive.grey600} display="block">
                실루엣만 보이지만, 분명 어딘가에서 기다리고 있어요.
              </Text>
            )}
          </div>
        ) : null}
      </BottomSheet>
    </div>
  );
}
