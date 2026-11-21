# Current final demo entry

Use the current [three-minute README sequence](../README.md#a-three-minute-demonstration): **Start → voice actions → Stop → Save & view report → inspect/export**. This includes whole-session speech/audio recording and requested-versus-observed QA. The older matched-pair demo below remains an optional advanced example, not the current primary stage flow.

There is no command textbox in the free kitchen. Pause and Stop are session controls in the conversation area; stopping keeps the route and scene. Saving after Stop is explicit, and records remain unreviewed. If a save fails, retain the dialog and retry; do not discard or refresh the only browser draft.

# Three-minute product demo and recovery

**Current operator policy — latest user instruction:** the local console uses a
single activity terminal. Supported task commands start immediately; there is no
Review tab, approval dialog or three-second countdown. Pause, Stop, human clear
and explicit Resume remain available. Requested reset/scene changes and a save
or export execute from their action directly, without a second confirmation.
Saving is **operator-save**, not a quality approval: records remain unreviewed
with `approved:false` and `identityVerified:false`. Simulator acceptance can pass
independently of that review state. The new direct-save backend is tested; the
changed terminal UI needs its current targeted browser check. Older recordings
with review/countdown controls are historical provider evidence, not today's UI.


The employee is a robotics QA/evaluation engineer. The product loop is **evaluate
→ independently analyze → regress → hand off a candidate correction**. A voice
command and robot motion begin the workflow; the reproducible failure and its
handoff make the output useful to another engineer.

**Current status:** matched-pair UI has four passed browser groups; portable
analysis/CLI/report has seven passing tests and actual CLI evidence. The
independent upload viewer now passes four browser groups on the same pair export,
including source-derived values, offline report reopening and tamper rejection. Existing provider/save
and native consumer evidence remain separately verified. The source-derived standalone CLI HTML report is also available as an offline fallback. See
[REGRESSION_WORKFLOW.md](REGRESSION_WORKFLOW.md).

## Opening

> “A robot can finish its movements and still do the wrong task. RoboTrace lets
> a robotics engineer brief a task by voice, catch that difference, inspect the
> actual exported states outside the simulator, and rerun a correction on the
> same scene. The handoff is an unreviewed candidate pair, not a trained policy.”

A shorter opening: **“We turn a spoken robotics task into a reproducible test,
an inspectable failure and a candidate correction.”**

## Before presenting

```sh
npm run demo:start
npm run demo:status
npm run doctor -- --check --health
```

Use **http://127.0.0.1:5189/** for the full local workflow. UI/API ports are
5189/8787; the public callback exposes authenticated tools on 8788 only. The
private hosted site is a static frontend and cannot supply the local API or
provider session. Keep ignored credentials and provider headers off screen.

Prepare a fresh Mobile kitchen, the matched protected-table case and a folder
for downloaded evidence. Practice the human interruption at 2× speed, or use 3×
if time is tight. Rehearse a person's microphone/speaker separately. The recorded
provider proof uses prerecorded input and cannot close HV-01.

Keep the [labelled automated backup](../.local/qa/final-workflow/teachtrace-voice-workflow.mp4)
and [exact saved native evidence](../.local/qa/final-workflow/mobile-evidence.json)
ready. Its prerecorded commands and actual remote audio have approximate A/V
alignment; it is not a live human-microphone run or an exactly synchronized clip.

## Three-minute sequence

| Time | Action | Evidence / precise explanation |
| --- | --- | --- |
| 0:00–0:15 | Give the opening; show Mobile kitchen and current voice state. | Cup begins beyond stationary reach. The map and controller are bounded simulation. |
| 0:15–0:55 | Say **“Take cup from counter to sink.”** Read the five-step plan/events in the terminal as execution starts immediately. Invite the judge to click **Human enters** during carrying and watch the changed route. For the blocked case, use **Block destination → Clear human → Resume**. | Navigation, reach recheck, pickup/carry/place and obstacle detour; an occupied destination pauses and clearance alone does not resume. This supervised live run demonstrates interaction/recovery, not one member of the matched regression pair. |
| 0:55–1:15 | Click the save action once and show its returned unreviewed record/report. | Saving does not assert human review. Geometry checks and stopped/failed outcomes remain truthful; spoken progress is not the save receipt. |
| 1:15–1:45 | Open **QA console → Run matched regression pair**. | Two local runs share the exact protected-table source and Cup → Sink goal. A valid Cup delivery is compared with a candidate that also picks and returns protected Bowl. Exact final restoration does not erase history. |
| 1:45–2:20 | Click **Download comparison → Open trace analysis**, then load the actual exported file. | File-derived chart and first recorded object change (this run: 20.6 s, step 8). The complete-record rule uses intentional zero tolerance; a status change can precede visible movement. Do not invent a 1 cm threshold or claim physical contact detection. |
| 2:20–2:45 | Use **Load correct recipe → Evaluate operator candidate** on the selected frozen source/goal; retain that additional result separately. | Actual task checks distinguish the accepted correction from the completed-but-rejected Bowl round trip. The evaluator does not silently repair a candidate. |
| 2:45–3:00 | Show the **unreviewed candidate preference** handoff and source/run identities. | “Another engineer can reproduce and review this comparison. We have not trained a model, validated a learning adapter or proved transfer.” |

If the independent viewer is unavailable, use the labelled standalone CLI report and the already observed **Try pickup before
moving**, **Try wrong destination** and protected-object artifact, clearly state
that this is the offline/report fallback rather than the live upload interaction, and finish the
verified explicit save/reopen loop. Do not simulate a new feature's success.

The matched comparison export retains its original two run IDs. A later operator correction is an additional result, not silently inserted into that earlier preference pair.

The live judge interruption and matched comparison are separate demonstrations.
Changing interventions, initial layout or goal between pair members invalidates
an apples-to-apples candidate comparison. An authored negative plan is not
claimed to be a mistake generated by a model.

## What to say at the chart

> “This is the object's recorded state history, not just its final pose. The
> rule is that Bowl must remain completely unchanged. Here is the first recorded
> change. If status changed before position, the violation marker can appear
> before the position curve moves. Later returning to the starting pose does not
> undo that violation.”

Zero tolerance is intentional for exact native simulator values of an untouched
object. It is not a claim that a noisy camera or physical robot can be evaluated
with the same tolerance. SHA verifies content consistency, not authorship or
physical truth.

## Optional follow-ups

- **Saved evidence:** open Saved recordings, load the exact record, seek actual
  states, export, then Return to live kitchen. Fresh-browser reexport/independent
  native SHA/FK consumption has verified evidence.
- **Fixed versus mobile reach:** same source/target/reach/handling controller,
  with navigation removed in the fixed condition. This is a capability ablation,
  not a model ranking.
- **Real model proposal:** make an explicit intended provider request, retain its
  returned sequence and measured latency. No automatic paid comparison loop.
- **Reference scene and lineage:** a submitted photo/selected video-frame JPEG
  has a fingerprint and optional selected time; loaded variations retain
  declared parent/seed/index. No calibrated reconstruction, temporal human
  action extraction or authenticated ancestry is implied.
- **100 cases:** the rehearsed seed-42 source produced 60 accepted and 40 expected
  refusals. They are correlated synthetic evaluations, not independent human
  demonstrations or a training gain.

## Recovery and honesty

| Problem | Action | Accurate statement |
| --- | --- | --- |
| Microphone/provider failure | Read the visible error; deliberately Reset voice or deliberately stop and reconnect after recovery. | “This turn has not proved a live voice round trip.” |
| Progress narration is late | Use current controller checks. | “Speech refers to an already verified milestone and can be queued.” |
| Human proxy blocks movement | Clear the explicit proxy and Resume. | “This is a software scenario, not tracked human motion or certified safety.” |
| Save fails | Retain/export the recorded evidence and retry the save directly. | “Persistent save is not confirmed; the record remains unreviewed.” |
| Independent viewer rejects the file | Keep original export and inspect the supported format/schema. | “This file has not passed analysis; I will not substitute a fabricated chart.” |
| Independent upload interaction unavailable | Open the already generated standalone HTML report for the same exported pair. | “This is the offline report; its values come from the exported source.” |

The actual combined provider/save/spoken-report run and labelled backup are
prerecorded-input evidence. The separate progress-only audit timed out before
its delivery predicate and remains an incomplete run. Neither replaces a person
speaking and listening in HV-01. See [VALIDATION.md](VALIDATION.md),
[DATA_CONSUMER.md](DATA_CONSUMER.md) and
[REGRESSION_WORKFLOW.md](REGRESSION_WORKFLOW.md) for artifact boundaries.
