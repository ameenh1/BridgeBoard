# BridgeBoard

**Conversation in. Choice out.**

A context-aware AAC app. A caregiver asks a question out loud; BridgeBoard turns it
into a simple visual board of *optional* vocabulary; the communicator chooses what is
actually said.

Built for VTHacks 2026.

---

## The one thing to understand

> BridgeBoard does not decide what a person means. It uses a caregiver's spoken
> context to surface optional, validated vocabulary choices. The communicator can
> select, reject, ask for more time, or always return to their full AAC board.

And the rule that follows from it:

> **The AI is allowed to fail. Communication isn't.**

The app must work with no microphone, no AI, no generated images, and no network.
Those services improve the demo; they are never required to communicate.

---

## How the safety layer works

The model never writes a word that a communicator says. It can only propose
**vocabulary IDs** from an approved catalog. Everything spoken is authored by us.

```
caregiver question
      ↓
classifier  ──────────────►  AIClassification (untrusted)
      ↓
Zod schema validation             ← malformed shape? fallback
      ↓
requiresFallback / confidence     ← below 0.78? fallback
      ↓
question type check               ← "unknown"? fallback
      ↓
approved-vocabulary allowlist     ← invented IDs dropped
      ↓
profile.maxChoices                ← board complexity enforced
      ↓
trusted catalog lookup            ← labels + spoken phrases come from here
      ↓
image resolution                  ← personal photo → curated → icon + text
      ↓
RenderableBoard  ──────────────►  the UI
```

The model is shown `{ id, label, category }` only. `spokenPhrase` is withheld, so
there is no path by which model output becomes speech.

---

## Setup

```bash
npm install
```

Create `.env.local` in the repo root:

```env
NEXT_PUBLIC_APP_MODE=demo
# OPENAI_API_KEY=       # not needed yet — the classifier is still mocked
```

> **Important:** `NEXT_PUBLIC_*` values are compiled into the build, not read at
> runtime. Create `.env.local` **before** you build, and rebuild after changing it,
> or demo mode silently won't engage.

```bash
npm run dev      # http://localhost:3000
npm run build    # production build — must be clean before merging to main
npm run smoke    # backend reliability checks, no browser needed
npm run lint
```

`.env.local` is gitignored. Never commit a key.

---

## API

### `POST /api/classify-question`

```jsonc
// request
{
  "questionText": "Do you want waffles or pancakes?",
  "profile": { "id": "demo-profile", "maxChoices": 4 }   // optional
}
```

```jsonc
// response — always { board }, even on failure
{
  "board": {
    "boardId": "…",
    "title": "What would you like to eat?",
    "questionText": "Do you want waffles or pancakes?",
    "boardType": "choice",
    "choices": [
      {
        "id": "food_waffles",
        "label": "Waffles",
        "spokenPhrase": "I want waffles.",
        "imageUrl": "/default-images/waffles.png",
        "iconKey": "utensils",
        "source": "curated"
      }
    ],
    "actions": ["help", "repeat", "something_else", "need_more_time", "full_board"],
    "isFallback": false
  }
}
```

There is no error shape to handle. If anything upstream breaks, `board` is simply a
fallback with `isFallback: true`. Internal reasons stay in the server log — a
communicator never sees `"low_confidence"`.

### `GET /api/health`

```json
{ "ok": true, "app": "bridgeboard", "mode": "demo" }
```

---

## Integration contracts

### Frontend

```ts
const res = await fetch("/api/classify-question", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ questionText, profile: { id, maxChoices } }),
});
const { board } = await res.json();
```

- `choices[].spokenPhrase` is the text to speak — never `label`
- `actions` is the persistent bar; `full_board` is always present
- `isFallback` selects the fallback presentation
- A choice may have no `imageUrl`. Render `label` + `iconKey` instead —
  **a missing image must never block communication**
- Settings: `loadSettings()` / `saveSettings()` / `updateSettings()` from
  `@/lib/storage/settings`. Corrupted or blocked storage returns defaults
- Full Board data: `getFullBoardCategories()` from `@/lib/board/fullBoard`

No AI-specific parsing belongs in a component.

### AI

One seam, in `src/lib/ai/classifyQuestion.ts`:

```ts
export async function classifyQuestion(questionText: string): Promise<unknown>;
```

`unknown` is deliberate — the response is validated downstream, so nothing changes
in the pipeline when the real classifier lands.

Build the prompt's ID list from `getAIAllowedVocabulary()`. It returns only
`{ id, label, category }`.

Vocabulary IDs are owned by the backend catalog. IDs from other naming schemes are
translated in `src/lib/vocabulary/vocabularyAliases.ts` — add an alias there rather
than forking the catalog.

---

## Failure behavior

| Failure | What happens |
|---|---|
| Classifier throws | fallback board |
| Malformed / non-JSON response | fallback board |
| Confidence below 0.78 | fallback board |
| `requiresFallback: true` | fallback board |
| Question type `unknown` | fallback board |
| Invented vocabulary IDs | dropped; board keeps the valid ones |
| All IDs invalid | fallback board |
| More choices than the profile allows | sliced to `maxChoices` |
| Image missing | label + icon; **not** a fallback |
| `localStorage` corrupted or blocked | default settings; **not** a fallback |
| No `OPENAI_API_KEY` | demo mode works unchanged |

The fallback board always offers Yes, No, Repeat, Help, More time, and Full Board.

---

## Layout

```
src/
  app/api/classify-question/   board endpoint
  app/api/health/              liveness + mode
  lib/ai/                      classifier seam + mock
  lib/board/                   builder, fallback, demo boards, Full Board
  lib/images/                  image resolution hierarchy
  lib/storage/                 settings, history, personal vocabulary
  lib/validation/              Zod schemas — the trust boundary
  lib/vocabulary/              approved catalog, allowlist, aliases
  types/                       shared contracts
scripts/smoke.ts               reliability checks
```

## Branches

`main` is always deployable. `frontend`, `ai`, and `backend` are per-person.
Before merging to `main`: `npm run build` and `npm run smoke` clean, and the
breakfast, feelings, personalization, and fallback demos all verified.
