# Validation status

Updated **21 November 2026, India time**. This document distinguishes actual
provider/browser evidence, isolated UI fault tests and remaining acceptance.
The JSON artifacts below are ignored local QA records in this development
checkout; they are not included in a fresh clone. Linked scripts reproduce the
corresponding checks, with provider tests requiring an explicitly intended call.

## Current RoboTrace voice-only kitchen release

The entry is `/kitchen`, titled **Free Kitchen Navigation Environment**. It automatically attempts voice connection once the scene is ready. The mobile sandbox has no task dropdown form or command textbox. English/Hindi/Hinglish input is configured; Murf spoken replies remain English.

| Current check | Observed result | Local evidence |
| --- | --- | --- |
| Full automated suite | **387 pass**: 226 simulation/data and 161 server/script tests. Includes distinct navigation/pickup/held carry/release, strict fast speech controls, multilingual configuration and persistent evidence. | `latest-robotrace-tests.log` |
| Route and voice lifecycle | Three isolated browser checks pass: direct `/kitchen`, one auto-connect attempt per entry, browser navigation, and explicit `?voice=off` test opt-out. Provider starts were intercepted in this lifecycle test. | `kitchen-route-results.json` |
| Explicit custody primitives | Real browser pickup → navigate → place chain passes: pickup holds Cup, navigation keeps it held, explicit placement performs exactly one release. No provider calls. | `kitchen-hold-ui-results.json` |
| Natural-language interpretation | One real model request interpreted a two-stage Cup→Sink→Table instruction; the actual controller planned the second source from Sink and preserved Bowl throughout. That earlier browser proof used the removed text-entry UI; current operation is voice-only. | `sandbox-intent-results.json` |
| Continuous sandbox | Eight completed tasks without resetting, fresh queued sources, dynamic block detour, blocked-dock recovery and distinct integrity-checked traces. This recorded proof predates textbox removal; the controller remains tested independently. | `kitchen-sandbox-smoke-results.json` |
| Longer trace persistence | Actual 1.18 MB dynamic-obstruction trace saved with HTTP 201 and an accepted independently checked unreviewed report. Native mobile upload/store bounds are now 8 MiB; unrelated request routes retain 1 MiB. | `kitchen-sandbox-dynamic-save-retry.json`, `sandbox-storage-limit-tests.log` |
| Live transcript transport | Actual prerecorded-input session: 138 RTC frames, 60 decoded updates, three observed partial UI updates, both speakers and a completed delivery. Later two-column layout checks reuse recorded actual rows and are labelled accordingly. | `live-voice-captions-attempt2/results.json`, `layout-results.json` |

The third combined prerecorded-input live check passed **4/4 workflow checks** through automatic `/kitchen` connection: navigation with no pickup, Hindi Stop and frozen clock, Hindi pickup, and Hindi held carrying to Sink with zero placements. Actual commands were Go to Sink, Stop, Pick up cup, Carry cup to Sink. Fast navigation dispatched 1 ms after its recognized transcript event. Hindi Stop used the LLM path: its first observed recognized caption to Stop acknowledgment was 2144 ms, not microphone latency. The strict direct Hindi Stop path was not observed for the garbled ASR prefix. Earlier failed rehearsals are preserved. Recognition errors and human microphone/speaker acceptance remain explicit limits. Evidence: `voice-speech-controls-attempt3/results.json`. See [voice transport and acceptance](VOICE_TRANSCRIPTS.md).

## Earlier interaction and regression release

The current console executes supported local commands immediately. It has one
small, severity-colored activity terminal, no task approval tabs or countdown,
and one-click saves explicitly marked **Unreviewed**. Earlier approval recordings
below are dated historical evidence, not the current operator flow.

