# LuckyCat 로딩 창 C · 꿈나라 로딩 (final)

## Files
| file | put in app at | size |
|---|---|---|
| assets/loading-cat.webp (132×112) | public/assets/loading/ | 4.5 KB |
| assets/loading-cat@2x.webp (264×224) | public/assets/loading/ | 10.0 KB |
| assets/loading-moon.webp (64×64) | public/assets/loading/ | 1.7 KB |
| assets/loading-moon@2x.webp (128×128) | public/assets/loading/ | 3.8 KB |
| src/components/LoadingModal.tsx | src/components/ | – |
| src/components/LoadingModal.css | src/components/ | – |

Total image weight: ~20 KB (all four). Card, gold border, cat ears, star corners, cloud,
progress bar with 5 stars, twinkles and Z-z-Z are pure CSS/HTML/text, so the modal shows instantly.
If the app wraps image URLs with `withAssetVersion()`, wrap `ASSET_BASE` paths the same way.

## Usage
```tsx
import { LoadingModal } from "./components/LoadingModal";

<LoadingModal open={loading} />                       // indeterminate bar
<LoadingModal open={loading} progress={0.63} />       // progress-driven (0–1)
<LoadingModal open messages={["카드를 섞는 중이냥...", "거의 다 됐다냥!"]} title="잠깐 꿈나라." />
```
Props: `open` (required), `messages?` (default below), `progress?` 0–1 (omit = indeterminate loop),
`title?` (default `잠깐 꿈나라.`), `intervalMs?` (default 2500).

Default messages (rotate every 2.5 s, restart from the first each time it opens):
1. 잠시만 기다려달라냥  2. 꿈속에서 행운을 찾는 중...  3. 하암~ 곧 일어날게냥

No indicator dots under the message (removed on purpose).

## Look
- Overlay: `rgba(12,8,28,.66)` + 2.5px backdrop blur, fixed full webview (Toss titlebar is native and stays above).
- Card: 292px wide (max 100vw−48px), radius 30, gradient #3d3166 → #2a2140 → #211a35, 2.5px #FFD54A border, gold glow.
- Ears: inline SVG on top edge, pink inner #FFB3C7. Corners ✦/✧ in #FFC93D.
- Title: Jua 22px #FFD54A, shadow 0 2px #4A2A05. Message: Gaegu 700 22px #FFF3D6.
- Stage 248×160: moon (top-left), CSS cloud, cat on cloud, Z-z-Z (Gaegu) top-right, 6 twinkles.
- Bar: 14px track, gold gradient fill with ✦ tip, 5 ★ at 12/30/48/66/84 % (lit when progress passes them).

## Animation (CSS keyframes only)
| element | keyframes | timing |
|---|---|---|
| overlay / card | lc-fade-in / lc-pop | 160 ms / 220 ms on open |
| cat | lc-breathe (scale 1 → 1.03×1.045, origin bottom) | 2.6 s loop |
| z, z, Z | lc-zfloat (fade in, drift up-right, fade out) | 2.4 s loop, delays 0 / 0.8 / 1.6 s |
| twinkles, bar tip | lc-twinkle | 1.8 s / 1.2 s loop |
| lit stars | lc-star-twinkle | 1.6 s, staggered 0.3 s |
| fill (no `progress`) | lc-fill-loop 8% → 92% → 8% | 2.2 s loop |
| fill (with `progress`) | width transition | 300 ms |
| message | lc-msg-in (fade + 4px rise) on each change | 280 ms |

`prefers-reduced-motion: reduce` → all animations off; Z's shown static, indeterminate bar fixed at 60%,
messages still change (no motion).

## Loading behaviour
- Text and card render immediately; images use `decoding="async"` and fade in (`.lc-img.is-loaded`) after `onLoad`.
- Optional: preload on app start so the cat is ready the first time:
  `<link rel="preload" as="image" href="/assets/loading/loading-cat@2x.webp">` (or `new Image().src = ...`).
- Accessibility: `role="dialog" aria-modal aria-busy`, bar has `role="progressbar"` (+ `aria-valuenow` when determinate),
  message is `aria-live="polite"`.

## Source
Cat = existing main-screen sleeping cheese cat (`mainscreen-assets/cat-sleeping-nodrool.png`), resized.
Moon = drawn crescent with soft glow. Preview: `preview-loading-c.png` (preview/preview.html).
