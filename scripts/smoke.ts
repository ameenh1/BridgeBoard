import { buildRenderableBoard } from "@/lib/board/buildRenderableBoard";
import { createFallbackBoard } from "@/lib/board/createFallbackBoard";
import { applyAssetEvent, mergeCommittedBoard } from "@/lib/board/boardSessionController";
import { DEFAULT_PROFILE } from "@/types/profile";

let failures = 0;
function check(name: string, condition: boolean): void {
  console.log(`${condition ? "PASS" : "FAIL"} ${name}`);
  if (!condition) failures += 1;
}

function classification(overrides: Record<string, unknown> = {}) {
  return {
    questionType: "forced_choice",
    questionText: "model-authored text must not win",
    topic: "food",
    candidateVocabularyIds: ["food_waffles"],
    explicitVisualConcepts: ["dragon fruit"],
    supportActions: ["help", "repeat", "something_else", "need_more_time", "full_board"],
    confidence: 0.95,
    requiresFallback: false,
    ...overrides,
  };
}

async function main(): Promise<void> {
const question = "Would you like waffles or dragon fruit?";
const board = await buildRenderableBoard(classification(), DEFAULT_PROFILE, question);
check("live contract builds a non-fallback board", !board.isFallback);
check("original caregiver text is preserved", board.questionText === question);
check("catalog and exact spoken concepts are included", board.choices.length === 2);
check("every choice is usable before image work", board.choices.every((choice) => Boolean(choice.label && choice.iconKey)));

const openBoard = await buildRenderableBoard(
  classification({
    questionType: "open_ended",
    topic: "food_places",
    candidateVocabularyIds: ["place_car", "place_school"],
    explicitVisualConcepts: [],
    suggestedAnswerConcepts: ["Restaurant", "Café", "Car", "School"],
  }),
  { ...DEFAULT_PROFILE, maxChoices: 8 },
  "Where do you want to eat?",
);
check(
  "open food-place questions offer relevant answers",
  openBoard.choices.some((choice) => choice.label === "Restaurant"),
);
check(
  "open food-place questions reject transport and destinations",
  !openBoard.choices.some((choice) => ["Car", "School"].includes(choice.label)),
);

const firstChoice = board.choices[0]!;
const withImage = applyAssetEvent(board, {
  type: "asset.ready",
  boardId: board.boardId,
  choiceId: firstChoice.id,
  assetKey: firstChoice.visual.assetKey,
  status: "ready",
  source: "generated",
  url: "data:image/webp;base64,AAAA",
});
const nextBoard = await buildRenderableBoard(
  classification({ explicitVisualConcepts: ["dragon fruit", "juice"] }),
  DEFAULT_PROFILE,
  "Would you like waffles, dragon fruit, or juice?",
);
const merged = mergeCommittedBoard(withImage, nextBoard);
check("ready images survive board refreshes", merged.choices[0]?.visual.status === "ready");
check("new choices alone remain pending", merged.choices.filter((choice) => choice.visual.status === "pending").length >= 1);

const failedVisual = applyAssetEvent(merged, {
  type: "asset.unavailable",
  boardId: merged.boardId,
  choiceId: firstChoice.id,
  assetKey: firstChoice.visual.assetKey,
  status: "unavailable",
});
check("a ready image never regresses", failedVisual.choices[0]?.visual.status === "ready");

const fallback = createFallbackBoard("ai_error");
check("fallback always keeps yes and no", fallback.choices.map((choice) => choice.label).join(",") === "Yes,No");
check("support actions remain available", fallback.actions.includes("help") && fallback.actions.includes("full_board"));

if (failures > 0) process.exitCode = 1;
}

void main();
