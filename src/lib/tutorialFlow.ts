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
  vars: { cardId?: string | null; breed?: string | null; grade?: string | null } = {},
): string {
  let next = template;
  if (vars.cardId) next = next.split("{cardId}").join(vars.cardId);
  if (vars.breed != null) next = next.split("{품종}").join(vars.breed);
  if (vars.grade != null) next = next.split("{등급}").join(vars.grade);
  // Drop unresolved placeholders so we don't show raw braces.
  next = next.replace(/\s*·\s*\{[^}]+\}/g, "").replace(/\{[^}]+\}/g, "");
  return next.replace(/\s+/g, " ").trim();
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
    stepLabel: step.stepLabel ?? "STEP 3/4",
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
    showFinger: sub.showFinger !== false,
    ackOnly: true,
    activateTarget: Boolean(sub.claimGate),
    stepLabel: step.stepLabel ?? "STEP 3/4",
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
    stepLabel: step.stepLabel ?? "STEP 3/4",
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
    target: resolveTutorialTarget(sub.target),
    copy: sub.copy ?? step.copy,
    showFinger: sub.showFinger !== false,
    ackOnly: true,
    passThrough: true,
    stepLabel: step.stepLabel ?? "STEP 4/4",
    bubble: "above",
  };
}

/** Drag phase: skip only (no dim/bubble); grid/ghost/hint live in RoomScreen. */
export function roomDragCoachMark(step: TutorialStep): CoachMark | null {
  const sub = roomSubstep(step, "4-2");
  if (!sub) return null;
  return {
    id: "step-4-2",
    target: "",
    ackOnly: true,
    showFinger: false,
    dim: false,
  };
}

export function roomDoneCoachMark(step: TutorialStep): CoachMark | null {
  const sub = roomSubstep(step, "4-3");
  if (!sub) return null;
  return {
    id: "step-4-3",
    target: resolveTutorialTarget(sub.target || "#room-done"),
    copy: sub.copy ?? "잘했어요! 다른 아이템도 자유롭게 꾸며 보세요",
    cta: sub.cta ?? "완료",
    ackOnly: true,
    activateTarget: true,
    showFinger: false,
    hideSkip: true,
    stepLabel: step.stepLabel ?? "STEP 4/4",
    bubble: "above",
  };
}

export function resolveRewardsIntroCopy(step: RewardsIntroStep, ops: OpsState): string {
  if (step.lines?.length) {
    for (const line of step.lines) {
      const when = line.when ?? "";
      if (when.includes(">=") && ops.nyangCoinBalance >= 10) {
        return line.copy ?? line.text ?? step.copy ?? "";
      }
      if (when.includes("<") && ops.nyangCoinBalance < 10) {
        return line.copy ?? line.text ?? step.copy ?? "";
      }
    }
  }
  return step.copy ?? "";
}

export function rewardsIntroMark(
  config: RewardsIntroConfig,
  stepId: string,
  ops: OpsState,
): CoachMark | null {
  const step = config.steps.find((entry) => entry.id === stepId);
  if (!step) return null;
  return {
    id: `rewards-intro:${step.id}`,
    target: step.target,
    copy: resolveRewardsIntroCopy(step, ops),
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
  };
}

export function getRewardsIntroConfig(tutorial: OpsTutorial): RewardsIntroConfig | null {
  return tutorial.contextual?.["rewards-intro"] ?? null;
}
