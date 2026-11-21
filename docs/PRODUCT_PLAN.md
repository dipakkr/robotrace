# RoboTrace product and delivery plan

Prepared 21 November 2026. This plan distinguishes the current software prototype from the complete hackathon deliverable and later robotics research. Feature descriptions below are a specification; the application and its verification results determine which features are complete.

## 1. Product decision

**RoboTrace is a conversational robot scenario-authoring and testing workbench.** A robotics employee describes a supported workcell and task, reviews the generated scenario, runs a controller, examines the result, and saves the episode. Voice and text share the same validated scenario/action interface.

The initial task family is tabletop sorting and placement involving rigid objects and destination trays. The workcell is the test environment; the employee's complete workflow is **author -> review -> execute -> evaluate -> record/curate**. Demonstration collection is one use of the resulting record, alongside debugging and repeatable controller testing.

### Problem statement

> Robotics teams must turn task descriptions into repeatable scenarios, run robot controllers against them, identify failures, and preserve usable evidence. RoboTrace lets an engineer or collector author a bounded scenario conversationally, review it before execution, and turn the run into an inspectable episode.

The hypothesis is that a shared conversational authoring, execution, and review surface can reduce scene-setup and failure-triage effort. Measure time to first valid scenario, repeatability of reruns, failure identification, and accepted episodes per session. No productivity or model-training improvement has been established by the prototype.

### Primary user and customer

- **Primary user:** a robotics engineer, QA/research technician, or demonstration collector preparing and reviewing controller runs.
- **Reviewer:** a robotics engineer or dataset lead checking scenario validity, failures, and episode annotations.
- **Potential customer:** a robotics/embodied-AI company, research lab, or demonstration-collection provider.
- **Relevant assignment:** construct reproducible tabletop placement scenarios, run a supported controller, and curate the outcomes.

### Operational value for AI and robotics companies

- **Debug failures:** connect a failed action to the scene, command, controller state, and observed outcome at that moment.
- **Repeat controller tests:** preserve scenario definition, seed, task, and controller identity so a later change can be tested under the same starting conditions.
- **Curate episodes:** keep successful, failed, stopped, and corrected attempts distinguishable, with explicit review status.
- **Share test intent:** readable tasks and criteria let a researcher or domain expert review the scenario without editing simulator code.

This is a focused workflow proposal in an existing tooling market. It makes no claim that conversational simulation, episode recording, or synthetic data generation is novel by itself.

### Implementation snapshot and evidence boundary

At the time of this revision, the integrating agent reports a runnable React workcell UI, 15 passing checks, and one real browser run that completed three placements and saved an episode through the local API. The implementation also has a server-side Agora/Murf adapter, but no live voice session has been verified because provider keys are not configured. A four-scenario library is being added.

These are a point-in-time integration report, not permanent production guarantees. Check the latest tests and UI before repeating the numbers. Free-form environment authoring, camera/video import, comprehensive physics, and learned policy improvement are not established by that browser run.

### What the first version proves

1. A supported text or voice brief resolves to a bounded scenario draft and inspectable task plan.
2. A human reviews the scenario, assumptions, and success conditions before it is applied/executed.
3. A robot representation visibly executes supported actions against the current scene.
4. Pause, stop, clarification, and supported changes produce coherent behavior.
5. Task success comes from scene-state checks.
6. An employee can inspect, rerun, save, and curate the resulting episode.

### What it does not prove

- A newly trained robot policy.
- Accurate reconstruction of robot actions from phone video.
- Physical transfer to a real arm.
- Realistic force, contact, friction, or dexterous grasp behavior unless a later physics integration implements and verifies them.
- A general-purpose domestic robot.
- Compatibility with a robotics dataset format merely because a JSON file can be downloaded.

## 2. Hackathon fit and completion gates

The user-provided selected track asks for an employee-facing natural voice assistant with enterprise context, tool/API actions, confirmation, and follow-up. Its technician example is illustrative. The event's public [common technology requirements](https://www.commudle.com/communities/knotic/hackathons/build-with-agora-blr) require Agora Conversational AI, Murf Falcon TTS, action-oriented tools/APIs, and an end-to-end demonstration. Physical robot hardware is not specified as mandatory.

