# 도감 보상 직접 받기 (claimMode: manual) — dex-spec 추가 섹션
보상은 자동으로 지급하지 않아요. 도감에서 직접 받아요. 받지 않은 보상은 기한 없이 남아요.

## 보상 id (계정당 1회, 서버에서 확인)
newCard:{cardId} = 냥코인 1 + 20P · set:breed:{id} = +10 / +200P · set:special|character|legend = +10 / +300P · fullDex = +100 / +3000P
API `POST /dex/rewards/claim {rewardIds|'all', requestId}`. 유니크 키(tossUserKey+rewardId), 지급과 claimed 표시는 한 트랜잭션, 같은 requestId로 재시도하면 같은 응답

## UI
| 위치 | id | 문구/동작 |
|---|---|---|
| 헤더 칩 | #dex-claim-all-chip / #btn-dex-claim-all | 받을 보상 {n}개 · 냥코인 {c} + {p}P [모두 받기] (n=0이면 숨김) |
| 탭 점 | .tab .rd | 해당 탭에 받을 보상이 있을 때 |
| 슬롯 코인 배지 | #dex-claim-{cardId} (.gift, 24pt, glow) | 처음 1회 툴팁: 톡, 눌러서 냥코인 1 + 20P 받기 |
| 세트 행 | #btn-set-claim-{key} | 완성 보상 받기 (빛나는 버튼) → 축하 시트 |
| 축하 시트 | #sheet-set-celebrate | SET COMPLETE / {품종} 1~5성을 모두 모았어요! / 한 품종을 끝까지 모은 집사에게 드리는 선물이에요 / +10 냥코인 +200 포인트 / [보상 받기] / 냥코인은 메뉴 › 보상함에서 10개부터 토스포인트로 받을 수 있어요 |
| 그룹 | 동일 시트 | 스페셜·캐릭터·레전드 카드를 모두 모았어요! (+10 / +300P) |
| 도감 완성 | #sheet-fulldex | 107마리를 모두 만났어요! 도감 완성! (전체 화면 컨페티, 큰 코인 비) +100 냥코인 +3000 포인트 |
| 받기 토스트 | #dex-claim-toast | 냥코인 1개 + 20포인트 받았어요 / 보상 {n}개를 한 번에 받았어요 · 냥코인 {c}개 + {p}포인트 / 받을 보상을 모두 받았어요 |
| 메인 도감 아이콘 | #btn-dex .rd | unclaimedCount>0 |
| 보상함 | #btn-rewards-to-dex | 도감에서 받을 보상 {n}개 → 도감 가기 (보상함에는 모두 받기를 두지 않음) |

연출: 코인 버스트(6~8개, 600ms) → 헤더 숫자 카운트업 + sfx-reward-coin. 응답을 받은 뒤에만 배지 제거. 실패하면 배지를 유지하고 "잠시 후 다시 받아 주세요"
Mockups: dex-claim-new.png, dex-claim-set.png, dex-claim-celebrate.png, reveal-new-copy.png
