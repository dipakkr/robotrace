# Feature review and demo acceptance

Updated **21 November 2026**. Every active feature below has an implementation review, a specific observed-outcome demo check and a regression gate. [DELIVERY_BACKLOG.md](DELIVERY_BACKLOG.md) contains the atomic task IDs; [FEATURE_RUBRIC_MATRIX.md](FEATURE_RUBRIC_MATRIX.md) maps evidence to internal priorities. Neither document is an official judging rubric or an estimate of winning odds.

Status axes are separate: **implementation** = TODO or IMPLEMENTED; **automated acceptance** = OPEN, AUTOMATED-CHECK or AUTOMATED-DEMO; **human acceptance** = OPEN or HUMAN-DEMO. A feature can be implemented and still have an open demo gate. No human microphone/listener pass is recorded here. Older demos remain useful evidence but do not verify later changes to their controls.

## Evidence and execution rules

Generated artifacts live under ignored `.local/qa/`; they are not promised in a fresh checkout. Inspect actual outputs, not only a script's assertions. Paid voice/model scripts require an explicit bounded test request; never launch them as an automatic regression loop. Browser tests use isolated contexts and the real local API, without modifying the owner's browser profile.

| Evidence | Recorded artifact | Observed result and limits |
| --- | --- | --- |
| E01 | `voice-result.json`, remote transcript/audio | Real prerecorded speech → Agora/LLM/Murf → approved repair task, 3 actions, remote audio captured. Physical microphone/listener fields remain false |
| E02 | `browser-smoke-results.json` | Three built-in task/replay/report/export flows; 9-case campaign; zero-action reach refusal. Predates the new Review policy |
| E03 | `browser-smoke-layouts-planners-results.json` | Layout/camera/collapse/approval-dock and human/baseline comparison. Dock evidence predates Review |
| E04 | `model-live-results.json`, `library-smoke-results.json`, `planner-live-ui.json` | Six predefined real model-plan cases; one explicitly requested real UI `gpt-4.1-mini` result: 3 actions, accepted, 1326.93 ms. These are small smoke tests |
| E05 | `scene-live-results.json`, `ai-scene.teachtrace.json` | Corrected cup/cup/bowl scene; 3 actions; saved report accepted with independent recomputation and deterministic replay matched |
| E06 | `reference-live-results.json` | Image preview and selected local-video frame; one real frame request returned supported cup/cup/bowl assets. Synthetic test reference, not measured worker activity |
| E07 | `human-smoke-results.json` | Four actual UI flows cover held-object occupancy pause, immersive proxy, clear-without-resume, explicit resume and occupied-before-start |
| E08 | `library-smoke-results.json` | Saved approved/completed record reopened; sealed import stripped storage links; changed digest rejected without history injection; no record writes |
| E09 | `approval-smoke-results.json` | New Review auto-selection/cancellation and one three-second automatic two-action run, with episode still in review. Not every exclusion is covered |
| E10 | `variation-smoke-results.json`, `variation-evidence.json` | 100 generated cases: 60 accepted tasks + 40 expected refusals, zero unexpected outcomes/provider calls; a generated situation loaded |
| E11 | Current integrated controller/data/server checks | Latest recorded full `npm test`: **282 passed** (163 simulation/data + 119 server/scripts), including static protected-history and legitimate human intervention. Re-run after further changes; this is a revision snapshot |
| E12 | `.local/qa/final-build.log` | Production TypeScript/Vite build passed again after the six-step UI fix; repeat after any further source change |
| E13 | `mobile-smoke-results.json`, `mobile-visual-smoke-results.json` | Actual main 5 mobile groups + focused visual pass: delivery/cargo hold/recovery, same-seed fixed/mobile comparison, detour/refusal, explicit reset, cameras/Escape and 1280/390 no overflow |
| E14 | `mobile-voice-results.json` | Prerecorded actual Agora/LLM/Murf mobile session: 5 skills, 10 m, 111 states, 738889 remote-audio bytes; transcript confirmed Cup→Sink/Bowl→Counter. Both human audio fields remain false |
| E15 | `mobile-planner-live-results.json`, `mobile-planner-live-report.json` | 8 browser groups passed; exactly one gpt-4o-mini request at 2797.58 ms/5 skills/accepted; 9 observed attempts = 4 accepted, 5 controller completions, 1 wrong-goal completion, 4 failed/refused/blocked |
| E16 | `consumer/workbench/manifest.json`, `consumer/mobile/manifest.json` | Independent SHA/FK consumer: workbench 70 observations/67 positive-time pairs/2 excluded same-clock pairs; mobile 111/110/0; source task checks not independently recomputed |
| E17 | Controller/data/server source tests | Current protected-history and navigation regressions pass; standalone consumer now has 9 tests. Per-feature results are distinct from the integrated E11 snapshot |
| E18 | `mobile-store-smoke-results.json` | Five actual local API/browser groups: completed accepted and stopped held-Cup unaccepted saves (201); frozen hash retained across injected unavailable save/retry; verified replay/fresh-browser list/live-world preservation; approval hit at 1280×720 |
| E19 | `reference-provenance-results.json` | Four browser groups with two explicitly mocked generation responses: actual resized JPEG hash, selected-frame time 0.4 s, stale-hash cancellation before API, 50 MiB rejection and recorded/native metadata preservation; zero paid calls |
| E20 | `lineage-smoke-results.json`, `lineage-child-*-consumer-manifest.json` | Three actual browser checks: two loaded child layouts record/export one declared parent SHA with seed/index; standalone consumer retains shared group plus distinct computed child hashes; ancestry unverified, no split |
| E21 | `mobile-voice-recovery-results.json` | Five error-state UI checks; actual SDK microphone held/denied before any provider start; duplicate prevention, visible errors/reset at 1280/390, one injected reset failure then one actual empty reset; not human audio acceptance |
| E22 | `protected-mobile-results.json` and E11 source tests | Actual Bowl round trip completes but fails task at pickup step 8 despite exact restored pose. Equivalent static candidate/native/server checks now pass, including legitimate human intervention |
| E23 | `release-preflight-results.json`, `scene-render-results.json` | 15 local privacy/startup checks pass; demand-render audit observes zero idle WebGL draws and real camera-change draws. Neither establishes production security/performance |
| E24 | `voice-progress-results.json` | Captured real remote speech contains idle marker and reach-check milestone. Overall delivery audit **false** after 14 s wait; local 17.1 s follow-up does not relabel that provider clip as complete; no human listening claim |
| E25 | `final-workflow/results.json`, [rehearsal script](../scripts/final-voice-workflow-smoke.mjs) | Five checks pass in one real-provider 73,650 ms session: prerecorded request→five steps/three passed checks→explicit 201 save→accepted report in live context→captured/transcribed delivery and saved/passed speech. Human audio flags false. First harness-failed attempt preserved separately; fresh-context handoff/consumer E26 and labelled backup E28 also pass their distinct checks |

