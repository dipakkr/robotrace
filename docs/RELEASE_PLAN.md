# RoboTrace release plan and acceptance rubric

## Product decision

RoboTrace is a voice operations console for robotics demonstration collectors. It helps an employee turn an approved work instruction into a reproducible simulated attempt, inspect failures, and deliver a reviewed evidence package to their robotics team.

The immediate problem is fragmented collection operations: instructions, environment setup, robot actions, outcome checks and review evidence are disconnected. Our output is a task-linked, reviewable episode with its scene, trajectory, checks, provenance and service report. The robot is a visible execution surface; the employee workflow is the product.

## Complete workplace workflow

1. **Initiate:** employee selects a repair, kitchen or laboratory assignment and connects Agora voice with Murf Falcon responses.
2. **Understand:** the assistant retrieves the assignment's approved SOP, exact object IDs, destinations and acceptance rules from the task API. Laboratory reference samples must remain undisturbed.
3. **Prepare:** employee asks for the task or a supported scene change. The application validates a bounded plan and shows its exact actions.
4. **Confirm:** operator approves movement or replacement of a scene. Unsupported or ambiguous requests cause no motion. Reset and dataset review remain explicit actions.
5. **Execute:** the tool API dispatches actions to the visible controller, waits for observed completion, handles pause/stop and reports actual failures. Robot narration describes milestones.
6. **Evaluate:** compute destination geometry, protected-object preservation and settled-controller checks. Record states, actions and outcomes, including failed attempts.
7. **Follow up:** collector reviews/replays the attempt, approves the evidence, saves it through the persistent API, updates its collection assignment and receives a factual report.
8. **Hand off:** download a versioned native evidence package with a manifest, task context, provenance and verification checks. Another developer can inspect it; no robot training benefit is claimed without a consumer experiment.

## Feature scope and implementation order

| Priority | Feature | Completion evidence |
| --- | --- | --- |
| P0 | Three genuine work environments | Different objects, layouts, assignments and controller-backed outcome checks |
| P0 | Agora + Murf + LLM + tool callbacks | Real account/API checks plus a browser voice round trip; mocked audio is not evidence |
| P0 | Persistent assignment workflow | Task read, reviewed submission, status update and saved service report survive refresh |
| P0 | Explainable execution and recovery | Plan approval, pause/resume/stop, refusal and voice reset all work |
| P0 | Review and portable evidence | Replay, actual checks, persistent approval and a validated native package |
| P0 | Demo interface | Consistent dark theme, legible typography, Studio/Copilot/Simulation presentation modes, working exit controls |
| P1 | Collection dashboard and rubric | Actual task/episode/check counts and evidence states; no invented impact metrics |
| P1 | Bounded environment creation | Supported voice/text descriptions produce reviewed schema-validated drafts |
| P1 | Repeatable evaluation suite | All supported success/rejection scenarios run and preserve truthful outcomes |
| P1 | Demonstration assets | Exact supported script, screenshots, architecture and known limitations |

Camera/video reconstruction, contact dynamics, learned policies, real robot deployment, cloud multi-tenancy and automatic frontier-lab ingestion are future milestones. They are not silently included in this release or claimed as completed features.

## Internal scoring rubric (100 points)

This is our acceptance rubric derived from the supplied track, not an organizer-published scoring sheet. An unverified requirement receives no completion credit.

| Category | Weight | Full-credit acceptance |
| --- | ---: | --- |
| Mandatory live voice | 20 | Employee speech reaches Agora; real Murf output is audible; a complete action is performed through voice |
| End-to-end workplace outcome | 20 | Retrieved assignment -> approved action -> verified result -> reviewed API submission -> persistent status/report |
| Meaningful agent actions | 15 | Scene-grounded tools perform real state changes and wait for evidence; failures are accurately explained |
| Physical-AI usefulness and integrity | 15 | Reproducible multi-environment episodes, protected-object checks, failures and native evidence with explicit fidelity |
| Demo UI and usability | 15 | Coherent dark design, readable 3D and transcript, all presentation modes, keyboard/escape behavior and responsive layout |
| Reliability and recovery | 10 | Tests cover real controller logic and API lifecycle; reload/reset/duplicate session recovery; no secrets exposed |
| Evidence and measurable results | 5 | Saved report, actual sample/action/check counts, rubric status and rehearsed supported demo |

Each category is scored against observable evidence with three states: implemented, automatically verified, human/live verified. Compilation and key presence never count as a voice round trip. No claimed time savings or policy gains are added without measurements.

## Work allocation