| Current check | Observed result | Evidence |
| --- | --- | --- |
| Full suite and build | **330 tests pass** (191 simulation/data + 139 server/scripts); production build passes. Large Three/Agora bundle warning remains. | `.local/qa/latest-dynamic-tests.log`, `latest-dynamic-build.log` |
| Durable QA console | Four actual browser groups pass: six local evaluations persisted (3 accepted tasks, 3 guard outcomes, 6 exact expectation matches), reopen/history/detail, full filtered trace export, and 1440/1280/390 layouts. Zero model calls. | `qa-console-ui-results.json`, `qa-console-report.json` |
| Dynamic person avoidance | Three actual UI groups pass: carrying Cup reroutes without stopping, occupied destination pauses, floor clicks reposition the person, clear alone does not resume, QA opening leaves live motion unchanged. Actual rerouted travel 10.57 m; no modeled circle overlap in recorded states. | `mobile-human-detour-results.json`, `mobile-human-detour-accepted-reroute.json` |
| Workcell terminal | Four original immediate-flow groups and four final fresh-history groups pass. One header, green 10px monospace, yellow warnings/red errors, current-attempt evidence only, no stale pre-run progress. | `terminal-workcell-results.json`, `workcell-terminal-context-results.json` |
| Natural follow-up | Actual counter→Sink task, exact “Move all cups from sink to drying rack”→both cups at Drying, preserved Bowl, fresh task ID and 5/5 new-goal checks. Unsupported Fork request rejects without stale completion. Three browser groups pass. | `workcell-cups-chain-results.json` |
| Follow-up persistence | Actual controller chain then one real API save: accepted independently recomputed new Drying task, review false/operator-save. | `followup-save-results.json` |
| Mobile immediate execution/save | Actual delivery, paused clock, resume and one-click real HTTP 201 save; report review false, no approval gate. | `mobile-terminal-immediate-results.json` |
| Matched regression | Four browser groups, two actual local evaluations, same scene/goal/seed, both Cup→Sink, protected Bowl round trip rejected despite exact restoration. | `matched-pair-ui-results.json`, `mobile-matched-pair.json` |
| Independent consumer | Five browser groups: real exported pair, first violating time/XYZ, selectable plot, exact JSON analysis, offline standalone HTML, integrity refusal, presentation view at 1280×720 and phone layout. | `trace-analysis-results.json`, `matched-analysis-final/manifest.json` |
| Current voice | One real prerecorded-input session executes immediately, saves unreviewed evidence and speaks its actual unreviewed status. Four workflow checks passed. The original fifth spelling check failed because the transcript rendered spoken Sink as its homophone “sync”; the explicit content reanalysis checks that against the accepted outgoing Sink announcement. No human listening pass is claimed. | `immediate-voice-workflow/results.json`, `immediate-voice-workflow/audio-content-reanalysis.json` |
| Simulation video | **89.8-second** actual typed-command recording: movement, human pause/resume, one-click unreviewed save, matched regression and independent plot. No voice/model session; two local evaluations. | `simulation-video/results.json`, `simulation-video/teachtrace-simulation-walkthrough.mp4` |

Generated evidence paths above are under ignored `.local/qa/`. The component-by-component
purpose review is [UI_COMPONENT_AUDIT.md](UI_COMPONENT_AUDIT.md). Human microphone/hearing,
real robot physics, downstream training benefit and production tenancy remain open.

## Earlier point-in-time evidence

