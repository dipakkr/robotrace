# Final judging acceptance and stage evidence

These are the seven final judging criteria supplied by the participant on 21 November 2026. No weights or numeric scoring rubric were supplied. This is an evidence checklist, not an official score prediction.

RoboTrace is a voice-operated robot task-planning sandbox and QA workbench. A robotics integration engineer can direct a mobile robot in a known-map kitchen, intervene during execution, inspect failures, and preserve portable evidence. The workplace workflow is task assignment → contextual planning → controller/tool execution → checked outcome → saved service/evaluation record and regression handoff.

| Final criterion | What the judge should see | Acceptance evidence and limits |
| --- | --- | --- |
| Innovation and creativity | The judge places a person or floor block while a cup is being carried; the route adapts. Then two plans reach the same final scene but receive different verdicts because one moved a protected object. | Actual path/cargo/controller history and the independent displacement plot. Authored bad plans are labelled; they are not invented model errors. |
| Real-time Conversational AI implementation | Microphone input, actual user/assistant caption events, partial/final state where delivered, audible responses, and an execution that changes the scene. | Agora RTC audio subscription plus genuine transcript packets. Typed commands never masquerade as voice events. A prerecorded-input provider rehearsal is distinct from a human microphone/hearing rehearsal. |
| Agentic AI capabilities and action execution | The assistant retrieves current task/map/object context, calls a simulator tool, observes the checked result, and can save the recorded attempt through the API. A queued task is planned against its later actual source position. | Actual command acknowledgments, geometric checks, queue dispatch, saved HTTP 201 record and report. Navigation is supplied by a deterministic route adapter; this is not a learned motor policy. |
| Agora technology integration | Show a live voice connection, the conversation, and the robot responding to the actual tool callback. | Agora Conversational AI + Agora RTC microphone/remote audio + authenticated public HTTPS tool bridge. Configuration status alone is insufficient. |
| Murf AI Falcon TTS integration | Let the assistant respond and narrate a verified action/outcome. | Falcon is configured as the Conversational AI TTS provider. A received transcript alone does not prove audio playback; provider/remote-track evidence and a human listening check have separate status. |
| Technical execution and functionality | Repeat Cup/Bowl moves without resetting; reorder pending instructions; introduce an obstruction; recover from an occupied dock; reopen persisted QA runs; replay/export actual traces. | Unit/server tests, real browser checks, bounded session cleanup, durable private local records, integrity-checked native export, portable offline analysis. Known-map kinematics and idealized handling; no contact dynamics. |
| User experience and real-world impact | One Start simulation entry, visible conversation beside compact live activity, clear current object locations, direct task controls, and an understandable failure explanation. | Real impact demonstrated now: an engineer can locate when a protected object moved even though it returned to its starting pose, and retain the case for regression. No measured training gain, real-robot transfer, customer productivity gain, or frontier-lab partnership is claimed. |

## Three-minute final demonstration

1. **0:00–0:20 — Give the judge a decision.** “You are reviewing a robot task planner. Can it finish the task when the room changes, and can we explain the failures before connecting hardware?” Click Start simulation. Point out the live voice state and both-speaker conversation.
2. **0:20–1:05 — Speak and intervene.** Ask for Cup to Sink. Let the judge place a person or block ahead while Cup is carried. Show the actual reroute event and added distance. If the target dock is occupied, explain the pause; move/remove the obstruction and explicitly Resume. Do not promise an alternate route where none exists.
3. **1:05–1:25 — Make it a sandbox.** Ask for Cup to Table, then back to Counter, or queue Bowl to Table. Show that the source is its current location and the scene was not reset. Save/export an actual attempt; saving remains Unreviewed.
4. **1:25–2:05 — Make it an evaluation tool.** Open QA console. Show stored runs and the six-case baseline suite: three deliveries and three expected guard outcomes are distinct from six expectation matches. AI model results are labelled separately; unrun cells stay unrun. Do not attribute the authored recipe's results to an AI model.
5. **2:05–2:50 — Show why the data matters.** Run/open the matched comparison: both plans put Cup in Sink, but one moves protected Bowl and restores it. Export the pair to the independent trace consumer; select the first violation and its actual timestamp/XYZ, then the final zero-displacement point.
6. **2:50–3:00 — Close with the proven outcome.** “You changed a live run. We preserved its response. A separate program then located a failure that the final frame concealed. This gives a robotics team a reproducible case to investigate and test against.”

Keep the interactive sandbox run separate from the matched comparison: initial conditions and intervention timing must match before claiming a fair pair. A collected preference example remains a candidate for researcher review; producing it does not train a model.

## Final operational check

- Start local UI/API/callback and check actual health, not just processes.
- Rehearse on the presentation laptop with its real microphone and speaker; confirm Agora and Murf are audible and both caption roles arrive.
- Reuse exported regression evidence as a labelled recorded comparison. Keep a recorded real UI/voice fallback available.
- Use the local app for API-backed demo. The private hosted frontend does not include the local API backend.
- If a provider fails, show the connection error honestly. A typed-control fallback preserves simulator functionality but does not demonstrate live voice integration.