| E26 | `final-workflow/handoff-results.json` | Four fresh-browser GET/replay/export/consumer checks pass for exact voice-saved record `22e32505-c3a9-43aa-abbc-153e4bb450bb`; reexport deep-equals sealed source; Return live restores controls; independent SHA/FK consumer reads 117 observations/116 positive-time pairs; zero POST/provider calls |
| E27 | [UI_ACCEPTANCE.md](UI_ACCEPTANCE.md), `ui-acceptance-review-regression-results.json` | Final six-step Review regression passes at 1280×720 with 96 px scroll area/visible footer; selected rail/tree/tabs computed stripe-free; 390 width no horizontal overflow; critical submission/reset/scene application remain explicit. Mocked six-object draft is UI-only evidence |
| E28 | [automated backup](../.local/qa/final-workflow/teachtrace-voice-workflow.mp4) | Actual 75.72 s build recording: prerecorded command and captured real remote audio mix. Labelled automated test; A/V alignment approximate, not exact synchronization or human microphone/listening acceptance |

### F-01 · Real voice path

**State:** IMPLEMENTED / AUTOMATED-DEMO E01, E14, E25 / human OPEN (HV-01).

- **Review:** [voice adapter](../src/integrations/voice.ts), [provider configuration](../server/config.mjs), [server lifecycle](../server/index.mjs). Keys stay server-side; transport/audio/tool states remain distinct; queued narration is not called heard speech.
- **Demo check:** a supported task reaches the scene/task tools, movement is approved under the current Review preference, actual placements complete and returned speech describes the observed result. Include a clarification or blocked request.
- **Controller/API check:** lifecycle tests cover failed start, concurrent/reset cleanup, tool auth and pending receipts; preserve original errors rather than turning a provider timeout into task success.
- **Regression gate:** repeat a bounded provider run when voice, task context, approval or tool acknowledgments change. E14 observed mobile current-policy pending/action/outcome receipts; retain separate workcell regressions if that path changes. Do not rerun paid providers for unrelated CSS.

### F-02 · Grounded task knowledge and actions

**State:** IMPLEMENTED / AUTOMATED-DEMO E01–E02, E05 / current regression OPEN.