| Area | Observed result | Record / reproducible check |
| --- | --- | --- |
| Build and automated checks | Full suite: **282 passed, zero failures** (163 simulator/data + 119 server/script). TypeScript/Vite production build passes, including the subsequent focused Review layout fix. The large-bundle warning remains. | [full-suite log](../.local/qa/final-unit.log), [build log](../.local/qa/final-build.log); [UI regression](UI_ACCEPTANCE.md) |
| Final combined voice/save rehearsal | Five checks passed in one real-provider session: prerecorded command, five actual steps, three passed goal checks, explicit HTTP 201 save, actual report in live voice context, and received/transcribed Murf confirmation. One start, one save, 117 states, 10 m, 15.2 simulated seconds, 1,140,198 remote-audio bytes; no browser errors. | [current rehearsal](../.local/qa/final-workflow/results.json), [transcript](../.local/qa/final-workflow/remote-transcript.json), [script](../scripts/final-voice-workflow-smoke.mjs) |
| Exact saved-record handoff | Four checks passed in a fresh browser: reopen the exact voice-saved ID, seek actual recorded states, reexport the identical sealed envelope, return to live, and ingest with the standalone consumer. 117 observations/116 positive-time pairs, SHA/FK verified; zero POST requests/provider calls. | [handoff results](../.local/qa/final-workflow/handoff-results.json), [consumer manifest](../.local/qa/final-workflow/independent-consumer/manifest.json), [script](../scripts/final-record-replay-smoke.mjs) |
| Real mobile voice delivery | Prerecorded speech used real Agora, configured LLM, Murf and action tools. Five skills, 10 m travel, 111 recorded states, Cup verified at Sink, 738,889 returned RTC audio bytes. Human microphone/playback flags are false. | [mobile voice artifact](../.local/qa/mobile-voice-results.json) |
| Mobile review/save/reopen | Five browser groups pass against the real local API: two HTTP 201 saves, completed accepted and stopped with held Cup not accepted. No timed submission. Frozen digest survives one deliberately unavailable save, export and real retry. Fresh browser reopens records; SHA tampering is rejected. | [store results](../.local/qa/mobile-store-smoke-results.json), [script](../scripts/mobile-store-smoke.mjs) |
| Critical approval visibility | At 1280×720, approval bounds x893–1247/y479–511 are inside the viewport, hit-tested and successfully clicked. Frozen review locks commands, header navigation and other tabs. Replay changes rendered canvas/clock; returning preserves the exact live world. | Same store results; [stopped report screenshot](../.local/qa/mobile-store-saved-stopped.png) |
| Final motion timer edges | Two groups pass: manual approval at 2453 ms causes exactly one action/episode; discarded/replaced timers never execute the obsolete plan. Genuine headless tab switching remained visible, so hidden cancellation and separate replay/modal/occupied timer combinations remain unexercised. | [timer results](../.local/qa/approval-edge-results.json), [scope and UI checks](UI_ACCEPTANCE.md) |
| Mobile voice recovery | Five error-state UI groups pass. Held/denied microphone before any provider start; duplicate starts blocked; error and Reset visible at 1280 and 390 widths; injected reset failure retained error, one actual empty reset confirmed cleanup. Workcell/mobile state agrees. | [recovery results](../.local/qa/mobile-voice-recovery-results.json), [script](../scripts/mobile-voice-recovery-smoke.mjs) |
| Real AI symbolic planner | Exactly one real UI request to gpt-4o-mini, measured 2797.58 ms, preserved its five-action candidate; actual controller/task acceptance passed. Eight browser groups pass. Export: nine attempts, four accepted tasks, five controller completions, one wrong-goal completion, four failures/refusals. This is one sample, not a model ranking. | [planner results](../.local/qa/mobile-planner-live-results.json), [script](../scripts/mobile-planner-smoke.mjs) |
| Negative cases and protected history | Five-case baseline: two accepted, one reach refusal/failure, one no-route refusal and one human block. A separate real Bowl pick-and-return completed with the exact original final pose but task acceptance failed at pickup step 8, preserving the violation. | [protected-object results](../.local/qa/protected-mobile-results.json), [planner report](../.local/qa/mobile-planner-live-report.json) |
| Workcell workflow | Built-in and approved custom tasks have recording/replay, local assignment/report submission, native import/export and tamper rejection. Acceptance is independently recomputed from complete recorded simulator states, not posted pass flags; incomplete legacy records remain unverified. | [browser results](../.local/qa/browser-smoke-results.json), [library results](../.local/qa/library-smoke-results.json) |
| Reference authoring and fingerprints | One prior real vision request proposed supported assets from a selected synthetic frame. New lineage QA used two explicitly mocked generation responses, actual JPEG resizing/hashing, controller recording and native export: four browser groups pass, including selected time 0.4 s, stale-hash cancellation and 50 MiB rejection. No media/filename is persisted in worlds. | [real reference request](../.local/qa/reference-live-results.json), [fingerprint QA](../.local/qa/reference-provenance-results.json), [script](../scripts/reference-provenance-smoke.mjs) |
| Seeded variations | Actual rehearsed source at seed 42/count 100: 60 accepted, 40 expected refusals, zero unexpected outcomes, zero provider calls. Joint traces accompany actual bounded execution. | [variation results](../.local/qa/variation-smoke-results.json), [script](../scripts/variation-smoke.mjs) |
| Correlated variant lineage | Three browser checks pass: two different loaded child layouts record and export the same declared parent digest/seed with distinct case indices. Independent consumer keeps their parent group together while retaining distinct computed child hashes. Helper/generator and consumer tests pass. Ancestry is explicitly unverified; no split is created. | [lineage results](../.local/qa/lineage-smoke-results.json), [script](../scripts/lineage-smoke.mjs), [consumer](DATA_CONSUMER.md) |
| Demand rendering | Software-WebGL QA observed zero idle draw calls across four 500 ms windows in both scenes, with actual draws after camera changes. This is a draw-activity check, not device FPS or a fleet-scale performance claim. | [render results](../.local/qa/scene-render-results.json) |
| Local release privacy checks | Fifteen preflight checks pass: private values actually loaded for scanning, credential mode 0600, supplied secrets absent from built client, ignored raw state excluded, environment/backup/private-source HTTP requests blocked, UI loopback-only, public tool auth enforced and private API unavailable through callback. | [preflight](../.local/qa/release-preflight-results.json) |

