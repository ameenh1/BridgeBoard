import type { VocabularyItem } from "@/types/vocabulary";

/**
 * Core vocabulary for the manual Full Board and the Default AAC board.
 *
 * These exist so a communicator always has words available, with no AI, no
 * network, and no images. Most are sentence-building blocks rather than
 * standalone answers, so they are not offered to the classifier — the
 * exceptions are yes/no, which are complete answers on their own.
 *
 * Every label and spokenPhrase in this file is the single source of truth. The
 * board layout references ids only; it never restates a word.
 */
export const CORE_VOCABULARY: VocabularyItem[] = [
  {
    id: "core_i",
    label: "I",
    spokenPhrase: "I",
    category: "core",
    imageUrl: "/default-images/i.webp",
    iconKey: "user",
    allowedForAI: false,
    isCore: true,
  },
  {
    id: "core_want",
    label: "want",
    spokenPhrase: "want",
    category: "core",
    imageUrl: "/default-images/want.webp",
    iconKey: "hand",
    allowedForAI: false,
    isCore: true,
  },
  {
    id: "core_need",
    label: "need",
    spokenPhrase: "need",
    category: "core",
    imageUrl: "/default-images/need.webp",
    iconKey: "hand-heart",
    allowedForAI: false,
    isCore: true,
  },
  {
    id: "core_dont_want",
    label: "don't want",
    spokenPhrase: "don't want",
    category: "core",
    iconKey: "ban",
    allowedForAI: false,
    isCore: true,
  },
  {
    id: "core_like",
    label: "like",
    spokenPhrase: "like",
    category: "core",
    imageUrl: "/default-images/like.webp",
    iconKey: "heart",
    allowedForAI: false,
    isCore: true,
  },
  {
    id: "core_dont_like",
    label: "don't like",
    spokenPhrase: "I don't like that.",
    category: "core",
    imageUrl: "/default-images/dont-like.webp",
    iconKey: "thumbs-down",
    allowedForAI: false,
    isCore: true,
  },
  {
    // Mirrors the `something_else` support action so the board can offer it as
    // an ordinary tile. The action stays where it is; this is the word.
    id: "core_something_else",
    label: "something else",
    spokenPhrase: "I want something else.",
    category: "core",
    iconKey: "ellipsis",
    allowedForAI: false,
    isCore: true,
  },
  {
    id: "core_more",
    label: "more",
    spokenPhrase: "more",
    category: "core",
    imageUrl: "/default-images/more.webp",
    iconKey: "plus",
    allowedForAI: true,
    isCore: true,
  },
  {
    id: "core_stop",
    label: "stop",
    spokenPhrase: "stop",
    category: "core",
    imageUrl: "/default-images/stop.webp",
    iconKey: "pause",
    allowedForAI: true,
    isCore: true,
  },
  {
    id: "core_help",
    label: "help",
    spokenPhrase: "help",
    category: "core",
    imageUrl: "/default-images/help.webp",
    iconKey: "life-buoy",
    allowedForAI: false,
    isCore: true,
  },
  {
    id: "core_go",
    label: "go",
    spokenPhrase: "go",
    category: "core",
    imageUrl: "/default-images/go.webp",
    iconKey: "arrow-right",
    allowedForAI: true,
    isCore: true,
  },
  {
    id: "core_again",
    label: "again",
    spokenPhrase: "again",
    category: "core",
    imageUrl: "/default-images/again.webp",
    iconKey: "rotate-ccw",
    allowedForAI: true,
    isCore: true,
  },
  {
    id: "core_all_done",
    label: "all done",
    spokenPhrase: "I'm all done.",
    category: "core",
    imageUrl: "/default-images/all-done.webp",
    iconKey: "check-check",
    allowedForAI: true,
    isCore: true,
  },
  {
    id: "core_wait",
    label: "wait",
    spokenPhrase: "Please wait.",
    category: "core",
    iconKey: "hourglass",
    allowedForAI: true,
    isCore: true,
  },
  {
    id: "core_yes",
    label: "Yes",
    spokenPhrase: "Yes.",
    category: "core",
    imageUrl: "/default-images/yes.webp",
    iconKey: "check",
    allowedForAI: true,
    isCore: true,
  },
  {
    id: "core_no",
    label: "No",
    spokenPhrase: "No.",
    category: "core",
    imageUrl: "/default-images/no.webp",
    iconKey: "x",
    allowedForAI: true,
    isCore: true,
  },
  {
    id: "core_later",
    label: "Later",
    spokenPhrase: "Maybe later.",
    category: "core",
    iconKey: "clock",
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
    // The concept doc lists "I don't know" as a persistent option on every
    // board, but `BoardAction` has no member for it. Carrying it as core
    // vocabulary lets the UI show it now without changing a shared contract.
    // Not offered to the classifier: it is an escape hatch the communicator
    // always has, not a choice the AI should spend a slot proposing.
    id: "core_dont_know",
    label: "I don't know",
    spokenPhrase: "I don't know.",
    category: "core",
    iconKey: "circle-help",
    allowedForAI: false,
    isCore: true,
  },
];