- **Review:** [task guides](../server/task-guides.mjs), [semantic planner](../src/sim/engine.ts), [API tests](../server/api.test.mjs). Object IDs, names, destinations and custom task goals must agree; unsupported nouns/ambiguous destinations must not trigger partial hidden execution.
- **Demo check:** load lab, request `Route the samples`, inspect alpha→Rack A/beta→Rack B/reference unchanged. Ask an ambiguous destination or nonexistent object; expect clarification and no movement.
- **Logic check:** semantic planner/environment tests assert wrong-environment refusal and simulator-grounded goal checks. An LLM's verbal success is never acceptance evidence.
- **Regression gate:** repeat known/unknown/ambiguous commands after new environment, asset, task or voice-context changes.

### F-03 · Review tab and three-second simulated motion

**State:** IMPLEMENTED / AUTOMATED-DEMO E09 (partial boundaries) / human OPEN. Tasks Q01–Q21.

- **Review:** [ApprovalReview](../src/components/ApprovalReview.tsx) is presentation-only; [App.tsx](../src/App.tsx) owns timers and eligibility. Scene changes, reset and evidence submissions stay explicit. Record whether motion approval was manual or automatic.
- **Demo check A:** submit `Clear the after-meal counter`; Review opens and countdown is visible. Cancel, wait beyond 3 seconds, and verify no motion with the same pending plan/manual approval still enabled. E09 passed this case.
- **Demo check B:** discard/reprepare, allow the visible countdown, verify exactly 2 actual placements, an automatic-approval event, and episode status `review`. E09 passed this case.
- **Open boundary checks:** disable auto and reload; manually approve near expiry; hide the tab; introduce a modal/replay/busy/occupied state; replace/discard a pending plan. Assert no duplicate or stale execution. Explicit scene/reset/submit actions must never inherit a motion timer.
- **Regression gate:** Q17/Q18 evidence does not close Q19/Q20/Q21. Run the final Review checks at 1280×720 with six steps, keyboard focus and a scrollable action list before closing R07.

### F-04 · Arm motion and three workplace families

**State:** IMPLEMENTED / AUTOMATED-DEMO E02 / new-policy integration OPEN.

- **Review:** [engine](../src/sim/engine.ts), [environments](../src/sim/environments.ts), [environment tests](../src/sim/environments.test.ts). Motion uses the actual controller and idealized attachment; completion requires geometry/settled-state checks.
- **Demo check:** select repair/kitchen/lab and run their exact supported assignments; observe 3/3/2 actions respectively, correct semantic targets and lab reference preservation. Review/replay the actual resulting episode.
- **Failure check:** reach-limit and occupied-destination cases retain the precise refusal, unchanged objects and unsuccessful outcome. Reject forged `location` strings without matching pose.
- **Regression gate:** rerun affected controller cases after motion/goal changes, then one end-to-end UI task after Review integration. Do not equate three fixtures with contact physics or a learned policy.

### F-05 · Human-presence proxy and recovery

**State:** IMPLEMENTED / AUTOMATED-CHECK + AUTOMATED-DEMO E07 / physical human tracking OUT OF SCOPE.

- **Review:** [human tests](../src/sim/human-activity.test.ts), [proxy renderer](../src/components/HumanPresenceProxy.tsx). State is explicitly `scenario-proxy`, not camera detection.
- **Demo check:** begin a transfer; set nearby (motion proceeds), then in-workspace (clock/pose/held object/motion freeze). Clear occupancy; remain paused until explicit resume. Finish and inspect recorded occupied/cleared states.
- **Failure check:** start occupied and attempt resume while occupied; expect zero movement and no completed claim. E07 also exercised immersive mode/exit.
- **Regression gate:** [human-smoke.mjs](../scripts/human-smoke.mjs) plus controller tests must still pass after auto-run or mobile-proxy changes. No safety certification or captured human-motion claim follows.

### F-06 · Deterministic and AI scene authoring

**State:** IMPLEMENTED / AUTOMATED-DEMO E02, E05 / final regression OPEN.

- **Review:** [scene authoring](../src/sim/scene-authoring.ts), [SceneSpec](../src/sim/scene-spec.ts), [AI composer](../src/components/AiSceneComposer.tsx). Every object has a destination or explicit unchanged goal; IDs/counts/vocabulary/slots validate; draft creation never mutates the live scene.
- **Demo check:** request two cups plus a bowl, inspect exactly cup/cup/bowl with correct task assignments, explicitly apply, execute, review and submit. E05's corrected run passed after an earlier quantity omission; keep the failure history separate.
- **Failure check:** unsupported assets/counts, duplicate IDs/labels/slots, incomplete goals and approval/control-like task names reject visibly. A valid JSON response alone is not request fidelity.
- **Regression gate:** run [scene-spec tests](../src/sim/scene-spec.test.ts) and provider-schema tests after vocabulary/count changes. A live call is needed only when provider behavior/prompt handling changed; it remains explicitly bounded.

