import type { DexCard } from "./dexTypes";
import type {
  CoachMark,
  NcoinIntroThen,
  OpsState,
  OpsTutorial,
  RewardsIntroConfig,
  RewardsIntroStep,
  TutorialStep,
  TutorialStepThen,
  TutorialSubstep,
} from "./opsTypes";

export function isNcoinIntroThen(then: TutorialStepThen | undefined): then is NcoinIntroThen {
  return Boolean(then && "id" in then && then.id === "ncoin-intro" && "lines" in then);
}

export function dexSubstep(
  step: TutorialStep | null | undefined,
  id: string,
): TutorialSubstep | null {
  return step?.substeps?.find((entry) => entry.id === id) ?? null;
}

export function roomSubstep(
  step: TutorialStep | null | undefined,
  id: string,
): TutorialSubstep | null {
  return step?.substeps?.find((entry) => entry.id === id) ?? null;
}

/** Breed / type label for slot coach copy. */
export function dexCardBreedLabel(card: DexCard | null | undefined): string {
  if (!card) return "";
  if (card.type === "breed") return card.breed?.ko ?? card.breed?.en ?? "";
  return card.name?.ko ?? "";
}

/** Grade label: n★ for breed, type name otherwise. */
export function dexCardGradeLabel(card: DexCard | null | undefined): string {
  if (!card) return "";
  if (card.type === "breed" && card.stars) return `${card.stars}★`;
  if (card.type === "special") return "스페셜";
  if (card.type === "character") return "캐릭터";
  if (card.type === "legend") return "레전드";
  return "";
}

