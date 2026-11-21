# TeachTrace: from one reviewed household task to many useful tests

Research checked **21 November 2026**, using primary company pages, official repositories and research projects. Company statements below are attributed claims, not independent audits. Recommendations and proposed features are marked as such. No partnership, customer, frontier-model integration, training improvement, or hackathon result is implied.

## Product decision

Build **a voice-operated task review, variation and evaluation console for household robotics data teams**. An employee turns a permitted reference or an existing approved task into explicit goals, tests candidate plans on reproducible variations, inspects failures, and hands another engineer a reviewed evidence package.

The near-term output is a **reproducible task case and its observed outcomes**. A kitchen scene makes the consequences understandable; the product value comes from preserving intent, finding failure cases, and making the evidence reusable. A visually realistic kitchen alone does not supply realistic contact physics or a trainable robot dataset.

The strongest proposed demo message is:

> One reviewed household task can become many reproducible decision tests. TeachTrace shows which plans satisfy the task, which disturb a protected item, and which need better demonstrations or a different controller.

This is more defensible than claiming that a phone video instantly trains a robot. It also acknowledges a crowded market: collection, annotation, simulation and model-training platforms already exist.

## What the primary evidence actually says

| Organization / project | Verified public statement | What it does **not** establish for TeachTrace |
| --- | --- | --- |
| **Pronto** | Its July 2026 Verified terms permit captured household-service data to support anonymized AI training, including third-party models. Its FAQ describes Verified footage as dispute-related with deletion. These public descriptions are not fully aligned. [Terms](https://www.withpronto.com/verified-tnc/), [FAQ](https://www.withpronto.com/frequently-asked-questions/) | A named data buyer, actual delivery format, a robotics training result, or access to its footage. Do not resolve inconsistent public descriptions by guessing. |
| **Sunday Robotics** | Its technology page describes household Memory Developers, Skill Capture Gloves, and an integrated collection/training/evaluation process. It lists sensing beyond ordinary video. [Sunday technology](https://www.sunday.ai/technology) | That phone-only capture reproduces its sensing, or that its robot capabilities are available through our application. |
| **micro1** | Its robotics offering includes expert demonstrations, temporal/action annotation, multimodal capture, QC and evaluation. [Robotics offering](https://www.micro1.ai/robotics) | A market gap for a generic annotation platform, a customer commitment, or transferable performance from its data to ours. |
| **micro1 flow** | Its September 2026 product description already combines expert review, generated variations, QC/grading, and linked camera/3D evidence in robotics workflows. [flow](https://www.micro1.ai/blog/introducing-flow) | Novelty for the broad phrase “human-data-to-robot bridge.” Our distinction must be a specific executable workflow and measured usability, not that phrase. |
| **Generalist** | Its privacy policy describes human-operated Data Hands and task/sensor data. Its GEN-1.5 article describes sensorimotor demonstration prompts and reports emerging one/few-shot behavior on its own system. [Data Hands policy](https://generalistai.com/privacy-policy), [GEN-1.5](https://generalistai.com/blog/gen-1.5) | That a generic text plan, a phone frame, or our kinematic trace is an equivalent physical prompt for that model. |
| **Physical Intelligence** | Its human-to-robot work combines human demonstrations represented by 3D hand tracks with relevant robot data and a broadly pretrained VLA. [Research](https://www.pi.website/research/human_to_robot) | That raw human video alone supplies robot motor commands, or that TeachTrace has reproduced its training method. |
| **Skild AI** | It describes human-video learning with a pretrained embodiment-transfer model and reports a separate simulation self-play post-training result. [Learning by watching](https://www.skild.ai/blogs/learning-by-watching), [Physical self-play](https://www.skild.ai/blogs/physical-self-play) | That data generation without fresh filming needs no base model, robot grounding, simulation fidelity or evaluation. |
| **Pi API beta** | PI announced an upload/fine-tuning/hosted-inference workflow on 13 October 2026. [Announcement](https://www.pi.website/blog/api-beta) | Universal access, acceptance of arbitrary browser logs, a verified schema adapter, or permission to use any third-party dataset. |
| **Apple EgoDex** | The research pairs egocentric video with calibrated hand/finger tracking. Its repository documents frames, confidence, generated-language errors and a separate dataset license. [Research](https://machinelearning.apple.com/research/egodex-learning-dexterous-manipulation), [Repository](https://github.com/apple-aiml-research/ml-egodex) | That an ordinary phone reference has equivalent pose quality, or that public availability implies unrestricted commercial reuse/derivatives. |
| **UMI** | The project uses handheld grippers and a designed action/policy interface, including relative trajectories and latency considerations, to bridge portable demonstrations and robot policies. [UMI](https://umi-gripper.github.io/) | Hardware-free recovery of all those channels from arbitrary household clips. |
| **Scale** | Its manipulation-captioning report emphasizes correct action, object and destination together; visually plausible language can still name the wrong object. [Captioning research](https://labs.scale.com/blog/path-to-large-scale-dense-video-captioning) | That caption fluency or semantic similarity alone is a quality gate. |
| **MimicGen** | It expands a small collection of demonstrations into new task configurations and evaluates learned policies. [Project](https://mimicgen.github.io/) | That every generated motion succeeds, that new physical skills appear without supporting data, or that our deterministic controller is the learned policy in that work. |
| **Isaac Lab Mimic / GR00T workflow** | Official documentation describes annotated object-relative subtasks, transformed trajectories, execution and success filtering; supplied recordings allow a tutorial without collecting fresh demonstrations. [Mimic documentation](https://isaac-sim.github.io/IsaacLab/main/source/features/imitation-learning/teleop_imitation.html), [NVIDIA workflow](https://developer.nvidia.com/blog/building-a-synthetic-motion-generation-pipeline-for-humanoid-robot-learning/) | A laptop-native replacement for Isaac's supported compute stack or a ready importer for TeachTrace's current records. |
| **RoboCasa365** | It combines diverse kitchen tasks, interaction skills, mobile embodiments, automated generation and systematic policy evaluation. [Official project](https://robocasa.ai/) | That decorative cupboards in a browser are interactive or that a stationary tabletop arm can perform mobile household work. |

These sources support the opportunity to improve data operations. They also establish that the surrounding infrastructure is already competitive. **micro1 flow is a particularly close reference**; cloning its appearance would not establish an advantage.

### An important correction to the Pronto narrative

The evidence supports saying that Pronto **publishes terms contemplating household recordings for AI-related uses**. Its public FAQ uses a narrower description. Neither page identifies a frontier robotics recipient or demonstrates a model trained on these recordings. TeachTrace should not present a fictional Pronto integration, assume commercial access, or say that its users' homes are training a named lab's robots.

Use an owner-created reference, a purpose-permitted licensed seed, or a clearly authored synthetic task. A future collection partner would need to specify the actual media/metadata contract and permitted use. This is a product-design requirement, not a claim that a consent checkbox in a demo grants rights to a commercial corpus.

## The frontier-AI role: several different layers

There is a useful distinction between a model that reasons about a task and a model that outputs robot-control actions.

Google DeepMind's current robotics materials separate embodied reasoning from lower-level action execution. PI's Hi Robot work similarly uses high-level language reasoning with a lower-level VLA and studies synthetic interaction labels. These are research precedents for a layered architecture; they do not turn our planner into those robot policies. [DeepMind embodied reasoning](https://deepmind.google/models/gemini-robotics/embodied-reasoning/), [Hi Robot](https://www.pi.website/research/hirobot)

| Layer | What an AI company needs | TeachTrace today | Proposed next integration |
| --- | --- | --- | --- |
| Perception / reference interpretation | Objects, interactions, uncertainty, time, calibration where required | A selected reference plus a bounded reviewed scene proposal | Review measured versus inferred fields; add temporal annotation and evidence links |
| Task reasoning | Correct goals, exceptions, object identity, ordering and recovery | Exact task assignments and human/model/baseline plan comparison | Versioned task graphs, correction benchmarks, explicit abstention tests |
| Low-level policy | Embodiment-specific observations/actions at the required frequency | A deterministic kinematic executor, not a learned policy | One validated simulator/policy adapter with a real control contract |
| Evaluation | Frozen tasks, independent checks, held-out cases, reproducible failures | Controller/task checks and recorded attempts | Broader scenario distributions and independently reviewed held-out suites |
| Data operations | Lineage, quality decisions, distribution, consumer validation | Native evidence export, integrity validation, local durable review/report workflow | Recipient-specific adapters and accepted consumer trials |

The first plausible customer is a **small robotics data or evaluation team** preparing household task cases, rather than a frontier lab buying unlimited browser trajectories. A lab might value well-specified failure cases, corrected semantics or coverage reports before it values our motion records. That willingness to pay remains a hypothesis.

PI's beta is now a concrete possible future destination: it describes customer data upload, managed fine-tuning and hosted inference. Before attempting it, obtain access and agree the embodiment, observation/action schema, dataset rights and evaluation contract. The beta announcement does not make today's native evidence a suitable upload. [Pi API beta](https://www.pi.website/blog/api-beta)

## Can useful samples be generated without recording a new person every time?

**Yes, for defined kinds of samples. No, if “sample” silently means a new measured human demonstration or a proven robot-training episode.** Keep four outputs separate.

| Output | Can reuse an existing seed? | What is new | What remains missing |
| --- | --- | --- | --- |
| Task/evaluation variant | Yes: an approved task and supported scene are enough | Initial placement, distraction, routing exception or interruption case | Real human motion, contact physics, low-level training usefulness |
| Synthetic language annotation | Yes: permitted existing observations and reviewed task labels | A paraphrase, correction, hypothetical instruction or subtask label | Independent evidence that the generated label is correct |
| Simulated robot trajectory | Yes, with a suitable simulator/controller and compatible source | A newly executed trajectory under declared simulated conditions | Real-world validation and any sensor/control channels not recorded |
| New physical human/robot demonstration | No: replaying or transforming old data does not make a new measurement | New capture from a person/robot | Nothing substitutes for that fresh measured interaction when it is required |

### Route A — the laptop path TeachTrace can implement first

Start from one frozen, approved household task. Generate supported initial-state variations, run candidates through the existing controller, retain actual checks and failures, and export the tested cases with their lineage. This can run without filming another clip or making another paid model request if a deterministic candidate is reused.

The current repository already has household task definitions in [workplace-cases.ts](../src/sim/workplace-cases.ts), explicit custom tasks in [scene-spec.ts](../src/sim/scene-spec.ts), candidate evaluation in [candidate-plans.ts](../src/sim/candidate-plans.ts), and seeded regression cases in [evaluation.ts](../src/sim/evaluation.ts). A general seed-expansion UI and manifest should be considered proposed until its implementation and browser checks are recorded.

An initial supported transformation set should be deliberately small:

1. Rearrange movable objects among declared, nonoverlapping reachable source slots.
2. Preserve object IDs, goal assignments and protected-reference states unless the operator explicitly approves a new task revision.
3. Add a declared capacity/reach refusal case as an expected negative test.
4. Schedule a software human-presence interruption at a documented controller phase.
5. Optionally change task wording while retaining the same immutable goal contract; evaluate wording changes separately from geometry changes.

A new kitchen color scheme or camera angle is **visual variation**. It does not count as a new manipulation skill or broader task coverage. In the current controller, successful placements arise from its declared kinematic primitives. The useful result is evidence about task logic and recovery under those changes.

### Route B — augment permitted structured demonstrations

MimicGen provides a stronger research precedent for multiplying demonstration coverage. Its object-relative approach reuses subtask segments across new placements. Isaac Lab's tutorial supplies recorded demonstrations and annotates/transforms them before execution and success filtering. This directly supports the claim that **a developer need not record a new demonstration for every generated trajectory**. [MimicGen](https://mimicgen.github.io/), [Isaac Lab Mimic](https://isaac-sim.github.io/IsaacLab/main/source/features/imitation-learning/teleop_imitation.html)

The conceptual object-relative transform is:

```text
new end-effector pose(t)
  = new reference-object pose
    × inverse(seed reference-object pose)
    × seed end-effector pose(t)
```

All transforms must have compatible frames and units. A transformed path can still fail reach, joint, collision or contact constraints. It must be executed and checked, rather than marked successful because a matrix multiplication worked. The current TeachTrace engine stores a much narrower kinematic representation; it should replan its supported primitive from the new source state, rather than pretend it has implemented general 6-DoF demonstration retargeting. [Official Mimic transform implementation](https://isaac-sim.github.io/IsaacLab/v2.2.1/_modules/isaaclab_mimic/datagen/data_generator.html)

Isaac's documented workflow is Linux-based, and its example parallel-generation settings assume substantial GPU resources. Treat this as a separate validated pilot or remote worker, not a critical dependency on the owner's M4 Pro laptop. Pin a supported version and prove one complete generated episode before discussing scale. [Supported workflow and compute examples](https://isaac-sim.github.io/IsaacLab/main/source/features/imitation-learning/teleop_imitation.html)

### Route C — generate annotations and interaction tests

Existing demonstrations can support hypothetical user instructions, corrections, protected-object exceptions and subtask labels. PI's Hi Robot research supplies a precedent for synthetic prompts/interjections paired with existing observations and skills. This is especially relevant to a voice copilot: the generated examples can test whether an instruction changes the correct goal or recovery behavior. [Hi Robot](https://www.pi.website/research/hirobot)

Generated annotations remain proposals. Scale reports object/destination grounding as a practical source of errors even when the action language looks plausible. Use exact object/destination checks and independent review, not a fluent explanation or the same model's unsupported self-score. [Scale manipulation captioning](https://labs.scale.com/blog/path-to-large-scale-dense-video-captioning)

Existing data is not automatically reusable for every purpose. EgoDex's repository specifies **CC-BY-NC-ND** terms for its dataset, separately from code licensing. Record the license/version and confirm that the intended use is permitted before deriving or distributing artifacts; choose an owner-controlled seed when the scope is unclear. [EgoDex license statement](https://github.com/apple-aiml-research/ml-egodex)

### Route D — a later learned-policy rollout or self-play loop

Skild's September 2026 self-play announcement illustrates another route: an existing capable model creates interactions in simulation and improves through a post-training procedure. That is different from generating more labels or transforming a seed. It requires a policy, meaningful observations/actions, an environment, rewards and evaluation. It is a company-reported result on its system, not an outcome reproduced here. [Skild physical self-play](https://www.skild.ai/blogs/physical-self-play)

TeachTrace currently has a deterministic kinematic controller. Running it repeatedly is not reinforcement learning or self-play. A future policy experiment must detect reward shortcuts and preserve a held-out evaluation that the data-generation process cannot rewrite.

### When fresh capture is still needed

Collect more data when the desired task requires unseen physical behavior, force/tactile channels, a new embodiment, a new real environment distribution, or failure/recovery behavior absent from the existing support. A synthetic variant can help specify **which missing example to collect**; it cannot manufacture an observation of friction, deformation or contact that was never measured or modeled.

This is the proposed data loop: **reuse what is supported, evaluate it, identify a specific gap, request targeted new evidence, review it, then expand again**. Endless resampling of easy successful cases is not an equivalent improvement loop.

## Proposed end-to-end data contract

The design below extends the existing native evidence format; fields are a roadmap, not an assertion that every one is already stored.

```text
Permitted source or approved authored task
   ↓ source ID / rights scope / capture type / hash / selected time range
Reviewed semantic task
   ↓ exact objects + goals + protected items + supported capabilities
Frozen seed revision
   ↓ scene hash + task hash + controller version + declared distribution
Generated candidates
   ↓ seed lineage + transform + random seed + expected outcome
Validation and execution
   ↓ schema → geometry → controller → independent task checks
Review and curation
   ↓ accepted / rejected / abstained, with reason and reviewer record
Consumer-specific handoff
   ↓ native task package today; validated training adapter only after its gate
Evaluation feedback
   → request the missing cases rather than filming everything again
```

| Record | Required meaning | Failure to prevent |
| --- | --- | --- |
| `sourceKind` | Distinguish authored task, human video, robot demonstration and simulated episode | Synthetic records counted as new human recordings |
| `sourceArtifactHash`, `sourceTimeRange` | Identify permitted input and selected interval when media exists | A generated scene falsely presented as measured reconstruction |
| `fieldOrigin` | Observed, operator-confirmed, model-inferred or simulated | Guessed depth/actions silently promoted to ground truth |
| `seedId`, `seedRevision`, `parentRunId` | Preserve the exact ancestor of each generated case | Losing the relation between one seed and many correlated variants |
| `taskHash`, `sceneHash` | Freeze task semantics and initial geometry | A model improving its score by editing the task it is graded on |
| `transform`, `seed`, `generatorVersion` | Record the actual variation applied | Unreproducible “random” success claims |
| `controllerOrPolicy` | Name implementation/checkpoint and action meaning | A scripted primitive advertised as learned behavior |
| `expectedOutcome` | Identify positive and intentionally refused tests | Reach refusals counted as completed household work |
| `observedOutcome`, `taskChecks` | Preserve what execution and acceptance actually found | A completed wrong movement presented as task success |
| `review`, `usageScope` | Record decisions without fabricating reviewer identity or rights | A checked box treated as proof of ownership or safe deployment |

For a later training adapter, add synchronized observation/action records, robot embodiment and joint ordering, units, coordinate frames, camera calibration, termination/truncation semantics and required modalities. A natural-language `move object to tray` tool call is not a joint-action vector. UMI's action interface and EgoDex's calibration/confidence metadata illustrate why those distinctions matter. [UMI](https://umi-gripper.github.io/), [EgoDex repository](https://github.com/apple-aiml-research/ml-egodex)

## Mobile manipulation: the correct expansion boundary

A household robot often has to approach a counter, choose a reachable stance, grasp an item, carry it, and place it at another station. A static arm can address only part of that sequence. Generalist has publicly shown a mobile-manipulation deployment example; RoboCasa supports mobile embodiments and distinct navigation/manipulation skills. [Generalist mobile demo](https://generalistai.com/blog/the-real-breakthrough-behind-our-gtc-demo), [RoboCasa](https://robocasa.ai/)

Recommended capability ladder:

| Stage | Executable contract | Gate |
| --- | --- | --- |
| Current tabletop | Supported pick/place, protected objects, explicit human-proxy hold/resume | Actual controller/check evidence |
| Station-level task graph | Sequence named stations/skills; identify a required navigation capability | Missing skills are rejected, not animated as if executed |
| Mobile simulation pilot | Base pose/actions, map, traversability, planning, manipulator reach and station frames | Closed-loop base+arm execution with collision/termination tests in a capable backend |
| Policy experiment | A specified policy consumes its actual sensors and outputs bounded compatible actions | Held-out scenes/tasks and reproducible baseline/augmentation comparison |
| Real deployment | Partner hardware, calibrated sensing, hardware controls and deployment-specific safeguards | Separate measured hardware evaluation |

Moving a person marker is not human-motion capture. Moving a rendered robot base along a line is not navigation. Decorative sinks and cupboards are context; they should become interactive capabilities only when their states, actions and checks exist.

## What to measure

### Operational value first

Measure the job the proposed customer would use: **produce a correct, reviewable task case and identify useful failures**.

| Metric | Definition | Interpretation |
| --- | --- | --- |
| Semantic correctness | Exact object count/identity/destination/protected-item agreement against an independently reviewed task | Quality of the reference-to-task interpretation |
| Review effort | Measured wall-clock review time and number/type of corrections | Workflow cost, not guessed time saved |
| Unique generated cases | Deduplicated scene+task hashes, with parent seed counts reported | Coverage expansion, not independent human evidence |
| Schema validity | Valid candidate plans / attempted candidate plans | Contract compliance, not task success |
| Controller completion | Completed executions / valid attempted plans | Executor behavior under declared simulation conditions |
| Task acceptance | Accepted tasks / all attempted candidates, with invalid/refused cases shown separately | End-to-end decision outcome |
| Protected-object violation | Attempts that changed any protected record / applicable attempts | Exception handling in this task representation |
| Refusal quality | Correctly matched expected refusal cases and unexpected refusals separately | Regression behavior, not completed work |
| Interruption recovery | Correct hold, unchanged state, no auto-resume, explicit recovery completion | Software scenario behavior, not certified human-robot safety |
| Consumer load rate | Packages actually parsed/verified by the named versioned consumer / tested packages | Distribution compatibility only |
| New-capture requests | Specific unsupported cases identified and later resolved by additional evidence | Whether the loop guides collection rather than merely creating volume |

Keep schema-invalid, controller-refused, controller-completed/task-rejected, and task-accepted counts separate. If a regression has six completed tasks and three expected refusals, “9/9 matched expected outcomes” is accurate; “nine tasks completed” is not.

Compare candidates on the same frozen scenes and report paired case-level results. Split related source recordings/households and seed families before creating train/test variants. Frames or transformed siblings from one source should not appear on both sides and be called independent generalization. Show small-sample counts; add uncertainty intervals in a real pilot rather than inventing significance from a polished demo.

### Training benefit is a different experiment

A credible later experiment compares a fixed policy/training recipe on: original permitted demonstrations; the same source plus generated data; and, if feasible, an equal-budget fresh-data comparator. Keep held-out scenes, compute, tuning budget and evaluation protocol fixed. Report task-wise successes/failures and domain-gap limitations. A successful importer or a larger dataset does not establish improved learning.

Do not copy the performance numbers of PI, Generalist, NVIDIA or MimicGen into TeachTrace's results. Their models, sensors, data scales and protocols differ.

## Hackathon differentiation and demo

No research can guarantee a win, and an internal rubric is not an organizer scoring sheet. The strongest evidence fits the supplied track's complete employee workflow while giving judges a visible failure/recovery story.

**Recommended headline:** “A voice-operated quality and evaluation console for household robot tasks.”

**Recommended operator persona:** a robotics data collector or QA engineer preparing reusable household task cases.

Demonstration sequence:

1. Open a household work brief: two used cups go to the sink-side rack; a reserved bowl stays untouched. Show the task and protected object before any motion.
2. Speak the supported task through the real Agora/Murf path. Retrieve the actual assignment and let the operator approve its exact actions.
3. Execute visibly. During a held-object transfer, introduce the person scenario; show the frozen clock/pose. Clear it and require explicit Resume.
4. Show the completed recording, actual checks, persistent submission/report and native evidence verification.
5. Compare a deliberately wrong human plan and a baseline or explicitly requested model on the same frozen task. A movement can complete while acceptance fails.
6. If the seed-expansion feature has been implemented and verified, generate a bounded batch from the approved seed, show actual accepted/rejected cases, and explain why these are simulated tests rather than new human recordings.

The impressive moment should be **a mistaken interpretation caught and preserved**, followed by a defensible next action. Voice is useful for task briefing, correction, approval, interruption and truthful progress announcements while the employee watches the work. It should not be presented as an unused microphone bolted onto a 3D animation.

Compared with existing tools, proposed advantages to test are: laptop-accessible setup; a narrow household task vocabulary with transparent limitations; direct execution of reviewed goals; paired model comparisons; failure-preserving lineage; and a complete voice-to-report workflow. Each is a hypothesis until a user comparison demonstrates its value.

## First customer hypothesis and pilot

Start with a robotics demonstration or QA team that already possesses permitted recordings and clear task requirements. Ask it to supply a small set of representative references, its current review process, and a specific consumer for the output. The experiment is whether a second engineer can understand the approved goals, reproduce a failure, and select a useful next collection task with less rework.

Compare the same assignments using the team's existing tools and TeachTrace. Measure semantic corrections, review duration, reproducibility, consumer-load success and whether the resulting failure request leads to relevant additional evidence. Ask which part is sufficiently painful to pay for; do not infer willingness to pay from an attractive simulation.

A collection company might use this workflow, build it internally, or already have an equivalent. A frontier lab might want only the resulting cases rather than another dashboard. Those alternatives should influence the integration and pricing hypothesis. No buyer interview, procurement result or cost saving is claimed by this research.

## Small research-to-feature tasks

All unchecked tasks below are proposals. Existing implementations are references, not an assertion that the entire proposed data loop is complete.

| ID | Small task | Acceptance evidence |
| --- | --- | --- |
| DF-01 | Name the first user and job in the UI copy | A collector/QA operator and the resulting task record are explicit |
| DF-02 | Display the household brief and protected objects before execution | Reviewer can inspect every assignment without starting motion |
| DF-03 | Distinguish authored synthetic task from selected media reference | Source category survives export |
| DF-04 | Hash the permitted source file locally when a reference exists | Identical input yields the same hash; no raw file is silently uploaded |
| DF-05 | Retain selected frame timestamp and capture mode | Export links the reviewed interpretation to its actual source interval |
| DF-06 | Mark source-derived versus model-inferred fields | Unknown geometry/depth is never shown as measured |
| DF-07 | Freeze a reviewed task hash | Candidate plans cannot edit their own goal contract |
| DF-08 | Freeze an initial scene hash | Every comparison can prove the same starting snapshot |
| DF-09 | Save a stable seed ID/revision | A later run names its exact parent |
| DF-10 | Implement one seeded supported-slot permutation | Same seed/revision reproduces positions and goals |
| DF-11 | Reject overlapping/out-of-bounds variants before execution | Invalid layouts get a reason and no fake run |
| DF-12 | Preserve protected references during source-layout variation | Protected object record stays byte/semantically unchanged |
| DF-13 | Add a reach-refusal variant with an explicit expected outcome | Refusal is counted separately from completed work |
| DF-14 | Add an occupied-tray variant | Real controller returns its actual capacity refusal |
| DF-15 | Add a phase-triggered human-proxy interruption | Recorded hold and explicit recovery are inspectable |
| DF-16 | Run a small free baseline batch | Results come from actual controller calls; no paid model loop |
| DF-17 | Record model IDs and request timing for optional paid comparisons | Only actual invoked models receive result rows |
| DF-18 | Keep wrong-reference actions in candidate execution | Failed acceptance is shown rather than silently repaired |
| DF-19 | Deduplicate cases by task+scene hash | Cosmetic duplicates do not inflate unique coverage |
| DF-20 | Export a batch manifest with parent/transform/seed/version | Consumer can reproduce one selected variant |
| DF-21 | Retain failed and invalid cases in batch totals | Counts reconcile with attempted cases |
| DF-22 | Add a failed-check filter | Operator can find protected-item, destination and refusal failures |
| DF-23 | Create a targeted collection-request record | Request describes the missing capability/evidence, not “more data” |
| DF-24 | Define a held-out seed-family split | Related variants cannot leak across the split |
| DF-25 | Add a second reviewer disagreement field | Corrections/abstentions remain visible |
| DF-26 | Measure task review duration prospectively | Report uses recorded wall time and a declared protocol |
| DF-27 | Pin one potential consumer's action/observation schema | Required units/frames/channels are documented |
| DF-28 | Run one native package through an independent consumer | Import count/checks are observed, not inferred from file extension |
| DF-29 | Select a purpose-permitted structured demo seed for a physics pilot | Version/license/use scope are recorded before reuse |
| DF-30 | Prove a single physics-backed generated episode remotely | Its actual control/sensor records reload through the chosen reader |
| DF-31 | Compare source-only versus augmented training with a fixed recipe | Held-out task results, failures and uncertainty are reported |
| DF-32 | Document the boundary before adding navigation or cupboards | Unsupported requests refuse until real capabilities/checks exist |

Do not expand into a full collection marketplace, foundation model, physics engine and fleet system at once. First prove that another engineer can reuse one reviewed task, reproduce a failure, and decide what evidence is missing.

## Evidence review of this document

- Public company claims are attributed; scale/performance marketing is not treated as independent measurement.
- Pronto's conflicting public descriptions are disclosed, with no guessed commercial recipient.
- A real Pi API beta is acknowledged without claiming entitlement or accepted data compatibility.
- Existing competing review platforms are named; broad platform novelty is not asserted.
- Reusing seeds is separated from new measurements and demonstrated policy-learning benefit.
- Decorative room geometry, scripted human presence and stationary manipulation are not upgraded into physics, tracking or mobile autonomy claims.
- Proposed metadata/features are separated from current repository modules and recorded release evidence.
- Detailed implementation/evaluation boundaries remain in [HUMAN_DEMONSTRATION_BRIDGE.md](HUMAN_DEMONSTRATION_BRIDGE.md), [PHYSICAL_AI_RESEARCH.md](PHYSICAL_AI_RESEARCH.md), and [PHYSICAL_AI_EVALUATIONS.md](PHYSICAL_AI_EVALUATIONS.md).

## Implementation evidence added after the research pass

The seed-expansion UI is now implemented in `VariationLab` and `data-variations.ts`. An isolated real-browser run generated and exported **100 actual controller cases: 60 accepted task completions and 40 expected reach/human-occupancy refusals, with zero provider requests**. This is a controlled software regression campaign, not a policy-quality or data-efficiency result. Every variation includes its exact initial/final scene, seed, task, actual outcome, and compact timestamped arm-state samples. Sampled joint angles and link coordinates are derived from the same analytic kinematics used by the renderer; they are not measured motor telemetry. The exported count is correlated scene variation, not 100 independently recorded human demonstrations.

The mobile controller and capability comparison are also implemented and tested at the engine level. Both capability conditions use the same initial scene, target and arm reach. Removing navigation makes the fixed-base controller fail its reach check; allowing navigation lets the mobile controller reposition, recheck, collect, carry and place. Runtime UI/voice acceptance remains a separate release gate until its own results are recorded.
