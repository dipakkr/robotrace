# TeachTrace judging story

Prepared 21 November 2026. This is the intended demonstration narrative. Use only features that the current build and live provider session actually demonstrate.

## The problem in one sentence

> Robotics employees need to turn task briefs into repeatable test scenarios, understand failures, and preserve useful episodes; TeachTrace brings scene authoring, controller execution, and episode review into one conversational workbench.

## The user and concrete assignment

The user is a robotics engineer, QA technician, or demonstration collector. Their assignment is to test a tabletop robot controller on a supported sorting task and save an inspectable run.

V1 has a deliberately bounded environment: one arm, one table, known rigid parts, named trays, approved layouts, and pick/place goals. A generated scenario is reviewed before application. A successful run produces an evaluated episode and a saved record.

## Defensible track mapping

| Track requirement | Demonstration evidence |
| --- | --- |
| Employee starts through natural voice | Real Agora Conversational AI session receives the employee's brief; Murf Falcon speaks the response. |
| Assistant understands and retrieves workplace context | Task assignment, supported scene vocabulary, and acceptance rules inform the draft and plan. |
| Agent performs meaningful actions through tools/APIs | It applies a reviewed scenario, runs the simulator, evaluates the result, and persists the episode. |
| Confirmation and error handling | Human approves the draft/revision; ambiguous or unsupported requests are explained; reset and final record actions have explicit semantics. |
| Follow-up | Run summary and assignment state update; saved scenario and episode can be inspected and repeated. |

This matches the supplied workplace-agent track by treating robotics testing/data collection as the workplace. It is an interpretation of the published and user-provided requirements, not an organizer's approval. The public [event requirements](https://www.commudle.com/communities/knotic/hackathons/build-with-agora-blr) allow action-oriented workflows beyond the suggested examples.

## Three-minute narrative

| Time | What to say/do | What the judge can verify |
| --- | --- | --- |
| 0:00–0:20 | “A robotics employee needs a repeatable sorting test and an inspectable run.” | Task brief, Simulation/idealized-controller label, truthful provider state. |
| 0:20–0:45 | “Create a tabletop test with the red, blue, and green parts. Red and green go in tray A; blue goes in tray B.” | A bounded scenario draft or supported scenario selection, with objects, layout, goals, and completion checks. |
| 0:45–1:00 | Review and approve the exact draft. | Approved scenario revision is applied to the workcell. |
| 1:00–1:35 | “Run this test and record the attempt.” | Arm and objects move; queue advances; recorder captures states/actions; outcomes follow the scene. |
| 1:35–1:55 | “Pause.” Inspect one part or give a supported interruption, then resume. | Controller pauses coherently and the event is preserved. |
| 1:55–2:15 | Give one unsupported or ambiguous request. | Assistant responds clearly without silently performing an invented action. |
| 2:15–2:40 | Inspect the final result and episode. | Expected destinations, empty gripper, action receipts, actual sample count, and termination outcome. |
| 2:40–3:00 | Approve saving the episode and show its receipt. | Server-saved record or clearly labelled local export; scenario can be rerun. |

If conversational authoring is not implemented, demonstrate a scenario-library choice and say so. If live voice cannot connect, use text to demonstrate the software and state that the required provider integration remains unverified. Neither fallback should be presented as a completed capability.

## Claims the demo can support

- Supported requests can operate a visible simulated workcell.
- Scenario intent, controller execution, and observed outcome are inspectable together.
- A real episode record can be saved with the run's state/action history.
- Saved starting conditions enable repeatable controller checks, subject to verification.

## Claims to avoid

- “The robot learned a new skill from one conversation.”
- “A phone video became physically accurate robot training data.”
- “These episodes improve a VLA model,” without training and held-out evaluation.
- “This is production-ready for real robots,” without separate robotics validation.
- “This is a new category,” or an unmeasured time/cost reduction.

## Current evidence and remaining work

The integrating agent reports a working React console, 15 passing checks, and a real browser run with three placements and an episode saved through the local API. A four-scenario library is being added. Agora/Murf adapter code exists but has not been verified with live credentials. Conversational environment authoring must pass its draft/validation/review/application gates before it is included as a live capability.

V2 may use a camera image or uploaded video to suggest a supported scene. Those suggestions remain approximate and require review; exact dimensions, calibration, physical properties, and robot-control trajectories are not inferred from ordinary video.

## Closing line

> “Describe a supported robot test, review the scenario, run it, and keep the evidence.”
