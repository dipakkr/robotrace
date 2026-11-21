# Validation status

Updated **21 November 2026, India time**. This document distinguishes actual
provider/browser evidence, isolated UI fault tests and remaining acceptance.
The JSON artifacts below are ignored local QA records in this development
checkout; they are not included in a fresh clone. Linked scripts reproduce the
corresponding checks, with provider tests requiring an explicitly intended call.

## Current evidence

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