export function fillTutorialCopy(
  template: string,
  vars: {
    cardId?: string | null;
    breed?: string | null;
    grade?: string | null;
    dailyLimit?: number | null;
  } = {},
): string {
  let next = template;
  if (vars.cardId) next = next.split("{cardId}").join(vars.cardId);
  if (vars.breed != null) next = next.split("{품종}").join(vars.breed);
  if (vars.grade != null) next = next.split("{등급}").join(vars.grade);
  if (vars.dailyLimit != null) {
    next = next.split("{dailyLimit}").join(String(vars.dailyLimit));
  }
  // Drop unresolved placeholders so we don't show raw braces.
  next = next.replace(/[^\S\n]*·[^\S\n]*\{[^}]+\}/g, "").replace(/\{[^}]+\}/g, "");
  // Collapse spaces/tabs but keep intentional newlines from tutorial copy.
  return next
    .replace(/[^\S\n]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function dexSlotCoachMark(
  step: TutorialStep,
  vars: { cardId?: string | null; breed?: string | null; grade?: string | null },
): CoachMark | null {
  const sub = dexSubstep(step, "3-1");
  if (!sub) return null;
  return {
    id: "step-3-1",
    target: resolveTutorialTarget(sub.target, vars),
    copy: fillTutorialCopy(sub.copy ?? step.copy, vars),
    cta: sub.cta ?? "다음",
    ackOnly: sub.ackOnly !== false,
    showFinger: false,
    stepLabel: step.stepLabel ?? "STEP 3/5",
    bubble: "above",
  };
}

export function dexClaimCoachMark(
  step: TutorialStep,
  vars: { cardId?: string | null },
): CoachMark | null {
  const sub = dexSubstep(step, "3-2");
  if (!sub) return null;
  return {
    id: "step-3-2",
    target: resolveTutorialTarget(sub.target, vars, sub.fallbackTarget),
    copy: sub.copy ?? "",
    lines: sub.lines,
    showFinger: sub.showFinger !== false,
    ackOnly: true,
    activateTarget: Boolean(sub.claimGate),
    stepLabel: step.stepLabel ?? "STEP 3/5",
    bubble: "above",
  };
}

export function dexAfterClaimMark(step: TutorialStep): CoachMark | null {
  const sub = dexSubstep(step, "3-3") ?? dexSubstep(step, "3-2");
  const after = sub?.id === "3-3" ? sub : sub?.afterClaim;
  if (!after) return null;
  return {
    id: "id" in after && after.id ? after.id : "ncoin-first",
    target: "",
    title: after.title ?? "냥코인을 처음 받았어요!",
    copy: "copy" in after ? after.copy : undefined,
    cta: after.cta ?? "알겠어요",
    ackOnly: true,
    showFinger: false,
    stepLabel: step.stepLabel ?? "STEP 3/5",
  };
}

export function dexClaimToastText(step: TutorialStep | null | undefined): string | null {
  const sub = dexSubstep(step, "3-3");
  return sub?.toast?.text ?? null;
}

export function roomPickCoachMark(step: TutorialStep): CoachMark | null {
  const sub = roomSubstep(step, "4-1");
  if (!sub) return null;
  return {
    id: "step-4-1",
    target: resolveTutorialTarget(sub.target || "#drawer-item-0"),
    copy: sub.copy ?? step.copy ?? "서랍에서 마음에 드는 아이템을 톡 눌러 보세요",
    showFinger: sub.showFinger !== false,
    ackOnly: true,
    passThrough: true,
    stepLabel: step.stepLabel ?? "STEP 4/5",
    bubble: "above",
  };
}

/** Preview confirm phase: spotlight the ✓ button. */
export function roomDragCoachMark(step: TutorialStep): CoachMark | null {
  const sub = roomSubstep(step, "4-2");
  if (!sub) return null;
  return {
    id: "step-4-2",
    target: resolveTutorialTarget(sub.target || "#placement-confirm"),
    copy: sub.copy ?? "여기 놓을게요! ✓를 눌러 확정해요",
    sub: sub.sub,
    showFinger: sub.showFinger !== false,
    ackOnly: true,
    passThrough: true,
    stepLabel: step.stepLabel ?? "STEP 4/5",
    // Above the ✓ toolbar (not parked on the drawer) so it won't cover the item.
    bubble: "above",
    // Keep the selected preview item + drawer tile bright with the ✓ button.
    alsoHighlight: [
      "#drawer-item-0",
      ".lucky-sprite.is-preview-ghost",
      ".lucky-placement-hud",
      ".lucky-select-hud",
    ],
  };
}

/** Alias for tap→preview tutorial naming. */
export function roomPreviewCoachMark(step: TutorialStep): CoachMark | null {
  return roomDragCoachMark(step);
}

export function roomDoneCoachMark(step: TutorialStep): CoachMark | null {
  const sub = roomSubstep(step, "4-3");
  if (!sub) return null;
  return {
    id: "step-4-3",
    target: "",
    copy: sub.copy ?? "잘했어요! 다른 아이템도 자유롭게 꾸며 보세요",
    cta: sub.cta ?? "완료",
    ackOnly: true,
    showFinger: false,
    hideSkip: true,
    dim: false,
    stepLabel: step.stepLabel ?? "STEP 4/5",
  };
}

/** After decorate tip: highlight the drawer paw-points chip. */
export function roomPointsCoachMark(step: TutorialStep): CoachMark | null {
  const sub = roomSubstep(step, "4-4");
  if (!sub) return null;
  return {
    id: "step-4-4",
    target: resolveTutorialTarget(sub.target || "#room-points-chip"),
    copy: sub.copy ?? "발바닥 포인트를 모아 원하는 아이템을 구매할 수 있어요!",
    cta: sub.cta ?? "완료",
    ackOnly: true,
    showFinger: sub.showFinger !== false,
    hideSkip: true,
    // Dim + block outside the chip; CTA advances (chip itself is not the action).
    stepLabel: step.stepLabel ?? "STEP 4/5",
    bubble: "above",
  };
}

export type RewardsTutPhase = "menu" | "row" | "sheet" | null;

export function step5CoachMark(
  step: TutorialStep,
  phase: RewardsTutPhase,
  ops: OpsState,
  dailyLimit = 50,
): CoachMark | null {
  if (!phase) return null;
  const id = phase === "menu" ? "5-1" : phase === "row" ? "5-2" : "5-3";
  const sub = roomSubstep(step, id);
  if (!sub) return null;
  const label = step.stepLabel ?? "STEP 5/5";
  if (phase === "menu") {
    return {
      id: "step-5-1",
      target: resolveTutorialTarget(sub.target || "#btn-menu"),
      copy: sub.copy ?? "메뉴에서 모은 냥코인을 확인할 수 있어요",
      showFinger: true,
      // Hole dim + outside blocks; only the elevated menu button stays tappable.
      passThrough: true,
      activateTarget: true,
      ackOnly: true,
      stepLabel: label,
      // Menu sits at the top — keep copy below so it doesn't cover the button.
      bubble: sub.bubble ?? "below",
    };
  }
  if (phase === "row") {
    return {
      id: "step-5-2",
      target: resolveTutorialTarget(sub.target || "#menu-row-rewards"),
      copy: sub.copy ?? "보상함을 눌러 보세요",
      showFinger: true,
      ackOnly: true,
      passThrough: true,
      stepLabel: label,
      bubble: sub.bubble ?? "below",
    };
  }
  const low = ops.nyangCoinBalance < 10;
  const lowLine = sub.lines?.find((line) => (line.when ?? "").includes("< 10"));
  const footnote = fillTutorialCopy(sub.sub ?? "※ 하루 최대 {dailyLimit}원", { dailyLimit });
  const lowHint = low ? (lowLine?.copy ?? lowLine?.text ?? "조금만 더 모으면 받을 수 있어요") : null;
  return {
    id: "step-5-3",
    target: resolveTutorialTarget(sub.target || "#withdraw-picker", {}, sub.fallbackTarget),
    copy: (sub.copy ?? "냥코인 10개부터 토스포인트로 바꿀 수 있어요").split("\n")[0],
    sub: lowHint ? `${footnote}\n${lowHint}` : footnote,
    cta: sub.cta ?? "알겠어요",
    ackOnly: true,
    showFinger: false,
    stepLabel: label,
    bubble: "above",
    // Dim outside the withdraw/wallet card; advance via CTA only.
    passThrough: false,
  };
}

export function resolveRewardsIntroCopy(
  step: RewardsIntroStep,
  ops: OpsState,
  dailyLimit = 50,
): string {
  if (step.lines?.length) {
    for (const line of step.lines) {
      const when = line.when ?? "";
      if (when.includes(">=") && ops.nyangCoinBalance >= 10) {
        return fillTutorialCopy(line.copy ?? line.text ?? step.copy ?? "", { dailyLimit });
      }
      if (when.includes("<") && ops.nyangCoinBalance < 10) {
        return fillTutorialCopy(line.copy ?? line.text ?? step.copy ?? "", { dailyLimit });
      }
    }
  }
  return fillTutorialCopy(step.copy ?? "", { dailyLimit });
}

export function rewardsIntroMark(
  config: RewardsIntroConfig,
  stepId: string,
  ops: OpsState,
  dailyLimit = 50,
): CoachMark | null {
  const step = config.steps.find((entry) => entry.id === stepId);
  if (!step) return null;
  return {
    id: `rewards-intro:${step.id}`,
    target: step.target,
    copy: resolveRewardsIntroCopy(step, ops, dailyLimit),
    bubble: step.bubble,
    showFinger: step.id !== "r4",
    ackOnly: step.id === "r3" || step.id === "r4",
    cta: step.id === "r4" ? "알겠어요" : step.id === "r3" ? "다음" : "다음",
  };
}

export function resolveTutorialTarget(
  target: string,
  vars: { cardId?: string | null } = {},
  fallbackTarget?: string,
): string {
  let next = target;
  if (vars.cardId) {
    next = next.split("{cardId}").join(vars.cardId);
  }
  // Unresolved placeholders are not valid CSS selectors — drop them so querySelector won't throw.
  if (next.includes("{") || next.includes("}")) {
    next = "";
  }
  if (typeof document !== "undefined" && next) {
    try {
      if (!document.querySelector(next) && fallbackTarget) {
        return resolveTutorialTarget(fallbackTarget, vars);
      }
    } catch {
      if (fallbackTarget) return resolveTutorialTarget(fallbackTarget, vars);
    }
  }
  return next;
}

export function mainStepMark(
  step: TutorialStep,
  phase: "base" | "then" = "base",
  vars: { cardId?: string | null } = {},
): CoachMark {
  if (phase === "then" && step.then && !isNcoinIntroThen(step.then)) {
    return {
      id: `step-${step.step}-then`,
      target: resolveTutorialTarget(step.then.target, vars, step.then.fallbackTarget),
      copy: step.then.copy,
      showFinger: true,
      bubble: "above",
    };
  }
  return {
    id: `step-${step.step}`,
    target: resolveTutorialTarget(step.target, vars),
    copy: step.copy,
    sub: step.sub,
    showFinger: true,
  };
}

export function ncoinIntroMark(then: NcoinIntroThen): CoachMark {
  return {
    id: "ncoin-intro",
    target: "#dex-toast",
    title: then.title,
    lines: then.lines.map((line) => ({
      icon: line.icon,
      text: line.text,
      muted: line.muted,
      dividerAbove: line.dividerAbove,
    })),
    cta: then.cta ?? "알겠어요",
    ackOnly: true,
    showFinger: false,
  };
}

export function ncoinNextMark(then: NcoinIntroThen): CoachMark | null {
  if (!then.next) return null;
  return {
    id: "ncoin-intro-next",
    target: then.next.target,
    copy: then.next.copy,
    // #btn-to-dex sits in the footer — keep the bubble above so it isn't clipped.
    bubble: "above",
    showFinger: true,
    // No 「다음」 CTA — user taps the highlighted 도감 button.
    ackOnly: true,
    activateTarget: true,
  };
}

export function getRewardsIntroConfig(tutorial: OpsTutorial): RewardsIntroConfig | null {
  return tutorial.contextual?.["rewards-intro"] ?? null;
}
