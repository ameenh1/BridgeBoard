# Live acceptance — run before promoting to `main`

The dev server is already running on <http://localhost:3000> from the
integration worktree (`C:\Users\islwh\bb-integration`). If it is not:

```powershell
cd C:\Users\islwh\bb-integration
npm run dev
```

Use a **fresh browser profile or an incognito window** for step 1 so the
session flag and stored settings start empty. Every step has one pass/fail.

| # | Do this | Pass means |
|---|---|---|
| 1 | Open the app in a new incognito window. Leave Email and Password blank. Click **Continue locally**. | The login shows first, and the blank form is accepted. |
| 2 | On setup, type a name, then **Continue to board**. | Lands on the Default AAC board with your name in the top-right pill. |
| 3 | Tap **I**, then **want**, then **eat**. Then press **Speak**, the **⌫** button, then **Clear**. | All 22 illustrated tiles have artwork. Each tap speaks that word. Speak reads the whole sentence. ⌫ removes one chip. Clear empties it. |
| 4 | Go to **AI AAC**. Type `Would you like waffles or dragon fruit?` and press **Ask**. | Two cards appear within about a second. |
| 5 | Look at the two cards *before* any picture loads. | **Waffles** and **dragon fruit** (that exact wording, not "fruit") are both readable and clickable, each showing a symbol. |
| 6 | Wait ~10 seconds. | Each picture fills its own card independently — one lands before the other, and neither card moves or resizes when it does. |
| 7 | Click **Waffles**. It speaks and gets a coral border. Then type `Would you like waffles or pancakes?` and press **Ask**. | Waffles is visibly selected before you ask the second question. |
| 8 | **While "Updating choices" is showing**, click **dragon fruit**, then click **Help**. | Both old cards are still on screen and still respond. Waffles keeps its selected border. Help speaks "I need help." Nothing blanks out. |
| 9 | Wait for the new board to commit. | Waffles **keeps its picture and its selection**. Pancakes is the only card showing a spinner. Dragon fruit is gone. |
| 10 | Click **History**, then click **AI AAC** again. | The same board is there, with the same pictures and the same selection. Nothing re-fetches. |
| 11 | Press F5 to reload (same tab, same session). | You go straight back to the board — not the login. Settings and history are intact. |
| 12 | Press **Listen**. Allow the microphone. Say "Would you like juice or milk?" then stop talking. Then press **Stop**. | Words appear next to "Hearing:" as you speak. About a second after you stop, a new board is classified. **Stop** makes the browser's microphone indicator go out. |
| 13 | In `.env.local`, corrupt `OPENAI_API_KEY` (add `x` to the end), save, then ask any new question. | The committed board stays fully usable and a notice says the previous choices are still available. Restore the key afterwards. |
| 14 | Resize to roughly 375, 768, 1024 and 1440 px wide. Then Tab through the board with the keyboard. | No horizontal scroll, no tile too small to hit. At 375 px the board scrolls rather than shrinking. Every focused control has a visible green ring. |

## Things worth a second look

- **Step 6 timing.** Generated images take 9–12 s against the live API. That
  is expected and is the whole point of the split: the board is usable at
  ~1 s, pictures upgrade it later.
- **Step 12** is the only step that needs a real microphone, and the only one
  that cannot be covered by the automated suite.
- **Step 14 at 375 px** is the likeliest failure. The frontend design assumed
  a landscape tablet that never scrolls; a 560 px breakpoint was added to let
  the board scroll and go to 3 columns instead of shrinking tiles past a
  hittable size.

## Then promote

Once every step passes:

```powershell
cd C:\Users\islwh\bb-integration
git fetch origin
git merge-base --is-ancestor origin/main HEAD   # merge + re-verify if this fails
npm run verify
git push origin HEAD:main
```

Then fast-forward the main checkout:

```powershell
cd "C:\Users\islwh\OneDrive\Desktop\VTHacks 2026"
git fetch origin
git checkout main
git merge --ff-only origin/main
```

If branch protection rejects the push, stop and report the branch —
`codex/main-frontend-integration` — rather than working around it.