### F-07 · Photo and selected video-frame reference

**State:** IMPLEMENTED / AUTOMATED-DEMO E06 / real worker recording utility OPEN.

- **Review:** the file stays local until explicit generation; only the selected bounded image is sent. Unsupported/oversized formats reject; a reference is not calibrated geometry or temporal motion.
- **Demo check:** choose an image and then a local video, select a frame, generate once, inspect the actual sent frame/returned asset draft and approve separately. E06 passed previews and one real frame request.
- **Failure check:** cancel/remove reference, choose invalid/oversized media and attempt generation before frame readiness. Expect visible errors and no scene replacement.
- **Regression gate:** image/video UI checks after media changes; uncertainty/timestamps/source hashes and selected-frame time now have E19/F-24 evidence; temporal segments and rights/recipient utility remain bridge gates. Do not call synthetic reference QA a household-data study.

### F-08 · Saved library, replay and sealed import

**State:** IMPLEMENTED / AUTOMATED-DEMO E08 / current Review regression OPEN. Tasks Y01–Y06.

- **Review:** [EpisodeLibrary](../src/components/EpisodeLibrary.tsx) validates saved/native records, separates storage links from recorded outcome/review, and performs GET-only loading.
- **Demo check:** load latest valid server record; compare original ID/status/outcome/sample count/initial/final state and scrub replay. Import a sealed native package; preserve original status/outcome while stripping savedId/reportId.
- **Failure check:** alter only the digest; expect visible integrity rejection and byte-identical browser history. Loading/importing must not submit or approve a report automatically.
- **Regression gate:** [library-smoke.mjs](../scripts/library-smoke.mjs) includes one paid AI test, so **do not run it blindly** for library-only changes. Use a focused read-only library check or explicitly authorize its one model call. Y06 checks current Review/timeline reachability.

### F-09 · Assignment status and independently recomputed report

**State:** IMPLEMENTED / AUTOMATED-DEMO E02, E05 / final regression OPEN.

- **Review:** [workflows](../server/workflows.mjs), [simulation service](../server/simulation.mjs). Acceptance ignores posted pass booleans, validates complete native evidence, recomputes task checks and labels whether deterministic replay was performed/matched.
- **Demo check:** submit the reviewed current custom scene. Read report by ID and assignment status; assert `independentlyRecomputed: true`, acceptance passed, and eligible command replay `performed: true / matched: true`. E05 contains those actual fields.
- **Failure check:** forged successful geometry, missing samples and mismatched replay must yield failed/unverified acceptance; approval alone cannot turn them passed. Interrupted save must not acknowledge an absent record.
- **Regression gate:** [simulation tests](../server/simulation.test.mjs), [workflow tests](../server/workflows.test.mjs) and API forged-record cases after validation changes; repeat one real submission after server restart/code changes.

### F-10 · Native evidence package and consumer

**State:** IMPLEMENTED / AUTOMATED-CHECK + AUTOMATED-DEMO E02, E05, E08.

- **Review:** [evidence builder/validator](../src/data/evidence.ts), [tests](../src/data/evidence.test.ts). Preserve episode v1 inside evidence v1; finite chronological states, stable IDs, actual counts, computed task checks and review/outcome remain consistent.
- **Demo check:** download, JSON-parse and verify a real package; reload initial/final worlds and checks. Repeat for a failed zero-action recording; it must remain failed.
- **Failure check:** tamper content/digest, order timestamps backwards, invent completion counts or disturb the reference while claiming success; the validator must reject inconsistency.
- **Regression gate:** native consumer test after schema/recorder/goal changes. SHA-256 is integrity, not authorship, physical truth, or LeRobot/RLDS compatibility.

### F-11 · Human/baseline/real-model plan comparison

**State:** IMPLEMENTED / AUTOMATED-CHECK + AUTOMATED-DEMO E03–E04.

- **Review:** [candidate evaluator](../src/sim/candidate-plans.ts), [PlannerBench](../src/components/PlannerBench.tsx), [model adapter](../server/planner-models.mjs). One frozen initial scene/task applies to every candidate; malformed/wrong-goal output is not silently repaired.
- **Demo check:** human red→spares on repair scene completes one move but fails the task; baseline completes three and passes. One explicit `gpt-4.1-mini` UI request passed with actual model/timing preserved. No new model request is required to repeat human/baseline controls.
- **Failure check:** unknown/duplicate IDs, malformed actions, timeout/provider rejection and already-busy snapshot remain visible. Local candidates show no invented LLM latency.
- **Regression gate:** targeted `browser-smoke.mjs --only=planners`; candidate/provider tests after contract changes. Six predefined calls are not a statistical model ranking or learned-policy benchmark.

