# 고양이방 픽셀아트 넣는 방법

파니룸처럼 **쿼터뷰(2:1 아이소) 픽셀아트**로 그립니다. 방 전체를 한 장으로 뽑지 마세요. 앱이 타일에 맞춰 붙입니다.

## 폴더

| 종류 | 크기 | 저장 위치 |
|---|---|---|
| 벽지 | 32 × 32, 심리스 픽셀 패턴 PNG | `public/room-art/walls/{아이템id}.png` |
| 바닥 | 32 × 32, 심리스 픽셀 패턴 PNG | `public/room-art/floors/{아이템id}.png` |
| 1칸 가구/소품 | 32 × 40, 배경 투명 아이소 스프라이트 | `public/room-art/items/{아이템id}.png` |
| 2칸 가구 | 64 × 40, 배경 투명 아이소 스프라이트 | `public/room-art/items/{아이템id}.png` |

파일이 없으면 기본 픽셀 스프라이트가 나와요. 파일 이름은 `wall_mint`, `floor_wood`, `decor_yarn`, `furn_bed`처럼 아이템 id와 같아야 합니다.

## 그리는 요령

- **벽지/바닥**: 정사각 픽셀 패턴만. 기울어진 벽·마름모 바닥은 그리지 마세요. 원근 금지. 위·아래·좌·우가 이어져야 합니다.
- **아이템**: 2:1 쿼터뷰로 세워서 그립니다. 발은 아래 마름모 그림자 안에. 두꺼운 픽셀, 파스텔, 외곽선.
- 1배 픽셀로 그린 뒤 정수배로만 키우세요. 흐리게 리사이즈하면 파니룸 느낌이 사라집니다.

## AI 프롬프트

벽지:

```
32x32 seamless pixel-art wallpaper texture, 1:1 pixels, junior-naver pani room style, pastel mint, tiny paw dots, flat repeating pattern, no furniture, no perspective, tileable
```

바닥:

```
32x32 seamless pixel-art floor texture, 1:1 pixels, pani room style, pastel cream wood planks, top-down, tileable, no objects, no isometric diamond
```

아이템:

```
Isometric pixel-art game sprite, 2:1 quarter view, pani room / habbo dollhouse style, cute pastel, 32x40, transparent background, chunky pixels, sitting on a small diamond shadow, no room, no UI
```
