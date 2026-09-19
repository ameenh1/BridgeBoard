# Backend / Infrastructure checklist (Person 3)

> Mission: make BridgeBoard safe, fast, deployable, and impossible to break during
> the demo. No raw AI output ever reaches the UI.

Status as of the `backend` branch. Check items off as they land.

---

## Phase 0 — Shared setup

| | Item | Notes |
|---|---|---|
| [x] | Next.js + TS + Tailwind app | Next 16.3.5, on `main` |
| [x] | `npm install openai zod zustand lucide-react` | done |
| [x] | `.env.example` committed | `.env*` negated for that one file |
| [x] | `.env.local` gitignored | verified — git refuses to add it |
| [ ] | **Deploy blank app to Vercel** | needs your login; do this early, not at hour 20 |
| [ ] | `OPENAI_API_KEY` in Vercel env | server-side only, never `NEXT_PUBLIC_` |
| [ ] | `OPENAI_API_KEY` in each teammate's `.env.local` | shared project key |
| [ ] | Teammates rebase onto `main` | `frontend` and `ai` are still on the README commit |

---

## Phase 1 — Reliability floor (no AI, no network) ✅

| | Item | File |
|---|---|---|
| [x] | Shared types committed early | `src/types/board.ts`, `profile.ts`, `vocabulary.ts` |
| [x] | Approved vocabulary catalog | `src/lib/vocabulary/approvedVocabulary.ts` |
| [x] | Full core board data | `src/lib/vocabulary/coreVocabulary.ts` |
| [x] | Allowlist helpers | `src/lib/vocabulary/vocabularyHelpers.ts` |
| [x] | Fallback board exists and is tested | `src/lib/board/createFallbackBoard.ts` |
| [x] | Static demo boards | `src/lib/board/demoBoards.ts` |
| [x] | Smoke test over required cases | `npm run smoke` — 104 checks |

---

## Phase 2 — The validation pipeline ✅

The core of the role. Everything below is deterministic app code, not model judgment.

| | Item | Detail |
|---|---|---|
| [x] | `AIClassificationSchema` (Zod) | `src/lib/validation/aiClassification.ts` — coordinate with Person 2 before changing it |
| [x] | `ClassifyQuestionRequestSchema` | never trust the browser; `questionText` 1–300 chars |
| [x] | `buildRenderableBoard(raw, profile)` | the pipeline below, in order |
| [x] | `MIN_AI_CONFIDENCE = 0.78` | tunable constant, not a model decision |
| [x] | `resolveVocabularyChoice(id, profile)` | image hierarchy; must never block |
| [x] | `POST /api/classify-question` | returns `{ board }`, safe even when the classifier throws |
| [x] | `GET /api/health` | `{ ok, app, mode }` — no secrets, no env contents |
| [x] | `temporaryMockClassifier()` | so Person 2 is never a blocker |

Pipeline order — do not reorder:

```
raw → Zod safeParse → requiresFallback → confidence < 0.78 → questionType "unknown"
    → allowlist filter → slice to profile.maxChoices → trusted catalog lookup
    → image resolution → RenderableBoard
```

Fallback triggers (each returns `createFallbackBoard(reason)`):

- [x] AI call throws → `ai_error`
- [x] malformed JSON / Zod fails → `invalid_response`
- [x] `requiresFallback === true` → `low_confidence`
- [x] `confidence < 0.78` → `low_confidence`
- [x] `questionType === "unknown"` → `unknown_question`
- [x] every candidate ID unapproved → `no_approved_vocabulary`
- [x] image lookup fails → **not** a fallback; render text + icon
- [x] storage fails → **not** a fallback; use defaults

---

## Phase 3 — Images

Priority order: personal photo → curated local → cached generated → pre-generated →
background request → icon + text.

| | Item | Detail |
|---|---|---|
| [ ] | `ImageCacheEntry` type (deferred: nothing to cache until assets exist) | id, normalizedKey, vocabularyId, label, styleVersion, imageUrl, source, status, accessCount, lastAccessedAt, createdAt |
| [ ] | `createImageCacheKey(label, styleVersion)` | lowercase, strip punctuation, hyphenate |
| [x] | `findPersonalVocabularyImage(profileId, vocabId)` | profile-scoped map is fine for MVP |
| [x] | Never await live generation in the request path | queue it, return the board now |
| [x] | Build-time image manifest | `imageUrl` only emitted when the file exists; assets light up automatically when dropped in |
| [ ] | `POST /api/images/resolve` | **only if** internal resolution proves insufficient |
| [x] | Web image search stays caregiver-approved | never automatic, never child-facing |