## Progress speech: partial run, precise conclusion

[The real progress-audio audit](../.local/qa/voice-progress-results.json) captured
316,619 remote-audio bytes over about 23 seconds. Automated transcription matched
the requested idle marker and **“Recheck Cup within arm reach verified.”** The
product's pickup announcement was rate-limited/suppressed in that run. REST
accepted/queued status alone was not treated as playback proof.

The audit's delivery predicate exceeded its 14-second wait, so its overall
`passed` flag is **false**. A separate local-only follow-up satisfied the same
predicate after 17.1 seconds. That diagnoses the timeout; it does not convert the
provider recording into a passed complete delivery. The audit establishes
progress-audio content, not every milestone, exact real-time synchronization,
complete delivery in that clip or human listening acceptance.

## Rehearsal evidence and pending human gates

- **Current combined rehearsal passed:** the voice session performed delivery,
  explicit save and spoken report confirmation. A separate fresh-context check
  reopened that exact record and independently consumed its identical export.
  The [75-second backup](../.local/qa/final-workflow/teachtrace-voice-workflow.mp4)
  visibly labels prerecorded input, real providers and approximate A/V alignment.
  Original tracks remain unchanged; this is not exact word/action timing evidence.
  The first attempt is preserved under `.local/qa/final-workflow-first-attempt/`:
  its real delivery/save passed, but an invalid relative URL in the QA harness
  aborted follow-up. Its overall failed result was not relabelled as a pass.
- **HV-01:** a person must verify microphone capture, conversation, audible Murf
  output and recovery on the presentation setup. Prerecorded input, remote-audio
  bytes and automated ASR do not close that gate. Physical phone audio/touch
  acceptance is also separate from responsive browser emulation.
- Recipient data rights, embodiment/action contract, validated training importer,
  policy training and held-out learning/transfer measurements remain open.
- Contact dynamics, physical sensing/safety and real-robot deployment are outside
  the current kinematic validation.
- Cloud tenancy, roles, operational monitoring and load acceptance remain
  production work. The private hosted site is a static frontend, not the local
  API/provider/persistent-record deployment.

## Interpretation rules

A plan is not execution; execution is not automatically task success; human
approval does not change a failed outcome. Parking **Go Home** can retain cargo
and reports navigation acceptance without a delivery or placement. An expected
refusal is useful test evidence, not a completed robot task.

Native exports and the standalone consumer verify unchanged content and internal
kinematics. The JSONL target is the **next observed state**, not a requested motor
command. Declared parent grouping is a curation hint, not authenticated ancestry,
a performed train/test split or a leakage-free evaluation guarantee.

[FEATURE_ACCEPTANCE.md](FEATURE_ACCEPTANCE.md) and
[DELIVERY_BACKLOG.md](DELIVERY_BACKLOG.md) track the detailed gates. Local evidence
files are inspectable records; source implementation or a backlog status alone
is not an acceptance result.
