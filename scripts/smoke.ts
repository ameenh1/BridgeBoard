/* Smoke test for the no-AI reliability floor. Run: npm run smoke */
import { createFallbackBoard } from "@/lib/board/createFallbackBoard";
import {
  getBreakfastDemoBoard,
  getDemoBoardForQuestion,
  getFeelingsDemoBoard,
  getPersonalCupsDemoBoard,
} from "@/lib/board/demoBoards";
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

console.log("\n-- Breakfast demo --");
const breakfast = getBreakfastDemoBoard();
check("boardType is choice", breakfast.boardType === "choice");
check("isFallback false", breakfast.isFallback === false);
check("two choices", breakfast.choices.length === 2, breakfast.choices.length);
check(
  "labels are Waffles + Pancakes",
  breakfast.choices.map((c) => c.label).join(",") === "Waffles,Pancakes",
  breakfast.choices.map((c) => c.label),
);
check(
  "speaks full sentence",
  breakfast.choices[0]?.spokenPhrase === "I want waffles.",
  breakfast.choices[0]?.spokenPhrase,
);

console.log("\n-- Feelings demo --");
const feelings = getFeelingsDemoBoard();
check("boardType feelings_needs", feelings.boardType === "feelings_needs");
check("four choices", feelings.choices.length === 4, feelings.choices.length);

console.log("\n-- Personal cups demo --");
const cups = getPersonalCupsDemoBoard();
check("two choices", cups.choices.length === 2);
check(
  "both marked personal",
  cups.choices.every((c) => c.source === "personal"),
  cups.choices.map((c) => c.source),
);
check(
  "both carry a photo",
  cups.choices.every((c) => Boolean(c.imageUrl)),
  cups.choices.map((c) => c.imageUrl),
);

console.log("\n-- Fallback board --");
const fb = createFallbackBoard("low_confidence");
check("isFallback true", fb.isFallback === true);
check("boardType fallback", fb.boardType === "fallback");
check("offers yes + no", fb.choices.map((c) => c.label).join(",") === "Yes,No");
check("no fabricated choices", fb.choices.length === 2, fb.choices.length);
check(
  "reason not leaked into board",
  !JSON.stringify(fb).includes("low_confidence"),
  JSON.stringify(fb),
);
check("full_board always reachable", fb.actions.includes("full_board"));

console.log("\n-- Demo matcher --");
check(
  "waffles question matches breakfast",
  getDemoBoardForQuestion("Do you want waffles or pancakes?")?.boardType === "choice",
);
check(
  "cups question matches personal",
  getDemoBoardForQuestion("Do you want your blue cup or red cup?")?.choices[0]?.source ===
    "personal",
);
check(
  "feelings question matches",
  getDemoBoardForQuestion("How are you feeling?")?.boardType === "feelings_needs",
);
check(
  "confusing question returns null (no guessing)",
  getDemoBoardForQuestion(
    "Should we maybe go after you finish that unless you want something different?",
  ) === null,
);

console.log("\n-- Allowlist --");
check("known id approved", isApprovedVocabulary("food_waffles"));
check("invented id rejected", !isApprovedVocabulary("made_up_dragon_food"));
const aiVocab = getAIAllowedVocabulary();
check("ai vocabulary non-empty", aiVocab.length > 0, aiVocab.length);
check(
  "spokenPhrase withheld from model",
  aiVocab.every((v) => !("spokenPhrase" in v)),
);
check(
  "grammar words withheld from model",
  !aiVocab.some((v) => v.id === "core_want"),
);
check("core board has words", getCoreVocabulary().length >= 12, getCoreVocabulary().length);

console.log(`\n${failures === 0 ? "ALL PASSED" : `${failures} FAILURE(S)`}\n`);
process.exit(failures === 0 ? 0 : 1);
