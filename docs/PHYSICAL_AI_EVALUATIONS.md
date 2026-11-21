# Physical-AI evaluation: what RoboTrace measures

Updated **21 November 2026**. This document describes the implemented evaluation contracts, the evidence collected so far, and the gates required for stronger claims. Research references and downstream data-format background are in [PHYSICAL_AI_RESEARCH.md](PHYSICAL_AI_RESEARCH.md).

RoboTrace helps a robotics operator turn a work instruction into a reproducible simulated attempt, inspect a decision that failed, and hand a reviewed record to another engineer. Its current physical-AI contribution is **task specification, decision evaluation, interruption testing, and reviewable evidence**. A visible arm makes the consequences inspectable. Motion on screen alone does not establish useful robot-training data.

The primary demo is now a complete **mobile-kitchen workflow**: voice request, retrieved local SOP, actual simulated navigation/handling, truthful outcome, explicit recorded-evidence review, durable local service report, and saved replay. The separate tabletop environments remain supported; their assignment/action schema differs from the mobile schema described next.

## Three different questions, three different evaluations

| Evaluation | Question | What runs | What a passing result means |
| --- | --- | --- | --- |
| Controller regression | Does the existing planner/controller behave as expected on supported fixtures and explicit failure cases? | Fixed seeded cases through the shared kinematic controller | This case matched its specified expected outcome |
| Human / AI plan comparison | Does a proposed assignment plan satisfy this frozen task? | Human-authored, bounded-baseline, or explicitly requested LLM steps through the same evaluator/controller | The candidate was valid, its execution completed, and every required task check passed |
| Mobile predeployment planning | Does this declared navigation/handling order satisfy the frozen mobile goal without disturbing other objects? | Server execution of exact human/baseline/model candidate skills on the known map | A bounded software task passed; physical deployment, perception and motor-policy performance remain unvalidated |
| Human-presence scenario | Does the software interruption rule hold motion and require explicit recovery? | An operator-controlled presence proxy and the controller's hold/resume logic | The tested software rule behaved as specified |

These results must stay separate. A correctly rejected unreachable request passes a regression case while completing zero task actions. A valid plan can finish every proposed movement and still fail the task. A working interruption rule is not evidence of physical human-robot safety.

## Mobile plan evaluation and complete follow-up

The mobile harness freezes the supplied scene and an independent goal, normally **Cup → Sink with Bowl untouched**. Candidates declare 1–12 exact skills. Navigation omits `objectId`; handling requires it:

```json
{
  "actions": [
    { "skill": "navigate", "station": "counter" },
    { "skill": "reach-check", "station": "counter", "objectId": "cup" },
    { "skill": "pickup", "station": "counter", "objectId": "cup" },
    { "skill": "navigate", "station": "sink" },
    { "skill": "place", "station": "sink", "objectId": "cup" }
  ]
}
```

Exact schema and scene-reference validation run before execution. The local server supplies collision-checked floor paths only for declared navigation actions; it does not insert missing navigation, reorder skills or fix destinations. The controller then executes that order with geometric reach/docking guards, idealized handoffs and a bounded tick/sample budget. The frozen task, rather than the candidate’s last destination or verbal self-score, decides acceptance.

The live browser evidence contains nine actual evaluation requests and one real `gpt-4o-mini` generation request. That model returned five actions, measured 2,797.58 ms request duration, and passed its exercised task. This is one observed case, not a model ranking, control frequency or promised response time. Deliberate operator candidates separately demonstrated failure before navigation and controller completion at a wrong destination with task rejection. Provider request failures are retained separately from controller execution outcomes. [Actual UI/API evidence](../.local/qa/mobile-planner-live-results.json)

