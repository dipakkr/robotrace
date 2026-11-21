# Final judging acceptance and stage evidence

The participant subsequently supplied a rubric screenshot: **Agora Conversational AI 25, Murf Falcon 20, Agentic Action 20, Technical Architecture 15, End-to-End 10, and Relevance/UX 5**. The visible maxima sum to **95**, although the interface says **/100**; the remaining five points are unexplained. Do not invent their category or assume normalization.

The [provisional rubric assessment](RUBRIC_ASSESSMENT.md) records our working **80/95** estimate (84.2% only if normalized), its evidence and deductions. It is not a judge's score or a winning prediction. The seven qualitative checks below remain a demonstration checklist; they are not seven additional weighted categories.

RoboTrace is a voice-operated robot task-planning sandbox and QA workbench. A robotics integration engineer can direct a mobile robot in a known-map kitchen, intervene during execution, inspect failures, and preserve portable evidence. The workplace workflow is task assignment → contextual planning → controller/tool execution → checked outcome → saved service/evaluation record and regression handoff.

| Final criterion | What the judge should see | Acceptance evidence and limits |
| --- | --- | --- |
| Innovation and creativity | The judge places a person or floor block while a cup is being carried; the route adapts. Then two plans reach the same final scene but receive different verdicts because one moved a protected object. | Actual path/cargo/controller history and the independent displacement plot. Authored bad plans are labelled; they are not invented model errors. |
| Real-time Conversational AI implementation | Microphone input, actual user/assistant caption events, partial/final state where delivered, audible responses, and an execution that changes the scene. | Agora RTC audio subscription plus genuine transcript packets. Typed commands never masquerade as voice events. A prerecorded-input provider rehearsal is distinct from a human microphone/hearing rehearsal. |
| Agentic AI capabilities and action execution | The assistant retrieves current task/map/object context, calls a simulator tool, observes the checked result, and the operator saves the resulting complete experiment through the API. A queued task is planned against its later actual source position. | Actual command acknowledgments, geometric checks, queue dispatch, saved HTTP 201 record and report. Navigation is supplied by a deterministic route adapter; this is not a learned motor policy. |
| Agora technology integration | Show a live voice connection, the conversation, and the robot responding to the actual tool callback. | Agora Conversational AI + Agora RTC microphone/remote audio + authenticated public HTTPS tool bridge. Configuration status alone is insufficient. |
| Murf AI Falcon TTS integration | Let the assistant respond and narrate a verified action/outcome. | Falcon is configured as the Conversational AI TTS provider. A received transcript alone does not prove audio playback; provider/remote-track evidence and a human listening check have separate status. |
| Technical execution and functionality | Repeat Cup/Bowl moves without resetting; reorder pending instructions; introduce an obstruction; recover from an occupied dock; reopen persisted QA runs; replay/export actual traces. | Unit/server tests, real browser checks, bounded session cleanup, durable private local records, integrity-checked native export, portable offline analysis. Known-map kinematics and idealized handling; no contact dynamics. |
| User experience and real-world impact | One Start simulation entry, visible conversation beside compact live activity, clear current object locations, direct task controls, and an understandable failure explanation. | Real impact demonstrated now: an engineer can locate when a protected object moved even though it returned to its starting pose, and retain the case for regression. No measured training gain, real-robot transfer, customer productivity gain, or frontier-lab partnership is claimed. |

## Three-minute final demonstration

The primary final flow is now **Start simulation → free voice actions and intervention → Stop simulation → Save & view report → inspect requested versus actual → export JSONL → independent analysis**. Use the exact sequence in [README](../README.md#a-three-minute-demonstration).

1. Give the judge the role of robotics QA lead: “Did the robot follow the instruction, and can we explain a failure before using hardware?”
2. Ask “Move forward one meter.” Show actual changing coordinates. Follow with “Go to Counter”, “Pick up the red cup”, and “Carry cup to Sink”. Introduce/move the software person during travel; a clear alternate route continues, an occupied/no-route destination pauses.
3. Explicitly request release: “Place cup at Sink”. Ask a question about distance or position without authorizing new motion. A 6 m straight request intentionally exceeds the declared 5 m controller bound: show a refusal as an unmet request, not a completed move or necessarily an AI defect.
4. Stop and save the whole experiment. Inspect the actual recognized speech, interpreted command, trajectory and request-versus-observed status. Native task completion cannot substitute for the requested action. Unclear requests and uncertain associations remain explicit.
5. Scrub coordinates, replay a native action, play separate captured microphone/assistant tracks and export JSONL. Open the independent voice-experiment analysis page and select a recorded time/position.
6. Close: “A robotics team can investigate this language-to-action failure and keep it as a regression case. This does not establish trained-policy improvement or real-robot transfer.”

The development voice test supplied a real failure: recognized “Please move forward one meter” was executed as Go Home with zero travel. The original report failed that request even though the model-chosen navigation passed its native checks. Preserve that record rather than relabelling it after a fix. Rehearsals using prerecorded microphone input are labelled and distinct from a person speaking on stage.

Optional: show the separate `/hall` photo-informed room draft. Its furniture rectangles are estimated, operator-reviewable geometry, used for rendering and routing. The source image does not prove dimensions or contact physics. Do not claim a calibrated digital twin.

Advanced planner benchmarks and the frozen protected-Bowl comparison remain a separate follow-up. Never compare a live judge intervention against a differently timed recorded run as a matched experiment.

## Final operational check

- Start local UI/API/callback and check actual health, not just processes.
- Rehearse on the presentation laptop with its real microphone and speaker; confirm Agora and Murf are audible and both caption roles arrive.
- Reuse exported regression evidence as a labelled recorded comparison. Keep a recorded real UI/voice fallback available.
- Use the local app for API-backed demo. The private hosted frontend does not include the local API backend.
- If a provider fails, show the connection error honestly. A typed-control fallback preserves simulator functionality but does not demonstrate live voice integration.
