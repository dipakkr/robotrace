# Stage openings and four-minute demo

Use the full local application at **http://127.0.0.1:5189/**. The employee is a
robotics data/evaluation engineer preparing household robot tasks and reviewing
what actually happened. Choose one opening, then finish the same save/report loop.

## Three openings

**The task.**

> “A robotics team needs ‘take the cup to the sink’ to become an exact plan and a
> checked record. I’ll ask by voice, inspect what the robot actually does, and
> save a reviewed report that another engineer can reopen.”

**The useful failure.**

> “The cup is beyond the arm's reach. A fixed robot should refuse. This mobile
> robot can move its base, recheck reach and try again. We can test both from the
> same scene and keep the failure as evidence, rather than hiding it.”

**The data question.**

> “How do you tell whether generated robot motion is useful evidence? Start with
> the task, preserve the starting scene, check the outcome and retain failures.
> TeachTrace makes that workflow visible. Exporting coordinates alone does not
> mean we trained a robot.”

## Before the judges arrive

```sh
npm run demo:start
npm run demo:status
npm run doctor -- --check --health
```

Use `npm run demo:restart-api` only when required, then reconnect voice. Keep
ignored `.env.local`, headers and provider dashboards off the presentation screen.
UI/API ports are 5189/8787; the public callback tunnel exposes authenticated tools
on 8788. The private hosted site is a static frontend and cannot replace this
local backend for the complete workflow.

Open a fresh **Mobile kitchen**. Use 3× simulation speed for a short presentation,
or 2× for an easier interruption. Disable automatic motion in Review if narrating
manual approval. Rehearse a person's real microphone and speaker; recorded speech
and automated audio transcription are not that acceptance. Check
[VALIDATION.md](VALIDATION.md) and HV-01 in
[FEATURE_ACCEPTANCE.md](FEATURE_ACCEPTANCE.md).

The combined prerecorded-input rehearsal passed five checks: real voice,
five executed steps, explicit save, saved-report context and spoken confirmation.
A fresh browser reopened and reexported that exact record; the standalone consumer
verified it. Keep the [labelled 75-second backup](../.local/qa/final-workflow/teachtrace-voice-workflow.mp4)
and [native evidence](../.local/qa/final-workflow/mobile-evidence.json) ready.
The viewing copy includes prerecorded test commands and actual remote agent audio
with approximate alignment. Never present it as a live human microphone run.

## Four-minute sequence

| Time | Action | Observable evidence |
| --- | --- | --- |
| 0:00–0:20 | Give one opening. Show **Mobile kitchen**, actual connection state and Cup beyond reach. | Employee, household task and laptop-only simulator scope. |
| 0:20–1:15 | Say **“Take cup from counter to sink.”** Inspect the five-step plan and approve. During carrying, click **Human enters**; show held cargo and paused motion, then **Clear human → Resume**. | Counter navigation, actual reach recheck, collection, continuous carry, Sink docking and release. Clearance alone does not resume. Completion follows actual checks, not a spoken promise. |
| 1:15–1:55 | In **Review**, inspect the three checks. Choose **Review & save mobile evidence**, then **Approve & save mobile evidence**. Open **Saved recordings**, select the returned record, scrub replay, export it and **Return to live kitchen**. | Explicit critical approval, persistent local ID/report, independently recomputed acceptance, SHA-verified read-only recording and preserved live world. No voice/countdown auto-submits evidence. |
| 1:55–2:25 | In **Task plan**, run **Compare fixed vs mobile reach**. Export the reach comparison or mobile evidence. | Same starting scene/target/reach/controller: stationary refusal versus mobile travel and delivery. Navigation is the changed capability; this is not a model ranking. |
| 2:25–3:00 | Open **AI deployment checks**. Show **Try pickup before moving** and/or **Try wrong destination**, then the five-case baseline or an existing model result. | Zero-travel reach failure; completed motion with rejected task goal; five baseline fixtures yield two accepted and three specific failures. Show the returned candidate and measured request time if using a real model. No automatic paid loop. |
| 3:00–3:40 | Return to **Workcell → Environment → Household scenarios → After-meal counter reset**. Open **Generate variations**, count 100, seed 42, execute and export. | The rehearsed source gives 60 accepted + 40 expected refusals, not 100 independent demonstrations. Parent fingerprint, seed/index and compact joint traces support reproducibility. Controller and hash timings are separate. |
| 3:40–4:00 | Show a prepared consumer manifest or native export and state the boundary. | “This is inspectable task/evaluation evidence. The consumer verifies SHA/FK and writes next-observed-state targets. We have not trained a policy or proved real-robot transfer.” |

If time is short, preserve the explicit **save → report → reopen** loop and drop
optional comparisons. Expected refusals are useful test results, not completed
deliveries. Confirm the actual exported counts before stating them.

## Useful extensions after the main loop

- **Protected-object error:** show the recorded Bowl pick-and-return case. Its
  controller completed and restored the exact final pose, but the task was
  rejected at the actual protected pickup step. A final screenshot cannot erase
  the handling history.
- **Workplace knowledge:** load a workcell repair, sample-routing or household
  assignment. Retrieve its locally authored sample SOP and acceptance rules;
  record, review and submit to update the local assignment/report. Do not call it
  an external enterprise integration.
- **Reference authoring:** explicitly submit a photo or one selected local-video
  frame. Inspect the proposed supported objects/goals, short JPEG fingerprint and
  selected time, then approve. The world retains metadata, not the media or
  filename. This is uncalibrated scene approximation, not human-motion extraction.
- **Correlated data:** load two variants and inspect their native exports or
  consumer manifests. Different child layouts retain one declared parent group.
  The ancestry is not authenticated and no train/test split is performed.
- **Parking:** **Go Home** is navigation. With cargo, it retains the object and
  creates no placement or delivery claim.

## Recovery

| Problem | Action | Accurate statement |
| --- | --- | --- |
| Permission denied / connection pending | Inspect the visible mobile error. Allow microphone access; use **Reset voice** deliberately, then reconnect once. | “This attempt has not established a live voice round trip.” |
| Stale active session | Use mobile **Reset voice** or workcell **Reset voice connection**. | “Reset is cleanup, not proof that a queued sentence played.” |
| Progress voice arrives late | Use the visible controller status/checks. | “This narration refers to a verified milestone; delivery timing can lag.” |
| Human proxy blocks motion | Keep cargo held; clear the scenario, then explicitly Resume. | “This is a software obstruction, not tracked human motion or certified safety.” |
| Evidence service unavailable | Keep the frozen review, **Export reviewed copy**, then retry or cancel deliberately. | “The file is retained; persistent submission is not confirmed.” |
| Provider/network unavailable | Use a clearly labelled recording or typed local workflow. | “This is the recorded/fallback path.” |

The separate progress-audio audit proved the requested marker and reach-check
speech were present in captured real RTC audio. Its overall delivery stage timed
out; do not use that clip as a passed complete-task demonstration. A REST
acknowledgment is not heard audio, and an automated transcript is not a human
listening test.

See [JUDGING_STORY.md](JUDGING_STORY.md), [VALIDATION.md](VALIDATION.md) and the
[atomic backlog](DELIVERY_BACKLOG.md) for track fit, evidence and remaining gates.