The five-case baseline suite produced two accepted tasks and three distinct failures: reach at the dock, no route through blocked furniture, and explicit human obstruction. Expected refusals are useful regression results, not completed deliveries. The protected-object case goes further: a ten-action sequence completed and restored Bowl’s exact final record, but the untouched-object check rejected its actual pickup at step 8. The evaluator tracks complete protected-object state across native ticks, rather than checking only final equality. [Protected-history browser evidence](../.local/qa/protected-mobile-results.json)

Inspect [mobile-candidates.ts](../src/sim/mobile-candidates.ts), [mobile-evaluation-cases.ts](../src/sim/mobile-evaluation-cases.ts), [MobilePlannerBench.tsx](../src/components/MobilePlannerBench.tsx), [mobile-planner.mjs](../server/mobile-planner.mjs), and the mobile adapter in [simulation.mjs](../server/simulation.mjs). The evaluator’s source/model labels are caller-declared metadata; local outcome computation is not cryptographic proof of provider attribution.

### Navigation is not delivery

**Go Home** requests navigation. It can finish with an initially carried Cup still held, and must not announce an object release or count a placement. Home is a robot parking station; raw pickup/place primitives there are refused, and it cannot pass as a delivery surface through station metadata alone.

For a saved navigation-only attempt, an initially held object is exempt from fixed world-position preservation because it travels with the base. A separate recorded custody check requires its identity, carried state, carrier alignment and held-object ID to remain intact without unloading/reloading. Restoring final custody does not erase an intervening violation. Other unrequested objects remain protected. These are declared software rules, not measured grasp stability.

### Explicit review, durable report and replay

The main mobile attempt opens a frozen **Review & save mobile evidence** record. Only **Approve & save mobile evidence** posts the reviewed envelope; ordinary motion auto-approval never saves it. The local store independently verifies the SHA-256 payload seal, bounded recorded worlds, analytic arm coordinates, original-command goal, chronology/endpoints, final geometry and recorded protected-object/custody history. Posted receipts and success booleans do not establish acceptance.

Its report basis is `independentlyrecomputed-recorded-simulator-state`, with `motionReplayed:false` and `identityVerified:false`. This must not be described as server execution of the uploaded trajectory or authenticated human activity. Failed/stopped attempts persist as nonaccepted reports. Same-envelope retries return the original local record; this is not a distributed storage guarantee.

Five browser checks passed, including **two real HTTP 201 saves**: completed/accepted and stopped/not accepted. They also verified an unavailable-save retry preserving the exact reviewed seal, API reopening, actual canvas replay without changing the live scene, persistence in a fresh browser context, and rejection of a corrupt digest. [Mobile store evidence](../.local/qa/mobile-store-smoke-results.json)

The main evidence envelope and candidate-harness report have different schemas. The current standalone consumer accepts supported native main recordings; it does not treat a harness report as a mobile evidence envelope. See [mobile-store.mjs](../server/mobile-store.mjs) and [mobile-records.ts](../src/data/mobile-records.ts).

## Tabletop contract: scene, assignment, candidate, observation

A comparison freezes a cloned initial world. That snapshot contains exact object IDs and labels, object dimensions and poses, destination labels, controller state, and any custom task or human-presence scenario metadata. Candidates do not share a mutable world with one another or with the live workcell.

The task is fixed before comparing candidates. Built-in assignments are:

| Environment | Work instruction | Goal |
| --- | --- | --- |
| Repair workbench | `Prepare repair kit` | Red and green parts in the repair kit; blue part in spares |
| Kitchen counter | `Clear the counter` | Utensil case and cup in serving; bowl in storage; counter cleared |
| Sample preparation lab | `Route the samples` | Alpha in Rack A; beta in Rack B; reference sample unchanged |

Custom scenes carry explicit assignments. Every initial object needs a destination or an `unchanged` reference goal. An incomplete goal definition cannot silently turn a partial plan into task success. A reviewer approves the draft before it replaces the scene. Prompt edits in the planner comparison do not rewrite those frozen acceptance rules.

A candidate is a bounded list of exact assignments:

