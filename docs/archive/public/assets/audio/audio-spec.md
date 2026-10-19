# Lucky Cat — 오디오 스펙 (audio-1.0)

에셋: `public/assets/audio/` (`sounds.json` + m4a/mp3). 설정 키: `lc.audio.bgm` / `lc.audio.sfx` (`"1"`/`"0"`).

## 포맷
`canPlayType('audio/mp4; codecs="mp4a.40.2"')` → m4a, 아니면 mp3. Web Audio (`AudioContext` + decode된 `AudioBuffer`).

## 볼륨
재생 볼륨 = `sounds.json` entry `volume` × 마스터(`masterVolume`).

## 설정
메뉴 › 설정: **배경음악(BGM)** 기본 OFF, **효과음** 기본 ON. 토글 즉시 적용.

## 자동재생
첫 `pointerdown`/`touchend`에서 `AudioContext.resume()`. 그 전엔 무음. BGM ON이면 800ms 페이드인. 가능하면 `navigator.audioSession.type = "ambient"`.

## BGM
- 메인/도감/메뉴/뽑기 공개 → `bgm-main`
- 방꾸미기 → `bgm-room`
- 화면 전환 600ms 크로스페이드(GainNode 2개). 같은 곡이면 유지.
- `loop=true`, `loopStart=0`, `loopEnd=loopEndSec`

## 라이프사이클
- `visibilitychange` hidden / `pagehide` → BGM 400ms 페이드아웃 후 정지, SFX 정지. visible + BGM ON이면 재개.
- 광고 `onAdOpen` → BGM 0·정지, SFX 차단. `onAdClose`/실패 → BGM ON이면 800ms 페이드인.

## SFX 트리거
tap(80ms debounce) · sheet-open/close · card-flip · reveal / reveal-rare · item-place · stamp · reward-coin · meow(고양이별 8초 쿨다운). 동시 최대 6.
