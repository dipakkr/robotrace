# TeachTrace delivery contract

Updated **21 November 2026**. The original seven-hour arm-only schedule is
historical. The current product includes household workcell tasks, mobile
manipulation, reviewed records, candidate evaluation and reproducible data
inspection. The roadmap separates this bounded local release from a recipient
pilot and production operations.

## Employee and work product

**TeachTrace is a voice-operated task and evidence console for a robotics data
or evaluation engineer.** The employee defines a supported household task,
reviews its exact plan, observes execution/failures and explicitly saves a
checked record for the team. It runs on a laptop without physical robot hardware.

The output is a reproducible task/scene, actual simulator states and outcomes,
reviewed report and inspectable handoff. A convincing rendering or a large task
ledger does not establish robot training usefulness.

## Deliverables and current evidence

| Deliverable | Implemented/observed result | Remaining boundary or gate |
| --- | --- | --- |
| Workplace and track contract | Employee role, household problem and Initiate/Understand/Execute/Confirm/Follow-up mapped in [judging story](JUDGING_STORY.md) | Track eligibility and scoring belong to the organizer; no awarded score is claimed |
| Mandatory provider path | Agora Conversational AI/RTC, Murf Falcon, LLM and authenticated tools; real prerecorded mobile run executed five skills, 10 m, 111 states and captured remote audio | Current one-session prerecorded voice/task/explicit-save/report/spoken-outcome rehearsal passes five checks; human microphone/listener HV-01 remains open |
| Task/environment library | Repair workbench, kitchen service and lab routing have distinct labels, rules, local SOPs and assignment/report workflows; household scenarios add explicit protected objects | Bounded rigid-object tasks; no clinical decisions, dishwashing, drawers or unrestricted household skills |
| Mobile reach and transport | Known-map routing, actual base movement, reach recheck, pickup/carry/place, human obstruction/explicit resume and fixed/mobile same-scene comparison | Kinematics and idealized attachment; no SLAM, full arm collision dynamics or physical safety validation |
| Explicit reviewed mobile records | Five real API/browser groups verify frozen review, actual 201 saves, independent state checks/report, error/export/retry, fresh-browser reopen and SHA replay | Report is based on recorded simulator states, not authenticated origin or physical motion replay; approval preserves stopped/failed outcome |
| Visible connection recovery | Persistent sanitized mobile errors, pending-start duplicate prevention and existing generation-owned Reset; five error-state groups pass including one actual empty reset | These tests start no provider agent and do not prove human media capture or audible recovery |
| Supported scene authoring | Deterministic/LLM text and explicit photo/selected-frame proposals use validated assets/slots and separate operator approval | Approximate bounded scene, not arbitrary text-to-3D or calibrated reconstruction |
| Reference identity | Exact submitted resized JPEG SHA and actual selected-frame time survive recording/native export; stale reference cancels before API; source limit 50 MiB | No original-media/filename stored in world; calibration/rights verification false; temporal human actions not extracted |
| Factual progress speech | Real captured RTC speech/automated transcript includes requested idle marker and verified reach-check milestone | That audit's overall delivery wait timed out; queued/accepted API response is not playback proof or a completed run |
| Candidate evaluation | Exact human/baseline/LLM symbolic order is executed without repair. Wrong goal and protected pick-and-return fail despite mechanical completion | High-level controller/task evaluation, not a learned motor-policy benchmark or statistical model ranking |
| Reproducible variations | Rehearsed 100-case source at seed 42: 60 accepted, 40 expected refusals, zero unexpected outcomes/provider calls; trace export and child loading work | Correlated synthetic cases, not independent human demonstrations; arbitrary-scene robustness remains open |
| Parent/child lineage | Loaded child native records retain declared parent SHA, seed/index/kind. Actual two-child browser/consumer check preserves one group with distinct child hashes | Ancestry unverified; no actual train/test split or leakage-free guarantee |
| Portable state-analysis handoff | Node-only consumer verifies SHA/FK, excludes same-clock target pairs, preserves failure/control metadata and writes JSONL plus manifest | Targets are next observed states, not requested motor commands, calibrated actions, LeRobot/RLDS compatibility or training results |
| Local operations and preview | One-command launcher/status/restart, private local configuration, tool-only public callback, static hosted UI; 15 preflight checks pass | Hosted preview does not deploy the local API/records/providers. Production tenancy, monitoring, recovery/load gates remain open |
| Release material | Current runbook, internal acceptance/evidence matrix, stable atomic backlog and candid limits | Continuous provider workflow, exact-record handoff/consumer, six-step UI fix/build and labelled 75.72 s automated backup verified; human stage/audio acceptance and final source/publish manifest remain separate |