```json
[
  { "objectId": "part-red", "destination": "tray-a" },
  { "objectId": "part-blue", "destination": "tray-b" }
]
```

The current interface supports at most six assignments, one per object, with destinations `table`, `tray-a`, `tray-b`, or `reject`. It rejects unknown object IDs, aliases, extra fields, repeated object assignments, and unsupported destinations. This is a task-level pick-and-place interface; it is not an arbitrary robot program, continuous policy action space, or joint-torque controller.

After validation, the evaluator executes the real shared deterministic controller against a copy of the snapshot. It retains initial and final worlds, generated controller steps, completed-action count, simulated duration, actual errors, and independently computed task checks. The caller's plan label or claimed success does not decide acceptance.

A scene must be settled: idle controller, empty gripper, and no active motion. An empty plan is a legitimate no-op candidate; it only satisfies a task if the frozen state already satisfies the actual goals.

## Controller regression campaign

The Evaluation Lab currently runs **nine cases**: three environments, each with a nominal assignment, a changed source layout, and an out-of-reach request. Source-layout offsets use fixed seeds 4200–4202. Initial and final scenes, seeds, planned steps, outcomes and check details are exported.

The observed browser campaign matched **9/9 expected outcomes**, comprising **6 completed tasks and 3 expected reach refusals**. The laboratory cases also check that the reference retains its full recorded initial state. This is evidence about these cases and this controller revision; it is not a learned-policy success rate or evidence of generalization to arbitrary environments.

Inspect the implementation in [evaluation.ts](../src/sim/evaluation.ts) and the UI in [EvaluationLab.tsx](../src/components/EvaluationLab.tsx). Run the campaign from **Controller evaluation → Run evaluation campaign**. Keep expected refusals visibly separate from task completions when presenting the summary.

## Human, baseline and LLM planner comparison

Open **Human and AI planner comparison** on a settled scene. The snapshot stays fixed until **Use current scene** is selected. That action, or changing the prompt instruction, starts a new comparison and clears earlier results.

| Candidate source | How it is produced | Honest interpretation |
| --- | --- | --- |
| Human authored | Operator chooses exact objects/destinations and evaluates the ordered list | A human-authored task plan; no human motion or teleoperation was measured |
| Bounded baseline | Existing `planCommand` parser resolves the instruction into supported assignments | A declared deterministic baseline; it is not disguised as an LLM |
| AI model | One explicit **Generate and evaluate AI plan** request to a configured, allowlisted model | That model's returned structured task plan, evaluated without silently repairing wrong goals |

The AI model receives bounded scene/task context through the local server. Keys remain server-side. Model discovery does not prove model entitlement or successful inference. Each generation click may incur provider usage; the interface does not run an automatic paid comparison loop.

A useful first demonstration is deliberately small:

1. Freeze the initial repair workbench.
2. Create a human plan that sends only the red part to spares.
3. Evaluate it: the plan is valid and its one movement completes, but task acceptance is false.
4. Evaluate the bounded baseline: three actions complete and the repair-kit task is accepted.
5. Optionally request one configured AI model, then inspect its actual returned assignments and checks.
6. Export the comparison and show that every result retained the same initial world.

Steps 1–4 and export were verified through the actual browser UI. The human result was **controller completed / task rejected**; the baseline was **controller completed / task accepted**. That acceptance check made zero paid planner requests. It does not establish the quality of a live model. Each live-provider result needs its own model ID, response and evaluator evidence.

The current comparison UI invokes the shared evaluator in the browser. A separate local API evaluator executes the same controller with server-owned module paths; it provides an additional computation boundary, not a trusted physical sensor or attestation of the uploaded scene. Distinguish these origins in any report. Do not describe a browser-only comparison as an independently server-executed run.

See [candidate-plans.ts](../src/sim/candidate-plans.ts), [PlannerBench.tsx](../src/components/PlannerBench.tsx), [planner-models.mjs](../server/planner-models.mjs), and [simulation.mjs](../server/simulation.mjs).

