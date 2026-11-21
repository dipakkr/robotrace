# Evaluation → independent analysis → regression → candidate handoff

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


Updated **21 November 2026**. The product is a task-quality workflow for a
robotics QA/evaluation engineer. Its output is a reproducible failure and a
candidate correction that another engineer can inspect, rather than an animation
or a claim that a policy has been trained.

**Current status:** matched-pair UI **AUTOMATED-DEMO** (four browser groups,
exactly two local evaluations, no paid calls); portable analysis/CLI/report
**AUTOMATED-CHECK** (seven meaningful tests and an actual two-controller-run CLI
analysis). The independent file-upload page now passes four browser groups, including exact pair IDs/values, offline standalone output, tamper rejection and phone layout.
Existing voice/save/replay evidence remains separately recorded in
[VALIDATION.md](VALIDATION.md). The records for this extension are listed below.

## Two demonstrations with different purposes

The live mobile task demonstrates employee interaction: ask **“Take cup from
counter to sink”**, read the terminal plan/events, let the judge introduce the software human
obstruction, clear it and explicitly Resume. Save or export the resulting attempt directly; saving does not mark it reviewed. It demonstrates supervision and truthful recovery.

The matched regression pair is a controlled comparison. Both candidates use the
**same frozen protected-table scene and Cup → Sink goal**. The live interruption
run is not one member of that pair: its intervention history differs. Do not
compare an interrupted live task with a different unperturbed layout and call the
result a matched plan experiment.

## The operational loop

| Step | Engineer's action | Inspectable output |
| --- | --- | --- |
| 1. Specify | Freeze the source scene, inventory, Cup → Sink goal and Bowl-unchanged rule. | Actual initial world, seed/IDs and source-scene fingerprint. |
| 2. Evaluate | Run the two declared candidates through the bounded controller. | Actual ordered actions, recorded states, controller outcome and independent task checks. |
| 3. Analyze elsewhere | Export the run/pair and open the independent file-upload analysis page. | Source-derived state/position chart and first recorded rule change, without simulator/API access. |
| 4. Regress | Remove the offending Bowl operations or load the supported corrected recipe; rerun against the same frozen source/goal. | Passing and failing outcomes stay attributable to their actual candidates. No silent evaluator repair. |
| 5. Hand off | Export a **candidate preference pair**, retaining both source runs, rule and reasons. | Unreviewed candidate comparison for a teammate; no trained model, approved training sample or learning gain is implied. |

The matched export schema is `teachtrace.mobile-matched-pair.v1`, with
actual results under `runs`, their source identity and candidate metadata. The
new UI action is **Run matched regression pair**. It makes two
local evaluation requests, without a model or voice request. The four browser groups verify this UI/export contract. Independent viewer visual/file checks also pass; module and browser evidence remain separately inspectable. An optional real model proposal remains an explicit separate provider
action; an authored negative test is never relabelled as a model failure.

## Why the Bowl round trip matters

The failing candidate can deliver Cup correctly, then pick up the protected
Bowl and return it to its exact original final pose. Its controller can finish
successfully while the task fails. The unchanged-object rule concerns the
**recorded history**, not only the final screenshot.

The canonical criterion shared by evaluator, export and portable analysis is: the protected object's complete simulated record must
remain exactly unchanged. The positional tolerance is **zero** for
this exact simulator record, rather than an invented one-centimeter threshold.
An untouched object is expected to preserve its stored values exactly; there is
no measured sensor noise to justify quietly weakening that contract. This is
not a recommended tolerance for a physical robot or reconstructed video.

The first violating observation may be a **status/record change before visible
position change**. For example, entering a loading state can violate the full
record rule while the plotted position has not yet moved. The chart must retain
that distinction instead of claiming that physical contact or displacement
occurred at that instant. A later positional excursion and exact final return
can coexist with the earlier recorded-state violation.

The producer forces the first violating native state into the exported trace and preserves its actual action attribution. Tests compare it with native tick evidence and reject a forged first marker. A chart of position alone is not
an independent reconstruction of contact, forces, intent or an unrecorded event.