### F-12 · Fixed nine-case controller campaign

**State:** IMPLEMENTED / AUTOMATED-CHECK + AUTOMATED-DEMO E02.

- **Review:** [campaign](../src/sim/evaluation.ts) declares expected outcomes, seeds and full input/output evidence before execution.
- **Demo check:** run Controller evaluation; 9 cases match expectations, with 6 completed tasks and 3 expected refusals. Expand the lab reference check and export actual worlds/results.
- **Failure check:** a wrong refusal reason or unexpected failure cannot count as a passed case; a refusal never increments completed tasks.
- **Regression gate:** evaluation tests and `browser-smoke.mjs --only=evaluation` after shared controller/fixture changes.

### F-13 · Presentation, cameras and responsive controls

**State:** IMPLEMENTED / AUTOMATED-DEMO E02–E03, E27 for named layout/Review checks; physical phone and full keyboard/accessibility gates remain open.

- **Review:** layout/camera controls change actual presentation state; hidden panels can be restored; simulation mode retains stop/exit controls.
- **Demo check:** Studio→Copilot→Simulation→Escape; Orbit/Top/Robot; collapse/restore inspector/copilot/timeline. At 1440×900, 1280×720 and 390×844, document/body widths must not exceed viewport.
- **Failure check:** entering simulation or closing a panel must not strand the operator, stop API state reconciliation, or hide critical recovery controls permanently.
- **Regression gate:** `browser-smoke.mjs --only=layouts` needs its old approval-dock assertions updated for Review. Physical phone touch/audio is separate from responsive emulation.

### F-14 · Dense stripe-free console design

**State:** IMPLEMENTED / AUTOMATED-DEMO E27 for inspected selected surfaces and six-step Review. Tasks S01–S12; universal keyboard/accessibility coverage is not claimed.

- **Review:** no left-edge border, inset shadow or active pseudo-element may signal selection anywhere. Use full-surface/icon/text contrast. Target dense approximately 11 px sidebar text/25 px rows without cutting labels.
- **Demo check:** select rail/tab/tree/episode/environment items and inspect their real computed styles plus screenshots; review all three layouts. Full rounded button outlines are allowed; left selection markers are not.
- **Failure check:** inspect pseudo-elements and hover/active/focus states, not only the first selected tree row. Ensure density does not make cancel/approve unreachable.
- **Regression gate:** source scan and actual final screenshots; passing a single computed-style assertion does not certify the whole design. S07–S11 cover laptop/phone/six-step/focus behavior.

### F-15 · Session recovery and truthful connectivity

**State:** IMPLEMENTED / AUTOMATED-CHECK + AUTOMATED-DEMO E21; full human recovery demo OPEN.

- **Review:** [API lifecycle tests](../server/api.test.mjs), [voice adapter](../src/integrations/voice.ts). Reset/late join/pending callbacks have ownership and cleanup; status never equates configured credentials with heard audio.
- **Demo check:** denied microphone or unavailable backend gives a useful error and leaves local mode available. Reset an interrupted voice connection, reconnect deliberately, and reconcile any actual task rather than repeating it blindly.
- **Failure check:** concurrent starts, provider rejection, lost callback stream and timeout retain one truthful lifecycle/outcome. No secret or tool token appears in status/export.
- **Regression gate:** server lifecycle checks after connection changes; a bounded real recovery test when transport behavior changes. Do not assume a mocked reset test proves a physical audio recovery.

### F-16 · Readiness and factual metrics

**State:** IMPLEMENTED / view-level final check OPEN.

- **Review:** readiness derives from actual connection/episode/report/campaign evidence and calls its weights internal. No self-awarded perfect score, invented savings or winning estimate.
- **Demo check:** inspect readiness before/after an actual task/report/campaign; pending voice/human gates remain visibly distinct. Action/sample/check counts agree with the selected run.
- **Failure check:** a queued action or selected model cannot earn completed-task/voice credit. A failed episode keeps its original outcome.
- **Regression gate:** compare readiness text to this matrix and the final artifact register after each feature-status update.

### F-17 · Complete workplace journey and handoff

**State:** IMPLEMENTED / AUTOMATED-DEMO E25 continuous provider/action/explicit-save/report/spoken-outcome; fresh-context handoff/consumer E26 and labelled backup E28 verified; human and untested approval/keyboard edges remain OPEN.