## Metrics and their limits

| Field | Meaning | What it does not establish |
| --- | --- | --- |
| `planValid` / `planErrors` | Candidate matches the bounded action schema and the supplied scene permits evaluation | Task correctness or executable grasp robustness |
| `outcome` | Controller completed, failed/refused, or did not execute an invalid candidate | Whether the overall work instruction was satisfied |
| `taskAccepted` / `checks` | All required task predicates passed after completed execution | Physical safety, real-world success, or model training benefit |
| `completedActions` | Actual controller completion count | Number of suggestions, API calls, or human interventions |
| `simulatedDuration` | Change in the simulator's own clock | Wall-clock runtime, real-robot cycle time, or employee time saved |
| `requestDurationMs` | Server-measured provider request/response processing time when a model call occurred | Inference-only compute time, robot action latency, or control frequency |
| Protected-reference check | Reference retains its complete initial record and has no observed handling/state violation across execution or recorded history | Authenticated capture, measured human motion, contact force, or physical safety clearance |
| Review status | Operator marked the recording reviewed/approved | Authenticated reviewer identity or automatic acceptance of the task |

Human and baseline rows show no LLM request time because no model request occurred. Do not substitute zero milliseconds and imply a latency comparison. Authoring time, cost, tokens, worker productivity gains and trained-policy improvements are not currently measured.

A result from one scene and one model call is a reproducible case study, not a statistically supported model ranking. Future comparisons should freeze a task suite, prompt/version, model revision, decoding settings, repeat count and failure taxonomy before collecting results. Include invalid plans, timeouts and refusals in the denominator; do not discard difficult cases or change task goals after inspecting model output.

## Human activity: useful interruption tests without pretending to capture people

The following `clear`/`nearby`/`in-workspace` contract describes the tabletop proxy. The mobile kitchen separately supports a bounded floor-obstruction proxy through `human enter` / `human clear`; clearance still requires explicit resume. Neither path measures people.

The implemented presence state is explicitly marked `source: 'scenario-proxy'`. An operator can set it to `clear`, `nearby`, or `in-workspace`; it does not come from a camera or tracked person.

Supported local scenario commands include:

```text
Simulate a person nearby
Simulate a person entering the workspace
Clear the human workspace scenario
Resume
```

`nearby` leaves the modeled workspace clear. `in-workspace` blocks attempted controller advancement and holds its simulated clock, active motion, held object, gripper and object poses. Clearing the proxy does not automatically resume a paused run. An explicit resume is required; attempting to resume while occupied blocks again before movement.

The controller tests cover these hold and recovery conditions, including entry during transfer and entry before motion begins. Inspect [human-activity.test.ts](../src/sim/human-activity.test.ts). A complete UI demonstration should also inspect the visible pause, recorded intervention event, clearance and explicit resume.

This is useful for exercising workflow recovery and preserving an interrupted attempt. It is not a measured human-activity dataset, perception evaluation, collision detector, certified protective stop, or authorization to deploy around people. A rendered person/proxy must retain that label in the UI and exported provenance.

## Creating new evaluation scenes during a session

Two authoring paths have different guarantees:

- The deterministic composer handles supported text templates without a model request.
- The AI composer proposes a bounded scene specification from a prompt and, optionally, one selected image/video reference frame. Schema and geometry checks run before explicit approval applies it.

The current supported vocabulary is a bounded set of block/cylinder/cup/bowl/sample assets, three declared colours, up to six objects, fixed supported slots, and explicit task assignments. The application supplies the geometry and controller primitives. It does not run model-produced code or accept arbitrary generated physics parameters.

A selected reference frame stays local until generation is requested; the selected frame is then sent to the configured model. A video reference supplies an operator-selected image, not reconstructed 3D geometry, calibrated scale, tracked hand trajectories, contact forces or a complete human demonstration. Review drafts and permissions before sending workplace images. Preserve uncertainty rather than claiming an exact reconstruction.