## Independent means a different consumer

The [independent trace page](../public/trace-analysis.html) reads an operator-selected local export.
It runs without the React app, simulator runtime, provider credentials or API
connection. Its verified plots derive from the file's actual coordinates and records. A pre-drawn success/failure illustration is not analysis evidence.

The already verified Node consumer in [DATA_CONSUMER.md](DATA_CONSUMER.md) handles
sealed native workcell/mobile recordings, independently checks SHA/FK and writes
state-analysis JSONL plus a manifest. The matched-pair/viewer/report path independently checks protected history and
source identity; it does not execute the candidate or independently recompute all task checks. Do not imply that every format has
native seal/FK validation just because the existing native consumer does.

Independence is not source authentication. A self-consistent file and a valid
hash do not establish who recorded it, whether the scene matches reality or
whether its declared ancestry is truthful.

## What the preference candidate is for

A preference candidate retains the task/source identity, the actual better and
worse candidates under that task rule, both evaluation outcomes and the reason
for preferring one. It remains **unreviewed**. A person or recipient pipeline must
check the labels and actual input/action contract before any training use.

A subsequent **Load correct recipe → Evaluate operator candidate** is an additional recorded test on the selected frozen scene. The existing **Download comparison** still identifies its original two runs; it does not silently substitute that later result. Export the additional result separately unless a new pair is actually built.

A passing recipe can be a useful proposed correction without being an LLM
improvement. This release does not update model weights, fit a reward model,
validate DPO/RLHF compatibility or prove that training on the pair improves a
held-out task. It also does not turn simulated joint deltas into measured motor
commands. The immediate value is reproducible failure triage and a precise
candidate handoff for another engineer.

## Evidence and remaining acceptance

- [Matched UI results](../.local/qa/matched-pair-ui-results.json): four passed groups; shared source SHA/goal, both Cup at Sink, accepted baseline/rejected Bowl round trip, actual canvas replay/step-8 jump and 390-width layout. [Actual comparison](../.local/qa/mobile-matched-pair.json) retains original run IDs and candidate-unreviewed preference.
- [Portable analysis tests](../scripts/protected-analysis.test.mjs): actual controller plans, first tick/position agreement, status-only zero-distance change, tiny exact displacement, tamper/source/schedule/first-marker rejection, safe HTML embedding and no-overwrite CLI behavior.
- [Actual CLI report](../.local/qa/matched-analysis-final/report.html) and [analysis](../.local/qa/matched-analysis-final/protected-analysis.json): analyze the **same exported browser pair** and preserve both source run IDs. One run preserves and one violates protected history.
- [Independent viewer QA](../.local/qa/trace-analysis-results.json): four passed groups cover actual pair IDs/verdicts, first violation/time/XYZ, source-derived JSON and fully offline standalone HTML, tampered input clearing the old verdict and phone usability.

The verified loop checks, to preserve on later changes, are:


- Both pair members retain exactly the same initial scene, goal, seed/IDs and
  canonical source identity; the Bowl starts at Table in that shared scene.
- The protected round trip actually executes and completes, but task acceptance
  fails at the first recorded complete-object change, even after exact final
  restoration. The correction passes the same task without hidden repair.
- The exported first violating state, step attribution and zero-tolerance
  contract agree with independent file-derived analysis. Status-first and
  position-first events are not conflated.
- The independent page opens the actual export without app/API dependencies and
  plots real values. Unsupported or inconsistent inputs fail clearly.
- The matched report and unreviewed preference candidate preserve actual run
  results. No model score, human approval or training gain is fabricated.

These checks are the new release scope. Human microphone/listening HV-01,
physical robot/contact validation, recipient training integration and measured
learning/transfer remain separate gates.

For this actual exported pair, the first violating sample is at **20.6 simulated
seconds**, pickup **step 8**, with displacement **0.021831868 m**. Peak displacement
is **1.195583427 m**; final displacement is **0**, and the complete final Bowl
record is restored. These are source-derived values for this run, not a threshold
or a promise for other cases. Separate tests cover status-only changes at zero
displacement and tiny exact coordinate changes.
