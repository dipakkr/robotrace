# Feature and internal rubric evidence matrix

Updated **21 November 2026**. Weights below come from [RELEASE_PLAN.md](RELEASE_PLAN.md): they are internal release priorities, **not the organizer's official rubric, an awarded score or an estimate of winning chances**. Feature counts and polished screenshots cannot establish a perfect score.

[FEATURE_ACCEPTANCE.md](FEATURE_ACCEPTANCE.md) defines a source review, actual demo check, failure case and regression gate for each F-number. [DELIVERY_BACKLOG.md](DELIVERY_BACKLOG.md) breaks that work into stable atomic tasks. Read all three together: implemented, automatically demonstrated and human demonstrated are different states.

## Status meanings

- **TODO:** implementation or its named acceptance remains missing.
- **IMPLEMENTED:** source exists; no current demo pass is implied.
- **AUTOMATED-CHECK:** meaningful controller/API/validation checks have evidence.
- **AUTOMATED-DEMO:** an actual browser/provider path has a recorded observed result.
- **HUMAN-DEMO:** a person performed/heard the specified check and its evidence is recorded. The physical microphone/listener check is still open.

Earlier browser/provider runs remain point-in-time evidence. They do not automatically close regression gates after new Review, visual, navigation or generation changes.

## Internal category priorities: 100 total, no awarded total

| Category | Weight | Full-credit criterion | Observed evidence | Gap / release gate |
| --- | ---: | --- | --- | --- |
| Mandatory live voice | 20 | Employee speech, actual Murf response, meaningful action and factual spoken outcome | Real prerecorded repair speech and mobile speech passed through Agora/LLM/Murf. Mobile run: 5 skills, 10 m, 111 states, 738889 remote-audio bytes; transcript confirmed Cup→Sink/Bowl→Counter | **HV-01 OPEN.** Mobile current-policy receipts were observed; prerecorded input/recorded output is not physical microphone or human-heard verification |
| End-to-end workplace outcome | 20 | Task/context → current approval semantics → observed execution → review → persistent assignment/report/export | All three built-in browser workflows passed. Corrected custom cup/cup/bowl scene completed 3 actions and returned independently recomputed acceptance with matched replay | E25 continuous mobile voice→five steps→explicit 201 save→accepted report→factual remote speech passed; exact saved-record replay/reexport/consumer E26 and labelled backup E28 verified; human audio and untested approval edges stay open |
| Meaningful actions | 15 | Grounded operations change actual state, wait for observation and retain truthful failures | Real provider speech-to-action; actual UI/controller placements; zero-action reach refusal; human-proxy hold/clear/explicit resume | Mobile reset stayed explicit; occupied start made no movement; stop retained cargo and fresh recovery delivered. Other untested Review exclusions remain OPEN |
| Physical-AI usefulness and integrity | 15 | Reproducible task/scene runs, protected references, retained failures and honest portable evidence | Independent SHA/FK consumer; 9 fixed controller cases; 5 mobile cases; human/baseline/model comparison; 100 constrained cases = 60 accepted + 40 expected refusals | Static and mobile protected-history checks pass, including restored final poses and legitimate human intervention. Training importer, measured learning/transfer and recipient utility remain open |
| Demo UI and usability | 15 | Dense readable dark console, usable review/recovery controls, presentation/camera/responsive behavior | Three layouts/cameras/Escape and panel toggles passed; new Review cancellation was reachable at 1280×720 | Current mobile/planner dialogs passed 1280×720 and 390×844 without overflow. E27 selected-style and six-step/footer checks pass; full keyboard/accessibility and physical phone acceptance remain open |
| Reliability and recovery | 10 | Meaningful controller/API checks, truthful error/recovery, consistent persistent data and protected secrets | Session/data tests; server-recomputed replay; library GET/replay/import with stripped links; corrupted digest rejected without history injection | Integrated snapshot: 282 tests and build pass; six-step UI regression/build now pass; untested auto-mode edges and physical media recovery remain |
| Evidence and measurable results | 5 | Actual reports/counts/checks, honest readiness and supported stage material | Saved reports, audio/transcript, consumer-verified exports, real model request timing and actual screenshots | E25 provider workflow, E26 exact-record handoff and E28 labelled backup now exist; final source/publish manifest and human rehearsal remain separate. No measured productivity savings, policy-training gain or winning probability |

