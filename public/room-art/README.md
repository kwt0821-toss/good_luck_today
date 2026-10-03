# 고양이방 그림 넣는 방법

방은 **2D 벡터 일러스트**로 그립니다. 아이소 벽 전체를 한 장으로 뽑지 마세요. 정사각 패턴과 세운 아이템만 넣으면 앱이 맵에 붙입니다.

## 폴더

| 종류 | 크기 | 저장 위치 |
|---|---|---|
| 벽지 | 256 × 256, 심리스 PNG/SVG | `public/room-art/walls/{아이템id}.png` |
| 바닥 | 256 × 256, 심리스 PNG/SVG | `public/room-art/floors/{아이템id}.png` |
| 1칸 가구/소품 | 128 × 160, 배경 투명 | `public/room-art/items/{아이템id}.png` |
| 2칸 가구 | 256 × 160, 배경 투명 | `public/room-art/items/{아이템id}.png` |

파일이 없으면 기본 벡터 그림이 나와요.

## 그리는 요령

- **벽지/바닥**: 위·아래·좌·우가 이어지는 플랫 벡터 패턴. 원근·픽셀아트는 넣지 마세요.
- **아이템**: 3/4 아이소 시점의 벡터 스프라이트. 발은 아래 마름모 가이드 안에.

## AI 프롬프트

벽지:

```
Seamless 256x256 2D vector wallpaper texture, cute pastel mint, tiny paw prints, flat illustration, no furniture, no characters, tileable, clean vector shapes
```

바닥:

```
Seamless 256x256 2D vector floor texture, pastel cream wood, top-down, tileable, flat illustration, no objects
```

아이템:

```
Cute isometric 2D vector game sprite, 3/4 view, pastel, sitting on a small diamond floor shadow, transparent background, 128x160, clean vector illustration, no pixel art, no UI
```