- **Review:** one employee/task narrative covers initiate, understand, execute, confirm and follow-up; meaningful tools mutate simulator and persistent local records, not only chat text.
- **Demo check:** choose a supported task, retrieve context, prepare/review or observe the visible simulated-auto approval, execute, verify outcome, replay, explicitly submit, read factual report and verify exported package.
- **Failure check:** demonstrate one refusal or interruption with truthful recovery; provider outage fallback must identify local mode and any unverified mandatory integration.
- **Regression gate:** E25 now records the continuous provider/action/save/spoken-report pass. Fresh-context consumer handoff E26, six-step UI regression E27 and labelled backup E28 now have evidence. HV-01 and remaining untested approval/keyboard edges stay open. Static hosting does not deploy the local API by itself.

### F-18 · Mobile floor navigation and delivery

**State:** IMPLEMENTED / AUTOMATED-CHECK E17 + AUTOMATED-DEMO E13–E14. Tasks T01–T22.

- **Review:** [mobile controller](../src/sim/mobile-navigation.ts), [controller tests](../src/sim/mobile-navigation.test.ts), [UI](../src/components/MobileKitchen.tsx), [renderer](../src/components/MobileKitchenScene.tsx) use a separate map/footprint/stations/cargo/goal state. Bounded A* and clearance test actual paths; reach is checked at handling; a human proxy blocks actual control ticks. No SLAM/contact/hardware claim.
- **Observed controller/browser check:** mobile main 5 groups passed: continuous Cup carry/delivery about 10 m; hold preserved clock/pose/cargo; clearing remained paused until explicit resume; fixed-base/mobile comparison shared one seed/target; furniture detour; unknown object moved nothing; reset stayed explicit; stopped Bowl retained cargo and a fresh two-step plan delivered it to Table.
- **Observed visual/provider check:** focused canvas/cameras/Escape and 1280×720/390×844 overflow checks passed. E14 real prerecorded voice completed 5 skills/10 m/111 states, recorded remote speech and factual Cup/Sink/Bowl/Counter transcript. Human microphone/hearing remains HV-01.
- **Regression gate:** rerun affected route/refusal/reach/cargo/control/export cases after mobile changes. No implicit motion on occupied start or reset; native mobile evidence must preserve its separate schema/clock/cargo meaning. Responsive emulation does not prove physical phone media/touch.

### F-19 · Constrained seeded variation batches

**State:** IMPLEMENTED / AUTOMATED-CHECK + AUTOMATED-DEMO E10 (bounded tested seed/task). Tasks U01–U20.

- **Review:** [generator](../src/sim/data-variations.ts), [tests](../src/sim/data-variations.test.ts), [UI](../src/components/VariationLab.tsx). Freeze parent task/world; seed/count are bounded; exact IDs/goals/protected state survive; case outcomes come from the actual evaluator.
- **Demo check:** generate 100 at seed 42; actual export shows 60 accepted tasks, 40 expected refusals, zero unexpected outcomes and zero provider calls. Load an executed case and compare its initial world. E10 passed this narrow case.
- **Open robustness checks:** validate every generated ordinary scene for finite/nonoverlapping valid geometry; reject active/malformed inputs; detect duplicates before claiming diversity. Repeatability and protected-reference tests exist; they are not arbitrary-scene guarantees.
- **Regression gate:** `variation-smoke.mjs` plus seed/limit/invariance tests after generator changes. Cancellation/progress is TODO rather than a hidden feature. Synthetic count is never counted as real human recordings, training gain or transfer.

### F-20 · Human-demonstration bridge and recipient utility

**State:** research/pilot contract IMPLEMENTED; temporal annotations/recipient utility TODO. Tasks W01–W18.

- **Review:** [HUMAN_DEMONSTRATION_BRIDGE.md](HUMAN_DEMONSTRATION_BRIDGE.md) cites Pronto's official AI-recording terms and primary robotics work. Frame references, inferred tasks, simulated trajectories and measured human/robot actions remain different data types.
- **Current demo check:** permitted reference frame→reviewed supported scene/task→same-scene human/LLM comparison→actual outcome/report/native consumer. Show uncertainty/limitations; do not imply a Pronto or lab connection.
- **Pilot acceptance:** timestamped segments, task graph, source hashes, observed/inferred provenance, reviewer corrections, permissions and one actual recipient loader must be evaluated on a fixed kitchen-task sample.
- **Regression gate:** no compatible-training-data, buyer, model-gain or robot-transfer claim without the separately agreed consumer/training/hardware evidence. Current native parsing proves native parsing only.


### F-21 · Shared analytic pose traces and standalone consumer

**State:** IMPLEMENTED / AUTOMATED-CHECK + observed CLI consumption E16–E17. Tasks Z01–Z09.