| Requirement | RoboTrace implementation | Evidence required before claiming complete |
| --- | --- | --- |
| Initiate | Employee requests a test scenario or collection assignment through Agora voice. | Actual Agora session joins and exchanges audio. |
| Understand | Assistant retrieves the task brief, supported scene vocabulary, collection/test rules, and success criteria. | Retrieved context is visible and the scenario/plan reflects it. |
| Execute | Tool calls draft/apply the scene, operate the controller, evaluate outcomes, and save episode records. | Validated scenario, action receipts, visible state changes, and a persisted episode. |
| Confirm | Employee reviews the scenario and criteria, resolves ambiguity, and approves final submission or destructive reset. | Review/confirmation is attached to the exact scenario revision or write. |
| Follow up | Test/collection assignment and episode summary update after the attempt. | Counts and outcomes derive from recorded runs; the saved scenario supports a repeat run. |
| Murf Falcon | Assistant audio output is generated by the configured Murf Falcon integration. | Provider configuration and a successful audible response. |

**Local text commands, browser speech recognition, and browser speech synthesis are development controls, not substitutes for the required Agora and Murf integration.** Label these states honestly. A disconnected provider must not appear connected.

MCP is optional unless the organizer's final track rules explicitly require it. A small server tool API is sufficient for the first integration. A rendering-only animation without task context, execution evidence, and follow-up would cover only part of the track.

## 3. MVP task contract

### Scene

- One tabletop workcell and one articulated arm.
- A few rigid objects with stable IDs, readable names, colors, and positions.
- Two named destination trays, for example left and right.
- Robot base, table, trays, and bounded work area.
- Explicit camera presets: orbit, overhead, and robot/inspection view where implemented.

### Firm v1 environment vocabulary

V1 authors **one tabletop workcell**, not an arbitrary home or factory. Its vocabulary is one existing arm, one existing table, supported rigid parts (`cube`, `block`, `cylinder` where rendered/controller-supported), named trays, preset workcell layouts, bounded poses, and supported placement/sorting goals.

Start with the current stable red/blue/green part IDs, tray A, tray B, and the review tray. If a later authoring feature creates more instances or additional names, the planner, capacity checks, controller, renderer, and export must all support them before the UI offers them. A four-scenario library is a useful first authoring surface; it does not by itself establish arbitrary environment generation.

Examples of target supported briefs:

- “Create a tabletop sorting scenario with the red, blue, and green parts and two trays.”
- “Use the collection layout. Put red and green in tray A, blue in tray B.”
- “Keep the same task, but use the next approved object-position layout.”
- “Save this as the baseline, run it, and record whether every part reaches its assigned tray.”

Requests such as “create my kitchen from this description,” “add a humanoid,” “fold this towel,” or “simulate a liquid spill” must produce an explicit unsupported response in v1. The assistant can suggest a supported tabletop approximation for human review.

### Conversational scenario authoring contract

1. Interpret a voice/text brief into a typed **draft**, without mutating the running scene.
2. Validate the draft against the supported assets, layout/pose bounds, object identifiers, tray capacity, controller reach, and allowed goals.
3. Show the human a preview, a readable summary, assumptions/defaults, and concrete success checks.
4. Require human review before applying a generated environment or starting its first run. Capture the approved revision.
5. Apply the scene only when the controller is idle/stopped and unsaved recordings are handled explicitly.
6. Build an action plan tied to that scene revision; reject a stale plan if its scene changed.
7. Execute, evaluate, and record. Subsequent reruns use the saved starting state/seed rather than an approximate recreation.

The draft should be data, never arbitrary code returned by a model. A proposed v1 schema is:

```json
{
  "schema_version": "teachtrace.scenario/1",
  "id": "scenario-id",
  "revision": 1,
  "name": "Tabletop sorting baseline",
  "source": "text",
  "workcell_template": "tabletop-arm-v1",
  "controller_id": "kinematic-pick-place-v1",
  "layout_id": "approved-layout-id",
  "seed": 42,
  "objects": [
    { "id": "part-red", "asset": "block", "color": "red", "pose_source": "layout" },
    { "id": "part-blue", "asset": "cube", "color": "blue", "pose_source": "layout" },
    { "id": "part-green", "asset": "cube", "color": "green", "pose_source": "layout" }
  ],
  "goals": [
    { "object_id": "part-red", "destination_id": "tray-a" },
    { "object_id": "part-blue", "destination_id": "tray-b" },
    { "object_id": "part-green", "destination_id": "tray-a" }
  ],
  "success_checks": ["all_goals_satisfied", "gripper_empty", "no_controller_error"],
  "assumptions": ["Idealized grasp attachment; no contact-force validation"],
  "review": { "status": "draft", "approved_revision": null }
}
```

