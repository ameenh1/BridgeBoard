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
import { DEFAULT_PROFILE } from "@/types/profile";
import type { ChildProfile } from "@/types/profile";
import {
  getAIAllowedVocabulary,
  getCoreVocabulary,
  isApprovedVocabulary,
} from "@/lib/vocabulary/vocabularyHelpers";

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

  console.log(`\n${failures === 0 ? "ALL PASSED" : `${failures} FAILURE(S)`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
