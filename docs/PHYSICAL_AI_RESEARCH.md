# Physical-AI product direction and data handoff

Research checked **21 November 2026**. Primary sources only. This document separates source-backed observations from proposed TeachTrace product decisions. It does not claim a partnership, a lab's willingness to ingest our data, or demonstrated improvement to any robot model.

## Recommended product

> TeachTrace helps robotics employees turn task briefs into executable simulation assignments, inspect decisions and failures, collect and review episodes, and deliver reproducible data packages to a downstream robotics workflow through a voice-assisted workbench.

The employee is a robotics engineer, demonstration collector, or QA technician. Their output is an inspectable assignment/run/dataset, rather than simply a moving robot. Agora and Murf support task briefing, clarification, approval, exception resolution, and progress communication. The action tools execute work and persist its results.

The strongest near-term product wedge is **scenario authoring, execution, review, and curation**. Training-data generation is an additional capability after its physics and data contracts are validated. Voice alone does not establish a new product category; mature simulator, data-generation, and robotics-observability projects already exist.

## Seven-hour hackathon decision

Target machine reported by the integrating agent: **M4 Pro, 24 GB RAM**. Do not make Isaac Sim, cloud GPU access, policy training, or a full dynamics migration critical dependencies for today's entry.

| Horizon | Deliverable | Honest claim |
| --- | --- | --- |
| **TODAY: required path** | Verified Agora/Murf employee conversation; reviewed environment/task definition; visible simulator action; deterministic outcome check; persisted episode; summary and export manifest | A working voice-assisted robotics-operations workflow |
| **TODAY: environment breadth** | Workbench kit collection, kitchen counter clearance, and laboratory rack routing as distinct supported task/fixture specifications and evaluators, reusing bounded rigid-arm primitives | Distinct workflow families sharing one declared controller; only implemented/tested fixtures are shown as supported |
| **TODAY: handoff sample** | Versioned scene specs, run logs, metrics, provenance and limitations, checksum manifest | A reviewable simulator-workflow sample; existing kinematic logs are not called a validated robotics-training dataset |
| **PILOT** | Benchmark a small MuJoCo workcell; add real sensor/control records; validate one LeRobot/robomimic importer | Physics-backed simulated data compatible with one specified downstream workflow |
| **LATER** | Learned-policy evaluation/training, GPU generation, larger environments, production multi-user infrastructure, partner/real-robot evaluation | Claims depend on separate evidence and acceptance gates |

For today, the kitchen should use counter/container tasks that the controller can actually execute. Shelf access, articulated drawers and orientation-changing placement should be deferred until implemented. The lab should route synthetic labelled rigid items without clinical decision-making. A generalization claim requires a learned policy and held-out evaluation, even if three scene families look different.

Only attempt a contact-physics spike today if it can prove one stable pick/place and recording quickly without jeopardizing the mandatory voice workflow. Failing that gate is a reason to preserve the declared kinematic scope rather than delay the working demo.

## What existing physical-AI work establishes

### Simulation can produce useful data, with substantial supporting machinery