This is a proposed contract, not a claim that this schema is already implemented. Preset `layout_id` is the first delivery option. User-authored numerical poses may be added only with the same bounds, overlap/capacity, and reach validation. Preserve simulator units explicitly; do not imply measured real-world dimensions.

### Supported goals

- Move an identified object to an identified tray.
- Move a supported set of objects to a tray.
- Sort by a supported object property.
- Return the arm to its home pose.
- Pause, resume, cancel, or stop current execution.
- Reset to the documented initial scene.
- Start/end recording, inspect an episode, annotate it, and export it where implemented.

The current parser may support only specific phrasing. Display example commands and return a useful unsupported-command response. Do not invent a broad natural-language capability from a small rules parser.

### Clarification and validation

- Multiple candidate objects: highlight candidates and ask which one.
- Missing target: ask for the target rather than choosing arbitrarily.
- Unknown object: list supported objects.
- Out-of-bounds/unreachable goal: reject with a reason before movement where possible.
- Busy controller: offer queue, pause, or cancel according to the supported interaction contract.
- Already satisfied goal: report the existing state without fabricating another action.

## 4. Screen and information architecture

The interface should look like a focused robotics workbench. References and their evidence limits are documented in [DESIGN_REFERENCES.md](./DESIGN_REFERENCES.md).

### Desktop shell

| Region | Approximate space | Content and purpose |
| --- | --- | --- |
| Global header | Compact fixed height | Product/workspace, workcell and robot identity, Simulation badge, execution state, recorder state, stop control. |
| Left navigation and scene | About 15–20% width | Scene hierarchy, task assignment, and episode navigation. Selection synchronizes with 3D. |
| Main viewport | About 55–65% width | Robot, table, objects, trays, paths/targets if supported, camera controls, action overlay. This is the visual center. |
| Right command panel | About 25–30% width | Task brief, interpreted plan, assistant transcript, confirmation card, and command entry. |
| Timeline/episode strip | Bottom | Recorded time, action segments, event markers, transport controls, review and export. |

These are design targets, not inflexible pixel requirements. At narrower widths preserve the viewport and command controls first; make scene/episode inspectors collapsible.

### Global status

- Separate **execution state**, **recording state**, and **voice connection state**.
- Always identify the active environment as simulation.
- Use a persistent stop control during execution. A stop is not identical to pause.
- Show actual session/time values. Do not add decorative CPU, network, force, confidence, or battery readings without a data source.
- Keep the user-facing result concise. Detailed tool parameters belong in an expandable inspection area.

### Scene explorer and selection

- Stable object IDs support recording; readable labels support conversation.
- Click an object in either the tree or viewport to select it in both.
- Selected-object details may show object type, world pose, current container, and target.
- Make selection outlines distinct from planned targets and completed placements.
- Preserve contrast between the arm and background so its movement is easy to follow on a projector.

### Mission and assistant panel

- Add a scenario draft/review surface with supported template, layout, task, assumptions, and success checks. A collector can edit or reject the draft before Apply.
- Show the collection brief and success criteria before execution.
- Render the interpreted task and action queue in readable language.
- Highlight the currently executing step.
- Give each step an explicit pending/running/succeeded/failed/cancelled status.
- Maintain a conversational transcript with user, assistant, and action-result distinctions.
- Confirmation cards identify the exact operation and have clear Approve and Cancel controls.
- Text command entry remains usable if microphone permissions or provider connectivity fail.
- Keep microphone state explicit: disconnected, connecting, ready, listening, speaking, or error.

### Episode review

- Show only episodes that were actually recorded; use an empty state initially.
- Include task, initial scene, duration, action count/sample count, termination reason, outcome, and review status.
- Selecting a timeline event reveals the corresponding action receipt and relevant state.
- Review and execution must not mutate each other's state unexpectedly.
- Replay must be labelled replay. It must not masquerade as a new physical attempt or a new provider call.
- An exported local file is labelled **Exported**. **Published** or **Submitted** requires a successful corresponding service write.

