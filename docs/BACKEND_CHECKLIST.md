# Backend / Infrastructure checklist (Person 3)

> Mission: make BridgeBoard safe, fast, deployable, and impossible to break during
> the demo. No raw AI output ever reaches the UI.

Status as of the `backend` branch. Check items off as they land.

---

## TODAY — integration day, in order

Ordered by how many people each item unblocks. **You** = needs your login or a
teammate conversation. **Me** = I can do it on request.

### Before anyone else pushes

| | Who | Item | Why now |
|---|---|---|---|
| [ ] | Me | **Merge `backend` into `main`** | `main` has 4 source files; `backend` has 31. Clean fast-forward. If all three merge into the current `main`, two of you resolve conflicts against a base with no API, no types, no README |
| [ ] | You | Tell both teammates to pull `main` first | stops a second round of the same conflict |
| [ ] | You | **Deploy to Vercel** | the last Phase 0 item. Works today with no API key. Ten minutes now, a bad hour at 2am. Repo is under Ameen's account, so he may need to approve the Vercel GitHub app |

### Two conversations to have

| | Who | Item | The question |
|---|---|---|---|
| [ ] | You | Image assets → Person 2 | run `npm run images:check` and hand them the list. 19 files expected, 0 present. The two cup photos are what make the personalization demo land |
| [ ] | You | Supabase → Ameen | is it load-bearing in the asset path, or a cache in front of static files? Team rule says the app must work without a database. A Supabase round-trip in the image path breaks that |

### Then wire it up

| | Who | Item | Note |
|---|---|---|---|
| [ ] | Me | Swap mock → Person 2's `classifyQuestion` | one function body in `src/lib/ai/classifyQuestion.ts`; flip `USING_MOCK` in the same commit. No gate downstream changes |
| [ ] | Me | Aliases for any new ids they emit | `src/lib/vocabulary/vocabularyAliases.ts` |
| [ ] | You/P1 | Point the UI at `POST /api/classify-question` | contract is in the README and below |
| [x] | Me | `/dev` diagnostics page | done — fires every demo prompt, dumps boards + health |

### Re-run the gate after each merge

`npm run build` · `npm run smoke` · breakfast · feelings · Full Board · fallback ·
no secrets · no raw AI output on screen

### End of hackathon, not before

| | Who | Item |
|---|---|---|
| [ ] | You | Backup screen-capture demo video |
| [ ] | Me | Architecture notes for Devpost |
| [ ] | You | Test deployed build in incognito + at tablet width |

### Explicitly not doing

Supabase for the MVP · image cache · `/api/images/resolve` · auth · runtime image
generation. All Phase 2 or later, all gated on the demo working first.

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
| [x] | Smoke test over required cases | `npm run smoke` — 122 checks |

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

**Scoped complete.** The cache and the resolve endpoint are deliberately not
built — see "Deliberately not built" below.

| | Item | Detail |
|---|---|---|
| [x] | Catalog references all 19 expected assets | so generated artwork is actually used when it lands |
| [x] | `npm run images:check` | prints exactly which files are still missing |
| [~] | `ImageCacheEntry` type | not built: nothing generates images at runtime, so there is nothing to cache |
| [~] | `createImageCacheKey(label, styleVersion)` | not built: same reason |
| [x] | `findPersonalVocabularyImage(profileId, vocabId)` | profile-scoped map is fine for MVP |
| [x] | Never await live generation in the request path | queue it, return the board now |
| [x] | Build-time image manifest | `imageUrl` only emitted when the file exists; assets light up automatically when dropped in |
| [ ] | `POST /api/images/resolve` | **only if** internal resolution proves insufficient |
| [x] | Web image search stays caregiver-approved | never automatic, never child-facing |

**Deliberately not built.** The doc says to prefer resolving internally and
"do NOT build a separate endpoint merely because it sounds architectural."
Pre-generated assets are static files the manifest already handles, so a cache
would only matter for runtime generation — which the doc keeps out of the
critical path and marks optional until after the MVP is stable. If runtime
generation is ever added, the seam is the numbered gap in
`resolveVocabularyChoice`.

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

## Phase 5 — Demo mode ✅

| | Item | Detail |
|---|---|---|
| [x] | `NEXT_PUBLIC_APP_MODE=demo` respected | must work with **no** `OPENAI_API_KEY` |
| [x] | Breakfast / feelings / cups boards | built |
| [x] | Uncertainty → fallback | built |
| [x] | Wire demo matcher into the API route | short-circuit before any model call |
| [x] | "Demo Mode" indicator in dev settings only | `/dev` — unstyled, not child-facing |
| [x] | Uncertainty prompt is deterministic in demo mode | was falling through to the classifier |
| [x] | `DEMO_PROMPTS` single source for chips + matcher | a chip cannot drift out of sync with its board |
| [x] | Matching tolerates speech-recognition variation | without hijacking unscripted questions |

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
