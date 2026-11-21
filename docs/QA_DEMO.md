# Demonstrate the QA workflow

The audience is a robotics integration lead or QA operator. The question is: **which declared task plans behave as expected in these frozen simulator situations, and what evidence explains a mismatch?** This is a high-level symbolic-planning test, not testing a learned motor policy.

## One minute before opening QA

In the main kitchen, enter **Take cup from counter to sink**. It runs immediately; there is no approval tab or countdown. The activity terminal shows the actual local planner rationale, navigation, reach, handling and outcome. Pause/Resume and Stop control this attempt. Human enters places an explicit person proxy ahead. The controller detours when a clear route exists. Place person opens a Top-view floor placement mode; click to move the person. Block destination occupies the current navigation dock and should pause the mission. Clearing a paused obstruction alone does not resume.

**Go Home** is navigation, including with existing carried cargo. It must not announce a delivery or release. **Save mobile evidence** is one click and records `approved:false`, `identityVerified:false`, `source:operator-save`. It preserves the outcome and does not assert human quality review.

Open **QA console** to evaluate independent frozen cases. It leaves the live mission unchanged; a paused live mission stays paused when the console closes.

## Select a candidate

- **Operator candidate:** the exact skill sequence selected in the editor. A deliberate bad recipe is an authored test, not a model mistake.
- **Bounded recipe:** a declared fixed baseline. It has no model request.
- **AI plan:** one explicit request to the selected provider. These runs may cost money. Inspect the actual returned actions; do not assume which candidate will pass.

A candidate selects navigation stations and handling order. The simulator supplies known-map paths for declared navigation, performs geometric guards, and checks the frozen task. It does not repair the candidate’s order or destinations. The input is simulator state, not robot-camera perception.

## Run the six-case suite

Click **Run 6-case baseline suite**. These are local executions, not paid calls. Explain the columns before reading numbers:

| Quantity | Meaning |
| --- | --- |
| Controller outcome | Whether the declared sequence completed, failed, was refused, was blocked or was invalid |
| Task acceptance | Whether all frozen task checks passed after completed execution |
| Expected behavior | Whether this specific case produced its required result, including the right refusal reason |

| Situation | Exact requirement |
| --- | --- |
| Initial distant Cup | Completed, task accepted, nonempty checks all passed |
| Cup unreachable at pickup dock | Failed/refused for `reach`, zero pickups |
| Static passage barrier | Refused for `no-route`, zero travel and pickups |
| Human blocks pickup dock | Blocked for `human-blocked`, zero placements; an alternate route cannot reach an occupied dock |
| Bowl at Table | Cup task completed/accepted with all checks passed, including unchanged Bowl |
| Human ahead with clear detour | Completed/accepted; the fixture additionally checks actual rerouting and longer travel |

The known recipe gives **3 deliveries and 3 noncompleted outcomes**. It can give **6 expectation matches**. Both numbers are true and answer different questions. Do not call it 100% task success.

An unknown expectation is **unscored**, not a match. A docking failure is not a reach match. `failed/no-route` is not the required preflight `refused/no-route`. A category with one wrong count fails. The verdict code is [mobile-qa-verdict.ts](../src/data/mobile-qa-verdict.ts).

## Read the matrix and bars

The condition × candidate view is a lookup, not decoration. Point to an unrun cell: **Not run**. Repeatedly running one cell does not increase coverage. The six known cases are the denominator; current/custom scenes are not silently added to it. If only the baseline has covered them, do not attribute its coverage to an AI model.

In the main scene, a person ahead is a movable circular software obstacle. The controller replans a longer route when one is clear and preserves its current mission and cargo. Moving it again triggers another replan. Every resulting segment uses the modeled clearance; this is not human perception or certified safety. A person covering the current base or target dock leaves no traversable route, so the controller pauses. Move/clear it and Resume. Merely moving it does not restart paused motion. Reroute events record remaining and added route length. The completion verdict alone does not prove a detour; inspect that event and travel.

A failure bar counts outcomes. Explain whether it includes invalid execution and whether request errors are separate. A request failure has no controller outcome and cannot be a delivery. Bars and expectation matches must remain distinct; an expected refusal is useful QA evidence.

Keep repeated attempts. They reveal instability; deleting them would hide it. Matrix summaries may select one attempt, but the detail/export must retain the denominator. Missing cases stay missing; an empty session has no success rate. See the UI utility for its actual selection rule before claiming how it summarizes repeats.

## The matched pair

Click **Run matched regression pair**. It makes two local authored attempts, not a human demonstration or model benchmark. Both start from the same scene and goal, and both deliver Cup to Sink. One also picks up Bowl and returns it.

Show both IDs and the shared scene fingerprint. They may both say **Controller completed**. Only one should say **Task accepted**. The bad plan is a negative fixture: expected rejection means `completed`, not accepted, `protected-object`, and a failed protected check. A wrong-destination failure cannot satisfy it.

Click **Jump to task violation**. The observed bad plan attributes Bowl pickup to **step 8**. The complete initial Bowl record is protected at every native tick; final equality alone is insufficient. Its strict policy has **zero tolerance**, so status-only changes can violate even at zero displacement. This is a software record policy, not a realistic robot tolerance specification.

## Replay, then use the independent plot

Play and scrub the actual attempt. Initial, violation and final frames should match the recorded times. End with Bowl back at its original pose: the history check must still fail.

Download the pair and open **Trace analysis**. Load that file; it is separate from the command center. Show the position/state trace and exact marker. Do not expect a displacement-only curve to explain a status-only violation. Policy metadata and changed fields carry that distinction.

This viewer and evaluation evidence do not authenticate authorship. A checksum tests content identity, and the source/model labels remain declared metadata. The native consumer produces next-observed-state analysis, not actual motor commands.

## What the lead should conclude

“I can inspect coverage and reproduce why a plan failed” is supported. “This will help our team” needs a recipient trial. “This improved a robot policy” needs an actual learner and held-out evaluation. “Ready for physical deployment” needs hardware work.

Ask: **Would this report let you reproduce and triage the failure?** Measure that, instead of asking whether the animation looks intelligent.
