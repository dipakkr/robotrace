# Mentor check-in and live demonstration

Updated **21 November 2026**. Start with the 90-second checkpoint; expand only if the mentor asks. Timings are presentation budgets, not latency promises. Keep the core story in the mobile kitchen: voice → task → execution → explicit evidence review → saved report → replay.

## First 90 seconds

| Budget | Action | Explanation |
| --- | --- | --- |
| 0–10 s | Show the initial mobile kitchen | “This is a voice-assisted task QA console for robotics operators. It tests whether an AI plan executes and whether it meets the requested goal.” |
| 10–55 s | Connect voice; ask **“Take cup from counter to sink.”** Show the returned plan, approval mode and motion | “Cup starts beyond arm reach. The base navigates, rechecks reach, collects and delivers. The assistant reports returned evidence rather than assuming a queued action succeeded.” |
| 55–75 s | Open **Review → Review & save mobile evidence**, inspect the frozen recording, then **Approve & save mobile evidence** | “Saving is a separate human decision. The local API verifies the seal and arm coordinates, recomputes recorded-state checks, and returns this durable record ID and service report.” |
| 75–90 s | Open **Saved recordings**; reopen the record and seek first/last frames | “This replays stored states without moving the live robot. A stopped attempt stays stopped and not accepted. This software gate does not approve physical deployment.” |

If voice fails, acknowledge it and continue through local commands. That recovery does not prove a successful live voice round trip.

## Three pitch lengths

**15 seconds:** “TeachTrace helps a robotics QA operator test a spoken task in a simulator, catch wrong AI plans, and save a replayable evidence record. It separates ‘the robot moved’ from ‘the requested task passed.’”

**30 seconds:** “An AI plan can miss navigation, choose the wrong destination or disturb an object that should stay untouched. TeachTrace lets an operator brief a task by voice, inspect simulated execution and compare human, baseline and model plans against the same frozen goal. The output is a reviewed service report and replayable failure case. Today that is task QA in a known-map kinematic simulator; learned manipulation and hardware transfer remain separate gates.”

**60 seconds:** “Our employee is a robotics QA operator or demonstration collector. Agora carries the conversation and Murf Falcon speaks. The assistant retrieves the current scene and local procedure, calls a bounded action tool, and reports verified outcomes. The mobile robot navigates before collecting an initially unreachable cup. The operator explicitly reviews and saves that same attempt through the API, receiving a persistent report and replay. We also evaluate real model-proposed skills without fixing their mistakes. A sequence can finish at the wrong destination and fail the goal, or restore an unrequested Bowl’s exact final pose and fail because it was picked up. This is a reproducible software test and handoff for engineers; calibrated training actions, held-out learning gains and real hardware remain future work.”

## Four-minute live workflow

### 0:00–0:15 — name the job

“The operator needs to know what a task meant, what the AI proposed, why it failed, and what another engineer can reproduce.” Point to Cup, Bowl, Counter, Sink and Home. The floor map is known and the handoffs are idealized.

### 0:15–1:00 — complete the voice/action loop

Ask **“Take cup from counter to sink.”** Show current scene/SOP retrieval and the returned navigation, reach check, collection and delivery actions. Follow the actual approval mode: eligible reversible simulation gets a visible three-second cancellation window; manual mode requires explicit approval.

Ask **“What is the latest verified result?”** Report only current returned evidence. An acknowledgement or `status:running` is not delivery. Queued speech is not live phase telemetry.

### 1:00–1:30 — save that same mobile attempt

Open **Review & save mobile evidence**. Inspect command, outcome, states, travel and digest. Explicitly approve saving. Show the service report and record ID. Open **Saved recordings**, load the record and seek first/last states; then return to the live kitchen.

The API recomputes from supplied recorded simulator states. It does not claim to execute/replay those states or authenticate the recorder. Saving a failed/stopped recording cannot turn it into an accepted task. On save failure, the reviewed envelope stays frozen for export/retry.

### 1:30–2:05 — expose concrete plan failures

Open **AI deployment checks**. Use **Try pickup before moving**, evaluate the operator candidate and show the actual failing reach/handling guard without inserted navigation. Then use **Try wrong destination**: its sequence can complete, but Cup at Table fails the independent Sink task. These are deliberate operator tests, not claimed model errors.

Run the five-case bounded baseline suite:

| Case | Observed baseline category |
| --- | --- |
| Initial distant Cup | Completed and accepted after navigation |
| Cup beyond reach even at dock | Reach failure; no pickup |
| Furniture blocks passage | Route refusal; no invented travel |
| Human obstruction proxy | Blocked; no completed delivery |
| Bowl already at Table | Cup task accepted; Bowl preserved |

