# Lucky Cat — 오디오 스펙 (audio-1.0)

파일은 `public/assets/audio/`에 둬요. 목록·볼륨·트리거는 `sounds.json`이 기준이고, 출처·라이선스는 `LICENSES.md`에 있어요(전부 CC0).

## 1. 포맷·레벨
| 구분 | 레벨 | 포맷 |
|---|---|---|
| BGM 2곡 | −18 LUFS 통합, 트루 피크 ≤ −1.5 dBTP, 44.1 kHz 스테레오 | `.m4a`(AAC 128k, iOS Safari 우선) + `.mp3`(128k 대체) |
| SFX 10개 | 순간 라우드니스 최대 −14 LUFS 목표, 트루 피크 −1 dBTP 상한(아주 짧은 소리는 피크 상한이 먼저 걸려서 조금 작아요), 앞뒤 무음 제거, 끝 15ms 페이드 | 같음 |
`canPlayType('audio/mp4; codecs="mp4a.40.2"')`이면 m4a, 아니면 mp3를 써요.

## 2. 기본값·설정
- **배경음악(BGM): 기본 OFF**, **효과음: 기본 ON.** 토스 안에서 갑자기 음악이 나오지 않게 해요.
- 메뉴 › 설정에 두 토글을 둬요(menu.json `settings.items`의 `bgm`, `sfx`). 저장은 localStorage `lc.audio.bgm`, `lc.audio.sfx` ("1"/"0").
- 기기 무음 스위치: iOS에서 Web Audio는 무음 모드를 따르도록 `navigator.audioSession.type = "ambient"`(지원 시)를 설정해요. 미지원이면 효과음만 HTMLAudio 대신 Web Audio로 재생하고, BGM은 사용자가 켰을 때만 재생해요.

## 3. 재생 규칙
1. **자동재생**: AudioContext는 첫 사용자 제스처(pointerdown/touchend)에서 `resume()` 해요. BGM이 ON이면 그 뒤에 페이드인(800ms) 해요. 그 전에는 아무 소리도 내지 않아요.
2. **화면 숨김**: `visibilitychange`가 hidden이면 BGM을 400ms 페이드아웃 후 일시정지하고 진행 중인 SFX는 정지해요. visible이 되면 BGM ON일 때만 이어서 재생해요. `pagehide`/`blur`도 같은 처리를 해요.
3. **화면 전환**: 메인/도감/메뉴/뽑기 공개 = `bgm-main`, 방꾸미기 = `bgm-room`. 바뀔 때 **600ms 등전력 크로스페이드**(두 GainNode, cos/sin 곡선)를 써요. 같은 곡이면 그대로 이어가요.
4. **광고**: 광고 SDK `onAdOpen`(또는 show 호출 직전)에서 BGM을 200ms 안에 0으로 낮추고 일시정지, SFX를 차단해요. `onAdClose`/실패 시 BGM ON이면 800ms 페이드인으로 복귀해요. 광고 보고 돌아온 직후의 뽑기 공개 SFX는 정상 재생해요.
5. **루프**: BGM은 `AudioBufferSourceNode.loop = true`, `loopStart = 0`, `loopEnd = sounds.json loopEndSec`로 재생해요(m4a/mp3 디코더 패딩 때문에 버퍼 끝까지 돌리면 틈이 생겨요). 루프 지점은 원곡의 반복 구간에 맞추고 60ms 크로스페이드를 넣어서 이음새가 없어요.
6. **SFX**: 미리 디코드한 AudioBuffer를 재사용하고, 동시 재생은 최대 6개예요. `sfx-tap`은 80ms 안에 다시 울리지 않게 하고, `sfx-meow`는 고양이별 8초 쿨다운이에요. 움직임 줄이기 설정과는 무관해요.
7. 볼륨 = 파일 볼륨(`volume`) × 마스터. BGM이 재생 중일 때 등급 공개 SFX가 나오면 BGM을 −6dB로 1.2초 덕킹해요(선택).

## 4. 트리거 요약
| id | 언제 |
|---|---|
| sfx-tap | 버튼·아이콘·메뉴 행 탭(pointerup) |
| sfx-sheet-open / -close | 메뉴 패널, 바텀 시트 열기/닫기 |
| sfx-card-flip | 뽑기 공개 화면 카드 뒤집기 시작 |
| sfx-reveal | 1~4성 공개 순간 |
| sfx-reveal-rare | 5성·스페셜·캐릭터·레전드 공개 순간 |
| sfx-item-place | 방꾸미기 아이템 내려놓기 확정 |
| sfx-stamp | 출석 도장 착지 프레임 |
| sfx-reward-coin | 포인트·보상 지급 성공(출석 포인트, 광고 포인트, 중복 교환, 보상함) |
| sfx-meow | 방에서 돌아다니는 고양이 탭(자동 재생 없음) |

## 5. 파일
bgm-main / bgm-room / sfx-tap / sfx-card-flip / sfx-reveal / sfx-reveal-rare / sfx-item-place / sfx-stamp / sfx-reward-coin / sfx-sheet-open / sfx-sheet-close / sfx-meow — 각 `.m4a` + `.mp3`, `sounds.json`, `LICENSES.md`, 이 문서. 전체 미리듣기: `audio-preview.mp3`(zip 밖).
