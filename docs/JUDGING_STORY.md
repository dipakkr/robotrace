# TeachTrace: problem, workplace fit and defensible impact

**A voice-operated task and evidence console for a household robotics team.**
The employee is a robotics data collector or evaluation engineer. Their output
is a reviewed task/attempt record that a teammate can inspect and reproduce.

## The problem

“Take the cup to the sink” leaves operational questions: which object, which
surface, whether the arm can reach, what must remain untouched and what to do
when a person interrupts. A robot animation does not answer those questions or
make its coordinates suitable training data.

TeachTrace connects the instruction, scene, exact plan, observed states, checks,
review and saved report. It makes useful failures visible before a team spends
more on physics or hardware experiments. A voice interface keeps the engineer
focused on the scene; retrieved context and tools make the request actionable.
Time saved, customer demand and learning improvements still need measurement.

The household is the task domain; the console operator is an employee. The
workplace workflow is preparation, simulation, QA, curation and evidence handoff.
It does not claim that a physical household service was performed.

## Fit to the supplied hackathon track

The [Build with Agora brief](https://www.commudle.com/communities/knotic/events/build-with-agora-blr)
asks for natural voice, enterprise knowledge, meaningful tool/API actions,
confirmation and follow-up, and permits workplace cases beyond its examples.
The organizer decides eligibility/scoring; our internal checklist is not their rubric.

| Stage | TeachTrace implementation | Boundary |
| --- | --- | --- |
| **Initiate** | Employee voice uses Agora Conversational AI/RTC, configured LLM and Murf Falcon output. | A real prerecorded mobile run completed five skills and captured remote audio. Human microphone/listener acceptance remains separate. |
| **Understand** | Tools retrieve current world/object/destination state and applicable task guidance. Workcell assignments include locally authored SOPs and acceptance rules; approved custom scenes supply their declared task. | These are local sample/operator-reviewed records, not a claimed external enterprise connector or RAG deployment. |
| **Execute** | Tool calls run actual bounded arm or mobile navigate/reach/handling controllers. The local evidence API performs a persistent write and returns a report. | Symbolic planning and software state changes are real; no learned low-level motor policy or physical robot action is implied. |
| **Confirm** | Exact motion plan appears in Review; optional reversible motion has a cancellable countdown. Mobile evidence freezes for explicit **Approve & save mobile evidence**. | Reset, scene application and evidence submission stay explicit. Approval never changes a stopped/failed outcome into success. |
| **Follow up** | Mobile records/report persist through the API, appear in Saved recordings and reopen in verified read-only replay. Workcell submission also updates its local assignment. Native packages and a standalone consumer support inspection. | The service independently checks recorded geometry/history; it does not authenticate origin or replay physical motion. No upload to a frontier lab is claimed. |

The mandatory path uses **Agora Conversational AI + RTC, Murf Falcon, an LLM and
tool calling**. It does not need every optional integration in the technology
list. Authenticated HTTP tools implement the current connection; no nonexistent
MCP connector or outside ticketing system is implied.

## What makes the demo more than voice-controlled animation

**Reach changes the executable plan.** Cup begins beyond stationary arm reach.
The mobile base must navigate, recheck actual reach, collect, carry and release.
The fixed/mobile comparison starts from the same scene and changes navigation
availability while retaining reach and handling. A blocked route or a pickup
still beyond reach fails rather than teleporting the object.

**Execution and task success are separate.** A wrong destination can finish
mechanically but fail the assignment. A protected Bowl can be picked up and
returned to its exact original pose and still fail the task at the true handling
step. The reported candidate is preserved; the evaluator does not silently repair it.
One actual gpt-4o-mini UI request returned a five-action plan that passed, with
2797.58 ms measured provider time. That is a smoke result, not a model ranking.

**The follow-up is a durable record.** Mobile review/save QA used two actual HTTP
201 saves: a completed accepted attempt and a stopped attempt retaining cargo
that stayed unaccepted. A simulated unavailable service left the frozen digest
available for export and retry. Reopening verified the seal, replayed real
states and preserved the live world. The final combined real-provider rehearsal
also passed: prerecorded voice executed five steps, explicit review saved a
report, and actual received speech confirmed saved/passed status. A fresh browser
reopened that exact record and its export passed the standalone consumer.
See [validation](VALIDATION.md); human microphone/hearing remains separate.

**Generated cases retain their relationship.** The rehearsed after-meal source,
seed 42/count 100, produced 60 accepted and 40 expected refusals with zero
unexpected outcomes. These are correlated synthetic tests. Loaded child records
retain parent fingerprint, seed, index and kind, allowing the consumer to keep
siblings grouped despite different geometry. The lineage is declared and
unverified, not an authenticated dataset history or a performed train/test split.

## Value and limits for an AI/robotics company

The concrete handoff contains a task contract, reproducible source/child scene,
recorded outcomes and events, derived joint/link/TCP/gripper/object states, units,
simulation limits, checks and human review status. The Node-only consumer verifies
SHA-256 and additive FK, excludes same-clock target pairs and writes JSONL
observations plus **next-observed-state targets**. Another program can inspect it
without running the application.

This can support regression, candidate-plan evaluation, curation and debugging.
The exported targets are not requested actuator commands or calibrated learning
actions. There is no claimed LeRobot/RLDS adapter, real-sensor stream, force data,
recipient ingestion, policy training, learning gain or sim-to-real improvement.
A learning claim needs the recipient's actual embodiment/observation/action
contract, suitable rights, a validated importer, a training recipe and a held-out
experiment. No frontier-lab partnership or automatic transfer endpoint is promised.

Photo/video-frame authoring retains a fingerprint of the exact submitted resized
JPEG and selected-frame time. Calibration and rights verification are false; raw
media/filenames are not stored in the world. It does not reconstruct calibrated
geometry, track continuous worker motion or substitute for a data-collection rig.

## Research and product context

These primary sources informed the problem and boundaries. They are not customers,
partners, evidence of a hackathon win, or proof that TeachTrace reproduces their systems.

| Source | Relevant distinction |
| --- | --- |
| [Sunday Robotics technology](https://www.sunday.ai/technology) | Household collection involves a concrete sensing/hardware/process system; a selected phone frame is not equivalent. |
| [Physical Intelligence: human-to-robot research](https://www.pi.website/research/human_to_robot) | Human/robot transfer requires appropriate representations, robot data and training/evaluation; rendering a room does not establish transfer. |
| [MimicGen](https://mimicgen.github.io/) | Demonstration expansion has a specific research/training basis; our bounded controller variations are evaluation evidence, not its learning result. |
| [RoboCasa dataset documentation](https://robocasa.ai/docs/build/html/datasets/datasets_overview.html) | Kitchen task families and held-out environments motivate explicit tasks and careful grouping. Published scale/results are not our metrics. |

Full context is in [PHYSICAL_AI_RESEARCH.md](PHYSICAL_AI_RESEARCH.md),
[DATA_FLYWHEEL_STRATEGY.md](DATA_FLYWHEEL_STRATEGY.md),
[HUMAN_DEMONSTRATION_BRIDGE.md](HUMAN_DEMONSTRATION_BRIDGE.md) and
[DESIGN_REFERENCES.md](DESIGN_REFERENCES.md). TeachTrace uses its own implementation
and branding.

## Readiness answer

The laptop controllers, local persistence, review/replay and evidence consumer
work within their declared boundaries. There is real automated provider audio
evidence, with a separate open human microphone/listener gate. Progress speech
was captured and transcribed in a partial audit whose overall delivery wait timed
out; that clip is not a passed full-task run.

This is a bounded prototype, not a production robotics platform. The private
hosted preview is static; full API/voice/records run locally. Multi-user cloud
operations, calibrated physics/sensors, recipient training compatibility and real
hardware validation remain separate gates.

[FEATURE_ACCEPTANCE.md](FEATURE_ACCEPTANCE.md), [VALIDATION.md](VALIDATION.md) and
the [atomic delivery backlog](DELIVERY_BACKLOG.md) separate implemented source,
automated evidence and human acceptance. Stable task IDs are not completed
promises. The [four-minute runbook](DEMO_SCRIPTS.md) finishes the employee's
explicit review/save/report loop before optional extensions.
