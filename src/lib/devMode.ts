/** Vite / local preview only — never true in production builds. */
export const isDevBuild = Boolean(import.meta.env.DEV);

/** Generous paw balance for local testing (shop is already free in DEV). */
export const DEV_PAW_BALANCE = 1_000_000;

/** Paw granted with progress reset so shop / room flows can be retested. */
export const RESET_BONUS_PAW = 2000;

export function resolveStartPaw(configPaw: number): number {
  return isDevBuild ? DEV_PAW_BALANCE : configPaw;
}