See [AiSceneComposer.tsx](../src/components/AiSceneComposer.tsx) and [scene-spec.ts](../src/sim/scene-spec.ts). A valid draft is not evidence that its task is physically achievable. Run its controller checks and review the resulting attempt. For model comparison, freeze the reviewed assignment before asking candidate planners; allowing the same model to invent easier goals after seeing its own result would invalidate the comparison.

## Portable output and independent review

| Export | Contents | Intended consumer |
| --- | --- | --- |
| `teachtrace.evaluation.v1` | Seeded cases, initial/final worlds, expected/actual outcomes, steps, checks and split summary | Another engineer reproducing the controller regression |
| `teachtrace.planner-comparison.v1` | Frozen initial world/instruction, capture timestamp, candidate source/model, actual evaluator results and returned request timing | A task-planning/debugging experiment |
| `teachtrace.evidence.v1` containing `teachtrace.episode.v1` | Scene/task provenance, recorded states/events/outcome, factual metrics, recomputed checks, review status, optional service report and SHA-256 integrity | Episode review and a native handoff to a robotics team |
| `teachtrace.mobile-planner-report.v1` | Frozen mobile goal, exact candidate actions, source/model metadata, server-executed results, actual failure steps and replay trajectories | Task-plan QA and reproducible software counterexamples |
| Sealed `teachtrace.mobile-evaluation.v1` | Main mobile attempt, exact worlds, derived arm coordinates, source checks/receipt and fidelity limits | Human review, recorded-state verification by the local mobile store, saved replay and state analysis |
| `teachtrace.mobile-service-report.v1` | Durable record ID, reviewed status, recomputed recorded-state checks, acceptance, outcome and observed metrics | Follow-up from the same mobile workplace attempt |

The native evidence validator checks finite chronological samples, stable object identities, agreement of initial/final states and metrics, and consistency of recorded completion evidence. It recomputes task checks and preserves unsuccessful outcomes. SHA-256 detects changed content relative to its digest; it is not a signature proving who recorded, reviewed or generated the data.

The tabletop episode service recomputes acceptance from a validated native recording rather than trusting submitted success booleans. For eligible completed tabletop pick-and-place commands it also attempts deterministic replay and compares recorded final objects and completion count. The mobile service described above recomputes recorded-state checks without claiming replay. A saved report should expose which operations were actually performed. Missing/inconsistent records remain unverified; an operator approval alone does not make them a passed task.

This validation boundary is still limited by the supplied scene/record and idealized controller. A client can author a synthetic scene; agreement with deterministic replay does not prove that a real event occurred. Check current runtime/API acceptance evidence before presenting a particular report as server-verified.

The exports are native kinematic evidence. They do not contain a validated low-level robot-action space, measured joint/force trajectories, a trained checkpoint, or a demonstrated learning gain. They are not advertised as ready-to-train LeRobot/RLDS datasets.

### Independent state analysis and variation lineage

[consume-evidence.mjs](../scripts/consume-evidence.mjs) is a standalone native consumer, without simulator imports. It verifies supported seals, units/frame conventions and independent forward kinematics, then writes a state-analysis manifest and next-observed-state pairs. Zero-duration control transitions are separated, not silently turned into fixed-duration motor actions. Its `sourceTaskChecksRecomputed:false` explicitly distinguishes source-reported acceptance from its own file/kinematic checks.

Two actual loaded and recorded seeded-variation children were exported and consumed. They retained one declared parent fingerprint and distinct computed child-scene hashes. The consumer marks declared ancestry as unverified and performs no split: `identityVerified:false`, `upstreamLineageVerified:false`, `splitPerformed:false`. Related cases can be grouped without claiming authenticated origin, independent real-world coverage or a leakage-free training split. [Lineage browser/consumer evidence](../.local/qa/lineage-smoke-results.json)

