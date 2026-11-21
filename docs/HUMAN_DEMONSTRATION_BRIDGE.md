# From household demonstrations to reviewed robot tasks

Live sources checked **21 November 2026**. This document separates verified company/research statements, RoboTrace's current implementation, and a proposed pilot. It does not imply a Pronto partnership, a buyer commitment, or an improvement to a frontier robot model.

**The useful product direction is a demonstration-to-task review and evaluation workbench.** A collector brings a permitted household reference; an operator checks the intended objects, goals and exceptions; competing plans are evaluated on the same reviewed scenario; another engineer receives reproducible evidence. The present version supplies the task/evaluation layer. It does not automatically turn a phone recording into robot-control training data.

## 1. Is the Pronto example real?

Pronto's own **Verified terms**, updated July 2026, describe household-service recordings and anonymized AI-training uses, including third-party models. That verifies a published policy, rather than actual downstream delivery or learning benefit. [Pronto Verified terms](https://www.withpronto.com/verified-tnc/)

Its official **FAQ** describes Verified footage more narrowly as dispute-related and subject to deletion. These public descriptions are not fully aligned. This research cannot determine their operational interpretation, actual recipients, commercial arrangements or training results. [Pronto FAQ](https://www.withpronto.com/frequently-asked-questions/)

Use this careful pitch wording:

> Pronto publishes terms contemplating household recordings for AI-related uses, although its public descriptions differ. Robotics research shows ways to use structured demonstrations. RoboTrace explores review and evaluation between a permitted reference and an accepted task.

Do not say “Pronto sends its data into our system,” “Pronto works with a particular lab,” or “our videos train that lab's robots.” None of those claims is established here. The business opportunity is a hypothesis to validate with collection teams and robotics engineers, rather than a closed partnership.

## 2. What robotics companies actually do with human activity

A recording supplies observations of a human completing a task. For a robot learner, the missing question is: **what action should this particular robot take from its current observation?** Human fingers, arms, camera motion and contact mechanics differ from a robot's gripper, control inputs and sensors.

| Primary source | What it actually establishes | Implication for RoboTrace |
| --- | --- | --- |
| [Physical Intelligence: human-to-robot transfer](https://www.pi.website/research/human_to_robot), 16 December 2025 | Their experiment co-finetunes a pretrained VLA using relevant robot data plus egocentric human data represented with tracked 3D hand positions. The transfer depends on their model/training setup and robot-data scale | Task references may complement robot experience; a plain uploaded clip is not their full pipeline |
| [Physical Intelligence technical paper](https://www.pi.website/download/human_to_robot.pdf) | Human action representations are derived from tracked hand geometry and relative poses, roughly aligned with robot end-effector actions. Human gripper actions are not simply assumed to be visible/recoverable | Preserve coordinate frames and missing channels. Do not relabel hand motion or simulated pose differences as measured robot motor commands |
| [Apple EgoDex research](https://machinelearning.apple.com/research/egodex-learning-dexterous-manipulation) | Egocentric manipulation video is paired with hand/finger tracking captured using Apple Vision Pro and calibrated sensing; the work includes trajectory-prediction evaluation | A phone-only demo can capture a reference, but does not inherit that calibrated tracking quality |
| [EgoDex official repository](https://github.com/apple-aiml-research/ml-egodex) | The data includes synchronized joint transforms, camera intrinsics, language metadata and optional confidence values. The authors warn that generated language annotations can contain errors; the dataset also has an explicit usage license | Temporal alignment, confidence, annotation review and usage rights are part of the product contract, not optional decoration |
| [Sunday Robotics](https://www.sunday.ai/) | Sunday says its Memory Developers collect household demonstrations using its Skill Capture Glove for Memo training | Purpose-built capture interfaces are another real approach; there is no basis to claim an ordinary phone reproduces their capture system |
| [DROID official project](https://droid-dataset.github.io/) | This is actual robot-manipulation data: the provided loader exposes camera observations, robot actions and language instructions; the project supplies hardware/setup and policy-learning resources | A downstream robot dataset expects meaningful action/observation fields, not only a scene image or an English tool call |
| [Open X-Embodiment official project](https://robotics-transformer-x.github.io/) | The project pools robot datasets across embodiments with standardized representations and evaluates trained models. Its documented action representation includes gripper-frame motion components and gripper state | “Compatible” requires a specific representation, embodiment and consumer test. One arbitrary JSON export is not universal robot-data compatibility |

These are examples of distinct approaches, not interchangeable recipes. Neither human video nor a simulator image guarantees a valid grasp, contact force, motor action or successful transfer. A language description can teach intent or help evaluate planning while remaining insufficient for low-level robot control.

A practical pipeline often has several representations:

```text
Human video + capture metadata
    ↓
Time intervals, task language, object identities and observed interactions
    ↓
Optional tracked hand/object/camera poses with confidence and calibration
    ↓
Embodiment-aware alignment / retargeting / paired robot experience
    ↓
A defined robot observation-action dataset and training recipe
    ↓
Held-out policy evaluation, followed separately by real-robot validation
```

This diagram is an architectural synthesis from the sources, not a claim that every company implements every stage or that RoboTrace already does so. Some methods use co-training rather than explicit geometric retargeting; the gap still has to be addressed by a documented method and evaluated outcome.

## 3. Where RoboTrace can sit in the middle

The near-term wedge is **making a task demonstrably reviewable and testable**, before claiming that the underlying demonstration is training-ready.

| Step | Current RoboTrace path | Boundary |
| --- | --- | --- |
| Capture a reference | Select a local photo or a frame from a local video; the chosen frame is sent to the configured model only when generation is requested | One image is a reference, not a temporal human-action recording |
| Interpret the task | Prompt plus reference can propose supported object identities and goals; deterministic text templates remain available | The proposal uses a fixed asset/slot vocabulary; it is not a measured reconstruction of the home |
| Review | Operator inspects the schema-validated draft and explicitly approves its scene/task | Plausible wording or valid JSON does not prove the model preserved every requested count or exception; these require acceptance checks |
| Evaluate decisions | Human-authored, bounded-baseline and explicitly requested LLM plans use the same frozen initial world and saved assignment | This compares task-level decisions through the existing kinematic controller, not learned physical robot policies |
| Observe failures | Actual controller outcomes and task checks distinguish a completed movement from a satisfied task; protected objects and refusals stay visible | Idealized attachment grasps do not establish physical robustness |
| Review and hand off | Record/replay an attempt, submit reviewed evidence, produce a factual report, export a native package or comparison | Current exports are native simulator evidence. They are not a calibrated human trajectory or validated LeRobot/RLDS training dataset |

The useful handoff is precise: **this reference, this reviewed interpretation, this task, this frozen scene, this candidate plan, this result, and this failed check**. An engineer can challenge a wrong destination or an omitted protected object without reconstructing an informal conversation.

Today the reference-to-scene relation is a reviewed hypothesis. The simulator's object coordinates come from supported slots, rather than measurements extracted from the room. Preserve that distinction when showing the phone next to the 3D scene.

The implementation is in [AiSceneComposer.tsx](../src/components/AiSceneComposer.tsx), [scene-spec.ts](../src/sim/scene-spec.ts), [PlannerBench.tsx](../src/components/PlannerBench.tsx), [candidate-plans.ts](../src/sim/candidate-plans.ts), and [native evidence](../src/data/evidence.ts). Detailed measurement boundaries are in [PHYSICAL_AI_EVALUATIONS.md](PHYSICAL_AI_EVALUATIONS.md).

## 4. A narrow pilot that fits the working product

Start with **reviewed kitchen serving/counter-clearance tasks using rigid objects**. The current kitchen demo already supports a cup and utensil case going to the serving tray, with a bowl routed to storage. A reviewed authored scene can vary the supported objects and explicit assignments. This is a credible starting point for object identity, count, destination, completion, and “leave this item untouched” decisions.

A pilot statement:

> Given a permitted short counter-clearance reference, help an operator confirm the intended object-to-destination task, test competing high-level plans, and deliver a reproducible accepted or rejected task case to a robotics team.

Use a staged tabletop recording made by the project owner for the demonstration. This avoids implying that the team has access to household-worker footage or rights to a commercial data provider's corpus. The initial customer hypothesis is a robotics demonstration/QA team or a data-collection vendor preparing task cases; whether they would pay requires interviews and a recipient trial.

A concrete demonstration sequence:

1. Show a brief owner-recorded clip of arranging rigid serving items. Select a clear reference frame.
2. Enter the intended task and any exception in the reference composer, such as preserving a reference item. Generate a supported draft and inspect its exact objects/counts/goals. The current reference-assisted composer uses this explicit UI request; spoken scene drafting is a separate path.
3. Approve the draft. Freeze the reviewed task so planners cannot make it easier by changing its acceptance criteria.
4. Create a human plan with a deliberate wrong destination. Show that its movement can complete while its task check fails.
5. Request one configured model's plan explicitly, inspect its actual decisions, and evaluate it against the same scene and assignment.
6. Review the recorded run and export the task/evaluation evidence. Show a consumer verification step.

The existing voice assistant can support task/context retrieval, clarification, supported scene/task operations, approval and outcome communication. Comparison currently has explicit UI/API controls; do not pretend a voice-only “compare all models” tool exists unless it has been implemented and tested.

Full cleaning introduces capabilities this controller does not have: wiping contact, fluids, deformable cloth, articulated cupboards, walking between rooms, force control and dexterous tool use. A narrow, executable serving task demonstrates the bridge more honestly than a visually elaborate cleaning animation.

## 5. What must be added to become a human-demonstration bridge

The following is a proposed roadmap. These fields and capabilities should not be described as present merely because an image can be uploaded.

| Gate | Small deliverable | Acceptance evidence |
| --- | --- | --- |
| G1 — reference lineage | Store source media hash, selected frame timestamp, capture mode, review status and intended use alongside the approved task | Export can trace a simulated scene to its reviewed source frame without claiming measured geometry |
| G2 — temporal annotation | Mark task start/end, object interactions and ordered substeps on the video timeline; let a reviewer correct labels and abstain where visibility is insufficient | A second reviewer can reproduce annotations from timestamps; disagreement/unknown labels are preserved |
| G3 — task graph | Encode required transitions, allowed orders, protected objects and failure predicates independently of a solver | Human and model candidates are checked against a frozen reviewed graph; the solver cannot grade itself by rewriting the task |
| G4 — uncertain perception | Optional object/hand tracking with calibrated frame definitions, confidence, occlusion/missing flags and model/version provenance | Visual overlay matches the source; uncertain estimates remain uncertain. Unknown depth, scale, forces or grasp state are not silently invented |
| G5 — controlled collection trial | Collect a small permitted owner/partner set with documented usage scope, participant/household permissions, retention choices and review workflow | Recipient can identify which episodes are allowed for the intended use and reject/revoke unsuitable material |
| G6 — one consumer adapter | Agree a recipient's real observation/action/metadata contract; implement a version-pinned loader or adapter | Recipient actually parses and reloads a sample, verifies units/frame conventions and confirms the supported use. Missing action/sensor modalities remain absent |
| G7 — physical learning experiment | Add a validated dynamics/robot-data path and a documented training recipe for a specific policy/task | Held-out evaluation compares the specified baseline with/without the contribution, with failure counts and uncertainty; learning benefit is claimed only if measured |

A future annotation record might distinguish `observed_in_video`, `operator_confirmed`, `model_inferred`, and `simulated` values, each with origin/version/confidence. That is a proposed provenance contract, not an existing native-export guarantee.

Actual hand/object motion would need reliable time alignment and coordinate meaning. Robot retargeting then needs embodiment limits and a compatible action representation. A gripper's command, a human wrist trajectory, a guessed 3D position and a rendered pose are different signals. If those distinctions are lost, an attractive dataset browser can package the wrong supervision very efficiently.

## 6. What to measure before calling it useful

Measure one operational hypothesis: **can another engineer turn an allowed reference into a correct, reviewable task case more reliably or quickly using this workflow?** Start with task semantics and review quality, not a training-gain promise.

For a small pilot, report:

- Exact agreement on object counts, identities, destinations and protected items against independently reviewed labels.
- Unsupported/ambiguous references correctly deferred for clarification, including occluded objects.
- Time to approve a task case and number of reviewer corrections, measured prospectively rather than estimated.
- Candidate validity, actual task acceptance and refusal/error reasons on a frozen task set.
- Evidence-package consumer load success, provenance completeness and correct preservation of failed cases.

Split reference households/setups/objects across development and held-out cases where appropriate. Do not place frames from one recording in both sides and call that independent generalization. Predefine success criteria and retain failed examples. A task-planning improvement does not establish better grasp physics; a successful importer does not establish that training improved a policy.

The current observed demonstrations are small smoke tests, not these pilot measurements. Use [FEATURE_RUBRIC_MATRIX.md](FEATURE_RUBRIC_MATRIX.md) for current release evidence and open gaps.

## 7. Why this remains a workplace voice-agent project

The employee is the collector or robotics QA operator. Voice is useful while watching a demonstration or inspecting a workcell: clarify the intent, retrieve the task/SOP, prepare a bounded action, approve a critical change, hear a truthful exception, and receive a service report. Agora supplies the live conversational/RTC path, Murf Falcon supplies speech, and the tools perform visible actions plus persistent record/report work.

This can be pitched as **a voice-assisted task review and evaluation console for physical-AI data operations**. The current proof is the connected workplace workflow and reviewable evidence. The longer-term hypothesis is a bridge from permitted human references to recipient-accepted tasks and, after separate gates, compatible training/evaluation records.

The proposition should stand even before any robot-training experiment: the operator gets an inspectable task and failure case. If interviews show that existing collection teams already solve this well, narrow the product to a specific unmet review/evaluation step rather than claiming an entirely unsolved market.

## 8. Competitive and synthetic-data follow-up

The expanded primary-source comparison, a precise seed-to-variation pipeline, mobile-manipulation boundaries, metrics and 32 small feature tasks are in [DATA_FLYWHEEL_STRATEGY.md](DATA_FLYWHEEL_STRATEGY.md). In particular, micro1 already describes linked video/3D expert review; the broad bridge concept is not a novelty claim. Reusing an approved task can generate more simulated decision tests without fresh filming, while measured human demonstrations and useful low-level training episodes require separate evidence.
