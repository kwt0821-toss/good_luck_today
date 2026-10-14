/** Vite / local preview only — never true in production builds. */
export const isDevBuild = Boolean(import.meta.env.DEV);

/**
 * Explicit opt-in for deployed test builds (Toss sandbox etc.).
 * Leave unset for store/launch builds so the reset control stays hidden.
 */
export const progressResetEnvEnabled =
  String(import.meta.env.VITE_ENABLE_PROGRESS_RESET ?? "") === "true";

/** Generous paw balance for local testing (shop is already free in DEV). */
export const DEV_PAW_BALANCE = 1_000_000;

/** Paw granted with progress reset so shop / room flows can be retested. */
export const RESET_BONUS_PAW = 2000;

export function resolveStartPaw(configPaw: number): number {
  return isDevBuild ? DEV_PAW_BALANCE : configPaw;
}

/** Visible without unlock gesture — local DEV or explicit test-build env. */
export function progressResetUnlockedByDefault(): boolean {
  return isDevBuild || progressResetEnvEnabled;
}
