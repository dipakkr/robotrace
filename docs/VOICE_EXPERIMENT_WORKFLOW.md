# Voice experiment workflow

Current release, 2026-11-21. This describes implemented local simulation and recording; it does not claim measured robot telemetry, trained motor policies or physical deployment approval.

## Operator flow

1. Open the free kitchen environment. The separate photo-informed hall is navigation-only and keeps its actual scene inventory; it must not acquire invented kitchen objects.
2. Select **Start simulation** to begin the experiment and connect voice. Speak a task, such as “Go straight one meter”, “Pick up the red cup”, or “Put the cup on Table”. Supported commands act immediately in the local simulator. Pickup/hold, carry, navigation and explicit placement have different goals.
3. Use **Activity** for actual commands, results and checks. **Coordinates** shows the current simulator base pose, analytic arm/TCP, held object, target and route facts. These are derived simulator coordinates, not encoders or perception output.
4. A person or floor-block intervention may cause a validated detour or a recoverable pause. Literal straight movement is not silently converted to a detour. Inspect the actual route; a longer retained path may merit review without proving a model or physical-safety failure.
5. Select **Stop simulation** to end the experiment. Inspect the save dialog and select **Save & compare**. This saves the frozen experiment and its actual outcome; it does not assert human quality approval. A stopped action is not counted as completed.
6. In the QA console, inspect recognized requests, associated commands, requested-versus-observed results, recorded coordinates, action replay and available separate audio clips. Scrubbing and replay do not drive the live robot.
7. Export JSONL for inspection outside the app. The QA console links to [the standalone inspector](../public/voice-experiment-analysis.html), which can also be opened locally as a file.

If a save fails, retain the draft and use **Retry** after the service is available. Do not refresh or reset the browser to repair a server validation problem: that can discard an unsaved recording. A successful service response, not merely clicking Save, establishes persistence.

## What the report means

The expected instruction comes from a final **recorded user ASR caption** or raw operator text, not from the model's selected tool command. ASR is not guaranteed to match the original audio. Partial or ambiguous wording remains unscored rather than acquiring invented ground truth.

For unambiguous relative movement, the report derives a requested point from the initial base pose and heading, then compares recorded movement, displacement and native checks. For supported station/object tasks it compares the ASR/text-derived goal and required pickup/placement counts. A native “Go Home” attempt can complete successfully while still **failing** a user's one-metre request.

- **Passed:** the supported recorded request matches its associated actual execution and checks.
- **Failed:** the requested result was not established, including a refusal/no associated execution for a clear task. A requested-distance failure can be a safe refusal of an unsupported or out-of-bounds request; it is not automatically a safety failure.
- **Cancelled:** the associated task stopped before completion; no completion is asserted.
- **Unscored:** wording, answer quantity, source evidence or coverage does not establish an unambiguous supported expectation. A distance question is not given an invented exact-answer score. If such a question triggers an associated motion that it never requested, that unexpected action can still fail.

Association records distinguish an explicit recorded turn/event ID from **temporal-only** proximity. Neither proves perfect speech-to-tool alignment. The current evaluator is `robotrace-request-eval.2`; historical sealed grades retain their original revision. Reopening must not silently rewrite a legitimate older grade merely because the evaluator improves.

## Recording and export contract

`robotrace.voice-experiment.v1` contains an experiment UUID, epoch-millisecond start/end, actual environment kind, initial/final worlds, events, native action attempts, transcript snapshots and explicit truncation counters.

Events have `{id, type, at, simTime, data}`. Attempts retain their command, original native payload and optional source-turn/event and wall-time metadata. User and assistant transcript snapshots retain actual IDs, text, partial/final state and receive time. Separate audio clips have direction, wall-time bounds, media type, byte count and digest; they are **not** presented as sample-synchronized audio/video. Text receipt is not proof of audio playback.

Session world sampling is bounded at approximately **5 Hz**, plus the terminal snapshot. Action recordings preserve their native approximately **10 Hz** snapshots and control/terminal states. Recorded data cannot recover unknown motion between snapshots. Coordinates use floor X/Z metres, rendered object-centre XYZ and radians for analytic joint angles. Session wall time and simulated time are separate clocks.

Current bounds include 6,000 session events, 600 transcript snapshots, 20 action attempts, 1,500 samples per action and a 20 MiB experiment transport limit. Dropped recording data is explicitly marked truncated; truncation cannot establish an overall pass. Audio has separate bounded storage. These are local demonstration bounds, not a cloud-scale or authenticated enterprise storage claim.

Typed JSONL rows include `experiment`, `event`, `transcript`, `native-attempt`, `requested-vs-observed` and `report`. The standalone consumer independently measures recorded positions and rechecks supported relative-distance requests. It labels temporal association uncertainty and does not trust posted grades. JSONL is an unsealed derivative; it does not authenticate the source or original audio. Sampled path length may undercount curves between samples.

## Independent validation and the browser/server precision fix

Native attempts are rechecked from recorded world states. Posted success labels do not determine acceptance. Validation retains complete arm-pose fields, keys, array order and nonnumeric metadata. Derived finite numeric pose values allow only **1e-9 absolute tolerance**; this accommodates final-bit browser/server mathematics without accepting meaningful coordinate changes.

A real Chrome-to-Node regression generated three moving native attempts: one-metre navigation, Cup pickup and Cup delivery. Exact JSON comparison found **277 differing numeric arm fields**, with maximum absolute difference **8.604228440844963e-16**. Those differences explained why moving browser recordings could be rejected even when zero-motion records passed.

After semantic numeric comparison, the browser-generated experiment saved through the actual local HTTP API with **201**, reopened with **200**, and preserved all three native attempts (26, 106 and 175 states). The recomputed report had three passed requests. No voice or paid model request was made for this regression; it is a controller test fixture, not a human voice session. Its saved fixture was archived outside the main QA list to avoid presenting it as user speech evidence.

Unit regressions also accept 1e-12 derived numeric differences and object-key reordering while rejecting 1e-5 coordinate changes, altered pose-basis metadata and missing fields. The fix does not remove arm validation or normalize the user's saved recording into different coordinates.

Local evidence:

- [Cross-runtime results](../.local/qa/voice-experiment-live/browser-moving-cross-runtime-results.json)
- [Browser-generated native fixture](../.local/qa/voice-experiment-live/browser-moving-cross-runtime-experiment.json)
- [Offline QA browser checks](../.local/qa/voice-experiment-live/final-offline-ui-results.json)
- [Standalone JSONL browser checks](../.local/qa/voice-experiment-live/independent-jsonl-smoke-results.json)
- [Requested-versus-observed and precision regressions](../src/data/voice-experiment.test.ts)

Local evidence files are development artifacts and may not be included in the public repository. Hash checks detect changes relative to the stored seal; they are not authentication, verified operator identity or proof that submitted data came from physical hardware.
