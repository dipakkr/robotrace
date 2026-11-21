# TeachTrace

**A voice-operated task and evidence console for a household robotics team.**

A robotics data or evaluation engineer specifies a task, observes its plan and
execution in an activity terminal, and saves a checked record. TeachTrace
runs on a laptop without robot hardware. Its output is a reproducible scene,
observed states, failures and a report for the team. Saved records remain
unreviewed unless a separate human quality review is actually performed.

## Run locally

```sh
npm install
npm run demo:start
npm run demo:status
```

Open **[http://127.0.0.1:5189/](http://127.0.0.1:5189/)**. Use a recent Node version
supporting `--env-file-if-exists`; the full launcher also needs `cloudflared`.
The UI listens on loopback port **5189**, the local API uses **8787**, and the
public HTTPS tunnel exposes authenticated tool callbacks on **8788** only.

```sh
npm run doctor -- --check --health
npm run demo:restart-api  # Reload backend changes; reconnect voice afterward
npm run demo:stop         # Stop only verified project-owned processes
```

The launcher checks process ownership before reuse/stop and keeps logs/PIDs in
ignored `.local/`. A new callback tunnel updates only `PUBLIC_API_BASE_URL` in
`.env.local`. For simulator use without a tunnel, run `npm run server` and
`npm run dev -- --host 127.0.0.1 --port 5189 --strictPort` in separate terminals.

## The main demo: voice → live activity → checked evidence

1. Open **Mobile kitchen**, connect voice and say **“Take cup from counter to
   sink.”** The cup begins 5.15 m away, beyond the 1.35 m stationary arm reach.
2. The command runs immediately: navigate to Counter, recheck reach, collect Cup,
   navigate to Sink, and place Cup. The compact green activity terminal records
   the actual context, plan, current action and results; yellow marks warnings
   and red marks failures. There are no task approval tabs or countdowns.
3. Observe actual base travel and carried-object movement. **Human enters** places
   a person ahead; the robot takes a clear detour and keeps its cargo. Use
   **Place person** and click the Top-view floor to reposition them.
   **Block destination → Clear human → Resume** tests the genuinely blocked case.
   Completion requires actual docking and delivery checks.
4. Click **Save mobile evidence** once. The local API verifies integrity and
   recorded geometry/history, saves the native record and returns a report.
   Its review status stays **Unreviewed**; failed/stopped outcomes are preserved.
5. Open **Saved recordings → Open mobile recording**. The application verifies
   its SHA-256 and shows read-only replay. Scrub the actual states, export the
   recording, then **Return to live kitchen**; the live world is preserved.

The earlier combined real-provider rehearsal passed: prerecorded voice → five actual
steps → explicit review → HTTP 201 save → factual spoken report. A fresh browser
reopened that exact record, replayed and reexported it; the standalone consumer
verified its seal and kinematics. See [validation](docs/VALIDATION.md) and the
[labelled backup video](.local/qa/final-workflow/teachtrace-voice-workflow.mp4).
A saved report is local persistence, not an upload to a robotics lab. That
recording uses the historical approval UI; the current interface executes
immediately. The new [90-second simulation recording](.local/qa/simulation-video/teachtrace-simulation-walkthrough.mp4)
shows the prior immediate local controls and pause policy, direct save, matched regression
and independent trace analysis. It uses typed commands, not a live voice session.

Open **QA console → Run matched regression pair**. Both authored
plans deliver Cup to Sink; the Bowl round trip fails despite restoring its
exact final state. **Download comparison**, open [Trace analysis](http://127.0.0.1:5189/trace-analysis.html)
and load that export. The independent consumer plots the real displacement and
first recorded violation. Its downloaded HTML works offline. See the
[regression workflow](docs/REGRESSION_WORKFLOW.md).

**Compare fixed vs mobile reach** holds the initial scene, target, reach and
handling controller constant while removing navigation from the stationary
condition. **QA console** executes declared human, bounded-baseline or
LLM symbolic plans. It preserves wrong ordering and destinations: controller
completion can still fail the task, including moving a protected Bowl and
returning it to the exact original pose. This is controller/task evaluation,
not a learned motor-policy benchmark.

**Go Home** is a navigation goal. It can retain loaded cargo and never counts
parking as an object delivery or invents a placement.

The **QA console** runs six frozen baseline conditions (three deliveries and
three guard outcomes), separates task acceptance from expectation matches, and
retains actual evaluation records across reloads. Its condition × candidate
matrix leaves unrun cells empty. AI suites are explicit, bounded provider calls.
See [the QA demo guide](docs/QA_DEMO.md).

## Workcell tasks, reference scenes and variations

**Environment → Household scenarios → After-meal counter reset** provides a
second complete workflow: **“Clear the after-meal counter”** moves two used cups
to the Sink rack while leaving the reserved bowl untouched. This is rack loading,
not dishwashing. Repair and sample-routing environments also have retrievable
locally authored SOPs and assigned tasks. One-click workcell saving stores an
episode, updates its local assignment and creates a persistent report.

Text, a photo or one selected video frame can propose a supported scene for
operator review. The applied world retains the SHA-256 of the exact submitted
resized JPEG, reference kind and selected-frame time, without retaining media or
filenames. Calibration and rights verification are explicitly false. This is an
approximate scene using bounded assets/slots, not room reconstruction or tracked
human motion.

**Generate variations** executes reproducible layouts, reach challenges and human
occupancy cases from one source. The rehearsed after-meal task at seed 42/count
100 produced **60 accepted tasks, 40 expected refusals and zero unexpected
outcomes**, without provider calls. These are correlated synthetic cases, not
100 independent human demonstrations. Loaded child recordings retain their
shared declared parent fingerprint, seed, index and kind. Hashing time is
reported separately from controller/trace generation time.

## What another program can consume

Native exports contain task/scene states, events, outcomes and the same derived
joint/link/TCP coordinates used by the renderer. The standalone consumer needs
only Node built-ins:

```sh
node scripts/consume-evidence.mjs INPUT.teachtrace.json --out .local/consumer/run-1
```

It verifies integrity and additive forward kinematics, then writes JSONL
observations and **next-observed-state targets**, plus a manifest. These targets
are not requested motor commands. Related variants share declared parent groups;
ancestry remains unverified, and no train/test split is performed. See
[the consumer contract](docs/DATA_CONSUMER.md).

This supports reproducibility, regression, failure triage and data inspection.
It does not establish calibrated training actions, LeRobot/RLDS compatibility,
recipient ingestion, a trained policy, learning gain or real-robot transfer.

## Agora + Murf configuration and voice evidence

Follow [account setup](docs/ACCOUNT_SETUP_CHECKLIST.md) and
[server setup](server/SETUP.md). Keep credentials only in ignored `.env.local`:

- `AGORA_APP_ID`, `AGORA_APP_CERTIFICATE`;
- `MURF_API_KEY`, `LLM_API_KEY`;
- `PUBLIC_API_BASE_URL`, maintained for a new callback tunnel by the launcher.

Never put secrets in chat, source, exports or `VITE_` variables. Certificate-based
Agora REST authentication makes Customer ID/Secret optional. Agora Conversational
AI/RTC supplies the session/audio transport; Murf Falcon supplies speech output;
the LLM retrieves context and uses authenticated action tools.

A real-provider prerecorded mobile run executed five skills, travelled 10 m,
recorded 111 states, verified Cup at Sink and captured 738,889 remote-audio bytes.
A separate audit captured and transcribed real progress speech, but its overall
delivery wait timed out; it is evidence of progress audio, not a passed complete
run. **A person's microphone/speaker acceptance remains open.** Queued speech is
not proof of playback, and speech can arrive after the verified milestone.

Mobile connection errors are visible with **Reset voice** recovery. A pending
connection disables duplicate starts. Recovery tests deliberately denied the
microphone before any provider start; they do not count as live-voice acceptance.

## Readiness and boundaries

This is a working bounded prototype, **not a production-ready robotics platform**.
The simulation has idealized attachment grasps and analytic kinematics, without
contact dynamics, measured forces, SLAM, complete arm collision checking or
validated physical safety. A phone reference does not supply calibrated sensing.

The private hosted preview is a static frontend. The full workflow uses the local
Node API, local records and laptop callback tunnel; cloud multi-user operations
and recipient integration remain separate work. Local preflight checks cover
private credential permissions, blocked `.local`/environment HTTP access and
secret-free build output. These checks do not establish production security.

```sh
npm test
npm run build
```

[Validation](docs/VALIDATION.md) records observed checks and open gates;
[feature acceptance](docs/FEATURE_ACCEPTANCE.md) and the
[atomic task backlog](docs/DELIVERY_BACKLOG.md) separate implementation, automated
evidence, human acceptance and future work. Use the
[four-minute runbook](docs/DEMO_SCRIPTS.md) and
[judging story](docs/JUDGING_STORY.md) for the demo.

Primary research and design context: [Physical AI](docs/PHYSICAL_AI_RESEARCH.md),
[data strategy](docs/DATA_FLYWHEEL_STRATEGY.md), and
[design references](docs/DESIGN_REFERENCES.md). No company partnership, frontier-lab
delivery, unverified hackathon win or model-training improvement is claimed.