Consumer-readable state analysis is an implemented handoff. Training-framework compatibility, correct executable motor actions, downstream policy improvement and physical transfer remain separate unpassed gates.

## Why this helps a physical-AI team

The proposed near-term customer is the engineer or operator managing task scenarios and collection quality. A useful handoff is a precise counterexample: **this instruction, this frozen scene, this proposed plan, this observed result, and this failed predicate**. Another engineer can inspect the reference constraint or wrong destination without reconstructing an informal conversation from memory.

This can support task-specification QA, high-level planning experiments, failure triage and curation-tool development now. Claims of saved engineering time need a measured user study. Claims of improved robot learning need a downstream training/evaluation experiment. There is no claimed frontier-lab partnership, universal ingestion API, automatic model improvement, or recipient acceptance of these exports.

A credible pilot progresses through explicit gates:

1. **Agree a consumer contract.** Pick one recipient, embodiment, task family, action/observation representation and success definition.
2. **Add a dynamics-backed adapter.** Version robot/assets, control mode, contacts and sensors; reproduce one supported task before expanding the environment count.
3. **Validate a real importer.** Pin a target LeRobot/robomimic version, write required state/action/visual fields with correct units and time alignment, finalize and reload an episode. Do not invent unavailable modalities.
4. **Run a held-out experiment.** Freeze scene splits and compare a specified policy with and without the contributed data, retaining failures and reporting uncertainty.
5. **Evaluate transfer separately.** Hardware or a qualified partner is required for real-robot results; simulator acceptance cannot substitute for them.
6. **Add human data deliberately.** For real recordings, establish consent/provenance, calibration, tracking uncertainty and quality checks before claiming human-motion or teleoperation data.

These are later acceptance gates, not a promise that the present laptop demo trains a frontier robot model. The background research and format references are linked in [PHYSICAL_AI_RESEARCH.md](PHYSICAL_AI_RESEARCH.md).

## Fit with the workplace voice-agent track

The employee is a robotics collection/QA operator, and the workplace artifact is a reviewed task attempt and service report. The required workflow is concrete:

1. Employee initiates a supported assignment through Agora Conversational AI, with Murf Falcon spoken responses.
2. The assistant retrieves the actual scene, task instructions and acceptance knowledge; it clarifies unsupported requests.
3. Tool calls prepare meaningful simulator actions and follow the actual approval policy: eligible reversible simulation may run after its visible cancellation window; disabled automatic approval or critical confirmation requires explicit approval. The controller returns actual results and errors.
4. The assistant confirms what actually happened. Queued narration is not treated as proof that a person heard it.
5. The employee explicitly reviews and saves the mobile attempt through the local API, producing a persistent record, recomputed service report and replayable follow-up. Failed/stopped outcomes remain nonaccepted. The separate tabletop pipeline also supports its own assignment updates and reports.

Planner comparison and authored scenarios strengthen this employee workflow; they do not replace the mandatory voice path. The comparison currently has explicit UI/API controls—do not claim a spoken “compare models” command exists unless a tested tool actually implements it.

The release plan records an automated prerecorded-speech → real Agora/LLM/Murf → approved action result. That is provider-path evidence; natural microphone interaction and a human-heard speaker response remain distinct verification items. Match the final demonstration claim to the current release evidence. Organizer interpretation determines eligibility; this document cannot guarantee acceptance or a judging score.

## Review checklist before a public evaluation claim

- Identify the exact question, source category, frozen task/scene and controller/model revision.
- Separate schema validity, execution outcome, task acceptance and human review.
- Retain failed/invalid/refused/interrupted attempts and their actual checks.
- Mark browser computation, server recomputation, provider acceptance and human observation separately.
- Report only measured quantities; include what was not measured.
- State kinematic/idealized-grasp limits and the absence of physical safety or learning claims.
- Export a record another developer can load; demonstrate the consumer check instead of merely showing a download button.
