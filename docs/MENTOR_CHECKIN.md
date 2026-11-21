# Mentor check-in: the product loop

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


Updated **21 November 2026**. The employee is a robotics QA/evaluation engineer.
The product is **evaluate → independently analyze → regress → hand off a
candidate correction**. Voice and visible robot execution are the interface;
a reproducible test and inspectable outcome are the work product.

**Current status:** matched comparison UI passes four browser groups with two
actual local evaluations and no model calls. Portable analysis/CLI/report passes
seven tests plus an actual CLI run. The standalone upload viewer passes four browser groups on the actual comparison export, including offline report reopening and tamper rejection. Earlier
provider/save/replay evidence remains verified and separate.

## The 30-second explanation

> “An AI plan can complete its motions and still fail the task. RoboTrace lets
> a robotics engineer brief a task by voice, evaluate exact actions on a frozen
> scene, export the result for independent inspection, and rerun a correction.
> The proposed handoff retains both candidate plans, their actual failures and
> source identity. It is unreviewed evidence for another engineer, not proof that
> we trained or improved a policy.”

## The first 90 seconds

| Budget | Action | What it establishes |
| --- | --- | --- |
| 0–15 s | State the job; show Cup, Bowl, Counter, Sink and the beyond-reach start. | A concrete task and known-map kinematic simulator, without hardware claims. |
| 15–55 s | Ask **“Take cup from counter to sink.”** Read the terminal plan/events as motion starts; let the judge introduce/clear the human obstruction, then explicitly Resume. | Real tool-driven navigation/reach/handling, observed outcome and supervised recovery. This live intervention run is separate from the matched pair. |
| 55–75 s | Save mobile evidence with one action; show the unreviewed record and returned report. | Durable local follow-up without an approval claim. Saving cannot turn a stopped/failed attempt into success. |
| 75–90 s | Introduce the matched comparison and unchanged-Bowl rule. | Next step is a controlled regression on one frozen protected-table source, with the same Cup → Sink goal for both candidates. |

For the full three-minute sequence, use [DEMO_SCRIPTS.md](DEMO_SCRIPTS.md).
If a live voice attempt fails, acknowledge it and use typed local commands or the
labelled actual-build backup. That fallback does not prove a live voice exchange.

## The engineering distinction to demonstrate

In the observed matched pair, both candidates deliver Cup to Sink from the same
source. The negative candidate also picks up protected Bowl and restores its
exact original final pose. Its movement sequence can finish while the task
fails. The relevant evidence is the complete object history, not the last image.

The new analysis contract intentionally uses **zero tolerance for the exact
native protected-object record**. A first status/record change can precede visible
position movement. The independent chart must explain that distinction rather
than inventing a one-centimeter threshold or claiming contact-force sensing.
The export should preserve the first violating native observation and actual
step attribution; this remains subject to the new QA.

After removing the Bowl operations, rerun the corrected candidate against the
same source/goal. An authored correction is a new tested candidate, not evidence
that a model learned. The preference handoff remains **unreviewed**, retains both
actual run outcomes and requires the recipient's review/action contract before
training use. No weights, reward model or learning benchmark are changed here.

## Independent analysis and current evidence

The existing Node-only consumer verifies native export SHA/FK and produces
observations/next-observed-state targets without React, Three.js or simulator
imports. That is a verified portable inspection path. Its targets are not motor
commands, and it does not rerun the task or authenticate the recording.

The new standalone file-upload viewer and matched-pair report extend that
inspection loop; the module/CLI checks cover shared-source identity, first change and malformed files; the independent viewer now passes four separate browser groups on the same source export.
The browser viewer must not depend on app memory or the evaluation API to display
its file-derived results.

| Existing artifact | Narrow observed evidence |
| --- | --- |
| [Combined provider workflow](../.local/qa/final-workflow/results.json) | Five checks in one real-provider session: prerecorded task, actual five-step/three-check execution, explicit 201 save, saved-report voice context and factual captured speech. Both human audio flags false. |
| [Exact-record handoff](../.local/qa/final-workflow/handoff-results.json) | Four fresh-browser GET/replay/reexport/consumer checks; exact saved record, 117 observations/116 positive-time pairs, zero POST/provider calls. |
| [Mobile store QA](../.local/qa/mobile-store-smoke-results.json) | Real completed/accepted and stopped/unaccepted saves; unavailable-save frozen retry/export; fresh-browser replay and source preservation. |
| [Protected-history QA](../.local/qa/protected-mobile-results.json) | Actual completed Bowl round trip rejected at pickup step 8 despite exact final restoration. New zero-contract/independent-viewer regression remains its own gate. |
| [Actual model UI request](../.local/qa/mobile-planner-live-results.json) | One gpt-4o-mini candidate and measured request time, evaluated without repairing its actions. This is not a model ranking. |
| [Matched comparison QA](../.local/qa/matched-pair-ui-results.json) and [independent viewer QA](../.local/qa/trace-analysis-results.json) | Two local authored runs share source/goal; both deliver Cup, only Bowl round trip fails. Actual file-derived first violation, JSON values, offline HTML and tamper/phone checks pass; no model calls. |
| [Lineage QA](../.local/qa/lineage-smoke-results.json) | Two different recorded children share declared parent group; distinct computed child hashes and unverified ancestry remain explicit. |

These ignored local artifacts may be absent in a fresh checkout. A historical
run is not the current live turn. The [automated backup](../.local/qa/final-workflow/teachtrace-voice-workflow.mp4)
uses prerecorded commands and actual remote audio with approximate A/V alignment;
it is not a human microphone/listening pass.

## Direct answers

**Who benefits?** A robotics integration/QA team can reproduce a task-level
failure, inspect the exact changed record and share a proposed correction.
Measured time savings and willingness to pay still require a recipient trial.

**Why voice?** The engineer can brief and supervise the visible task without
turning every interaction into a form. Agora provides the conversational/RTC
path, Murf Falcon the output voice, and tools retrieve context and perform
bounded actions. Evidence, rather than fluent speech, determines task outcome.

**Does it train robots?** The immediate output is test evidence and an unreviewed
preference candidate. We have not validated a training adapter, trained a policy,
measured learning gain or demonstrated hardware transfer. Recipient data rights,
action definitions, loader and held-out experiment remain separate gates.

**Why zero tolerance?** An untouched native simulator object should retain its
stored values exactly. This is a declared exact-record invariant, not a physical
sensor-noise standard or proof that there was no contact.

**Is it production-ready?** It is a bounded local prototype. Full physics,
calibrated perception, physical safety, multi-user cloud operations and downstream
training remain separate. The static hosted preview does not supply the local
backend/provider session.

**What still requires a human?** HV-01: a person speaks into the real microphone,
hears actual provider speech and verifies the task/outcome. Prerecorded input,
RTC bytes, automated transcription and a preference label cannot close that gate.

See [REGRESSION_WORKFLOW.md](REGRESSION_WORKFLOW.md),
[DATA_CONSUMER.md](DATA_CONSUMER.md) and
[FEATURE_ACCEPTANCE.md](FEATURE_ACCEPTANCE.md) for contracts and remaining gates.
