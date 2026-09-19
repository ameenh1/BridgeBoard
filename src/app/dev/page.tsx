import { DEFAULT_PROFILE } from "@/types/profile";
import { buildRenderableBoard } from "@/lib/board/buildRenderableBoard";
import { getDemoBoardForQuestion } from "@/lib/board/demoBoards";
import { getFullBoardCategories } from "@/lib/board/fullBoard";
import { limitChoices } from "@/lib/board/limitChoices";
import { classifyQuestion, isUsingMockClassifier } from "@/lib/ai/classifyQuestion";
import { getAppMode, isDemoMode } from "@/lib/demo/demoMode";
import { DEMO_PROMPTS } from "@/lib/demo/demoPrompts";
import { listAvailableImages } from "@/lib/images/imageManifest";
import { approvedVocabulary } from "@/lib/vocabulary/approvedVocabulary";
import { getAIAllowedVocabulary } from "@/lib/vocabulary/vocabularyHelpers";
import type { RenderableBoard } from "@/types/board";

/**
 * Developer diagnostics. Not part of the product, not child-facing, and
 * deliberately unstyled so nobody mistakes it for the UI.
 *
 * It exists to answer one question quickly during integration: is the backend
 * wrong, or is the wiring wrong? It runs every scripted demo prompt through
 * the same path the API uses and shows what comes back.
 */
export const dynamic = "force-dynamic";

async function boardFor(questionText: string): Promise<RenderableBoard> {
  if (isDemoMode()) {
    const demo = getDemoBoardForQuestion(questionText);
    if (demo) return limitChoices(demo, DEFAULT_PROFILE);
  }
  return buildRenderableBoard(await classifyQuestion(questionText), DEFAULT_PROFILE);
}

export default async function DevPage() {
  const results = await Promise.all(
    DEMO_PROMPTS.map(async (prompt) => ({
      prompt,
      board: await boardFor(prompt.text),
    })),
  );

  const expectedImages = approvedVocabulary.filter((i) => i.imageUrl).length;
  const presentImages = listAvailableImages().length;

  return (
    <main style={{ fontFamily: "monospace", padding: 24, lineHeight: 1.5 }}>
      <h1 style={{ fontSize: 20, margin: 0 }}>BridgeBoard — developer diagnostics</h1>
      <p style={{ color: "#666", marginTop: 4 }}>
        Not the product. Backend state only.
      </p>

      <h2 style={{ fontSize: 16, marginTop: 24 }}>Environment</h2>
      <ul style={{ margin: 0, paddingLeft: 20 }}>
        <li>
          app mode: <strong>{getAppMode()}</strong>
          {isDemoMode() && " (scripted prompts bypass the classifier)"}
        </li>
        <li>
          classifier: <strong>{isUsingMockClassifier() ? "MOCK" : "live"}</strong>
          {isUsingMockClassifier() && " — flip USING_MOCK when the real one is wired"}
        </li>
        <li>
          vocabulary: {approvedVocabulary.length} items, {getAIAllowedVocabulary().length}{" "}
          offered to the model
        </li>
        <li>
          images: {presentImages}/{expectedImages} present
          {presentImages < expectedImages && " — missing ones render as icon + text"}
        </li>
        <li>full board: {getFullBoardCategories().length} categories</li>
      </ul>

      <h2 style={{ fontSize: 16, marginTop: 24 }}>Demo script</h2>
      {results.map(({ prompt, board }) => (
        <section key={prompt.id} style={{ marginBottom: 20 }}>
          <div>
            <strong>{prompt.label}</strong> — &ldquo;{prompt.text}&rdquo;
          </div>
          <div style={{ color: "#666" }}>
            {board.boardType}
            {board.isFallback ? " · FALLBACK" : ""} · {board.choices.length} choices
          </div>
          <table style={{ borderCollapse: "collapse", marginTop: 6 }}>
            <tbody>
              {board.choices.map((choice) => (
                <tr key={choice.id}>
                  <td style={cell}>{choice.label}</td>
                  <td style={cell}>&ldquo;{choice.spokenPhrase}&rdquo;</td>
                  <td style={cell}>{choice.source}</td>
                  <td style={cell}>{choice.imageUrl ?? `icon:${choice.iconKey ?? "none"}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ color: "#666", fontSize: 12 }}>
            actions: {board.actions.join(", ")}
          </div>
        </section>
      ))}

      <h2 style={{ fontSize: 16, marginTop: 24 }}>Full board data</h2>
      <ul style={{ margin: 0, paddingLeft: 20 }}>
        {getFullBoardCategories().map((category) => (
          <li key={category.key}>
            {category.label}: {category.choices.length}
          </li>
        ))}
      </ul>
    </main>
  );
}

const cell: React.CSSProperties = {
  border: "1px solid #ddd",
  padding: "2px 8px",
  fontSize: 13,
};