## 5. End-to-end user journey

1. **Open workspace.** The robot is in a known home state. Provider and recorder statuses are truthful. The assignment is visible.
2. **Author.** Employee describes a supported environment/task or chooses a scenario template. The system creates a draft rather than silently changing the live scene.
3. **Review.** Inspect generated objects/layout, goals, defaults, and success checks. Resolve ambiguity, then approve the exact revision.
4. **Apply and inspect.** Apply the approved draft, orbit the camera, and select objects. Selection never executes a motion.
5. **Plan.** Validate the task against current scene state and show an action queue. Bind the plan to the scene revision.
6. **Record and execute.** Start a new episode, capture initial state, and run the controller. The UI/recorder consume the same state.
7. **Interrupt or recover.** Pause preserves context; stop prevents further steps; supported retries create traceable actions.
8. **Evaluate.** Check actual object destinations and declared completion criteria. Preserve failed, stopped, and unconfirmed results accurately.
9. **Review episode.** Inspect the attempt, events, samples, outcome, and annotations. Accept, reject, or request another run.
10. **Save/curate.** Save or export the validated record and show its actual receipt.
11. **Follow up.** Update the assignment, summarize results, and offer a repeat test from the same saved scenario or a supported variation.

## 6. State and control model

Use one authoritative engine state. The 3D renderer, status cards, assistant tools, recorder, and success evaluator must not maintain competing versions of object locations.

### Execution lifecycle

```text
Idle -> Planning -> Awaiting clarification/confirmation -> Executing
Executing -> Paused -> Executing
Executing -> Completed | Failed | Stopped
Paused -> Stopped
Completed | Failed | Stopped -> Planning | Reset -> Idle
```

Implementation enums may differ, but transitions must remain explicit. Planning or confirmation can be omitted only when an instruction is unambiguous and the supported action requires no confirmation.

### Scenario-authoring lifecycle

```text
Brief -> Draft -> Validating -> Needs clarification | Reviewable
Reviewable -> Approved revision -> Applied -> Ready for execution
Any edit -> New draft revision -> Revalidation and review
Invalid draft -> Explanation without live-scene mutation
```

Scene review and episode review are separate decisions. Approval of a scenario does not automatically approve its resulting record for a dataset.

### Recorder lifecycle

```text
Off -> Recording -> Review -> Approved | Rejected
Approved -> Exported
Approved -> Submitted only after successful service acknowledgment
```

Recorder state is orthogonal to execution. Pausing the arm does not silently end an episode. Resetting a scene must not silently erase a completed recording.

### Provider lifecycle

```text
Unconfigured -> Configured -> Connecting -> Connected
Connecting | Connected -> Error | Disconnected
```

Missing credentials must produce Unconfigured rather than a simulated success state. Development fallback controls remain labelled local/demo controls.

### Action receipt

Conceptual fields:

```json
{
  "action_id": "unique-id",
  "episode_id": "episode-id-or-null",
  "type": "pick_and_place",
  "parameters": { "object_id": "red-block", "target_id": "left-tray" },
  "status": "succeeded",
  "started_at": "timestamp",
  "finished_at": "timestamp",
  "observed_result": { "object_container": "left-tray", "held": false },
  "error": null
}
```

Do not let the assistant announce success from the command request alone. It must wait for the controller/evaluator result.

## 7. Architecture and integration boundary

```text
Laptop / optional phone client
    |
    +-- React operator console
    |     +-- Scenario brief / draft / review
    |     +-- Scene renderer
    |     +-- Mission / assistant panels
    |     +-- Episode recorder and review
    |     +-- Local development command adapter
    |
    +-- Authoritative workcell engine
    |     +-- Versioned scenario application and reset seed
    |     +-- Scene state and supported action validation
    |     +-- Motion / idealized grasp controller
    |     +-- Success evaluator
    |     +-- Action and recording events
    |
    +-- Voice integration server
          +-- Agora session/token lifecycle
          +-- LLM and task-context retrieval
          +-- Murf Falcon configuration
          +-- Authorized tools to workcell/session/dataset services
```

Add a scenario compiler/validator between natural-language interpretation and workcell mutation. The browser and server must agree on schema/version, allowed assets and goals. The simulator is responsible for actual execution state; a model's text is not execution evidence.