An implemented feature does not automatically earn its category weight. **No numerical score is awarded here.**

## Feature-level review and demo status

Detailed expected inputs, assertions and regression gates are in the corresponding F-section of FEATURE_ACCEPTANCE.md. Tasks refer to DELIVERY_BACKLOG.md. An AUTOMATED-DEMO label covers the listed case, not every future input.

| Feature / acceptance review | Current implementation and evidence | Concrete observed result | Remaining check / regression |
| --- | --- | --- | --- |
| **F-01 Voice** · C/X | IMPLEMENTED; AUTOMATED-DEMO | Repair 3-action run and mobile 5-skill/10 m/111-state run; actual remote audio/transcript and current approval receipt | HV-01 remains OPEN; neither prerecorded input nor captured output proves human speaking/hearing |
| **F-02 Grounded knowledge/tools** · A/C/H | IMPLEMENTED; AUTOMATED-CHECK + AUTOMATED-DEMO | Exact built-in task/scene context and meaningful actions; custom assignment supplied to supported planner | Ambiguity/unknown-object regression whenever task/context vocabulary changes |
| **F-03 Review/auto motion** · Q | IMPLEMENTED; scoped AUTOMATED-DEMO | Cancellation/auto-run, disabled preference after reload and explicit scene/reset/save checks passed. Final timer audit: manual approval at 2453 ms ran once; discarded/replaced plan deadlines caused no obsolete movement | Actual hidden-tab cancellation was not exercised (headless Chrome remained visible). Separate replay/modal/occupied pending-timer combinations remain open; see UI_ACCEPTANCE |
| **F-04 Arm/workplace families** · F/G | IMPLEMENTED; AUTOMATED-DEMO | Repair/kitchen/lab distinct assignments completed 3/3/2 actions with goal checks and lab reference preserved | Final integration after Review; no drawers, cloth, contact dynamics or arbitrary physical-task support |
| **F-05 Human proxy** · I | IMPLEMENTED; 8 controller tests + 4 AUTOMATED-DEMO groups | Nearby proceeds; occupied transfer holds pose/clock/cargo; clearing remains paused; explicit resume completes; preflight occupied blocks | Rerun affected guards after auto/mobile changes. Proxy is not detection, motion capture or safety certification |
| **F-06 Scene drafts** · E | IMPLEMENTED; AUTOMATED-DEMO | Corrected exact two-cup/one-bowl draft applied, executed, reviewed and saved with recomputed matched replay | The earlier omitted-count failure is retained as history; new count/asset/goal combinations still require fidelity checks |
| **F-07 Image/video frame** · M/W | IMPLEMENTED; AUTOMATED-DEMO | Photo and local-video-frame previews; one explicit real frame request returned supported cup/cup/bowl draft | Exact submitted JPEG hash/time, stale-hash cancellation and 50 MiB rejection now pass F-24; temporal motion and rights verification remain open |
| **F-08 Saved library/import** · Y | IMPLEMENTED; AUTOMATED-DEMO | Latest valid approved/completed episode replayed; sealed import preserved state/status, stripped savedId/reportId; bad SHA caused no history change/writes | Current Review/timeline regression; no imported link is a trusted local receipt |
| **F-09 Reports/recomputation** · H/I | IMPLEMENTED; AUTOMATED-CHECK + AUTOMATED-DEMO | Corrected live custom scene receipt: acceptance passed, independentlyRecomputed true, replay performed/matched | Repeat one real submission after server/validator changes; posted success booleans and approval alone never prove acceptance |
| **F-10 Native evidence** · L | IMPLEMENTED; AUTOMATED-CHECK + AUTOMATED-DEMO | Native packages parsed/verified; failed zero-action case preserved; tampered data rejected; derived traces consumed independently (F-21) | Static-arm candidate/native/server protected-history regressions pass; final restore cannot erase handling. SHA proves integrity, not authorship, physical truth or training-format compatibility |
| **F-11 Human/model planners** · V | IMPLEMENTED; AUTOMATED-CHECK + AUTOMATED-DEMO | Human wrong-goal move completes but fails task; baseline passes same scene. Six predefined real model cases passed; one UI gpt-4.1-mini request passed at 1326.93 ms with 3 actions | No statistical ranking/generalization claim. Rerun local controls without paid calls unless provider behavior changed |
| **F-12 Fixed controller campaign** · J/U01 | IMPLEMENTED; AUTOMATED-DEMO | 9 matched cases = 6 completed tasks + 3 expected reach refusals; protected references checked | Changed controller/fixtures require repeat. Correct refusal is a passed regression, not completed work |
| **F-13 Layout/camera/responsive** · D/S | IMPLEMENTED; prior AUTOMATED-DEMO | Studio/Copilot/Simulation/Escape, three cameras, panel restoration; 1440×900, 1280×720, 390×844 without horizontal overflow | New Review/selection/current mobile modal changes require targeted visual/control checks; physical phone remains separate |
| **F-14 Dense stripe-free console** · S | IMPLEMENTED; scoped AUTOMATED-DEMO E27 | Named rail/tree/tabs computed stripe-free, compact 11 px/25 px rows, six-step Review visible footer and 390-width no overflow | Full keyboard/accessibility and untested surfaces remain separate; no universal certification |
| **F-15 Connection recovery** · C/O | IMPLEMENTED; AUTOMATED-CHECK | Lifecycle race/reset/auth/cleanup/error checks and truthful local/provider status | Mobile error-state/empty-reset UI passes F-26 with zero provider starts; physical microphone/audio reconnect remains open |
| **F-16 Factual readiness** · O/X | IMPLEMENTED; final view check OPEN | Actual episode/report/campaign evidence is available; internal priorities declared | Audit no queued/selected feature receives false completion credit; no automatic perfect score or fabricated benefit |
| **F-17 Full workplace release** · O/P/X | IMPLEMENTED; prior AUTOMATED-DEMO | Built-in/custom records plus E25 one-session prerecorded voice/action/explicit-save/report/spoken-outcome pass | E26 exact-record handoff and E28 backup verified; untested approval/keyboard edges and HV-01 remain open |
| **F-18 Mobile floor navigation** · T | IMPLEMENTED; AUTOMATED-CHECK + AUTOMATED-DEMO | 17 core tests; browser main 5 groups + focused visual pass; actual reach/pickup/carry/delivery, same-scene fixed/mobile comparison, detour, occupied hold/clear/resume, explicit reset, stop/cargo recovery, SHA export | Final regression after any controller change; physical phone touch/audio and real navigation/sensing remain unverified |
| **F-19 Constrained variation** · U | IMPLEMENTED; AUTOMATED-CHECK + AUTOMATED-DEMO | 100 seeded executed cases exported: 60 accepted, 40 expected refusals, zero unexpected outcomes/provider calls; case load worked | Validate arbitrary valid starting scenes/overlap bounds; duplicate accounting and cancellation remain TODO; not 100 real recordings |
| **F-20 Human-demo bridge** · W | Research/contract IMPLEMENTED; temporal/recipient utility TODO | Official Pronto terms and primary robotics sources verified; narrow rigid kitchen pilot defined; current reference→task→evaluation/native handoff exists | Temporal task graph/annotations/uncertainty/rights/reviewer lineage/actual recipient loader and a measured pilot; no partnership/training-gain claim |
| **F-21 Shared kinematic traces / independent consumer** · Z | IMPLEMENTED; AUTOMATED-CHECK + observed CLI consumption | Display/export share arm pose; independent consumer has 9 tests and verified SHA + signed additive FK. Actual workbench: 70 observations/67 positive-time pairs/2 same-clock exclusions; mobile: 111/110/0 | Derived base/joint/TCP/gripper coordinates and state deltas are not measured motor actions, a training dataset or a LeRobot adapter; consumer does not independently rerun task acceptance |
| **F-22 Actual mobile AI predeployment evaluation** · AA | IMPLEMENTED; AUTOMATED-CHECK + AUTOMATED-DEMO | 17 candidate tests; browser 8 groups passed; exactly one gpt-4o-mini request: 2797.58 ms, 5 skills, task accepted. Report: 9 attempts, 4 accepted, 5 controller completions, 1 completed wrong-goal, 4 failed/refused/blocked. Five-case baseline: 2 accepted + 3 expected failures | High-level skill plans only; not a VLA, motor-policy benchmark or statistical model ranking. Mobile and static-arm protected-history regressions pass; touched-and-returned references remain rejected |
| **F-23 Mobile reviewed records** · AB | IMPLEMENTED; AUTOMATED-DEMO E18 | Five real API/browser groups; completed accepted and stopped unaccepted saves, exact frozen retry/export, GET/SHA replay/live preservation, approval hit at 1280×720 | Continuous prerecorded voice→save→spoken report now passes E25; local state validation is not source authentication and exact-record consumer handoff passes E26; human acceptance remains separate |
| **F-24 Submitted reference identity** · AC | IMPLEMENTED; AUTOMATED-DEMO E19 | Exact resized JPEG fingerprint and video-frame time survive real recording/export; stale upload/hash and 50 MiB cases pass using two mocked generation responses | No original-media identity, calibrated reconstruction, temporal capture or verified rights |
| **F-25 Correlated child lineage** · AD | IMPLEMENTED; AUTOMATED-CHECK + AUTOMATED-DEMO E20 | Two recorded child layouts retain shared parent/seed and distinct indices; consumer groups declared siblings and retains different computed child hashes | Ancestry is unverified, no train/test split or training result |
| **F-26 Mobile connection recovery** · AE | IMPLEMENTED; AUTOMATED-DEMO E21 | Five error-state groups, visible error/Reset at 1280/390, duplicate prevention, one actual empty reset after injected failure | Zero provider starts in this test; human media and full live recovery remain HV-01 |

