import type {
  CoachMark,
  NcoinIntroThen,
  OpsState,
  OpsTutorial,
  RewardsIntroConfig,
  RewardsIntroStep,
  TutorialStep,
  TutorialStepThen,
} from "./opsTypes";

export function isNcoinIntroThen(then: TutorialStepThen | undefined): then is NcoinIntroThen {
  return Boolean(then && "id" in then && then.id === "ncoin-intro" && "lines" in then);
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
