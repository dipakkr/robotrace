# Does RoboTrace address a useful physical-AI problem?

Audit date: **21 November 2026**. This assessment combines inspection of the current source with primary-source research. Product demand, savings and downstream learning benefit remain hypotheses. It does not claim a frontier-lab partnership, a training improvement or physical transfer.

## Decision

**Go for the hackathon as a voice-assisted task validation and evidence workflow. No-go for claiming that today's output is validated robot-training data.**

The current application performs real software work: it prepares bounded tasks, executes a controller, distinguishes completed motion from an accepted task, records attempts and failures, and exposes results for review. The mobile kitchen now adds actual known-map base navigation before collection and delivery. It does not just animate a stationary arm in a different room.

The same mobile attempt now completes the follow-up: explicit frozen-evidence review, durable local API save, independently recomputed recorded-state service report, library reopening and replay. Five browser checks passed, including two real HTTP 201 saves—one completed/accepted and one stopped/not accepted. No tabletop workflow switch is needed to demonstrate mobile follow-up. [Observed browser evidence](../.local/qa/mobile-store-smoke-results.json)

That still leaves a substantial gap between useful simulation evidence and data that improves a robot policy. Adding a large download button, joint-angle columns or a familiar dataset extension cannot close it. The necessary evidence is a downstream consumer, an explicit observation/action interface, and a learning/evaluation experiment appropriate to the intended claim.

The best near-term pitch is:

> Robotics QA operators need to reproduce what a task meant, why a plan failed, and whether a claimed delivery actually happened. RoboTrace turns a spoken task into a bounded, inspectable simulation attempt, checks the outcome, and hands another engineer the exact scene, plan, trace and failure evidence.

The initial customer hypothesis is a **small robotics application or demonstration-operations team testing task-level decisions for mobile counter-to-station delivery**. The user is its collector, integration engineer or QA technician. A frontier lab is a possible later recipient; it is too broad to be the assumed first paying customer.

## What the implementation actually proves

| Implemented mechanism | Defensible observation | Limit |
| --- | --- | --- |
| Reviewed task and environment definitions | An operator can inspect object identity, requested destination and protected objects before a run | A reviewed interpretation of an image is not a reconstructed household or measured human demonstration |
| Task-plan comparison | Supported human, model and bounded baseline plans can be checked against the same frozen tabletop task | This tests task-level assignments, rather than a VLA's perception or low-level control |
| Mobile predeployment checks | Declared human, model and baseline navigation/handling sequences can execute against a frozen Cup→Sink goal, including wrong order, wrong destination, reach/route refusal and obstruction cases | A correct high-level plan in the declared known-map simulator is one software gate, not physical deployment approval |
| Stationary reach versus mobile delivery | A distant object can fail the fixed-base reach condition while a mobile plan navigates, rechecks reach, collects and delivers in the declared map | Mobility helping reach is expected; this is a useful counterfactual and integration test, not a robotics research discovery |
| Mobile floor navigation | The base follows a bounded known map and continuously carries attached cargo | There is no SLAM, localization uncertainty or sensor-based navigation |
| Analytic arm trace | The exported coordinates use the same analytic pose as the displayed arm, with explicit units and reach flags | These are derived kinematic coordinates; they are not measured encoders, commanded motor actions, continuous collision-free trajectories or contact physics |
| Human obstruction scenario | The software controller can pause and preserve state, require clearance and wait for explicit resume | A person proxy and software interlock do not prove real human detection or certified safety |
| Outcome and evidence checks | Native validation can reject inconsistent placement metadata, disturbed references and invented completion | Native consistency does not prove physical validity, external dataset compatibility or learner usefulness |
| Voice-to-tool operation | Spoken requests can retrieve local procedures, prepare a task and communicate actual returned evidence | Live provider success needs its own tested session; prompt/config tests alone do not prove RTC, recognition or speech quality |

Source contracts inspected: [mobile navigation](../src/sim/mobile-navigation.ts), [mobile arm solver](../src/sim/mobile-arm.ts), [mobile evidence](../src/data/mobile-evidence.ts), [native evidence](../src/data/evidence.ts), [candidate evaluation](../src/sim/candidate-plans.ts), and [task procedures](../server/task-guides.mjs). A source-level capability is distinct from successful release/browser/provider evidence.

The mobile evidence schema already labels its source as a simulated controller and explicitly sets `humanRecording`, `measuredMotorTelemetry`, `learnedPolicy`, `physicalTransferValidated` and `trainingAdapterValidated` to false. Preserve those truthful fields in the pitch and any future conversion.

## The missing learning contract