---

## Phase 4 — Persistence (localStorage first) ✅

| | Item | Detail |
|---|---|---|
| [x] | `loadSettings()` / `saveSettings()` / `clearSettings()` | `src/lib/storage/settings.ts` |
| [x] | Corrupted JSON returns `DEFAULT_PROFILE` | wrap every read in try/catch; never throw |
| [x] | Persist: complexity, quiet mode, TTS, visuals, labels, history, last profile | |
| [x] | Personal demo vocabulary | profile-scoped |
| [x] | Optional communication history | after core works; never log audio |

---

## Phase 5 — Demo mode

| | Item | Detail |
|---|---|---|
| [x] | `NEXT_PUBLIC_APP_MODE=demo` respected | must work with **no** `OPENAI_API_KEY` |
| [x] | Breakfast / feelings / cups boards | built |
| [x] | Uncertainty → fallback | built |
| [x] | Wire demo matcher into the API route | short-circuit before any model call |
| [ ] | "Demo Mode" indicator in dev settings only | not in the pitch flow |

---

## Phase 6 — Deployment and hardening

| | Item | Detail |
|---|---|---|
| [ ] | Vercel project created / imported | |
| [ ] | Env vars set in Vercel | same key as local |
| [ ] | Preview deployments work | |
| [ ] | One stable production deployment | |
| [ ] | Tested in incognito | catches "works because of my cache" |
| [ ] | Tested at tablet width | primary target device |
| [ ] | API cost controlled | demo mode short-circuits most calls |
| [ ] | **Backup screen-capture demo video** | you own the final file — wifi dies at demos |
| [x] | README: setup + architecture diagram | pipeline diagram, setup, both integration contracts |
| [ ] | Architecture notes for Devpost | |

---

## Merge gate (before anything hits `main`)

- [ ] `npm run build` clean
- [ ] `npm run smoke` passes
- [ ] Breakfast demo works
- [ ] Feelings demo works
- [ ] Full Board data renders
- [ ] Fallback works
- [ ] Vercel preview checked
- [ ] No secrets committed
- [ ] No raw AI output displayed

---

## What I owe my teammates

**Person 1 (frontend)** — one contract, already committed:

```ts
const res = await fetch("/api/classify-question", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ questionText, profile: { id, maxChoices } }),
});
const { board } = await res.json();   // RenderableBoard
```

`board.choices[].spokenPhrase` is what to speak. `board.actions` is the persistent
bar. `board.isFallback` picks the fallback presentation. No AI parsing in components.

**Person 2 (AI)** — one seam:

```ts
export async function classifyQuestion(questionText: string): Promise<unknown>;
```

`unknown` is deliberate — I validate it. Use `getAIAllowedVocabulary()` for the ID
list in the prompt; it withholds `spokenPhrase` by design.

## What I need from them

- **Person 2:** the image assets. `approvedVocabulary` points at
  `/default-images/*.png` and `/demo-photos/{blue,red}-cup.png` — none exist yet, so
  those URLs 404 today.
- **Person 1:** render a choice with a broken/missing `imageUrl` as text + icon.
  Per the failure matrix, a missing image must never block communication.
- **Both:** rebase onto `main` before writing code.

## Cross-branch integration

- Person 2's classifier emits a different id scheme. Translated in
  `src/lib/vocabulary/vocabularyAliases.ts` — delete that file if the catalogs are
  ever reconciled properly.
- Their schema allows 8 candidate ids; ours now accepts 8 and slices, rather than
  rejecting an otherwise-good classification.
- Their branch is not a Next app (no `src/`, own `package.json`/`tsconfig.json`).
  It cannot merge as-is — someone has to move `lib/` and `data/` under `src/` and
  drop the duplicate configs.

## Open questions

- Branch names: doc says `backend-cache-deploy` / `frontend-child-mode` /
  `ai-speech-images`; actual remote is `backend` / `frontend` / `ai`.
- Supabase is already provisioned (ref `rpldjjorjscwyaubbdtq`) though the plan puts it
  in Phase 2. Confirm nothing is expected to depend on it for the MVP.
- Feelings demo board currently shows 4 emotions; the frontend mockup shows 6 plus
  "I need help" and "I need a break".
- Personal vocabulary is a static server-side map. Caregiver photo *upload* needs
  Person 1's uploader UI and a storage decision before it can be persisted.
