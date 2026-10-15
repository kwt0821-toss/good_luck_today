/**
 * Help sheet copy loader. Reads `/config/help.json` (synced from repo `config/`).
 */

export type HelpTabId = "ncoin" | "paw";

export type HelpRow = {
  t: string;
  d: string;
  amt: string;
  cap: string;
};

export type HelpSection = {
  h: string;
  rows: HelpRow[];
};

export type HelpUse = {
  h: string;
  t: string;
  d: string;
};

export type HelpTab = {
  id: HelpTabId;
  label: string;
  icon: "ncoin" | "paw";
  lead: string;
  sections: HelpSection[];
  use: HelpUse;
};

export type HelpConfig = {
  _version?: string;
  _source?: string;
  title: string;
  tabs: HelpTab[];
  entry?: string[];
  footnote?: string;
};

const CONFIG_URL =
  (import.meta.env.VITE_HELP_CONFIG_URL as string | undefined) ?? "/config/help.json";

let cache: Promise<HelpConfig> | null = null;

export async function loadHelpConfig(): Promise<HelpConfig> {
  if (!cache) {
    cache = fetch(CONFIG_URL, { cache: "no-cache" }).then(async (res) => {
      if (!res.ok) throw new Error("help.json missing");
      return (await res.json()) as HelpConfig;
    });
  }
  try {
    return await cache;
  } catch (err) {
    cache = null;
    throw err;
  }
}

export function clearHelpConfigCache() {
  cache = null;
}