### Agora and Murf

- Use the official integration path supported by the installed SDK/API version; main and preview platform examples should not be mixed blindly.
- Provider keys, Agora app certificate, session-creation credentials, and LLM keys remain server-side.
- The client receives only the short-lived session/token information it needs.
- Tools use structured parameters, return actual results, and enforce supported scene actions.
- Long-running arm movement should return accepted action identity and communicate eventual completion reliably, rather than blocking a synchronous tool request indefinitely.
- Interrupting assistant audio and stopping physical-simulation execution are separate controls. Wire their relationship deliberately.
- Mobile support can initially be a voice client/controller; it does not require phone motion tracking or a wearable.

### Illustrative tools

These are proposed logical operations, not a claim that these exact endpoints already exist:

- `get_task_assignment()`
- `get_scenario_vocabulary()` / `list_scenario_templates()`
- `draft_scenario(brief)` / `validate_scenario(draft)`
- `approve_scenario(scenario_id, revision)` / `apply_scenario(scenario_id, revision)`
- `get_scene_state()`
- `plan_task(goal)`
- `execute_plan(plan_id)`
- `pause_execution()` / `resume_execution()` / `stop_execution()`
- `start_episode(task_id)` / `finish_episode(outcome)`
- `annotate_episode(episode_id, annotation)`
- `review_episode(episode_id, decision)`
- `export_episode(episode_id)` or `submit_episode(episode_id)`

Use action IDs and request IDs to prevent duplicate writes when a network request is retried. Gate scene resets and final submission according to the workflow's confirmation rules.

## 8. Recording and export contract

The first export is a **RoboTrace simulation episode**, with an explicitly versioned schema. It is not automatically a LeRobot or RLDS dataset.

Recommended fields:

- Schema version and application version.
- Episode ID, task ID, original instruction, and normalized plan.
- Simulator/engine identity and whether grasp behavior is idealized.
- Scene asset IDs, initial poses, work-area bounds, and reset seed if applicable.
- Scenario ID/revision, reviewed assumptions, approved goals/success checks, and controller ID/version.
- Timestamped robot state: joints or end-effector pose and gripper state, depending on what the implementation actually provides.
- Timestamped object state and supported control actions.
- Action receipts, interruption events, errors, and collector annotations.
- Completion checks and terminal outcome.
- Review status, reviewer decision time, and export/submission receipt.

Record sampling timestamps and achieved sample counts. Do not advertise a fixed FPS without recording/validating it. If video frames are not recorded, say so; rendered scene replay is not a camera-video recording.

Later dataset-format compatibility requires actual field mapping, metadata, sample/video encoding, and loading validation in the target tooling. Real-world training value requires an evaluation that goes beyond successful JSON export.

## 9. Delivery phases

### Phase A — Runnable visible prototype now

- Coherent operator console and scene.
- One arm, simple objects and trays.
- Supported text commands and visible plan execution.
- Pause/resume/stop/reset with consistent state.
- Result checks, event log, and local episode export where implemented.
- Provider configuration status and an honest integration boundary.
- Four supported scenario-library entries, subject to implementation and verification.

**Exit gate:** a selected object moves to a selected tray; actual state verifies success; a recorded attempt exports; pause/stop and one invalid command are demonstrated.

### Phase B — Bounded conversational scenario authoring

- Typed scenario schema and vocabulary endpoint.
- Text briefs mapped to a template/layout/goal draft using deterministic interpretation or a configured model.
- Validation and a human review/Apply step before scene mutation.
- Versioned saved scenarios, repeatable resets, and plans invalidated when their scene revision changes.
- The same scenario-authoring tools available to the live voice adapter when configured.

**Exit gate:** an employee describes a supported workcell/task, reviews it, applies it, runs it, and saves an evaluated episode; an invalid draft cannot mutate the scene.

### Phase C — Required live voice integration

- Server-side secrets and token/session lifecycle.
- Real Agora microphone input and conversation.
- Murf Falcon spoken output.
- Task brief retrieval and structured tools invoking the same workcell engine.
- Confirmation and provider/tool-error handling.
- Repeat the complete demo with real voice.

**Exit gate:** the selected track can be demonstrated start-to-finish through the required providers, with actual actions and inspectable records.

### Phase D — Durable testing and collection workflow