## Evidence artifacts and implementation links

Generated `.local/qa/` artifacts are local evidence, not guaranteed files in a fresh checkout:

- `voice-result.json`: prerecorded provider run; both human audio fields false.
- `browser-smoke-results.json`: original complete three-family UI/API/export run.
- `browser-smoke-layouts-planners-results.json`: prior layouts and human/baseline comparison.
- `model-live-results.json`: six predefined real model-plan cases; explicitly not statistical.
- `scene-live-results.json`: corrected quantity-preserving custom scene and independently recomputed matched report.
- `reference-live-results.json`: actual selected image/video-frame UI/provider path.
- `human-smoke-results.json`: four actual proxy interruption/recovery groups.
- `library-smoke-results.json`, `planner-live-ui.json`: saved/import/tamper plus exactly one real model UI request.
- `approval-smoke-results.json`: new Review cancellation and auto-run cases; inspect its actual check list before claiming further boundaries.
- `variation-smoke-results.json`, `variation-evidence.json`: actual 100-case generation/export/load result.
- `mobile-smoke-results.json`, `mobile-visual-smoke-results.json`: 5 actual mobile UI groups and focused canvas/camera/responsive checks; no paid calls.
- `mobile-voice-results.json`: actual prerecorded Agora/LLM/Murf mobile run; human microphone/playback flags remain false.
- `mobile-planner-live-results.json`, `mobile-planner-live-report.json`, `mobile-planner-live-observed.csv`: 8 UI groups; one actual model request and derived report counts (not synthetic scores).
- `mobile-store-smoke-results.json`, `reference-provenance-results.json`, `lineage-smoke-results.json`, `mobile-voice-recovery-results.json`: narrow F-23–F-26 checks; see FEATURE_ACCEPTANCE E18–E21.
- `release-preflight-results.json`: 15 local checks; no production security claim.
- `final-workflow/handoff-results.json`: four exact saved-record GET/replay/reexport/Node-consumer checks, 117 observations/116 pairs, zero POST/provider calls.
- `ui-acceptance-review-regression-results.json` and [UI_ACCEPTANCE.md](UI_ACCEPTANCE.md): six-step 96 px scroll area/footer, named selected styles and responsive/explicit-critical-action checks.
- `final-workflow/teachtrace-voice-workflow.mp4`: 75.72 s labelled automated backup with prerecorded command and real remote audio, approximate A/V alignment.
- `approval-edge-results.json`: two actual UI groups passed for near-deadline manual approval and discarded/replaced timers; hidden/replay/modal/occupied combinations are explicitly unexercised.
- `voice-progress-results.json`: real progress content proved, overall delivery audit false after its timeout; no human listening claim.
- `final-workflow/results.json`: five checks pass in one 73,650 ms actual-provider session including explicit 201 save, report context and transcribed delivery/save outcome; prerecorded input, both human flags false. Earlier harness-failed attempt remains `final-workflow-first-attempt/`.
- `consumer/workbench/manifest.json`, `consumer/mobile/manifest.json`: independent actual SHA/FK consumption, observed sample/pair counts and explicit `sourceTaskChecksRecomputed: false`.

