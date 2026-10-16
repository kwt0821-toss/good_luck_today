# COZY 레벨 시트 (cozy-1.0)
- **열기**: 방 화면의 `COZY Lv.n` 칩을 누르면 바텀시트(크림 #FFF6E6, 둥근 모서리 28px, 뒤 55% dim). 바깥 탭/아래로 끌면 닫힘.
- **히어로 카드(navy #1E1A2B)**: COZY 라벨 + 큰 `Lv.n`(44px), 초승달·별 장식. 진행바(민트→크림 그라데이션) = (cozyPoints − 현재 레벨 minCozy) / (다음 레벨 minCozy − 현재 minCozy). 왼쪽 `현재 / 다음 레벨 기준점`, 오른쪽 `Lv.n+1까지 N점 남았어요`. Lv.10 이후는 beyondLv10(+80/레벨) 기준.
- **점수표**: economy.json `cozy.pointsPerTier`(검정 큰 숫자)와 `duplicatePointsPerTier`(초록 +n). 표시 순서 소품·벽 꾸미기·벽지/바닥·가구·큰 가구. 벽지/바닥은 '1번'(중복 없음). 레전드는 아래 한 줄로.
- **안내 3줄**: '같은 아이템을 더 사면 절반 점수' / '방에 놓지 않아도 가지고 있으면 점수가 올라요' / '레전드급 한정 아이템은 60점 (+30)'.
- **버튼**: [아이템 보러가기] → 꾸미기 서랍(상점 탭) 열기.
- **데이터**: cozyPoints·level은 서버가 계산(GET /room/cozy → {cozyPoints, level, curMin, nextMin}). 점수표 숫자는 economy.json cozy에서 읽기. 공식: Σ[pointsPerTier + max(0,min(count,maxOwn)−1)×ceil(pointsPerTier×duplicateRate)].
- 목업: cozy-sheet.png (390×844 @3x, 방 화면 위). 예시 값 Lv.4 182/200.
