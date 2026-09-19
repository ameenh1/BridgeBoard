/* Smoke test for the backend reliability layer. Run: npm run smoke */
import { buildRenderableBoard } from "@/lib/board/buildRenderableBoard";
import { createFallbackBoard } from "@/lib/board/createFallbackBoard";
import { limitChoices } from "@/lib/board/limitChoices";
import {
  getBreakfastDemoBoard,
  getDemoBoardForQuestion,
  getFeelingsDemoBoard,
  getPersonalCupsDemoBoard,
} from "@/lib/board/demoBoards";
import { temporaryMockClassifier } from "@/lib/ai/mockClassifier";
import { getFullBoardCategories } from "@/lib/board/fullBoard";
import {
  clearSettings,
  loadSettings,
  saveSettings,
  updateSettings,
} from "@/lib/storage/settings";
import { appendHistory, clearHistory, loadHistory } from "@/lib/storage/history";
import { DEFAULT_PROFILE } from "@/types/profile";
import type { ChildProfile } from "@/types/profile";
import {
  getAIAllowedVocabulary,
  getCoreVocabulary,
  isAIAllowedVocabulary,
  isApprovedVocabulary,
} from "@/lib/vocabulary/vocabularyHelpers";
import {
  getVocabularyAliases,
  normalizeVocabularyId,
} from "@/lib/vocabulary/vocabularyAliases";

let failures = 0;
function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    console.log(`  PASS  ${name}`);
  } else {
    failures++;
    console.log(`  FAIL  ${name}`, detail ?? "");
  }
}

const profile: ChildProfile = DEFAULT_PROFILE;

/** A well-formed classification, overridable per test. */
function classification(overrides: Record<string, unknown> = {}) {
  return {
    questionType: "forced_choice",
    questionText: "Do you want waffles or pancakes?",
    topic: "food",
    candidateVocabularyIds: ["food_waffles", "food_pancakes"],
    supportActions: ["help", "repeat", "full_board"],
    confidence: 0.96,
    requiresFallback: false,
    ...overrides,
  };
}

