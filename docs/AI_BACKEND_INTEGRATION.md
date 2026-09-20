# AI backend integration

This is the data contract between the API routes and the client shell. Both
live in this repository — `src/components/BridgeBoardApp.tsx` is the only
consumer — but the rules below are what make the board stable, so they are
written down rather than left implicit in the component.

**Two rules the UI must not break:**

1. Keep the last committed board mounted and interactive while a new caregiver
   message is being classified.
2. Update visuals by `assetKey`. Never clear the board to show a picture
   arriving.

## Classify a finalized caregiver turn

`POST /api/classify-question`

```json
{
  "questionText": "Would you like waffles or dragon fruit?",
  "profile": { "id": "profile-1", "maxChoices": 4, "visuals": "photos_first" }
}
```

Only `id`, `maxChoices` and `visuals` are accepted. Everything else in
`ChildProfile` — display name, button size, speech rate, voice — is
presentation and never leaves the device.

`visuals` decides how much image work a board is worth:

| Value | Behaviour |
|---|---|
| `photos_first` | Resolve every choice that has no bundled picture. |
| `mixed` | Keep bundled catalog artwork; resolve only novel concepts. |
| `icons_first` | Resolve nothing. Every tile shows its symbol immediately. |

The response contains `board` and, when image providers are configured and
there is work to do, an `assetStream` descriptor. Every choice already has a
label, spoken phrase, icon and working selection action. `visual.status:
"pending"` means *only the picture* is outstanding.

A pending visual that no stream will ever deliver is downgraded to
`unavailable` before the response is sent, so a tile never spins forever.

For `open_ended` questions, the classifier may return up to eight
`suggestedAnswerConcepts` in addition to catalog IDs. These are untrusted,
short answer phrases rather than selections: the server validates and
deduplicates them, creates the spoken phrase locally, and filters catalog
choices by topic. For example, `food_places` may offer restaurant, café,
fast food, picnic, or home, but a destination such as car or school is not
accepted as a place-to-eat answer.

For `statement` messages, the classifier may return up to four
`suggestedResponseConcepts`. These are also untrusted options, not selections.
The application allows short acknowledgments and first-person response phrases
such as `Yes`, `Not yet`, `I need more time`, or `I want to go`, rejects vague,
unsafe, sentence-like, and URL-shaped output, and creates the spoken phrase
locally. A statement response board is capped at four new choices so the
append-only eight-choice gallery retains earlier answers.

## Board session controller

```ts
const controller = createBoardSessionController({
  profile: serverProfileFields(profile),
  onStateChange(state) {
    renderBoard(state.board, { nonBlockingRefresh: state.isRefreshing });
  },
});

realtime.onPartialTranscript = ({ transcript }) => {
  controller.acceptPartialTranscript(transcript); // never classifies or clears
};
realtime.onFinalTranscript = ({ transcript }) => {
  controller.acceptFinalTranscript(transcript); // coalesced for one second
};
```

The controller:

- keeps the committed board and support actions usable during classification;
- treats the AI side as an append-only gallery: the new message's answers or
  responses go on top and earlier answers move down (up to 8 visible), so generated pictures
  survive later questions; the quick answers ride along separately and never
  count against that cap;
- merges unchanged choices by `choiceKey` and retains ready images;
- adds new choices with text/icon plus a per-choice pending visual;
- applies NDJSON image events only when `assetKey` still matches;
- keeps a ready image when refresh or generation fails;
- preserves the committed board when a later classification fails, and never
  replaces a real board with a fallback one.

### Selection

`selectChoice(choiceKey)` records what the communicator tapped, and
`state.selectedChoiceKey` reports it. Selection is deliberately owned by the
controller rather than by React state so that it follows the same lifecycle as
the board:

- it updates immediately on tap;
- it is **held** through classification;
- it **survives** a commit that still offers that `choiceKey`;
- it clears **only** when a committed board no longer contains it;
- asset events never change it.

Call `destroy()` when the owning screen is permanently unmounted — not when
navigating between tabs. Destroying the controller on navigation throws away
the active board and every picture already resolved for it.

## Asset stream

`POST /api/resolve-assets` accepts the signed token returned by classification:

```json
{
  "token": "signed-token",
  "skipAssetKeys": ["already-ready-asset-key"]
}
```

The token is HMAC-signed and valid for two minutes. The NDJSON stream emits
`asset.ready`, `asset.unavailable`, then `complete`. An unavailable image does
not disable its choice. Raw model output, prompts, provider errors and
credentials are not part of this contract.

`url` on a ready event is either an inline `data:image/webp;base64,…` or a
signed Supabase URL — a provider's own URL is never handed to the browser. The
client applies `isRenderableVisualUrl()` before using any of it as an image
source.

## Realtime transcription

Send a browser WebRTC SDP offer as `application/sdp` to
`POST /api/realtime/session`. The route returns the SDP answer and keeps the
OpenAI key server-side; there is no ephemeral client token to leak.

Use `createRealtimeTranscriptionController()` for the browser connection and
pass only completed transcripts to the board-session controller. Construct it
when the caregiver presses Listen, not before — nothing should hold the
microphone open ahead of an explicit request — and `stop()` it to close the
peer connection and release the tracks.

`start()` reports `permission_denied`, `not_supported`, `connection` or
`session` through `onError` and also rejects. Either way the typed message
box must stay usable.