- **Review:** [workcell trace](../src/data/robot-trace.ts), [mobile arm](../src/sim/mobile-arm.ts), [mobile evidence](../src/data/mobile-evidence.ts), [standalone consumer](../scripts/consume-evidence.mjs), [consumer tests](../scripts/consume-evidence.test.mjs). Display/export derive coordinates from the shared analytic pose. Base anchor, world frame, additive joint pitch, radians/meters, wrist/TCP offset, gripper state and absolute-versus-relative time must be explicit.
- **Observed consumer check:** actual workbench export produced 70 observations, 67 positive-time pairs, 2 same-clock exclusions and one terminal observation; mobile produced 111/110/0 and one terminal observation. Independent code verified SHA and forward kinematics; 9 consumer tests include tampering and re-signed bad angles.
- **Failure/timing check:** preserve failed/stopped outcomes; do not invent targets for no-positive-time attempts. Paused same-clock control events remain audit observations but do not become finite-duration action pairs. The consumer manifest explicitly keeps `sourceTaskChecksRecomputed: false`.
- **Regression gate:** rerun native trace/consumer tests and consume one newly exported artifact after pose/schema/clock changes. This is portable native state analysis, not encoder telemetry, applied motor commands, contact validation, an external training loader or learning evidence. Follow [GOAL_VALIDATION.md](GOAL_VALIDATION.md).

### F-22 · Actual mobile AI predeployment plan evaluation

**State:** IMPLEMENTED / AUTOMATED-CHECK E17 + AUTOMATED-DEMO E15. Tasks AA01–AA15.

- **Review:** [candidate evaluator](../src/sim/mobile-candidates.ts), [17 candidate tests](../src/sim/mobile-candidates.test.ts), [five cases](../src/sim/mobile-evaluation-cases.ts), [model service](../server/mobile-planner.mjs), [server execution](../server/simulation.mjs), [bench](../src/components/MobilePlannerBench.tsx), [browser check](../scripts/mobile-planner-smoke.mjs). Freeze scene and independent Cup→Sink goal. Human/authored/model candidates submit exact ordered primitives; reject malformed or extra fields; never insert missing navigation/placement or repair a model's wrong goal.
- **Observed UI check:** human reach-before-navigation fails at 0 m; wrong Table destination finishes its controller sequence but fails the independent Sink task; correct recipe passes; replay changes actual canvas/time. Five actual baseline cases produce 2 accepted tasks plus reach/no-route/human-blocked outcomes. Exactly one actual gpt-4o-mini request produced 5 skills and accepted task at measured 2797.58 ms.
- **Observed report check:** downloadable native report/derived CSV retain 9 attempts, 4 accepted tasks, 5 controller completions, 1 completed wrong-goal and 4 failed/refused/blocked. Request failures remain separate. Model/source metadata are declared provenance; server execution is not cryptographic provider attribution. No model ranking follows from this one request.
- **Failure/history check:** actual outcome/category/step/action/message and ~10 Hz native replay remain distinct. Mobile evaluator observes every native tick: picking and returning an unrequested Bowl still fails protected-object acceptance even when final state equals initial. No fake errors are added when a candidate genuinely passes.
- **Regression gate:** rerun malformed/order/wrong-goal/protected-history/route/human cases and bench replay/report tests after changes; use local cases for UI changes to avoid paid loops. Static-arm equivalent protection now has passing evaluator/native/server regressions in E11, including exact final restoration and a legitimate human interruption. E22 supplies the actual mobile UI attribution check. This is high-level symbolic skill evaluation, not VLA/motor-policy training or physical transfer.


### F-23 · Explicit mobile evidence review, persistence and saved replay

**State:** IMPLEMENTED / AUTOMATED-DEMO E18. Tasks AB01–AB07.

- **Review:** [mobile UI](../src/components/MobileKitchen.tsx), [frozen review](../src/components/MobileEvidenceReview.tsx), [library](../src/components/MobileRecordLibrary.tsx), [store](../server/mobile-store.mjs). Motion completion opens Review; persistence requires its own explicit approval and cannot inherit the motion countdown.
- **Observed check:** real API saves completed/accepted and stopped/held-Cup/not-accepted attempts. Frozen source hash survives an injected unavailable service, local export and retry. Header/tabs/commands lock during critical review; approval/cancel are visible and hit-tested at 1280×720.
- **Replay/failure check:** actual GET and SHA verification reopen a fresh-browser record; slider changes rendered states/time; returning preserves live world. A corrupted digest is rejected. No automatic write occurs after the three-second waits.
- **Regression gate:** [mobile-store smoke](../scripts/mobile-store-smoke.mjs); report acceptance checks recorded simulator states, not origin authenticity, full physical motion or human identity. The actual continuous voice/save/spoken-report rehearsal now passes E25; the exact saved-record handoff/consumer E26 and labelled automated backup E28 are also verified; human acceptance remains separate.

### F-24 · Exact submitted-reference fingerprint

**State:** IMPLEMENTED / AUTOMATED-DEMO E19, prior real vision E06. Tasks AC01–AC05.