## Main complete workflow

1. Open **Mobile kitchen**, connect voice and request **“Take cup from counter to
   sink.”** Retrieve current task/world information and review the five steps.
2. Approve the reversible simulation. Navigate to Counter, recheck reach, collect
   Cup, navigate to Sink and place it. Human obstruction requires clearance and
   explicit Resume. Actual task checks decide whether delivery is verified.
3. In Review, choose **Review & save mobile evidence**. Inspect the frozen source,
   then **Approve & save mobile evidence**. The API saves a local record/report;
   no countdown or voice acknowledgment submits it automatically.
4. Use **Saved recordings → Open mobile recording**. SHA-verified read-only replay
   shows recorded states; export and **Return to live kitchen** preserve the live
   scene. A stopped/failed saved attempt retains that outcome.

The final continuous prerecorded provider session now passes five checks: actual
five-step task, explicit save, independently accepted report in live context and
factual captured delivery/save speech. A first harness-failed attempt is retained
separately; its partial success was not relabelled. Fresh-context GET/replay/reexport and independent consumer of that exact saved
record now pass four checks (117 observations/116 pairs). A 75.72 s labelled
automated backup combines prerecorded command and actual remote audio with
approximate A/V alignment; it is not a human stage/microphone test. See
[VALIDATION.md](VALIDATION.md) for the actual provider/browser boundaries.

Workcell tasks also complete their local assignment→record→review→persistent
report loop. Their knowledge source is a locally authored sample SOP or reviewed
scene task, not a claimed outside enterprise connector.

## Configuration already available for this checkout

The required provider configuration has been supplied and exercised. Keep it in
ignored `.env.local`; do not paste secrets into chat or client-side `VITE_` values.
A fresh clone follows [account setup](ACCOUNT_SETUP_CHECKLIST.md).

| Configuration | Required values |
| --- | --- |
| Agora project | App ID and matching App Certificate; certificate-based REST auth makes Customer ID/Secret optional |
| Murf | Falcon-enabled API key and supported voice configuration |
| LLM | Server-side key plus the configured compatible endpoint/model |
| Callback | Public HTTPS origin for authenticated tool listener 8788 |

No Hugging Face, extra storage account or cloud GPU is required for the local
workflow. A separate recipient/physics/production path may require them later.

```sh
npm run demo:start
npm run demo:status
npm run doctor -- --check --health
```

Use **http://127.0.0.1:5189/** for the full local workflow. Doctor reports local
presence/format/health without paid provider calls; it does not prove human
speech operation. Restarting the API requires reconnecting voice afterward.

## Small tasks and acceptance records

[DELIVERY_BACKLOG.md](DELIVERY_BACKLOG.md) retains stable task/gate IDs rather than
an obsolete fixed task count. New bounded groups are AB (mobile reviewed records),
AC (submitted reference identity), AD (correlated lineage) and AE (visible voice
recovery). [FEATURE_ACCEPTANCE.md](FEATURE_ACCEPTANCE.md) defines their narrow
observed checks as F-23–F-26/E18–E21. The latest integrated snapshot has **282
passing tests** (163 simulation/data + 119 server/scripts) and a passing production
build; further source changes still require affected regression/build checks.

Recorded handoff, six-step Review regression and automated backup now pass.
Open work includes final source/publish manifest, untested approval/keyboard edges,
a live human stage rehearsal and HV-01. Source,
automated acceptance and human acceptance remain distinct statuses.

## Pilot and production deliverables

- **Recipient pilot:** agree the robot/observation/action contract and rights;
  implement a real consumer loader; validate shapes/units/unavailable modalities.
- **Learning experiment:** appropriate signals, fixed recipe, held-out cases and
  measured baseline/comparison. Native state analysis alone cannot close it.
- **Physics/hardware:** suitable contact/sensor/control backend, calibrated
  observations, collision/safety tests and a separate real-robot protocol.
- **Production operation:** authenticated tenants, isolation, durable jobs/storage,
  concurrency limits, monitoring, backup/restore and measured load acceptance.
- **Temporal human-reference workflow:** permitted recordings, observed/inferred
  annotations, uncertainty, correction lineage and prospective utility evaluation.

There is no universal frontier-lab ingestion endpoint, partnership or automatic
training gain in this release. Research context is in
[PHYSICAL_AI_RESEARCH.md](PHYSICAL_AI_RESEARCH.md); the concrete current handoff
is specified in [DATA_CONSUMER.md](DATA_CONSUMER.md).
