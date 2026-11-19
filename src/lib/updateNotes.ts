import type { OpsState } from "./opsTypes";

const CONFIG_BASE = (import.meta.env.VITE_OPS_CONFIG_BASE as string | undefined) ?? "/config";

export type UpdateNotes = {
  id: string;
  title: string;
  image: string;
  items: string[];
  cta: string;
};

function asNotes(value: unknown): UpdateNotes | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const image = typeof raw.image === "string" ? raw.image.trim() : "";
  const cta = typeof raw.cta === "string" ? raw.cta.trim() : "";
  const items = Array.isArray(raw.items)
    ? raw.items.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  if (!id || !title || !cta || items.length === 0) return null;
  return { id, title, image, items, cta };
}

/** `config/updateNotes.json` and `public/config/updateNotes.json` stay the same file. */
export async function loadUpdateNotes(): Promise<UpdateNotes | null> {
  try {
    const res = await fetch(`${CONFIG_BASE}/updateNotes.json`, { cache: "no-cache" });
    if (!res.ok) return null;
    return asNotes(await res.json());
  } catch {
    return null;
  }
}

export function updateNotesUnseen(ops: OpsState, notes: UpdateNotes | null | undefined): boolean {
  if (!notes) return false;
  return ops.updateNotesSeenId !== notes.id;
}
