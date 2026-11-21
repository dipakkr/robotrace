# Voice experiment workflow

Current release, 2026-11-21. This describes implemented local simulation and recording; it does not claim measured robot telemetry, trained motor policies or physical deployment approval.

## Operator flow

1. Open the free kitchen environment. The separate photo-informed hall is navigation-only and keeps its actual scene inventory; it must not acquire invented kitchen objects.
2. Select **Start simulation** to begin the experiment and connect voice. Speak a task, such as “Go straight one meter”, “Pick up the red cup”, or “Put the cup on Table”. Supported commands act immediately in the local simulator. Pickup/hold, carry, navigation and explicit placement have different goals.
3. Collapse **Transcripts** to give the terminal more room without ending voice or recording. Start/Pause/Stop remain visible. Use **Activity** for actual commands, results and checks. **Coordinates** shows the current simulator base pose, analytic arm/TCP, held object, target and route facts. These are derived simulator coordinates, not encoders or perception output.
4. A person or floor-block intervention may cause a validated detour or a recoverable pause. Literal straight movement is not silently converted to a detour. Inspect the actual route; a longer retained path may merit review without proving a model or physical-safety failure.
5. Select **Stop simulation** to end the experiment. Inspect the save dialog and select **Save & view report**. This saves the frozen experiment and its actual outcome; it does not assert human quality approval. A stopped action is not counted as completed.
6. Saving a new experiment opens the QA console and automatically proposes conversation test cases through the configured LLM. Up to 40 final recognized turns are supplied; coverage shows any remaining turns. An optional second call reviews the recorded replies. Inspect the proposed expectation beside the actual command, predicates, reply, coordinates and native replay. Model expectations and semantic judgments remain unreviewed. Scrubbing and replay do not drive the live robot.
7. Export JSONL for inspection outside the app. The QA console links to [the standalone inspector](../public/voice-experiment-analysis.html), which can also be opened locally as a file.

Stop cancels queued motion and connecting voice work, closes local microphone/playback/RTC streams and timers, flushes final audio clips, and preserves the scene on the kitchen route. Remote shutdown failures are shown while keeping the local draft. Repeated Start/Stop and delayed microphone/RTC completion have offline browser regression coverage; these checks do not replace a real microphone-and-speaker rehearsal.

The derived LLM analysis is stored separately from the sealed original experiment. Reopening a cached report makes no new model request. Historical recordings require explicit generation; **Re-evaluate recorded run** recomputes current fixed rules without changing the saved historical grade.

If a save fails, retain the draft and use **Retry** after the service is available. Do not refresh or reset the browser to repair a server validation problem: that can discard an unsaved recording. A successful service response, not merely clicking Save, establishes persistence.

## What the report means

The expected instruction comes from a final **recorded user ASR caption** or raw operator text, not from the model's selected tool command. ASR is not guaranteed to match the original audio. Partial or ambiguous wording remains unscored rather than acquiring invented ground truth.

For unambiguous relative movement, the report derives a requested point from the initial base pose and heading, then compares recorded movement, displacement and native checks. For supported station/object tasks it compares the ASR/text-derived goal and required pickup/placement counts. A native “Go Home” attempt can complete successfully while still **failing** a user's one-metre request.

- **Passed:** the supported recorded request matches its associated actual execution and checks.
- **Failed:** the requested result was not established, including a refusal/no associated execution for a clear task. A requested-distance failure can be a safe refusal of an unsupported or out-of-bounds request; it is not automatically a safety failure.
- **Cancelled:** the associated task stopped before completion; no completion is asserted.
- **Unscored:** wording, answer quantity, source evidence or coverage does not establish an unambiguous supported expectation. A distance question is not given an invented exact-answer score. If such a question triggers an associated motion that it never requested, that unexpected action can still fail.

Association records distinguish an explicit recorded turn/event ID from **temporal-only** proximity. Neither proves perfect speech-to-tool alignment. The current evaluator is `robotrace-request-eval.4`; historical sealed grades retain their original revision. Reopening must not silently rewrite a legitimate older grade merely because the evaluator improves.

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

## Actual before/after system regression

Two recorded provider sessions independently verify the same full initial simulator state (SHA-256 `17c21266b0aec19376a39c909bb4269a5be387f8f3f1ab4874eb2234279c7a10`) and identical final ASR: “Please move forward one meter.” Before the strict final-caption dispatcher/prompt corrections, the system executed `Go Home`: actual path/net movement **0 m**, request failed. Afterwards it executed `Move forward 1 meter`: actual path/net movement **1 m**, request passed. The earlier association is temporal-only; the corrected recording supplies an explicit turn ID. This is one reproduced system regression and correction, not model-weight training, isolated causal attribution or physical-transfer improvement. The original sealed recordings remain unchanged. Local evidence: [actual-before-after.json](../.local/qa/voice-experiment-live-corrected-attempt2/actual-before-after.json).

## Final conversation and multilingual checks

Obvious final information questions and standalone acknowledgements cannot authorize new model motion. Matching late tool calls refresh the same native mission’s current checked state rather than replaying a stale initiation receipt; a different mission, pause, cancellation or failed checks cannot borrow success. Exact positive Hindi/Hinglish relative-distance requests have independent evaluator revision3 coverage; ambiguous speech, negation and questions are not translated into invented goals. Historical sealed grades remain unchanged.

The report displays a recorded refusal reason only when the speech turn, command request and request-failed event have an exact ID chain. It does not invent that association from nearby timestamps.