MimicGen demonstrates adapting a limited set of human demonstrations to varied initial conditions, objects, and robot embodiments. Its published work includes generating and evaluating policies, rather than merely exporting motion clips. This establishes a research precedent for demonstration expansion, not that arbitrary generated movements are valid training demonstrations. [MimicGen project, NVIDIA/UT Austin](https://mimicgen.github.io/)

RoboCasa provides genuine kitchen task families and separates pretraining environments from held-out target kitchens. Its dataset documentation also describes per-frame subtask labels for target composite tasks. This is a useful reference for distinct environments, task composition, and evaluation splits. Do not copy its published results or dataset-scale claims into TeachTrace's own metrics. [RoboCasa dataset overview](https://robocasa.ai/docs/build/html/datasets/datasets_overview.html)

Human videos are a possible additional data source, but robot/human differences require care. Physical Intelligence's reported transfer method combines relevant robot data with human demonstrations and represents the latter through tracked 3D hand positions. A phone video alone is not equivalent to that pipeline. [Physical Intelligence research](https://www.pi.website/research/human_to_robot)

### There are established data formats and evaluation interfaces

LeRobotDataset supports structured episode metadata, tabular state/action records, and visual streams. Its current documentation exposes creation, frame addition, episode saving, finalization, and Hub publication. **Finalize writers and reload the result before upload.** Pin the library version: layouts and APIs can change, so avoid relying on a remembered directory structure. [LeRobotDataset API](https://huggingface.co/docs/lerobot/en/api/datasets), [v3 format guide](https://huggingface.co/docs/lerobot/lerobot-dataset-v3)

robomimic documents environment metadata, state/action sequences, observations and next observations, rewards, termination signals, and train/validation masks. An adapter must preserve those meanings and expected shapes. Replacing an `actions` field with a natural-language tool call does not create an equivalent robotics dataset. [robomimic dataset structure](https://robomimic.github.io/docs/datasets/overview.html)

RLDS is another episodic representation used by existing robotics datasets. Its reference repository is currently archived/read-only; that is a maintenance consideration, not a statement that existing RLDS data is unusable. Prefer a maintained LeRobot integration first, then implement recipient-requested RLDS compatibility. [Google Research RLDS repository](https://github.com/google-research/rlds)

LeRobot now documents local and remotely served simulation through a shared environment interface. Its benchmark integration reports episode/task/suite outcomes, and success comes from an environment-provided signal. This supports separating the simulator service from the policy runtime. [LeRobot simulation](https://huggingface.co/docs/lerobot/simulation), [benchmark integration](https://huggingface.co/docs/lerobot/en/adding_benchmarks)

## Three useful levels of output

| Level | What TeachTrace supplies | Defensible use | Gate before claiming the next level |
| --- | --- | --- | --- |
| **A: current kinematic workflow** | Scene definitions, explicit goals, tool plans, simulator poses, idealized grasp state, event history, review status | Workflow demos, controller-logic regression, debug traces, annotation/curation experiments | Add a validated dynamics backend and a documented sensor/action contract |
| **B: physics-backed simulated episodes** | Versioned robot/environment assets, actual simulator control inputs, synchronized simulated observations and states, contacts/outcomes where supported | Candidate simulation benchmark or imitation-learning data, after importer/quality checks | Demonstrate training and held-out evaluation for a specified policy/environment |
| **C: validated downstream learning result** | A reproducible training recipe, model checkpoint, held-out evaluation, ablations and limitations | Evidence that a particular data contribution helped a particular simulated learning problem | Real-robot transfer requires separate hardware/partner evaluation |

Level A is already useful for building the application and debugging a bounded controller. It should not be marketed as measured human motion, contact-accurate robot training data, or a trained robot policy. A file can be syntactically compatible with a learning library while remaining unsuitable for a target model.

## Genuine multiple environments

Changing the colours of blocks on one table is a scene variation. A new environment family should introduce different fixtures, task semantics, constraints, and success checks.

Recommended initial families share rigid-object manipulation to keep one robot/controller integration practical:

| Family | Actual assignments | Distinct fixtures and success criteria | Suggested implementation order |
| --- | --- | --- | --- |
| **Maintenance workbench** | Collect a specified repair kit; arrange components; route a rejected item to review | Parts bins, kit tray, part identity and quantity requirements | First; extends existing code |
| **Kitchen counter** | Move the cup and utensil case to the serving tray; put the bowl in the storage tray | Counter clearance, semantic object types and a distinct assignment; idealized rigid-object grasps | Second; shelf access and orientation-sensitive tasks remain later capabilities |
| **Laboratory sample-routing bench** | Route Sample alpha to Rack A and Sample beta to Rack B; leave the Reference sample untouched | Label identity, distinct rack destinations, unchanged reference pose/state, exact assignment completeness | Third; operational workflow only, with synthetic/nonclinical samples |

These bounded families now have repository implementations and controller-backed checks in [environments.ts](../src/sim/environments.ts). Household task stories add distinct routing and protected-object conditions in [workplace-cases.ts](../src/sim/workplace-cases.ts); their rooms are decorative context. Release/browser evidence remains separate from the existence of those modules. Drawer operation, insertion, deformable laundry, fluid pouring, mobile navigation, humanoid control, and multirobot planning are separate capability expansions. They must not be declared supported simply because an asset can be rendered.

## Shared architecture

```text
Employee voice / reviewed text brief
                ↓
Task + environment schema / approved knowledge
                ↓
Plan, clarify, and approve
                ↓
Capability adapter → simulator backend → explicit outcome checks
                ↓                            ↓
Run/episode recorder ← observations + control inputs + events
                ↓
Human review / curation / exporter
                ↓
Private recipient handoff → recipient importer → learning/evaluation
```

Recommended contracts:

- **Environment adapter:** capability manifest, versioned assets, `reset(seed, scene)`, `observe()`, `step(action)`, `evaluate()`, and `snapshot()`.
- **Task definition:** goal predicates, allowed object/fixture references, failure predicates, time budget, and initial-state distribution.
- **Skill definition:** typed inputs, preconditions, control/action representation, supported embodiments, expected events, and postconditions.
- **Policy adapter:** observation schema and preprocessing, model/checkpoint revision, action schema, action bounds, latency/timeout handling, and termination semantics.
- **Dataset adapter:** target format/version, required modalities, dimensionality/units, normalization, resampling rules, writer finalization, importer verification, and data card.

The voice model chooses high-level goals and supported operations. The simulator/controller determines physical state transitions and measured simulated outcomes. The UI shows those returned facts. A learned low-level policy can later replace a deterministic skill without changing what an accepted episode means.

## Data that a downstream lab would need

The following is a proposed minimum contract to agree with a recipient. Exact fields depend on their robot, policy, sensors, and learning recipe.

### Episode identity and reproducibility

- Dataset, episode, task, environment-family, scene, and assignment IDs.
- Immutable scene/config hash; assets and their versions/hashes.
- Simulator engine/version/settings and controller or policy revision.
- Robot embodiment, joint ordering, control mode, action-space definition and units.
- Random seed, initialization distribution, and split membership.
- Source category: simulated, human teleoperation, human video, derived annotation, or real-robot measurement.

### Time-aligned steps

- Monotonic simulation timestamp and frame/step index.
- Observation available **before** the action, not information from the future.
- Actual control/action input sent for that step, with units and reference frame.
- Robot state such as joint positions/velocities, end-effector pose, and gripper state when available.
- Sensor streams required by the target policy: RGB, optional depth/segmentation, and camera calibration/extrinsics.
- Next observation, environment termination/truncation, task success, and failure labels.
- Contact/force data only when actually produced by a capable backend; missing values must remain missing.

### Human feedback and quality metadata

- Original instruction and normalized task specification.
- Human correction/approval text with timestamps and reviewer identity or pseudonymous ID.
- Failure reason, intervention intervals, retry relation, and accepted/rejected status.
- Licenses/permissions of demonstrations and assets; provenance and release restrictions.
- Quality-check results, dropped frames, resampling and derived-label provenance.

Current commanded end-effector motion or pose differences must not be silently relabelled as measured joint actions. Images, action vectors, and control frequency must match the target policy interface. Whether the recipient uses deltas, absolute targets, torques, or action chunks must be explicit.

## A realistic path to transferring data to a frontier lab

There is no general-purpose public endpoint that accepts arbitrary simulation logs into all frontier robotics models. Treat a lab's ingestion requirements and acceptance as a separate integration/partnership decision.

**November 2026 update:** Physical Intelligence announced a Pi API beta on 13 October 2026 with customer-data upload, managed fine-tuning and hosted inference. This provides a concrete potential future integration, subject to access and the actual data/embodiment contract. It does not establish acceptance of TeachTrace's kinematic logs or universal compatibility. [PI announcement](https://www.pi.website/blog/api-beta)

1. Select a specific target workflow: e.g. a LeRobot-compatible local evaluation or a recipient's documented importer.
2. Agree on embodiment, task family, action/observation schema, required modalities, license and intended use.
3. Collect a small, versioned sample batch.
4. Validate writer output and reload it through the recipient-compatible dataset loader.
5. Produce a dataset card and manifest with hashes, quality metrics, splits and limitations.
6. Show the user the precise destination, access level and contents for approval.
7. Transfer to an authorized private repository or recipient-controlled object store.
8. Record immutable repository revision/object versions and checksums as the handoff receipt.
9. Run a recipient-side import smoke test and retain its result.
10. Only then run an agreed training/evaluation experiment; report observed results without claiming general transfer.

The Hugging Face API supports private publication options, and dataset cards document contents, provenance, intended use and licensing metadata. Publication is distribution, not model training or acceptance by a lab. [LeRobot Hub publication API](https://huggingface.co/docs/lerobot/en/api/datasets), [Hugging Face dataset cards](https://huggingface.co/docs/hub/datasets-cards)

Open X-Embodiment's official project page provides a dataset enrollment form for potential contributions. It is a specific contribution route, not an automatic ingestion guarantee. Do not submit or contact its maintainers as part of an unapproved prototype demo. [Open X-Embodiment contribution information](https://robotics-transformer-x.github.io/)

## Proving value

Start with operational metrics the application can measure:

- Time to produce a valid scene/task assignment.
- Time from an observed failure to a reviewed, reproducible episode.
- Accepted episodes per collector-hour, with rejection reasons.
- Failed imports and missing-modality rates.
- Reproduction rate across repeated seeded runs.
- Coverage of supported task/fixture/initial-state combinations.

For a learning claim, compare the same base policy/checkpoint and training recipe with and without the added data. Keep held-out environments, seeds, objects, and scene variants separate from training and authoring feedback. Report counts, uncertainty, failures and compute budget. LeRobot's benchmark documentation is a useful reference for success counts and confidence intervals; a deterministic controller smoke test is not a learned-policy evaluation. [Evaluation metric semantics](https://huggingface.co/docs/lerobot/en/adding_benchmarks)

## Compute and delivery stages

| Stage | Practical compute plan | Required proof |
| --- | --- | --- |
| Existing command center | Browser + laptop + provider APIs | Actual commands, records and provider workflow |
| Small contact-physics workcell | Native MuJoCo service; benchmark on the actual laptop | Stable grasp/contact task, sensor capture, fixed control timing |
| Larger environment suite | Headless workers, durable jobs/object storage, per-run resource limits | Reproducible jobs with cancellation, quotas and retry isolation |
| Policy inference/training | Capability-dependent local runtime or optional GPU worker | Model-specific installation, memory/latency test and budget approval |
| Isaac/photoreal generation | Optional suitable NVIDIA workstation or cloud worker | Compatibility checker, reproducible image, workload/credit limits |

MuJoCo provides articulated/contact simulation and supports native and browser visualization. Its documentation explicitly notes browser WebAssembly inspection is slower than native code. This makes native benchmarking sensible before assuming browser-physics throughput. [MuJoCo overview](https://mujoco.readthedocs.io/en/stable/overview.html)

Isaac Sim's current documented requirements include a compatible Windows/Linux platform and substantial NVIDIA GPU resources. It is not a default assumption for an unspecified laptop or a Mac. Treat it as an optional remote backend rather than a mandatory first step. [Isaac Sim requirements](https://docs.isaacsim.omniverse.nvidia.com/latest/installation/requirements.html)

## Small implementation tasks for the master backlog

The parent plan should assign IDs, owners, dependencies and acceptance evidence to these tasks. These are proposals, not completed work.

### Product and task contracts

- Name the primary employee persona.
- Define one collection assignment per initial environment family.
- Define one measurable success predicate per assignment.
- Define expected failure labels per assignment.
- Define the exact meaning of an accepted episode.
- Define the action/observation schema for one target policy.
- Choose the first recipient-compatible export format and pin its version.

### Genuine environment families

- Introduce an environment-family registry.
- Add fixture metadata and supported-skill declarations.
- Implement the workbench kit-count evaluator.
- Implement kitchen counter/shelf placement predicates.
- Implement sample-rack slot occupancy checks.
- Add separate, seeded starting-state distributions.
- Save and reload each family as an immutable scene revision.
- Add explicit unsupported-capability responses.

### Physics and policy integration

- Benchmark a minimal MuJoCo model on the laptop.
- Implement one stable contact-based grasp.
- Expose fixed-timestep reset/observe/step endpoints.
- Connect one calibrated simulated camera.
- Record the actual control vector with joint ordering and units.
- Add robot model/version identifiers to each run.
- Implement a deterministic policy-adapter baseline.
- Implement one learned-policy adapter only after its environment schema matches.
- Add per-step latency and timeout behavior.
- Separate termination from truncation.

### Data pipeline

- Add monotonic step and episode timestamps.
- Distinguish observed, commanded, simulated and derived fields.
- Add dropped-frame and resampling metadata.
- Save initial-state and asset hashes.
- Add intervention/correction intervals.
- Add quality-check results to review records.
- Implement a small LeRobot writer using its public API.
- Finalize writers before packaging.
- Reload the package through the pinned reader.
- Verify episode, frame, task and camera counts.
- Render a sample decoded frame and action trace for QA.
- Create a dataset card from actual metadata.
- Create a checksum manifest.

### Handoff and measured value

- Add destination/access-level review before any external upload.
- Add private publication with an explicit repository ID.
- Retain the returned immutable revision.
- Verify downloaded artifact checksums.
- Run a recipient-import smoke test.
- Define independent held-out scenes/seeds.
- Record a baseline result before augmentation.
- Run an ablation with unchanged training settings.
- Report task-wise counts and uncertainty.
- Measure collector setup/review time against the same manual assignment.

## Claims for the hackathon

Defensible after verification: an employee can use Agora/Murf to author a supported scenario, clarify and approve it, execute a task through tools, inspect the outcome, and save/export a reviewable record.

Defensible only after later gates: physically validated simulated demonstrations, a working recipient-format importer, a reproducible policy-learning improvement, or real-robot transfer.

The practical near-term story is **helping robotics employees do the surrounding work that makes simulation and datasets reproducible, inspectable, and shareable**. The data becomes useful to a frontier lab only after a specific compatibility and quality workflow succeeds.

For primary-source company comparisons and the precise distinction between generated task variants, synthetic annotations, simulated trajectories and newly measured demonstrations, see [DATA_FLYWHEEL_STRATEGY.md](DATA_FLYWHEEL_STRATEGY.md).