async function main() {
  console.log("\n=== Static boards (no AI) ===");

  const breakfast = getBreakfastDemoBoard();
  check("breakfast is a choice board", breakfast.boardType === "choice");
  check("breakfast not fallback", breakfast.isFallback === false);
  check(
    "breakfast shows Waffles + Pancakes",
    breakfast.choices.map((c) => c.label).join(",") === "Waffles,Pancakes",
    breakfast.choices.map((c) => c.label),
  );
  check(
    "breakfast speaks a full sentence",
    breakfast.choices[0]?.spokenPhrase === "I want waffles.",
  );

  const feelings = getFeelingsDemoBoard();
  check("feelings board type", feelings.boardType === "feelings_needs");
  check("feelings has 4 choices", feelings.choices.length === 4);

  const cups = getPersonalCupsDemoBoard();
  check("cups marked personal", cups.choices.every((c) => c.source === "personal"));

  const fb = createFallbackBoard("low_confidence");
  check("fallback flagged", fb.isFallback === true);
  check("fallback keeps Yes/No", fb.choices.map((c) => c.label).join(",") === "Yes,No");
  check("fallback invents nothing", fb.choices.length === 2);
  check("full_board always reachable", fb.actions.includes("full_board"));
  check(
    "FallbackReason never leaks to the UI",
    !JSON.stringify(fb).includes("low_confidence"),
  );

  check(
    "unknown prompt returns no demo board",
    getDemoBoardForQuestion(
      "Should we maybe go after you finish that unless you want something different?",
    ) === null,
  );

  console.log("\n=== Allowlist ===");
  check("known id approved", isApprovedVocabulary("food_waffles"));
  check("invented id rejected", !isApprovedVocabulary("made_up_dragon_food"));
  const aiVocab = getAIAllowedVocabulary();
  check("spokenPhrase withheld from model", aiVocab.every((v) => !("spokenPhrase" in v)));
  check("grammar words withheld", !aiVocab.some((v) => v.id === "core_want"));
  check("core board populated", getCoreVocabulary().length >= 12);

  console.log("\n=== Pipeline: valid classifications ===");

  const good = await buildRenderableBoard(classification(), profile);
  check("forced choice builds a board", good.isFallback === false);
  check("board type mapped to choice", good.boardType === "choice");
  check(
    "labels come from the catalog",
    good.choices.map((c) => c.label).join(",") === "Waffles,Pancakes",
  );
  check(
    "spoken phrase comes from the catalog",
    good.choices[0]?.spokenPhrase === "I want waffles.",
  );
  check("question echoed back", good.questionText === "Do you want waffles or pancakes?");

  const feelingsBoard = await buildRenderableBoard(
    classification({
      questionType: "feelings_needs",
      topic: "feelings",
      questionText: "How are you feeling?",
      candidateVocabularyIds: ["emotion_happy", "emotion_sad", "emotion_overwhelmed"],
      confidence: 0.93,
    }),
    profile,
  );
  check("feelings maps correctly", feelingsBoard.boardType === "feelings_needs");
  check("feelings has 3 choices", feelingsBoard.choices.length === 3);

  const cupsBoard = await buildRenderableBoard(
    classification({
      topic: "drink",
      questionText: "Do you want your blue cup or red cup?",
      candidateVocabularyIds: ["personal_blue_cup", "personal_red_cup"],
      confidence: 0.94,
    }),
    profile,
  );
  check(
    "personal photo wins over generic",
    cupsBoard.choices.every((c) => c.source === "personal"),
    cupsBoard.choices.map((c) => c.source),
  );
  check(
    "personal photo url resolved",
    cupsBoard.choices[0]?.imageUrl === "/demo-photos/blue-cup.png",
    cupsBoard.choices[0]?.imageUrl,
  );

  console.log("\n=== Pipeline: every failure route ===");

  check(
    "malformed response -> fallback",
    (await buildRenderableBoard({ nonsense: true }, profile)).isFallback,
  );
  check(
    "non-object response -> fallback",
    (await buildRenderableBoard("not json at all", profile)).isFallback,
  );
  check("null response -> fallback", (await buildRenderableBoard(null, profile)).isFallback);
  check(
    "confidence 0.40 -> fallback",
    (await buildRenderableBoard(classification({ confidence: 0.4 }), profile)).isFallback,
  );
  check(
    "confidence just below threshold -> fallback",
    (await buildRenderableBoard(classification({ confidence: 0.77 }), profile)).isFallback,
  );
  check(
    "confidence at threshold -> allowed",
    !(await buildRenderableBoard(classification({ confidence: 0.78 }), profile)).isFallback,
  );
  check(
    "requiresFallback true -> fallback",
    (await buildRenderableBoard(classification({ requiresFallback: true }), profile))
      .isFallback,
  );
  check(
    "questionType unknown -> fallback",
    (await buildRenderableBoard(classification({ questionType: "unknown" }), profile))
      .isFallback,
  );
  check(
    "confidence out of range -> fallback",
    (await buildRenderableBoard(classification({ confidence: 1.4 }), profile)).isFallback,
  );
  check(
    "empty questionText -> fallback",
    (await buildRenderableBoard(classification({ questionText: "" }), profile)).isFallback,
  );

  const mixed = await buildRenderableBoard(
    classification({
      candidateVocabularyIds: ["food_waffles", "made_up_dragon_food"],
    }),
    profile,
  );
  check("invented id filtered out", mixed.choices.length === 1, mixed.choices.length);
  check("surviving id is the real one", mixed.choices[0]?.id === "food_waffles");
  check("partial board is not a fallback", mixed.isFallback === false);

  check(
    "all ids invented -> fallback",
    (
      await buildRenderableBoard(
        classification({ candidateVocabularyIds: ["dragon_food", "unicorn_soup"] }),
        profile,
      )
    ).isFallback,
  );
  check(
    "empty id list -> fallback",
    (await buildRenderableBoard(classification({ candidateVocabularyIds: [] }), profile))
      .isFallback,
  );

  console.log("\n=== Profile limits and images ===");

  const narrow = await buildRenderableBoard(
    classification({
      questionType: "feelings_needs",
      topic: "feelings",
      candidateVocabularyIds: [
        "emotion_happy",
        "emotion_sad",
        "emotion_tired",
        "emotion_overwhelmed",
      ],
      confidence: 0.9,
    }),
    { ...profile, maxChoices: 2 },
  );
  check("maxChoices 2 respected", narrow.choices.length === 2, narrow.choices.length);

  const noImage = await buildRenderableBoard(
    classification({
      questionType: "feelings_needs",
      topic: "feelings",
      candidateVocabularyIds: ["emotion_angry"],
      confidence: 0.9,
    }),
    profile,
  );
  check("missing image still yields a choice", noImage.choices.length === 1);
  check("missing image falls back to icon", Boolean(noImage.choices[0]?.iconKey));
  check("missing image has no url", noImage.choices[0]?.imageUrl === undefined);
  check("missing image does not trigger fallback", noImage.isFallback === false);

  // Regression: demo boards bypass buildRenderableBoard, so they need the
  // profile limit applied explicitly or board complexity is silently ignored.
  const narrowProfile: ChildProfile = { ...profile, maxChoices: 2 };
  check(
    "demo feelings board respects maxChoices 2",
    limitChoices(getFeelingsDemoBoard(), narrowProfile).choices.length === 2,
    limitChoices(getFeelingsDemoBoard(), narrowProfile).choices.length,
  );
  check(
    "limit leaves smaller boards alone",
    limitChoices(getBreakfastDemoBoard(), narrowProfile).choices.length === 2,
  );
  check(
    "limit never trims a fallback board",
    limitChoices(createFallbackBoard("ai_error"), narrowProfile).choices.length === 2,
  );

  console.log("\n=== Mock classifier end to end ===");

  for (const [prompt, expected] of [
    ["Do you want waffles or pancakes?", "choice"],
    ["How are you feeling?", "feelings_needs"],
    ["Do you want some water?", "yes_no"],
    ["Do you need the bathroom?", "feelings_needs"],
  ] as const) {
    const raw = await temporaryMockClassifier(prompt);
    const board = await buildRenderableBoard(raw, profile);
    check(`"${prompt}" -> ${expected}`, board.boardType === expected, board.boardType);
  }

  const confusing = await buildRenderableBoard(
    await temporaryMockClassifier(
      "Should we maybe go after you finish that unless you want something different?",
    ),
    profile,
  );
  check("confusing question -> fallback", confusing.isFallback === true);
  check("confusing question fabricates nothing", confusing.choices.length === 2);

  console.log("\n=== Cross-branch integration (Person 2's ids) ===");

  // Their classifier emits a different naming scheme. Every alias must land on
  // a real, AI-allowed item, or boards silently come back empty.
  for (const [theirs, ours] of Object.entries(getVocabularyAliases())) {
    check(
      `${theirs} -> ${ours} resolves`,
      isAIAllowedVocabulary(normalizeVocabularyId(theirs)),
      normalizeVocabularyId(theirs),
    );
  }

  const yesNoFromTheirIds = await buildRenderableBoard(
    classification({
      questionType: "yes_no",
      topic: "activities",
      questionText: "Do you want to go outside?",
      candidateVocabularyIds: ["action_yes", "action_no", "action_later"],
      confidence: 0.91,
    }),
    profile,
  );
  check(
    "their yes/no ids build a real board",
    yesNoFromTheirIds.isFallback === false,
    yesNoFromTheirIds.isFallback,
  );
  check(
    "their yes/no ids speak our phrases",
    yesNoFromTheirIds.choices.map((c) => c.label).join(",") === "Yes,No,Later",
    yesNoFromTheirIds.choices.map((c) => c.label),
  );
  check(
    "their drink_water maps to our water",
    (
      await buildRenderableBoard(
        classification({
          topic: "drink",
          candidateVocabularyIds: ["drink_water"],
          confidence: 0.9,
        }),
        profile,
      )
    ).choices[0]?.spokenPhrase === "I want water.",
  );

  // Their schema allows 8 candidates; ours must not reject the whole response.
  const eight = await buildRenderableBoard(
    classification({
      questionType: "feelings_needs",
      topic: "feelings",
      candidateVocabularyIds: [
        "emotion_happy",
        "emotion_sad",
        "emotion_angry",
        "emotion_worried",
        "emotion_tired",
        "emotion_overwhelmed",
        "emotion_sick",
        "need_help",
      ],
      confidence: 0.9,
    }),
    profile,
  );
  check("8 candidate ids accepted, not rejected", eight.isFallback === false);
  check("8 candidates sliced to maxChoices", eight.choices.length === 4, eight.choices.length);

  console.log("\n=== allowedForAI is enforced on the way in ===");

  // Existing in the catalog is not enough. A grammar word must never become a
  // standalone choice just because the model asked for it.
  check("core_want is in the catalog", isApprovedVocabulary("core_want"));
  check("core_want is NOT offered to the model", !isAIAllowedVocabulary("core_want"));
  const grammar = await buildRenderableBoard(
    classification({ candidateVocabularyIds: ["core_want", "core_i", "core_not"] }),
    profile,
  );
  check("model cannot place grammar words on a board", grammar.isFallback === true);
  const mixedGrammar = await buildRenderableBoard(
    classification({ candidateVocabularyIds: ["food_waffles", "core_want"] }),
    profile,
  );
  check("grammar word filtered from a mixed board", mixedGrammar.choices.length === 1);
  check("real vocabulary survives", mixedGrammar.choices[0]?.id === "food_waffles");

  console.log("\n=== Full Board (manual, no AI) ===");

  const categories = getFullBoardCategories();
  check("seven categories", categories.length === 7, categories.length);
  check(
    "no empty category",
    categories.every((c) => c.choices.length > 0),
    categories.filter((c) => c.choices.length === 0).map((c) => c.label),
  );
  check(
    "category order matches the spec",
    categories.map((c) => c.label).join(",") ===
      "Core,Needs,Feelings,Food,People,Places,Activities",
    categories.map((c) => c.label),
  );
  check(
    "every full board choice can be spoken",
    categories.every((c) => c.choices.every((ch) => ch.spokenPhrase.length > 0)),
  );

  console.log("\n=== Settings persistence ===");

  // No window yet: this is the SSR / storage-blocked path.
  check("no storage -> defaults", loadSettings().maxChoices === DEFAULT_PROFILE.maxChoices);
  check("save without storage does not throw", (() => {
    try {
      saveSettings({ ...DEFAULT_PROFILE, maxChoices: 6 });
      return true;
    } catch {
      return false;
    }
  })());

  const store = new Map<string, string>();
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  };

  check("empty storage -> defaults", loadSettings().id === DEFAULT_PROFILE.id);

  saveSettings({ ...DEFAULT_PROFILE, maxChoices: 6, quietMode: true });
  check("settings round-trip: maxChoices", loadSettings().maxChoices === 6);
  check("settings round-trip: quietMode", loadSettings().quietMode === true);

  store.set("bridgeboard.profile.v1", "{ this is not json");
  check("corrupted json -> defaults", loadSettings().maxChoices === 4);

  store.set("bridgeboard.profile.v1", JSON.stringify({ id: "x", maxChoices: 3 }));
  check("wrong shape -> defaults", loadSettings().maxChoices === 4);

  store.set("bridgeboard.profile.v1", JSON.stringify({ totally: "different" }));
  check("unknown shape -> defaults", loadSettings().visuals === "photos_first");

  saveSettings({ ...DEFAULT_PROFILE, speechEnabled: false });
  check("valid save overwrites corruption", loadSettings().speechEnabled === false);

  const patched = updateSettings({ maxChoices: 2 });
  check("updateSettings patches", patched.maxChoices === 2);
  check("updateSettings persists", loadSettings().maxChoices === 2);
  check("updateSettings preserves other fields", loadSettings().speechEnabled === false);

  // An invalid value must not be written, or it becomes tomorrow's bad read.
  saveSettings({ ...DEFAULT_PROFILE, maxChoices: 5 as unknown as 2 });
  check("invalid profile refused", loadSettings().maxChoices === 2);

  clearSettings();
  check("clear -> defaults", loadSettings().maxChoices === DEFAULT_PROFILE.maxChoices);

  console.log("\n=== Communication history ===");

  check("history starts empty", loadHistory().length === 0);

  appendHistory({ boardType: "choice", selectedLabel: "Waffles" }, false);
  check("disabled history records nothing", loadHistory().length === 0);

  appendHistory(
    { boardType: "choice", questionText: "Do you want waffles?", selectedLabel: "Waffles" },
    true,
  );
  check("enabled history records", loadHistory().length === 1);
  check("entry has timestamp", Boolean(loadHistory()[0]?.timestamp));
  check("entry has id", Boolean(loadHistory()[0]?.id));

  store.set("bridgeboard.history.v1", "not json");
  check("corrupted history -> empty", loadHistory().length === 0);

  appendHistory({ boardType: "fallback" }, true);
  check("history recovers after corruption", loadHistory().length === 1);

  clearHistory();
  check("history clears", loadHistory().length === 0);

  console.log(`\n${failures === 0 ? "ALL PASSED" : `${failures} FAILURE(S)`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