| Missing or insufficient part | Why it matters | Minimum proof before a stronger claim |
| --- | --- | --- |
| Defined action interface | Current plans are high-level operations; exported arm angles are derived poses. A learner needs to know exactly what its output controls | Specify one executable action space, bounds, frame, units, control mode and duration; log the actual input applied to each step |
| Pre-action observations | A saved full world includes privileged simulator facts and may include current plan/mission data. Feeding these indiscriminately can leak the solution | Define the permitted observation before action; exclude oracle routes, teacher actions, future state and success labels from model inputs |
| Fixed control timing | Mobile recording is approximately 10 Hz plus control and terminal events. Duplicate simulation timestamps around paused controls are meaningful audit events | A separate learning adapter needs an explicit timing contract, missing-frame policy and tested alignment. Do not silently treat every event as a fixed-duration action |
| Camera observations | A decorative room and a canvas screenshot are not a synchronized egocentric or robot camera stream | For a visual policy, record each required RGB/depth view with camera parameters and timestamps. State-only experiments can proceed without images if described as state-only |
| Robot embodiment | The arm is analytic and generic; the planner reach envelope differs from the rendered two-link span | Specify joint order, limits, tool transform and applicable robot/control model. Do not imply calibration to a commercial robot |
| Dynamics and contacts | Idealized attachment and interpolated station handling bypass friction, force, grasp stability and contact failure | A manipulation-learning claim needs a declared physics/robot backend and checks appropriate to that task |
| Collision coverage | Known-map base clearance is not full arm swept-volume, self-collision or hand/object collision checking | Validate the relevant swept bodies and joint constraints in the target backend before using collision/physical-safety claims |
| External consumer | A native export has its own validator but no demonstrated target training-library importer | Pin one recipient/library version, load the written dataset with that real consumer, and verify features, ordering and units |
| Learned baseline | A deterministic successful controller does not show a model learned from the collected data | Train a specified baseline and execute its own outputs in closed loop, including failures and timeouts |
| Held-out evaluation | Nearby frames or nearly identical seeds can inflate an apparent result | Freeze unseen scene/layout/task splits before training; report exact counts, distributions, failures and compute budget |
| Economic validation | A working flow does not establish saved employee time or willingness to pay | Run a controlled manual-versus-assisted collection/review trial and a real recipient handoff |

