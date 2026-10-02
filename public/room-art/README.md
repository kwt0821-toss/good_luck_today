# 고양이방 그림 넣는 방법

아이소메트릭 벽·바닥은 직접 그리지 마세요. **정사각 패턴**과 **세워 둔 아이템 PNG**만 만들면 앱이 맵에 맞춰 붙입니다.

## 폴더

파일을 이 이름 그대로 넣으면 코드 수정 없이 바로 보여요. 파일이 없으면 기본 SVG가 나와요.

| 종류 | 크기 | 저장 위치 |
|---|---|---|
| 벽지 | 256 × 256, 심리스 PNG | `public/room-art/walls/{아이템id}.png` |
| 바닥 | 256 × 256, 심리스 PNG | `public/room-art/floors/{아이템id}.png` |
| 1칸 가구/소품 | 128 × 160, 배경 투명 PNG | `public/room-art/items/{아이템id}.png` |
| 2칸 가구 | 256 × 160, 배경 투명 PNG | `public/room-art/items/{아이템id}.png` |

아이템 id 예: `wall_mint`, `floor_wood`, `decor_yarn`, `furn_bed`

도안 SVG는 `templates/` 안에 있어요. Figma·Aseprite·포토샵에서 연 다음 그 위에 그리면 됩니다.

## 그리는 요령

- **벽지/바닥**: 위·아래·좌·우가 이어지는 타일 패턴. 원근은 넣지 마세요.
- **아이템**: 3/4 아이소 시점으로 세워서 그리고, 발은 아래 마름모 가이드 안에 두세요.
- 픽셀 느낌을 원하면 1칸 아이템을 64×80으로 그린 뒤 200%로 키워 128×160으로 저장하세요.

## AI로 만들 때

벽지:

```
Seamless 256x256 pixel-art wallpaper texture, pastel mint, tiny cute paw prints, flat repeating pattern, no furniture, no characters, tileable
```

바닥:

```
Seamless 256x256 pixel-art floor texture, pastel cream wood planks, top-down, tileable, no objects
```

아이템:

```
Isometric pixel-art yarn ball game sprite, 3/4 view, cute pastel, sitting on a small diamond floor shadow, transparent background, 128x160, no UI
```