- More complete annotation/review UI.
- Durable assignment and episode service.
- Accurate episode replay and optional camera recording.
- Narrow supported scene variation generation.
- Measured manual-versus-assisted collection comparison.
- Compare controller runs with the same scenario/seed and retain failed attempts for debugging.
- Operational hardening gates below before production claims.

### V2 — Camera/video-assisted scene suggestions

V2 may accept a phone image or short video as an additional brief. The output is an **approximate, editable scene suggestion** expressed in the same bounded vocabulary: candidate objects, rough arrangement, task steps, and uncertain relationships.

- Use a deliberate upload/capture step; recording should not begin silently.
- Keep the source media and its interpreted suggestions linked in the review surface.
- Ask the human to confirm object identity, supported asset mappings, layout, task intent, and critical dimensions if they are available.
- Represent uncertainty explicitly. If the source does not show an object or relationship clearly, ask or omit it.
- Do not infer accurate metric dimensions, camera calibration, grip forces, friction, contact behavior, robot joint trajectories, or a physically faithful digital twin from ordinary video.
- A reviewed suggestion becomes a normal versioned scenario. It follows validation and approval before execution.
- Unsupported household objects can be mapped to reviewed rigid proxies; that approximation must remain visible in metadata.

**Exit gate:** a supplied clip yields a reviewable supported scenario suggestion with provenance, editable assumptions, and no scene mutation until approval. Evaluation must include cases where the system admits insufficient evidence. This feature is not required for the first hackathon run.

### Later — Physics and learning, only if independently justified

- Integrate a contact physics engine and validate controller behavior.
- Verify real grasp, collision, and stable-placement criteria.
- Add a target robotics dataset format with loading tests.
- Train or fine-tune a small policy and evaluate held-out scenes if claiming policy improvement.
- Assess sim-to-real transfer separately; it is not established by a successful simulator demo.

## 10. Three-minute demonstration script

Use current supported object names and commands. This script is a target acceptance journey, not a claim that every interaction exists today.

| Time | Interaction | Evidence on screen |
| --- | --- | --- |
| 0:00–0:25 | Explain the robotics employee's assignment and describe/select a supported scenario. | Task brief, scenario draft or library, simulation badge. |
| 0:25–0:50 | Review/apply the scenario and request the placement/sorting test. | Objects/layout, goals, checks, approved revision, readable action queue. |
| 0:50–1:20 | Start/observe execution. | Arm reaches, grasp state changes, object moves; active step follows movement. |
| 1:20–1:45 | Pause or introduce one supported change. | Controller stops coherently, assistant acknowledges and explains next step. |
| 1:45–2:10 | Resume/finish; try one invalid or ambiguous request. | Scene checks determine completion; unsupported request causes a clear response. |
| 2:10–2:40 | Review the recorded attempt. | Actual duration, events, outcome, and recorded state samples. |
| 2:40–3:00 | Approve export/submission and show receipt. | Download or service acknowledgment and updated assignment summary. |

Have a text-input fallback for provider/network failure. If used, say that live voice could not be demonstrated rather than presenting the fallback as Agora.

## 11. Verification gates

Passing software gates establishes a working software product for its stated environment. It does not establish physical safety, realistic robot dynamics, training-data usefulness, or sim-to-real transfer. Those require separate robotics validation.

### Scenario-authoring correctness

- Supported briefs create schema-valid drafts using known assets and goals.
- Ambiguous or unsupported requests do not mutate the live scene.
- Applying a scenario requires the reviewed revision; edits invalidate that approval.
- Invalid positions, unreachable placements, duplicate IDs, unavailable capacity, and missing objects are rejected.
- Reset/rerun reproduces the saved starting state and seed.
- A plan cannot execute against a different scene revision without revalidation.

### Engine correctness

- The supported pick/place task changes the authoritative object state and satisfies the specified destination check.
- Multi-object goals execute each object once and preserve unselected objects.
- Pause preserves position and action progress until resumed.
- Stop prevents queued actions from proceeding; another command cannot restart them implicitly.
- Reset restores the documented scene and does not accidentally retain held objects or queued actions.
- Unsupported objects/destinations are rejected without partial unintended mutations.
- Already-completed goals have an explicit result.

### Recording and review