Relevant sources/checks: [engine](../src/sim/engine.ts), [scene specification](../src/sim/scene-spec.ts), [candidate plans](../src/sim/candidate-plans.ts), [evidence](../src/data/evidence.ts), [mobile controller](../src/sim/mobile-navigation.ts), [variation generator](../src/sim/data-variations.ts), [server simulation](../server/simulation.mjs), [API tests](../server/api.test.mjs), [browser smoke](../scripts/browser-smoke.mjs), [library smoke](../scripts/library-smoke.mjs), [human smoke](../scripts/human-smoke.mjs), [approval smoke](../scripts/approval-smoke.mjs), [variation smoke](../scripts/variation-smoke.mjs).

New sources/checks: [mobile arm solver](../src/sim/mobile-arm.ts), [derived workcell trace](../src/data/robot-trace.ts), [mobile evidence](../src/data/mobile-evidence.ts), [independent consumer](../scripts/consume-evidence.mjs), [consumer tests](../scripts/consume-evidence.test.mjs), [mobile candidate evaluator](../src/sim/mobile-candidates.ts), [candidate tests](../src/sim/mobile-candidates.test.ts), [five cases](../src/sim/mobile-evaluation-cases.ts), [planner bench](../src/components/MobilePlannerBench.tsx), [mobile planner service](../server/mobile-planner.mjs), [mobile browser smoke](../scripts/mobile-smoke.mjs), [planner UI smoke](../scripts/mobile-planner-smoke.mjs).

Research and limits: [claim go/no-go review](GOAL_VALIDATION.md), [human demonstration bridge](HUMAN_DEMONSTRATION_BRIDGE.md), [physical-AI evaluations](PHYSICAL_AI_EVALUATIONS.md), [physical-AI research](PHYSICAL_AI_RESEARCH.md). No universal frontier-lab ingestion endpoint or data buyer is assumed.

## Remaining human verification — one field

| Field | Status and acceptance |
| --- | --- |
| **HV-01 physical microphone and human-heard response** | **OPEN.** A person speaks a supported current-policy task into the laptop microphone, hears actual Agora/Murf speech, observes the real action and hears its factual outcome. Record date, environment and result. Keep `humanMicrophoneVerified: false` and `humanPlaybackVerified: false` until this happens |

Other open engineering gates stay in their feature rows. Production multi-tenancy, full dynamics, low-level policy training, recipient training-format compatibility and real-robot deployment are outside this local prototype's completed claims. Final release gates and every feature's review/demo checks are in FEATURE_ACCEPTANCE.md; no heading or internal weight closes a gate automatically.
