# AI backend integration

BridgeBoard returns a usable board before it starts image work. Frontends must keep the last committed board mounted while a new question is classified and must update visuals by `assetKey`, never by clearing the whole board.

## Classify a finalized caregiver turn

`POST /api/classify-question`

```json
{
  "questionText": "Would you like waffles or dragon fruit?",
  "profile": { "id": "profile-1", "maxChoices": 4 }
}
```

The response contains `board` and, when image providers are configured, an `assetStream` descriptor. Every choice already has a label, spoken phrase, icon, and working selection action. `visual.status: "pending"` means only the image is pending.

```ts
const controller = createBoardSessionController({
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
- merges unchanged choices by `choiceKey` and retains ready images;
- adds new choices with text/icon plus a per-choice pending visual;
- applies NDJSON image events only when `assetKey` still matches;
- keeps a ready image when refresh or generation fails;
- preserves the committed board when a later classification fails.

Call `destroy()` when the owning screen is permanently unmounted.

## Asset stream

`POST /api/resolve-assets` accepts the signed token returned by classification:

```json
{
  "token": "signed-token",
  "skipAssetKeys": ["already-ready-asset-key"]
}
```

The NDJSON stream emits `asset.ready`, `asset.unavailable`, then `complete`. An unavailable image does not disable its choice. Raw model output, prompts, provider errors, and credentials are not part of this contract.

## Realtime transcription

Send a browser WebRTC SDP offer as `application/sdp` to `POST /api/realtime/session`. The route returns the SDP answer and keeps the OpenAI key server-side. Use `createRealtimeTranscriptionController()` for the browser connection and pass only completed transcripts to the board-session controller.
