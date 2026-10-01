import { Storage } from "@apps-in-toss/web-framework";

import type { AppSettings } from "../types";

const SETTINGS_KEY = "good-luck-today.settings";
const REVEALED_KEY = "good-luck-today.revealed";

const DEFAULT_SETTINGS: AppSettings = {
  nickname: "",
};

async function read(key: string): Promise<string | null> {
  try {
    return await Storage.getItem(key);
  } catch {
    return window.localStorage.getItem(key);
  }
}

async function write(key: string, value: string): Promise<void> {
  try {
    await Storage.setItem(key, value);
  } catch {
    window.localStorage.setItem(key, value);
  }
}

export async function loadSettings(): Promise<AppSettings> {
  const raw = await read(SETTINGS_KEY);
  if (!raw) return DEFAULT_SETTINGS;

  try {
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as AppSettings) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await write(SETTINGS_KEY, JSON.stringify(settings));
}

export async function loadRevealedDates(): Promise<string[]> {
  const raw = await read(REVEALED_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export async function saveRevealedDates(dates: string[]): Promise<void> {
  const unique = Array.from(new Set(dates)).sort();
  await write(REVEALED_KEY, JSON.stringify(unique.slice(-30)));
}
