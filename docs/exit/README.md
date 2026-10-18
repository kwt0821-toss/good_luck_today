# LuckyCat: exit confirm modal (variant A, cat A-1)

## Where the files go (repo `good_luck_today`)
| From this package | Into the app |
|---|---|
| `assets/exit/exit-cat-a.webp` (140px, ~6KB), `exit-cat-a@2x.webp` (280px, ~12KB) | `public/assets/exit/` |
| `src/components/ExitConfirmModal.tsx`, `ExitConfirmModal.css` | `src/components/` |
| `src/components/ExitBackHandler.example.tsx` | Example only. Copy the hook into the home screen (or `src/hooks/`). |

Fonts: uses the app's existing `Jua` and `Gaegu` families. No new font files.

## Component
```tsx
<ExitConfirmModal open={open} onStay={() => setOpen(false)} onExit={() => Screen.close()} />
```
- `onStay`: called by "더 놀래", a tap on the backdrop, or Escape.
- `onExit`: called by "종료하기". The caller closes the mini-app.
- Animations are CSS only (pop-in, the cat sways ±2.5° from the bottom, a teardrop drips every 2.6s). They are turned off when the user has "reduce motion" on.
- Accessibility: `role="alertdialog"` with a label and description. Focus starts on "더 놀래".

## Hooking it to the Toss back button
See `ExitBackHandler.example.tsx`. It was type-checked against `@apps-in-toss/web-framework` 3.7.0, the version in package-lock.
```tsx
import { graniteEvent, Screen } from "@apps-in-toss/web-framework";
useEffect(() => {
  if (!isHomeScreen) return;                   // other screens: normal back
  return graniteEvent.addEventListener("backEvent", {
    onEvent: () => setOpen(o => !o),           // back again while open = stay
    onError: console.error,
  });                                          // returns the unsubscribe function
}, [isHomeScreen]);
// 종료하기 → Screen.close()   (the docs call it closeView(); in SDK 3.7+ closeView is marked @deprecated in favour of Screen.close)
```
- While a `backEvent` listener is registered, Toss does not run its default back. That is why only the home screen subscribes.
- Do not use `history.replaceState` / React Router `replace` on the entry screen. It breaks the exit alert (techchat 3107).

## What the 앱인토스 docs and guidelines say
1. **Back can be intercepted.** Use `graniteEvent.addEventListener('backEvent', { onEvent, onError })`. It returns an unsubscribe function.
   https://developers-apps-in-toss.toss.im/documentation/common/screen/event ·
   https://developers-apps-in-toss.toss.im/documentation/sdk/events/graniteevent
2. **Closing the app** uses `closeView()` (SDK typings: `Screen.close()`).
   https://developers-apps-in-toss.toss.im/documentation/common/screen/close ·
   https://techchat-apps-in-toss.toss.im/t/topic/852
3. **The top-right X button cannot be intercepted.** This is Toss common policy. Toss shows its own "{앱 이름}을 종료할까요?" (닫기 / 종료하기) modal for X and for back on the first screen.
   https://techchat-apps-in-toss.toss.im/t/topic/4574 ·
   https://techchat-apps-in-toss.toss.im/t/topic/962 ·
   https://techchat-apps-in-toss.toss.im/t/topic/3834
4. **Review checklist (game and non-game):**
   - An exit confirmation modal appears when the app closes.
   - Back on the first screen, or the Android system back button, goes back or closes the app.
   - Every screen has a way out.
   - The result of a CTA can be predicted.
   - Bottom sheets must not be used to force behaviour on screen transitions.
   https://developers-apps-in-toss.toss.im/checklist/app-game ·
   https://developers-apps-in-toss.toss.im/checklist/app-nongame
5. **Dark-pattern guide.**
   - #2: no bottom sheet that blocks the user when they press back.
   - #3: there must always be a way to exit.
   - Breaking either can mean a rejected review or a suspended service.
   https://developers-apps-in-toss.toss.im/design/consumer-ux-guide
6. **A real rejection case.** An app was rejected because back on the first screen did not show an exit confirmation.
   https://techchat-apps-in-toss.toss.im/t/closeview/3052 ·
   https://techchat-apps-in-toss.toss.im/t/headershomw/4065

## Design changes made for the guidelines
- "종료하기" is now a **full button the same size as "더 놀래"** (side by side, clearly outlined) instead of a small underlined link. Exiting is one tap and easy to see.
- Added the plain line **"럭키캣을 종료할까요?"** so it is obvious this is an exit confirmation (CTA predictability).
- Back, a backdrop tap, or "더 놀래" only closes the modal. The modal is never shown twice in a row, and it never carries ads or rewards.
- It is used only on the first screen. X is left to Toss's native modal.

## Review risk
The playful "벌써 가는 거냥?" copy is a soft retention prompt. Because exiting is one equally visible tap, it should read as an exit confirmation, not a block. It is still custom UI in place of Toss's native confirm on back. If review pushes back, remove the `backEvent` listener on the home screen: Toss's native exit modal then appears by itself, and nothing else needs to change. It may be worth asking on techchat before submitting.
