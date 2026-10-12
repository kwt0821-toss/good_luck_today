/** Vite / local preview only — never true in production builds. */
export const isDevBuild = Boolean(import.meta.env.DEV);

/** Generous paw balance for local testing (shop is already free in DEV). */
export const DEV_PAW_BALANCE = 1_000_000;

export function resolveStartPaw(configPaw: number): number {
  return isDevBuild ? DEV_PAW_BALANCE : configPaw;
}