The exercised suite produced **two accepted tasks and three failure/refusal/block outcomes**. Those are not five deliveries or an automatically awarded model score.

### 2:05–2:45 — evaluate one real model proposal

Choose a configured model and click **Generate & evaluate AI plan** once. Show its exact proposed actions, measured request time and server-executed result. Replay the attempt. Keep the frozen task and candidate unchanged.

The observed live check used **one `gpt-4o-mini` request**, returned **five actions**, and measured **2,797.58 ms** request time. That candidate completed and passed this task. This is one case study, not a model ranking or promised latency. Show whatever the new request returns. Invalid provider responses remain separate request failures.

For the strongest exception, use **Try protected Bowl round trip**. The tested sequence restores Bowl’s exact final record, yet fails the untouched-object rule because it picked Bowl up at **step 8**. Show “controller completed / task not accepted,” the violating object/station and actual replay. Never remove the offending action to make the candidate pass.

### 2:45–3:25 — export and independently inspect

Export the harness report: actual candidates, results, failures and replay traces. Its source/model labels are declared metadata; controller recomputation is not cryptographic proof of provider authorship.

For the standalone consumer, export the supported **main mobile evaluation envelope** from the live/saved recording. The harness report is a different schema. Run:

```sh
node scripts/consume-evidence.mjs /absolute/path/to/teachtrace-mobile-evaluation.json --out /absolute/path/to/review-output
```

Show integrity, frames, timestamps and state-pair counts. The consumer checks supported file/kinematic consistency and emits **next-observed-state analysis**. Its targets are not commanded motor actions, a LeRobot dataset or an improved policy. Task acceptance is explicitly not recomputed by this consumer; the saved service report has its own recorded-state verification basis.

### 3:25–4:00 — useful scale and the next gate

If asked about more cases without new filming, show the recorded seeded-variation evidence: two different child layouts share a declared parent fingerprint and have distinct computed child hashes. This helps group related cases for curation. It does not authenticate ancestry or establish a leakage-free train/test split. The optional tabletop variation demonstration is separate; no switch is needed to prove the mobile workflow’s follow-up.

Close with: “We have a reviewable predeployment software case and a durable handoff. Training readiness needs a specified observation/action contract and real learning consumer. Learning benefit needs held-out evaluation of learned actions. Physical transfer needs calibrated robot tests.”

## Evidence to keep open

| Artifact | Recorded evidence |
| --- | --- |
| [Mobile voice test](../.local/qa/mobile-voice-results.json), [remote speech transcription](../.local/qa/mobile-remote-transcript.json) | Prerecorded speech through real providers; Cup delivery, Bowl at Counter and received remote audio. Human microphone/listening are separate pending checks |
| [Mobile store browser checks](../.local/qa/mobile-store-smoke-results.json) | Five passed checks; two real HTTP 201 saves, completed/accepted and stopped/not accepted; failed-save recovery, replay and fresh-context persistence |
| [Live planner browser checks](../.local/qa/mobile-planner-live-results.json) | Nine actual evaluation requests, one model request, observed report counts and desktop/phone checks |
| [Protected-history browser checks](../.local/qa/protected-mobile-results.json) | Completed sequence rejected for Bowl pickup at step 8 despite exact final restoration |
| [Lineage browser checks](../.local/qa/lineage-smoke-results.json) | Two recorded children, one declared parent group, distinct child hashes; zero provider requests |

These are local artifacts, not automatic public uploads. Do not present a historical result as the current live turn. Before presenting, perform one genuine human-microphone exchange and listen to its output; prerecorded audio and a transcript cannot complete that check.

## Direct answers

**Is it a game?** It is a bounded software harness with real controller guards, frozen goals, failure attribution and durable evidence. Its idealized kinematics do not model full physical robot behavior.

**Who benefits?** A robotics integration/QA operator could reproduce task-level failures and share precise evidence faster. Time saved and willingness to pay require a controlled recipient trial; neither is measured yet.

**Does this train frontier robots?** No current claim. The consumer makes native state analysis usable outside the UI. Target action definitions, training-framework import, learned-policy evaluation and physical transfer remain unvalidated.

**What about Go Home?** It is navigation, not delivery. An initially held Cup may stay carried, with zero placements. The service checks custody across recorded states; unloading/reloading cannot erase a violation. Home is a parking station, and raw pickup/place there is refused.

**Why could it compete?** A clear employee, voice-driven tool actions, visible consequences, demonstrated exceptions and a reviewable follow-up make a coherent pitch. This is positioning, not winning odds or a claim about unpublished judging weights. See [HACKATHON_POSITIONING.md](HACKATHON_POSITIONING.md).