- **Review:** [fingerprint helper](../src/data/reference-fingerprint.ts), [composer](../src/components/AiSceneComposer.tsx). Hash exact submitted resized JPEG bytes; distinguish image/selected-video-frame, retain finite selected time, and persist no image or filename. Calibration/rights verification stay false.
- **Observed check:** actual UI resizing/hash→scene approval→controller recording→sealed export preserves exact reference metadata for photo and video frame at 0.4 s. Two generation responses are fixtures, not paid vision evidence.
- **Failure check:** new upload clears old draft immediately; reference changed during asynchronous hashing sends no stale request; oversized source is rejected at 50 MiB. Generated canvas remains within its comparison cell.
- **Regression gate:** [reference smoke](../scripts/reference-provenance-smoke.mjs) and helper tests. Original-media identity, calibrated reconstruction, temporal human motion, rights clearance and recipient utility remain unproved.

### F-25 · Correlated scene derivation and consumer grouping

**State:** IMPLEMENTED / AUTOMATED-DEMO E20 + AUTOMATED-CHECK E11. Tasks AD01–AD06.

- **Review:** [scene lineage](../src/data/scene-lineage.ts), [variations](../src/components/VariationLab.tsx), [native validator](../src/data/evidence.ts), [consumer](../scripts/consume-evidence.mjs). Canonical parent task/scene SHA, actual seed/index/kind and identityVerified:false survive loading a child and recording/export. Controller timing excludes asynchronous lineage hashing.
- **Observed check:** two different child layouts share one declared parent group, retain distinct computed child hashes, and pass native/consumer validation. Parent hashing is deterministic under key reordering and does not mutate input or discard reference metadata.
- **Failure check:** invalid identity claims or changing derivation are rejected, even for re-signed content. Consumer reports groupingSource and upstreamLineageVerified:false; it does not authenticate source history or perform a train/test split.
- **Regression gate:** [lineage smoke](../scripts/lineage-smoke.mjs), helper/native/consumer tests. A declared group is a curation hint; it does not guarantee independence or leakage-free evaluation.

### F-26 · Visible mobile voice recovery

**State:** IMPLEMENTED / AUTOMATED-DEMO E21. Tasks AE01–AE05.

- **Review:** [App voice operation ownership](../src/App.tsx), [mobile controls](../src/components/MobileKitchen.tsx). Errors remain visible in the mobile workspace; Reset reuses the existing generation/cleanup path, pending Connect disables duplicates, and disconnect failures are caught.
- **Observed check:** one SDK microphone request under rapid clicks; denied permission and unavailable service produce useful errors before provider start. One deliberate reset failure retains recovery, then one actual empty reset clears state. Workcell/mobile state agrees; no hidden connection modal is left behind.
- **Regression gate:** [recovery smoke](../scripts/mobile-voice-recovery-smoke.mjs). Error controls are checked at 1280 and 390 widths; zero provider starts occur. Physical microphone capture, audible speech and live transport recovery remain separate HV-01 acceptance.

## Human and final release fields

| Field | Status | Required observed evidence |
| --- | --- | --- |
| **HV-01 physical microphone and human-heard response** | **OPEN** | A person speaks into the actual laptop microphone, hears real Agora/Murf speech, observes a supported current-policy task and hears its factual result. Record date/environment/outcome; retain both human flags false until performed |
| **RG-01 logic/build snapshot** | **AUTOMATED-CHECK E11–E12** | 282 tests and production build pass on the recorded integrated revision. Build also passed after the six-step UI fix; re-run affected checks after further changes |
| **RG-02 changed feature demos** | **AUTOMATED-DEMO E27 (scoped)** | Named selected surfaces, six-step Review/footer and 390-width no-overflow checks pass; UI-01 closed. Full keyboard/accessibility and untested Q19/R07 approval edges remain open |
| **RG-03 continuous voice/workplace workflow** | **AUTOMATED-DEMO E25** | One actual prerecorded provider session completed five steps/three checks, explicit 201 save, independently accepted report in live context and transcribed factual spoken delivery/save outcome. Exact saved-record fresh-browser replay/reexport/consumer also passes E26; labelled backup E28 exists. Human flags remain false |
| **RG-04 backup and stage material** | **AUTOMATED-DEMO E28 (backup)** | Supported script/screenshots and actual 75.72 s automated backup exist. Prerecorded input plus real remote audio; approximate A/V alignment. This does not close a live human stage rehearsal or HV-01 |

Production tenancy, durable distributed jobs, dynamics/low-level learned policy, recipient training formats and real-robot validation are future gates in the backlog. None closes merely because the console is visually convincing or many implementation tasks exist.