- Primary agent: release contract, presentation modes, integration of UI/workflow/evidence, browser acceptance and final release checks.
- UI implementation agent: dark design tokens, consistent typography, component states and responsive demo surfaces.
- Workflow implementation agent: persistent assignment records, reviewed submission, status transitions and service reports.
- Evidence implementation agent: typed native export package, manifest/checks and meaningful validation.

All work converges on one full laboratory assignment first, then the other two environments. Validate the integrated UI and failure/recovery path before expanding scope.

## Voice/action consistency

Every approved plan has exact object IDs, semantic labels and destinations. Spoken intent, rendered queue and controller receipts must agree. The agent may claim completion only after actual tool completion. Progress speech uses verified past-tense milestones; queued speech must not announce an obsolete current or next action. Delayed or unverified playback remains visibly labelled. Validate at least one real provider speech-to-tool flow, and record which audio/RTC checks are automated versus heard by a human.

## Release gates

- No broken primary button or demonstration path.
- Build, controller/API tests and browser flow checks pass.
- Static preview is explicitly distinguished from the local live backend.
- Saved report and exported package match actual episode outcomes.
- No secret in source, export, screenshots or browser responses.
- Final live microphone/speaker interaction is clearly reported if human verification is unavailable while the owner is away.

## Next evaluation direction: human activity

User-requested follow-up: begin with a human-led demonstration, preserve human intent/corrections and evaluate a robot attempt against that task. Subsequent scenes can include human presence, interruptions and collaboration. Avatar animation alone is not a validated human-motion dataset; video-derived poses require calibration, consent/provenance, uncertainty and separate safety validation. This is explicitly later, after the current complete workflow.

## Five-hour autonomous delivery block: expanded scope

The owner asked for independent delivery covering scene creation on the fly and evaluations involving humans, AI and other models. Work proceeds in small validated increments, preserving the working v1.

### A. Workspace usability (finish first)

- Neutral soft-black surfaces; compact pill actions; minimal nested outlines.
- Inspector, copilot and timeline collapse independently and can be restored.
- Pending approval stays outside transcript scrolling; action details remain inspectable.
- Verify laptop 1280x720, desktop 1440x900 and phone 390x844; no hidden critical actions.

### B. Durable collection and portable review

- List server-saved episodes, reopen by ID and replay after refresh.
- Import a native evidence package only after schema/integrity validation.
- Keep source, review status, original outcome and human-review limitations intact.
- Provide a concise activity/report view and actual metrics without invented savings.

### C. Human and AI planner evaluation

- Evaluate an explicit human-authored object/destination plan using the same simulator and goals.
- Request bounded plans from configured LLM models through server-only keys.
- Validate every returned action before execution; preserve refused/invalid plans as evaluation outcomes.
- Compare plan validity, computed task acceptance, action count, protected-object preservation and measured request time.
- Separate planner performance from motion-controller checks and physical robustness.
- Model calls are explicit, bounded and use an allowlisted configured endpoint/model set; do not run an unlimited paid loop.

### D. Create a scene during a session

- Keep the deterministic text composer available offline.
- Add an optional AI-generated draft for supported workbench/kitchen/lab/custom rigid-object scenes.
- Validate object vocabulary/count/IDs/poses/goals, show assumptions, and require approval before replacing a scene.
- Work immediately on the approved scene with grounded object names and targets.
- A supported component scene is not arbitrary text-to-3D or physically calibrated reconstruction.

### E. Human activity and correction foundation

- Human-authored demonstrations and explicit correction annotations are first-class evidence.
- A bounded human-presence/interruption simulation may be added if core checks pass; any person geometry is a proxy, not captured motion or certified safety behavior.
- Camera/video capture begins as local reference and reviewed task/scene suggestions; never infer force, exact scale or training-ready actions silently.

### F. Final release evidence

- Repeat the complete browser workflow and failure/recovery checks after functional changes.
- Retain the already verified prerecorded-speech -> real Agora/LLM/Murf -> approved three-action result as automated provider evidence; human microphone/playback remains separately labelled.
- Update feature/rubric matrix, physical-AI evaluation strategy, demo script, screenshots, startup and recovery instructions.
- Publish the current private static preview when source/build verification is complete; distinguish it from the local live backend.

These are implementation goals, not claims of completed or production-ready features. Record actual evidence and explicitly mark any remaining gap.

## User design rules

Never use a left-edge stripe/border/inset marker to indicate selection anywhere in this project. Use a subtle complete surface, icon/text contrast and restrained weight instead. Sidebar hierarchy and inspector use dense console typography and compact row heights. Pending approvals live in a dedicated Review tab; low-risk simulated movement uses an explicitly visible cancellable three-second auto-run setting. Scene replacement, reset and evidence submission remain explicit.
