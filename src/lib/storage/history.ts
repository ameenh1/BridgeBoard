import { z } from "zod";
import type { RenderableBoard } from "@/types/board";

const STORAGE_KEY = "bridgeboard.history.v1";

/** Keeps storage bounded; this is a conversation aid, not an archive. */
const MAX_ENTRIES = 50;

export type CommunicationHistoryEntry = {
  id: string;
  timestamp: string;
  questionText?: string;
  boardType: RenderableBoard["boardType"];
  selectedVocabularyId?: string;
  selectedLabel?: string;
};

const HistoryEntrySchema = z.object({
  id: z.string().min(1),
  timestamp: z.string().min(1),
  questionText: z.string().optional(),
  boardType: z.enum(["choice", "feelings_needs", "yes_no", "fallback", "full_board"]),
  selectedVocabularyId: z.string().optional(),
  selectedLabel: z.string().optional(),
});

const HistorySchema = z.array(HistoryEntrySchema);

/**
 * Optional local record of what was said.
 *
 * Never required for communication, never leaves the browser, and never
 * contains audio. Honours the caregiver's `historyEnabled` setting — callers
 * pass it in rather than this module reaching for settings itself.
 */

function getStorage(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadHistory(): CommunicationHistoryEntry[] {
  const storage = getStorage();
  if (!storage) return [];

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = HistorySchema.safeParse(JSON.parse(raw));
    // Drop the whole log rather than render half-valid entries.
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

/**
 * Records one selection. A no-op when history is disabled, so callers do not
 * have to branch.
 */
export function appendHistory(
  entry: Omit<CommunicationHistoryEntry, "id" | "timestamp">,
  historyEnabled: boolean,
): void {
  if (!historyEnabled) return;

  const storage = getStorage();
  if (!storage) return;

  const full: CommunicationHistoryEntry = {
    ...entry,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  };

  try {
    const next = [...loadHistory(), full].slice(-MAX_ENTRIES);
    storage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    console.error("[history] append failed", error);
  }
}

export function clearHistory(): void {
  const storage = getStorage();
  if (!storage) return;

  try {
    storage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("[history] clear failed", error);
  }
}
