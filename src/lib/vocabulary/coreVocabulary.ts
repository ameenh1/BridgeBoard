import type { VocabularyItem } from "@/types/vocabulary";

/**
 * Core vocabulary for the manual Full Board.
 *
 * These exist so a communicator always has words available, with no AI, no
 * network, and no images. Most are sentence-building blocks rather than
 * standalone answers, so they are not offered to the classifier — the
 * exceptions are yes/no, which are complete answers on their own.
 */
export const CORE_VOCABULARY: VocabularyItem[] = [
  {
    id: "core_i",
    label: "I",
    spokenPhrase: "I",
    category: "core",
    allowedForAI: false,
    isCore: true,
  },
  {
    id: "core_want",
    label: "want",
    spokenPhrase: "want",
    category: "core",
    allowedForAI: false,
    isCore: true,
  },
  {
    id: "core_dont_want",
    label: "don't want",
    spokenPhrase: "don't want",
    category: "core",
    allowedForAI: false,
    isCore: true,
  },
  {
    id: "core_more",
    label: "more",
    spokenPhrase: "more",
    category: "core",
    iconKey: "plus",
    allowedForAI: false,
    isCore: true,
  },
  {
    id: "core_stop",
    label: "stop",
    spokenPhrase: "stop",
    category: "core",
    iconKey: "hand",
    allowedForAI: false,
    isCore: true,
  },
  {
    id: "core_help",
    label: "help",
    spokenPhrase: "help",
    category: "core",
    iconKey: "life-buoy",
    allowedForAI: false,
    isCore: true,
  },
  {
    id: "core_go",
    label: "go",
    spokenPhrase: "go",
    category: "core",
    iconKey: "arrow-right",
    allowedForAI: false,
    isCore: true,
  },
  {
    id: "core_again",
    label: "again",
    spokenPhrase: "again",
    category: "core",
    iconKey: "rotate-ccw",
    allowedForAI: false,
    isCore: true,
  },
  {
    id: "core_yes",
    label: "Yes",
    spokenPhrase: "Yes.",
    category: "core",
    iconKey: "check",
    allowedForAI: true,
    isCore: true,
  },
  {
    id: "core_no",
    label: "No",
    spokenPhrase: "No.",
    category: "core",
    iconKey: "x",
    allowedForAI: true,
    isCore: true,
  },
  {
    id: "core_not",
    label: "not",
    spokenPhrase: "not",
    category: "core",
    allowedForAI: false,
    isCore: true,
  },
  {
    id: "core_like",
    label: "like",
    spokenPhrase: "like",
    category: "core",
    iconKey: "heart",
    allowedForAI: false,
    isCore: true,
  },
];