LeRobot documents episode-aware feature records and writer/reader operations. That makes it a concrete consumer candidate, rather than evidence that our current files are already compatible. [LeRobot dataset API](https://huggingface.co/docs/lerobot/en/api/datasets)

MimicGen's relevance is the complete chain: seed demonstrations, generated variations, executed trajectories and policies evaluated from generated data. RoboTrace has not reproduced that learning experiment. [MimicGen project](https://mimicgen.github.io/)

Physical Intelligence's human-to-robot work uses a pretrained VLA, relevant robot data and human demonstrations represented with tracked 3D hand positions. It does not establish that an arbitrary phone frame plus a synthetic arm trace supplies the same supervision. [PI human-to-robot research](https://www.pi.website/research/human_to_robot)

## Should we build a learner immediately?

**Do not make a rushed learner the hackathon's main evidence.** A model trained on generated routes could mostly imitate the deterministic solver that already performs this task reliably. If the model consumes the saved oracle path or is silently corrected by the existing planner at inference, the demonstration would not even establish independent learned execution.

A bounded learner can be educational and technically honest if its question is narrow: “Can a state-only model imitate this simulator controller on these unseen layouts?” It would demonstrate a simulator learning interface, not a frontier robot capability. Success is neither guaranteed nor inherently more useful than the existing solver.

Only attempt it after the mandatory voice workflow and evidence handoff are stable, and only if the following are available together:

1. A versioned `reset(seed)`, `observe()` and `step(action)` interface that actually applies the model's outputs.
2. A defined state-only observation and action space, with the teacher solution excluded from observations.
3. A real imported training dataset, a saved checkpoint, and a reproducible train command.
4. A frozen held-out layout set and closed-loop evaluation independent of the teacher.
5. Explicit refusal to turn a negative result into a positive claim by filtering failed rollouts.

If the experiment is navigation-only, call it learned navigation in this known-map simulator. If it is discrete next-skill prediction, call it task-level skill selection. Neither label should become “trained robot manipulation” merely because an arm appears in the viewport. Even a positive in-simulator result provides no physical transfer evidence.

For a later manipulation pilot, one validated small physics-backed task is more informative than expanding the current analytic trace into thousands of nominal motor-training episodes. The right scope is one task, one embodiment, one action contract and one consumer.

## Minimum credible bridge to downstream learning

Use three separate outputs and receipts:

1. **Native evaluation case, available now:** reviewed task, exact initial scene, candidate plan, observed controller trace, actual checks, failed/refused attempts and provenance. Another engineer can load or independently inspect this case. Do not call internal native loading a LeRobot integration.
2. **Consumer-ready trajectory, a separate implementation gate:** a pinned real loader accepts the specified observation/action schema, reloads timestamps and features correctly, and supplies one batch to the selected learner. A state-only contract is acceptable for a state-only experiment; camera channels must be added before a visual-policy claim.
3. **Learning evidence, a separate experiment:** train the baseline and evaluate its own actions on frozen held-out scenes. Compare the base recipe with and without the added/expanded data. Report successful episodes, refusals, errors, collisions where measurable and timeouts, with all denominators.

Only output 3 answers whether a data contribution helped that learner in that simulator. It still does not prove physical deployment readiness or that a frontier lab wants the data.

Avoid a circular test: success labels must be frozen task predicates, not the teacher's declaration that its own route is good. An identical deterministic solver can establish reproducibility, but cannot be the sole evidence of model generalization.

## Can more samples be generated without new recordings?

Yes, **more simulated task cases** can be generated from one permitted reviewed seed. Vary layouts, object starting stations, protected items, destinations, known obstacles, reach limits and interruption timing within actual controller capabilities. Execute each variation and retain failures with exact reasons. Record the seed, generation rule and link to the source task. Repeated runs of one scene are repeats, rather than new task diversity.

The resulting samples are not new measured human behavior. The current planner's regenerated paths are also not a general demonstration-retargeting implementation. To make training-data augmentation claims, first satisfy the consumer/learning gates above.

Task coverage should count meaningful changes: an initially out-of-reach pickup, an unreachable dock, a blocked route, an interrupted carry, a protected object and a different destination goal. Room color, camera orbit and identical tasks under fresh UUIDs do not add comparable decision coverage.

## Market and novelty reality

micro1's flow already describes expert task definition, model-assisted generation, review, quality checks, and robotics workflows involving video and 3D evidence. A broad “human activity to robotics data platform” is therefore not a defensible novelty claim. [micro1 flow, 22 September 2026](https://www.micro1.ai/blog/introducing-flow)

The narrower differentiation to test is **a laptop-first, voice-assisted executable task case that keeps the requested goal, actual movement, reference preservation, interruption and evidence receipt aligned**. Its value could be faster reproduction and review of task-level failures. This is a product hypothesis, not a verified competitive moat.

Pronto-style household capture may supply an interesting future reference source, but RoboTrace has no established access, buyer relationship or measured training result from it. The current customer experiment should use owner-controlled examples and a willing robotics reviewer. The fuller source and licensing assessment is in [the data strategy](DATA_FLYWHEEL_STRATEGY.md) and [human-demonstration bridge](HUMAN_DEMONSTRATION_BRIDGE.md).

## What to measure using the same baselines

Freeze a small case suite before running comparisons. Record the exact hardware, app revision, cases and provider/model revision. A suggested initial suite is 12–20 cases if they can be reviewed properly; this is an experiment design target, not an existing result or statistical guarantee.

| Question | Baseline and assisted condition | Measurement |
| --- | --- | --- |
| Is the operational workflow easier? | Same operators and comparable tasks using existing manual UI versus voice-assisted task/review flow; counterbalance order | Wall-clock time to a correct, reviewed case; corrections, clarification turns, retries and rejected packages |
| Are decisions correct? | Human plan, bounded deterministic baseline and explicitly requested model on the exact same frozen world | Schema-valid plans; task acceptance; protected-object violations; expected refusals; unexpected failures. Keep controller completion separate |
| Does mobility resolve this modeled reach problem? | Fixed base versus mobile on the same object goal and starting scene | Initial reach result, actual base distance, simulated duration, verified delivery, refusal reason. Do not compare different goal difficulty |
| Does the recorder help another engineer? | A narrative/screenshot handoff versus the same case with native evidence | Load/verify success, time to identify the actual failed predicate, and whether another engineer reproduces the outcome |
| Is the voice outcome truthful? | Spoken summaries compared with actual current receipts | Unsupported completion claims divided by tested completion statements; correct ambiguous-command clarification; correct manual/automatic approval handling |
| Does expansion add useful coverage? | Fixed seed task versus reviewed generated variations | Unique constraint combinations, valid/refused counts, duplicate rate and coverage gaps; never count only successful cases |

Report raw counts alongside ratios. Distinguish wall-clock provider latency from simulated execution time. Expected safe refusals belong in a separate category from successful delivery and unexpected failure. A generated run is not automatically an accepted episode; reviewer agreement is not automatically a correct physical model.

No savings percentage, frontier-model benefit or hackathon winning probability should be asserted before its corresponding measurement exists.

## Go/no-go gates

| Claim | Go only when | Current decision |
| --- | --- | --- |
| Working workplace voice demo | Live Agora + Murf run retrieves current SOP, prepares an actual action, follows the implemented approval mode, executes and communicates a verified receipt or explicit uncertainty | Final real-provider prerecorded-input delivery/review/save/spoken-report session passed five checks; exact record passed fresh-browser replay/export and independent consumer. Exceptions have separate controller/browser evidence. Physical human microphone/hearing remains open |
| Useful native QA evidence | Another consumer loads the exact initial/final scene and actual checks, reproduces a supported attempt, and cannot silently convert failure to success | Mobile review/save/report/reopen/replay and standalone state-analysis consumption have actual browser/consumer evidence; this is recorded-state/kinematic validation, not authenticated execution |
| Consumer-readable state analysis | Independent code verifies the supported seal/frame conventions and emits documented observed-state pairs | Implemented for native workcell/mobile exports; next-state targets are not motor commands or training-framework compatibility |
| Recipient-compatible dataset | A named version-pinned external importer loads the declared schema and modalities; units, frames and action semantics are checked | No-go until separately implemented and tested |
| Training-ready for a specified recipe | Data provides the required executable actions and pre-action observations; timing, quality, license and splits are validated; a real training batch runs | No-go for the current native motor traces as a general robot-training dataset |
| Demonstrated simulated learning benefit | Learned closed-loop evaluation on held-out cases beats the declared comparison under the same setup; failure counts and compute are reported | No-go without the experiment |
| Physical transfer | Calibrated embodiment and sensors, applicable dynamics/collision validation, real hardware evaluation under an appropriate test procedure, and observed transfer results | No-go; laptop simulation alone cannot establish this |
| Validated commercial impact | A target team confirms the need and completes a controlled handoff/operations trial with measurable benefit | Unvalidated customer hypothesis |

## Small implementation and validation tasks

This staged backlog predates the latest implementation. Several native workflow, consumer and failure-evidence tasks now have the proof recorded above; the list is not a claim that all remain undone. Training, recipient-validation and physical-transfer items remain separate proposed work. Use the current gate/evidence sections to distinguish implemented capabilities from pending live-human and downstream experiments.

### Protect the hackathon claim

- G01: Freeze one sentence naming the employee and the failure-reproduction problem.
- G02: Add the exact fidelity/source label to the mobile export walkthrough.
- G03: Record one live initial Cup→Sink voice task and its actual receipt.
- G04: Record one obstruction, clearance and explicit-resume sequence.
- G05: Record one unsupported or ambiguous request that causes clarification without motion.
- G06: Inspect the spoken final summary against actual object/destination fields.
- G07: Load one exported native case in a separate consumer session.
- G08: Retain one failed/refused export alongside its successful comparison.
- G09: Write the demonstrated limits on the pitch's final slide.

### Prove operational usefulness

- G10: Define the manual baseline without hiding setup time.
- G11: Freeze the reviewable case suite and expected checks.
- G12: Add wall-clock task/review timing separate from simulation time.
- G13: Count corrections, retries and clarification turns explicitly.
- G14: Separate expected refusals from unexpected errors in reports.
- G15: Run a counterbalanced manual-versus-assisted pilot.
- G16: Ask a robotics engineer to reproduce one case from the export.
- G17: Record whether the recipient needed missing fields or a different representation.
- G18: Publish exact observed counts; keep unmeasured benefits as hypotheses.

### Establish one learning interface

- G19: Choose one state-only or visual learning target and name it precisely.
- G20: Specify the actual input observation before each action.
- G21: Remove teacher paths, plan steps and future-state labels from learner observations.
- G22: Specify an executable action vector and its control interval.
- G23: Record actual applied actions rather than relabeling analytic poses.
- G24: Version frame conventions, joint order, units, bounds and termination semantics.
- G25: Separate asynchronous audit events from fixed-cadence learning steps.
- G26: Implement the required synchronized cameras only if the chosen learner uses them.
- G27: Pin one external dataset writer/loader version.
- G28: Write and finalize one episode; reload it through that consumer.
- G29: Assert imported feature shapes, action meanings and timestamps.
- G30: Freeze scene-level train/validation/test splits before tuning.
- G31: Train a small baseline and save its recipe/checkpoint.
- G32: Execute the learner in closed loop without teacher correction.
- G33: Compare the same recipe with and without added variations.
- G34: Export all held-out outcomes and the compute budget, including failures.
- G35: Stop at a negative result if it adds no value; do not market distillation as transfer.

### Gate physical claims separately

- G36: Select and calibrate a specific robot/backend before extending manipulation claims.
- G37: Validate joint limits and swept arm/object collisions for its supported task.
- G38: Validate contacts/grasps and sensor conventions where the experiment needs them.
- G39: Agree a recipient's real-robot test and acceptance criteria before claiming transfer.
- G40: Require observed hardware evidence before changing `physicalTransferValidated`.

## Evidence review

The recommendation deliberately leaves the product with a useful near-term output even if no learner is trained: another engineer receives a reproducible task and a truthful reason for success, refusal or failure. The longer-term learning bridge remains explicit work with testable gates. Neither a competitor's published results nor a plausible 3D performance substitutes for those gates.

Primary pages rechecked during this audit: LeRobot dataset API, MimicGen project, PI human-to-robot research, and micro1 flow. Additional company/data-rights context is documented with source URLs in the linked research files. No accounts were created, providers contacted, datasets uploaded or training jobs launched for this audit.

## Implementation updates after the initial audit

The mobile symbolic-planning harness is now implemented in [MobilePlannerBench.tsx](../src/components/MobilePlannerBench.tsx), [candidate execution](../src/sim/mobile-candidates.ts), [five bounded cases](../src/sim/mobile-evaluation-cases.ts), and [the model request service](../server/mobile-planner.mjs). It must retain actual model proposals and independently computed execution outcomes. Deliberately wrong operator candidates must be labelled as such. The baseline suite expects two completed tasks and three refusal/block cases; those expectations do not constitute a score awarded before execution.

An independent native evidence consumer now exists in [consume-evidence.mjs](../scripts/consume-evidence.mjs). It checks supported sealed evidence, frame/kinematic consistency and state observations, and emits a state-analysis manifest with next-observed-state pairs. That is a concrete native handoff, distinct from the still-missing target training-library importer and executable action contract. The consumer explicitly reports that source task checks are not independently recomputed there and that the targets are not requested motor commands.

During read-only audit, a reference-history loophole was reproduced using actual controller motion: an unrequested object could be picked up and put back into its identical final state. Final equality alone incorrectly treated that as untouched. The static evaluator, native evidence and server recomputation now use recorded reference history; the mobile evaluator tracks every controller tick separately. Acceptance must preserve that distinction even when a legitimate human hold makes command-only replay incomplete. These checks reason about supplied simulator states, rather than authenticating a recording or proving physical safety.

The final real-provider mobile test uses prerecorded speech and exercises Agora/Murf/tool/action delivery, explicit mobile review/save and actual received/transcribed confirmation of the saved report. A fresh browser reopened that exact record; its identical export passed standalone SHA/FK consumption. [Final voice evidence](../.local/qa/final-workflow/results.json), [exact-record handoff](../.local/qa/final-workflow/handoff-results.json). Human microphone and audible playback verification remain separate live checks. [MENTOR_CHECKIN.md](MENTOR_CHECKIN.md) keeps the complete follow-up in the mobile workflow and preserves this evidence boundary.

The actual model-planner browser check made one `gpt-4o-mini` request, measured 2,797.58 ms and evaluated the returned five actions without repair. That task passed. The same UI retained deliberate operator wrong-order and wrong-destination failures, and a five-case baseline suite produced two accepted tasks and three refusal/block outcomes. A protected Bowl round trip completed its sequence but failed the untouched-object rule at the actual pickup, step 8, despite identical final Bowl state. These are concrete software test cases, not evidence of policy training or a statistically supported model ranking. [Live planner evidence](../.local/qa/mobile-planner-live-results.json), [protected history evidence](../.local/qa/protected-mobile-results.json)

Navigation and delivery are also distinct: Go Home may retain initially held cargo, with zero placements, provided recorded custody remains intact. Unloading/reloading cannot erase that custody violation; raw pickup/place at Home is refused. This guards truthful outcomes for supported navigation commands, without implying physical grasp validity.

Two actual recorded variation children now carry one declared parent-scene fingerprint while the independent consumer computes distinct child hashes. The manifest preserves `identityVerified:false`, `upstreamLineageVerified:false` and `splitPerformed:false`. This supports grouping correlated cases; it does not authenticate source history, prove independent data coverage or guarantee a leakage-free split. [Lineage evidence](../.local/qa/lineage-smoke-results.json)

The verified prior-winner comparison and public event requirements are in [HACKATHON_POSITIONING.md](HACKATHON_POSITIONING.md). They inform presentation choices, not winning odds, unpublished rubric weights or a claim that this entry already helps train a frontier robot model.
