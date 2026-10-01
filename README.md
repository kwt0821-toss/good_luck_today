# 럭키캣 (Lucky Cat)

하루 한 번 방울을 울려 고양이를 소환하는 앱인토스 리워드 미니앱이에요.

- 매일 00:00 KST 기준 기본 소환 1회
- 전면 광고(Mock) 후 고양이 가차 소환
- 최초 해금 시 핑크젤리 +1, 중복은 카운터만 증가
- 하루 최대 5회 재도전: 일반 확률 / 확률업(30초 리워드 광고)
- 50종 이상 고양이 도감, 등급 필터와 획득 순 정렬

광고 SDK 연동 전에는 Mock Ad Modal이 3초(전면) / 30초(리워드) 타이머를 시뮬레이션해요. 유저 상태는 LocalStorage(또는 앱인토스 Storage)에 저장돼요.

## 시작하기

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:5173`을 열면 미리볼 수 있어요. 토스 앱 안에서는 앱인토스 샌드박스 또는 `.ait` 번들로 실행해요.

## 배포하기

앱인토스 배포 API 키는 [앱인토스 콘솔](https://apps-in-toss.toss.im/) > 워크스페이스 > API 키에서 발급받을 수 있어요.

```bash
npm run build
npm run deploy
```

## 유용한 링크

- [앱인토스 콘솔](https://apps-in-toss.toss.im/)
- [앱인토스 개발자센터](https://developers-apps-in-toss.toss.im/)
- [앱인토스 개발자 커뮤니티](https://techchat-apps-in-toss.toss.im/)