- Episode initial state matches the scene at recording start.
- Timestamps are ordered and samples reflect actual execution.
- Outcome agrees with the completion evaluator.
- Failed/cancelled attempts remain distinguishable from successful attempts.
- Export parses, identifies its schema, and contains enough state/action information for its advertised replay/inspection behavior.
- Review/approval/export status changes only on the corresponding successful operation.

### Voice and API

- Missing credentials are visible.
- Real voice uses Agora and Murf Falcon when claimed.
- No secret appears in the browser bundle, transcript, URL, export, or logs.
- Tool retries do not create duplicate submissions.
- Provider failure cannot falsely complete an arm action.
- Required confirmation cannot be bypassed by the model's own message.

### UI and practical demo

- No console/runtime errors on startup or during the complete journey.
- Robot and object movement remain legible at common laptop and projector sizes.
- Camera controls do not steal command typing unexpectedly.
- Stop remains reachable while execution is active.
- Core workflow is keyboard operable and status is not encoded only by color.
- Browser refresh and storage behavior are documented.

### Software production acceptance

These are acceptance requirements for a production claim, not features already established by the current prototype:

- Authenticate users and authorize project/scenario/episode access. The current local single-user service is not a multi-tenant service.
- Keep provider and storage credentials server-side, validate all input schemas, bound resource use, and handle malformed uploads if V2 is enabled.
- Add persistent versioned scenario/episode storage with recovery/export procedures and documented retention behavior.
- Make apply/run/save requests idempotent, scope action authority to the current session, and handle disconnect/reconnect without duplicate actions.
- Surface timeouts as unconfirmed outcomes until reconciled with actual scene state.
- Capture structured logs/metrics for provider failures, action durations, save failures, and actual episode outcomes without leaking secrets.
- Add meaningful automated coverage for draft/apply/revision conflicts, execution, recording, persistence, and integration failure paths.
- Run a real end-to-end Agora/Murf session and verify credentials, supported provider payloads, audio, tool callbacks, and result acknowledgment.
- Establish supported browser/hardware limits through testing, rather than promising a performance level from visual smoothness on one machine.

### Separate robotics validation

- Validate kinematics, reachability, joint limits, and controller behavior for each claimed robot model.
- If using a physics engine, validate collision geometry, contact and grasp behavior, and stable placement; idealized attachment does not establish these properties.
- Verify trajectories against the intended learning/export format and load them in the actual consumer pipeline.
- If claiming training benefit, train/evaluate with a baseline, documented split, held-out scenarios, and measured outcomes.
- If claiming real-robot use, conduct hardware-specific calibration, controller integration, and safety validation separately.

For the initial release, publish it accurately as an idealized simulated scenario/testing workbench with recorded episodes.

## 12. Risks and decisions

| Risk | Decision / mitigation |
| --- | --- |
| Arm motion/grasp integration exceeds available time. | First validate one exact task; keep the scene and movement library small. |
| Attractive UI creates a false impression of robotics fidelity. | Label kinematic/idealized grasp behavior and expose real engine state. |
| Required voice provider setup is missing. | Keep the prototype usable, but report hackathon integration as incomplete until verified. |
| A local JSON export is mistaken for a training-ready dataset. | Version and describe the schema; state precisely what it contains and what has not been validated. |
| Natural-language expectations exceed supported actions. | Provide examples, structured plans, clarification, and explicit unsupported responses. |
| Competing state copies drift. | One engine state, one event stream, shared IDs and timestamps. |
| Existing companies already offer adjacent tools. | Position as a focused workflow prototype; measure completion and review effort rather than claiming a new category. |
| Phone/laptop capabilities are unknown. | Keep visual assets small and test the target hardware before expanding scope. |
| “Create an environment” is interpreted as unrestricted 3D world generation. | Offer a firm v1 vocabulary and reviewable schema; explain unsupported requests. |
| Video import implies accurate reconstruction. | Label V2 suggestions approximate, preserve provenance/uncertainty, and require human review. |

### Commit criteria

Commit to the software demonstration after one scenario executes, evaluates, and records reliably on the target laptop. Commit to conversational environment-authoring claims after draft/schema/review/apply gates pass. Commit to track completion only after the actual Agora/Murf workflow and meaningful record action are verified. Treat production operations, physics fidelity, video reconstruction, and policy learning as separate claims with their own acceptance gates.
