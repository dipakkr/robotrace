# RoboTrace atomic delivery backlog

Updated **21 November 2026**. Existing task/gate IDs are retained; new bounded release work uses stable AB–AE IDs below. The ledger separates source implementation, narrow observed acceptance and open human/pilot/production gates. The earlier seven-hour arm-only schedule is historical.

This is a task ledger, not a claim that every feature works. [FEATURE_ACCEPTANCE.md](FEATURE_ACCEPTANCE.md) gives each feature a source review, controller/browser demo check, expected outcome and regression gate. [FEATURE_RUBRIC_MATRIX.md](FEATURE_RUBRIC_MATRIX.md) maps observed evidence to internal priorities; it is not the organizer's rubric and cannot estimate winning chances.

## Status, scope and evidence

- **TODO:** not implemented or an acceptance action has not been run.
- **IMPLEMENTED:** source/contract exists; this does not claim a current demo pass.
- **AUTOMATED-CHECK:** meaningful logic/API/validation checks have recorded evidence; no human/browser acceptance is implied.
- **AUTOMATED-DEMO:** an actual browser/provider path has recorded evidence. Evidence predating the new Review flow is historical and needs affected regression checks.
- **HUMAN-DEMO:** a person performed/heard the specified acceptance and a record identifies it. No physical microphone/listener pass is claimed here.
- **USER:** requires a genuine external person/account/recipient, not a routine implementation permission request.
- **GATE:** open release checkpoint; not a completed task.

Lanes are **CURRENT** (authorized release work), **PILOT** (downstream data/physics utility), **PRODUCTION** (multi-user/operations), and **FUTURE** (separate capabilities). A laptop simulation pass does not close a real-robot gate. Task dependencies name actual prerequisites; they do not turn a TODO into a passed feature.

Current artifacts establish: real prerecorded speech → Agora/LLM/Murf → approved 3-action task and captured remote audio; all three built-in workflow/report/export journeys; 9 controller cases = 6 tasks + 3 expected refusals; human/baseline comparison; 6 predefined real model-plan cases plus one real model UI request; corrected two-cup AI scene/report with server-recomputed matched replay; photo/video-frame reference; human-proxy pause/clear/resume; saved library/import/tamper rejection. Newer artifacts also cover Review cancellation and one automatic two-action run, plus 100 constrained generated cases. New mobile evidence includes 17 core checks, browser main 5 groups plus a focused visual pass, and an actual prerecorded Agora/LLM/Murf run with 5 skills, 10 m, 111 states and 738889 remote-audio bytes. The mobile candidate evaluator has 17 checks; its live browser suite passed 8 groups, including exactly one gpt-4o-mini request (2797.58 ms, 5 skills, accepted). The downloaded report retained 9 attempts: 4 accepted, 5 controller completions, 1 wrong-goal completion, 4 failed/refused/blocked. Its five-case baseline has 2 accepted plus 3 expected failures. Independent consumer evidence covers SHA/FK and actual workbench 70-observation/67-positive-time-pair/2-same-clock-exclusion and mobile 111/110/0 exports; 9 consumer tests passed, including declared-parent grouping and malformed ancestry rejection.

These do **not** establish natural human microphone/playback, every Review exclusion, arbitrary-scene generation robustness, an external training importer, learning gain, real-robot transfer or production scalability. Mobile and static-arm protected-history checks now pass across candidate/native/server paths, including exact restored references and legitimate human intervention. Latest integrated test snapshot: **282 passed** (163 simulation/data + 119 server/scripts); production build passed. Current continuous prerecorded voice/action/explicit-save/report/spoken-outcome rehearsal now passes five checks in `final-workflow/results.json`; exact-record fresh-context handoff/consumer (117 samples/116 pairs), labelled 75.72 s automated backup and six-step UI regression now pass. HV-01, untested approval/keyboard edges and final source/publish manifest remain open. See [GOAL_VALIDATION.md](GOAL_VALIDATION.md) for predeployment-evaluation go versus training/transfer no-go boundaries.

Exactly one open human audio field is **HV-01** in FEATURE_ACCEPTANCE.md. Source inspection or a simulator smoke cannot close it. Generated data has no claimed Pronto/lab partnership or learning gain; see [HUMAN_DEMONSTRATION_BRIDGE.md](HUMAN_DEMONSTRATION_BRIDGE.md).

## Current execution order

1. Close Review/countdown/critical-action gates Q and dense UI gates S without regressing the complete workplace flow.
2. Preserve demonstrated floor-navigation T, constrained variation U, analytic traces Z and mobile AI evaluation AA as separate capabilities; close the static-arm protected-history regression before final claims.
3. Rerun only affected feature demos after each change; retain failures and preserve all original outcome labels.
4. Complete integrated build/controller/API/UI regression X, final supported demo and HV-01 when a person is available.
5. Keep GPU training, arbitrary video-to-3D, contact physics, real robot deployment and production tenancy behind their explicit later gates.

## A. Product, scope, and track contract — H

| ID | Lane | Status | Task | Depends on | Acceptance criterion |
| --- | --- | --- | --- | --- | --- |
| A01 | CURRENT | IMPLEMENTED | Record the supplied workplace-agent requirements. | — | PRODUCT_PLAN.md maps initiate, understand, execute, confirm, and follow-up. |
| A02 | CURRENT | IMPLEMENTED | Freeze the primary employee and their first assignment. | A01 | One named role, one concrete brief, and one observable final record are agreed in the demo spec. |
| A03 | CURRENT | IMPLEMENTED | Define the hackathon release’s supported task vocabulary. | A02 | A versioned list names allowed objects, fixtures, actions, and unsupported requests. |
| A04 | CURRENT | AUTOMATED-DEMO | Distinguish environment selection for work from regression tests. | A03 | The UI offers a task-capable environment and a separate test-suite operation. |
| A05 | CURRENT | IMPLEMENTED | Write one enterprise task brief as structured source data. | A02 | The assistant retrieves a stored assignment rather than inventing the task. |
| A06 | CURRENT | AUTOMATED-CHECK | Define three success checks for that assignment. | A05 | Each check is computable from simulator evidence and has a failure description. |
| A07 | CURRENT | IMPLEMENTED | Define motion automation and explicit critical approvals. | A03 | Review opens for motion; a visible cancellable 3-second option applies only to eligible simulated movement. Scene replacement, reset and submission require explicit approval. |
| A08 | CURRENT | IMPLEMENTED | Define measurable workflow benefit. | A02 | Baseline and assisted setup/review time can be measured on the same assignment. |
| A09 | CURRENT | IMPLEMENTED | Separate software, data-utility, and real-robot claims. | A03 | Each claim has a required evidence artifact; unsupported claims are excluded. |
| A10 | CURRENT | IMPLEMENTED | Agree the first complete demonstration script. | A05, A06, A07 | A three-minute script ends in a persisted, inspectable outcome. |

## B. Minimum accounts and configuration — H

Use [ACCOUNT_SETUP_CHECKLIST.md](ACCOUNT_SETUP_CHECKLIST.md) and [server/SETUP.md](../server/SETUP.md) for current official account steps. Account configuration and automated provider access are now evidenced; natural microphone/listener acceptance remains open.

| ID | Lane | Status | Task | Depends on | Acceptance criterion |
| --- | --- | --- | --- | --- | --- |
| B01 | CURRENT | IMPLEMENTED | Provide an ignored server-side configuration template. | — | .env.example exists; .env.local and local records are ignored by Git. |
| B02 | CURRENT | IMPLEMENTED | Sign in to the user’s Agora account. | — | The user can open their own project console. |
| B03 | CURRENT | IMPLEMENTED | Create/select a token-authenticated Agora project. | B02 | A project with App ID and certificate access is available. |
| B04 | CURRENT | IMPLEMENTED | Add the Agora App ID/certificate pair locally. | B03, B01 | Presence check reports the pair configured without printing either value. |
| B05 | CURRENT | AUTOMATED-CHECK | Verify certificate-token REST auth and optional Basic override. | B02, B01 | Default REST auth uses App ID/certificate; paired Customer credentials are optional and covered by auth checks. |
| B06 | CURRENT | AUTOMATED-DEMO | Confirm Conversational AI and the configured ASR are accessible. | B03 | The project can start the configured agent rather than merely hold key fields. |
| B07 | CURRENT | IMPLEMENTED | Sign in/create a Murf API account. | — | The user reaches the API dashboard; Studio access is not assumed to be API access. |
| B08 | CURRENT | AUTOMATED-DEMO | Add a Falcon-enabled Murf API key locally. | B07, B01 | A test request can use the selected supported streaming voice. |
| B09 | CURRENT | AUTOMATED-DEMO | Add an accessible function-calling LLM key locally. | B01 | The chosen endpoint/model accepts a minimal tool-capable request. |
| B10 | CURRENT | GATE | Close automated provider readiness separately from human audio. | B04, B05, B06, B08, B09 | Real provider start/stop, speech-to-action and callback evidence are recorded; HV-01 remains separately open. |

## C. Real voice, tools, and announcements — H

| ID | Lane | Status | Task | Depends on | Acceptance criterion |
| --- | --- | --- | --- | --- | --- |
| C01 | CURRENT | AUTOMATED-CHECK | Implement server-only provider configuration. | B01 | Mocked tests verify Main API fields, Falcon model, and secret separation. |
| C02 | CURRENT | AUTOMATED-DEMO | Establish an HTTPS callback to the tool-only listener. | B10 | A cloud request reaches 8788; local session/dataset endpoints are not exposed through it. |
| C03 | CURRENT | IMPLEMENTED | Publish microphone/RTC media and distinguish input provenance. | C01, B10 | Adapter and real prerecorded audio path exist; physical microphone speech remains HV-01, not a completed human demo. |
| C04 | CURRENT | IMPLEMENTED | Receive Murf-backed audio and verify human playback separately. | C03 | Actual remote audio/transcript were captured; a person still needs to hear the live result in HV-01. |
| C05 | CURRENT | AUTOMATED-DEMO | Retrieve fresh task/scene context through an agent tool. | C02, C03 | A live tool response contains current revision, supported IDs, and the stored task guide. |
| C06 | CURRENT | AUTOMATED-DEMO | Execute an approved command over the real tool bridge. | C05, A07 | A live voice request produces the correct simulator action and acknowledgment. |
| C07 | CURRENT | AUTOMATED-CHECK | Prevent queued/pending work being announced as complete. | C06 | Live pending, failure, timeout, and completion responses match actual state. |
| C08 | CURRENT | AUTOMATED-DEMO | Verify bounded progress speech through real remote RTC. | C04, C06 | Automated transcript matches idle marker and verified reach milestone in real audio; overall delivery audit timed out and remains false. Human hearing and all-milestone coverage remain open. |
| C09 | PILOT | TODO | Test barge-in during an explanation. | C04 | The operator can interrupt without an unintended movement or duplicated command. |
| C10 | PILOT | TODO | Test disconnect and reconnect during a task. | C06 | The UI preserves authoritative execution state and reconciles the outcome after reconnect. |
| C11 | CURRENT | TODO | Test voice confirmation against the exact pending revision. | C06, E07 | An old or ambiguous approval cannot run a different/new plan. |
| C12 | CURRENT | AUTOMATED-DEMO | Record one real provider voice-to-saved-report session. | C04, C06, I06 | E25: one 73,650 ms prerecorded session completed five steps/three checks, explicit 201 save and factual transcribed delivery/save outcome; both human flags remain false. |

## D. Realistic command-center UI — H

| ID | Lane | Status | Task | Depends on | Acceptance criterion |
| --- | --- | --- | --- | --- | --- |
| D01 | CURRENT | IMPLEMENTED | Research public robotics interface patterns. | — | DESIGN_REFERENCES.md records sources and observed versus inferred details. |
| D02 | CURRENT | AUTOMATED-DEMO | Render the arm, worktable, objects, and trays. | — | The original desktop run visibly showed articulated movement and object transfer. |
| D03 | CURRENT | AUTOMATED-DEMO | Display authoritative action/pose/status feedback. | D02 | Position, gripper, task progress, and placement checks change with actual simulator state. |
| D04 | CURRENT | AUTOMATED-DEMO | Verify environment-library interactions in a browser. | G01, G02 | Every selectable environment loads with its correct visible objects and task. |
| D05 | CURRENT | AUTOMATED-DEMO | Verify the scene-composer review UI in a browser. | E03, E04 | Invalid drafts do not mutate the scene; approved valid drafts do. |
| D06 | CURRENT | AUTOMATED-DEMO | Verify the scenario-results panel in a browser. | J02 | Expected refusal is distinguished from completed work and unexpected failure. |
| D07 | PILOT | TODO | Add visible request-to-result trace IDs. | H01 | A command, plan, action, and episode can be correlated in the console. |
| D08 | CURRENT | IMPLEMENTED | Verify responsive rendering, then physical-phone interaction. | D04, D05, C04 | 1440×900, 1280×720 and 390×844 have prior browser evidence; physical-phone touch/audio remain unverified. |
| D09 | CURRENT | TODO | Complete keyboard and screen-reader checks. | D04, D05 | Dialog focus, stop controls, command entry, and live status work without relying on color alone. |
| D10 | PILOT | TODO | Measure and optimize UI load/render behavior on the target laptop. | D02 | Bundle/startup and steady-state frame performance are recorded for a representative task. |

## E. Scene descriptions, validation, and revision control — H then P

| ID | Lane | Status | Task | Depends on | Acceptance criterion |
| --- | --- | --- | --- | --- | --- |
| E01 | CURRENT | AUTOMATED-CHECK | Implement bounded text-to-scene drafts. | A03 | Tests cover supported word/numeric counts, empty scenes, and named templates. |
| E02 | CURRENT | AUTOMATED-CHECK | Reject unsupported/ambiguous scene descriptions. | E01 | Unknown objects/shapes/counts produce an error instead of partial hidden interpretation. |
| E03 | CURRENT | AUTOMATED-CHECK | Validate initial object IDs and geometry. | E01 | Tests reject duplicate IDs, nonfinite poses, invalid dimensions, and overlaps. |
| E04 | CURRENT | AUTOMATED-DEMO | Require review before applying a generated scene. | E03, A07 | Handler exists; browser tests verify explicit approval and cancellation. |
| E05 | CURRENT | IMPLEMENTED | Freeze the bounded scene specification. | A03 | SceneSpec v1 declares base environment, supported asset/slot IDs, exact counts, instruction and one goal/reference rule per object. |
| E06 | CURRENT | TODO | Migrate current template drafts into that schema. | E05 | Existing presets round-trip without losing initial state or task meaning. |
| E07 | CURRENT | TODO | Bind pending approvals to scenario and plan revision hashes. | E06 | Any intervening edit invalidates a stale approval. |
| E08 | CURRENT | TODO | Add exact saved-scenario import/export. | E06 | An exported scenario restores the same supported starting state and criteria. |
| E09 | PILOT | TODO | Save scene revisions durably. | E06, N03 | Editing creates a new revision; prior runs retain their original scenario. |
| E10 | CURRENT | AUTOMATED-DEMO | Translate supported LLM scene output through the same schema. | C05, E06 | Model output cannot bypass asset/pose/goal validation. |
| E11 | PILOT | TODO | Add reviewer-editable assumptions and dimensions. | E06 | Defaults are visible; changes create a new reviewed revision. |
| E12 | CURRENT | IMPLEMENTED | Preserve generated-scene origin and reviewed assumptions. | E06 | Approved scenes retain source, prompt/model where available, task assignments and declared fixed-slot geometry; full media provenance remains W06–W10. |

## F. Simulator and robot capability adapters — H then P

| ID | Lane | Status | Task | Depends on | Acceptance criterion |
| --- | --- | --- | --- | --- | --- |
| F01 | CURRENT | AUTOMATED-CHECK | Implement deterministic articulated pick/place motion. | — | Engine tests verify movement, release, destination state, and unchanged source state. |
| F02 | CURRENT | AUTOMATED-CHECK | Implement pause/stop and reach/capacity rejection. | F01 | Tests verify frozen motion and precise preflight failure reasons. |
| F03 | CURRENT | IMPLEMENTED | Label idealized kinematic grasping accurately. | F01 | UI/export state that contact dynamics and learned policy are absent. |
| F04 | CURRENT | TODO | Define the simulator adapter interface. | E05 | Reset, step, observe, execute, cancel, snapshot, and capability queries have typed contracts. |
| F05 | CURRENT | TODO | Wrap the current browser controller in the adapter. | F04 | Existing tests run unchanged through the adapter boundary. |
| F06 | PILOT | TODO | Benchmark one CPU-compatible physics simulator locally. | F04 | One rigid-body scene runs on the actual laptop with measured stepping/rendering cost. |
| F07 | PILOT | TODO | Load one fixed robot description and joint limits. | F06 | Joint names, units, limits, base transform, and end-effector frame are recorded. |
| F08 | PILOT | TODO | Implement one contact-aware grasp/release experiment. | F07 | Success/failure follows simulated contact/object motion, not mesh attachment alone. |
| F09 | CURRENT | TODO | Generalize destinations to typed fixture poses/slots. | F04, E06 | Targets can refer to rack slots or surfaces, not only the three hard-coded trays. |
| F10 | PILOT | TODO | Check supported collisions along a commanded motion. | F07 | The documented checked geometry stops/rejects an intersecting path; unchecked geometry stays disclosed. |
| F11 | PILOT | TODO | Align rendering and recording to a fixed simulation clock. | F04 | Observation/action samples carry monotonic, reproducible simulator timestamps. |
| F12 | CURRENT | IMPLEMENTED | Declare the current capability/fidelity manifest. | F01 | Native evidence names the kinematic controller, idealized grasps, no contact validation, no trained policy and no demonstrated transfer. |

## G. Genuinely different environments and work tasks — P

The first two rows are H prototype foundations. New environment families below need different fixtures/goals and capability declarations; recoloring the same workcell does not complete them. The original arm-only cut is superseded by the current requested floor-navigation workstream T; navigation remains unverified until its own gates close. CURRENT rows use explicitly labelled kinematic rigid-object tasks; the richer physics checks remain PILOT rows.

| ID | Lane | Status | Task | Depends on | Acceptance criterion |
| --- | --- | --- | --- | --- | --- |
| G01 | CURRENT | AUTOMATED-DEMO | Provide the initial sorting workcell. | F01 | Red/green placement in A and blue placement in B pass controller checks. |
| G02 | CURRENT | AUTOMATED-DEMO | Provide reach-limit, occupied-tray, and rearranged presets. | G01 | All three produce the specified real controller outcome/reason. |
| G03 | CURRENT | AUTOMATED-DEMO | Build the supported rigid kitchen-counter fixture. | F12 | Cup, utensil case and bowl have kitchen labels/layouts and serving/storage destinations; no shelf or drawer capability is implied. |
| G04 | CURRENT | AUTOMATED-DEMO | Define and execute counter clearance. | G03 | Clear the counter sends serving items to serving and the bowl to storage, checks all objects and clears the counter. |
| G05 | PILOT | TODO | Verify upright-object constraints in the kitchen task. | G04, F08 | Orientation and stability checks are computed in the selected simulator. |
| G06 | CURRENT | AUTOMATED-DEMO | Build the supported sample-routing bench. | F12 | Synthetic labelled carriers and rack-labelled tray destinations differ from the kitchen/workbench layout. |
| G07 | CURRENT | AUTOMATED-DEMO | Define identity-based sample routing. | G06 | Correct sample IDs reach designated slots; color alone is not the task definition. |
| G08 | CURRENT | AUTOMATED-CHECK | Check destination occupancy and wrong task assignment. | G07 | Shared controller rejects full destinations; final geometry/task checks reject incorrect sample placement rather than trusting location strings. |
| G09 | CURRENT | AUTOMATED-DEMO | Build a maintenance-workbench fixture layout. | F12 | Named tools, holders, and kit slots form a different supported task layout. |
| G10 | CURRENT | AUTOMATED-DEMO | Define a tool-return or kit-preparation sequence. | G09 | Required order/placement constraints are explicit and checked after execution. |
| G11 | CURRENT | TODO | Filter environment choices by robot capability and task. | G04, G07, G10, F12 | An unsupported task/robot combination cannot be launched as though supported. |
| G12 | CURRENT | IMPLEMENTED | Define a mobile floor-navigation extension contract. | T01 | MobileWorld declares map/footprint/stations/cargo/events/goals and fidelity separately from an arm episode. |

## H. Assignment, execution, and durable jobs — H then S

| ID | Lane | Status | Task | Depends on | Acceptance criterion |
| --- | --- | --- | --- | --- | --- |
| H01 | CURRENT | TODO | Assign stable IDs to briefs, requests, plans, and runs. | A05 | Every result references the exact originating assignment and revision. |
| H02 | CURRENT | AUTOMATED-DEMO | Retrieve the approved task guide through the API. | A05 | Endpoint exists; live voice retrieves the intended stored task version. |
| H03 | CURRENT | IMPLEMENTED | Document the current local execution transitions. | F01, F02 | Idle/running/paused/stopped/error controller states, pending plans, blocked states and completion receipts have explicit local semantics; durable jobs remain H04–H10. |
| H04 | PRODUCTION | TODO | Persist a job before execution begins. | H01, N03 | A process restart does not erase the requested work or approval. |
| H05 | PRODUCTION | TODO | Add idempotent job creation. | H04 | Repeating one request ID returns its existing job instead of running twice. |
| H06 | PRODUCTION | TODO | Lease a job to one simulator worker. | H04 | Two workers cannot execute the same active job concurrently. |
| H07 | PRODUCTION | TODO | Implement cancellation at the worker boundary. | H06 | A cancellation receipt stops future steps and preserves the actual terminal state. |
| H08 | PRODUCTION | TODO | Detect worker timeout and recover job status. | H06 | A lost worker becomes unconfirmed/failed according to policy; it is never silently completed. |
| H09 | CURRENT | AUTOMATED-DEMO | Persist assignment status and factual service report. | H03, I06 | A real saved episode updates assignment status and returns actual counts, checks, verification basis and follow-up. |
| H10 | PRODUCTION | TODO | Show a retriable failed-job action. | H08 | Retry creates a new linked attempt and preserves the original failure. |

## I. Recording, review, and episode provenance — H then P

| ID | Lane | Status | Task | Depends on | Acceptance criterion |
| --- | --- | --- | --- | --- | --- |
| I01 | CURRENT | AUTOMATED-DEMO | Capture simulator state samples and action events. | F01 | Recorded desktop run contains time-aligned state/action evidence. |
| I02 | CURRENT | AUTOMATED-DEMO | Replay captured state without changing the live scene. | I01 | Original desktop review visibly restored recorded states separately from live state. |
| I03 | CURRENT | AUTOMATED-DEMO | Capture and review zero-motion rejection episodes. | F02 | A preflight refusal retains initial state, reason, and failed outcome; browser behavior is verified. |
| I04 | PILOT | TODO | Add append-only human annotations. | I01 | Corrections retain author/time and do not overwrite the original event. |
| I05 | CURRENT | TODO | Bind review approval to episode content hash. | I01 | Editing annotations or underlying content invalidates the old approval. |
| I06 | CURRENT | AUTOMATED-DEMO | Persist an approved local episode through the API. | I01 | A demonstrated browser save produced a server-stored record and receipt. |
| I07 | CURRENT | TODO | Add idempotent episode submission. | I05, I06 | Retrying one publication cannot create duplicate accepted records. |
| I08 | CURRENT | IMPLEMENTED | Declare prototype schema/controller/source versions. | F12 | Native evidence identifies episode/evidence schema and kinematic controller; AI scene/model provenance is preserved when available. |
| I09 | PILOT | AUTOMATED-DEMO | Record the implemented human-proxy interruption. | I01 | Browser evidence retains nearby/occupied/cleared proxy states and explicit pause/resume; this is not tracked human activity. |
| I10 | PILOT | TODO | Add bounded retention and durable-export verification. | I06, N04 | Retention is visible; approved exports survive browser-cache eviction and server restart. |

## J. Policy integration and evaluation — P

| ID | Lane | Status | Task | Depends on | Acceptance criterion |
| --- | --- | --- | --- | --- | --- |
| J01 | PILOT | TODO | Define a policy-adapter manifest. | F04 | Input observations, output actions, rates, embodiment, and model version are explicit. |
| J02 | CURRENT | AUTOMATED-DEMO | Execute the real baseline controller in a headless scenario runner. | G02 | Tests compare actual outcomes and exact expected failure reasons. |
| J03 | PILOT | TODO | Integrate one externally supplied policy endpoint. | J01, F11 | Its real outputs pass through validation and drive the selected simulator adapter. |
| J04 | PILOT | TODO | Reject incompatible policy actions. | J03 | Wrong dimensions, units, bounds, or unsupported control modes fail before movement. |
| J05 | PILOT | TODO | Add policy-call timeout/cancellation. | J03 | A slow/disconnected policy produces a traceable unconfirmed/failed attempt. |
| J06 | PILOT | TODO | Define a held-out scenario split. | G04, G07, G10 | Evaluation scenes are excluded from demonstration/training exports by explicit manifest. |
| J07 | PILOT | TODO | Compare baseline and external policy on identical scenarios. | J03, J06 | Seeds, initial conditions, task criteria, and sample counts are matched. |
| J08 | PILOT | TODO | Measure task success, violations, and completion time. | J07 | Metrics are computed from outcomes; model verbal claims are not the scoring source. |
| J09 | PILOT | TODO | Preserve failed and recovery attempts separately. | I09, J07 | The evaluator can associate a correction with its failure without relabelling failure as success. |
| J10 | PILOT | TODO | Publish an evaluation report with limitations. | J08, J09 | Report names tested policy, scenarios, counts, uncertainty, and simulator boundaries. |

## K. Data quality and usefulness — P

| ID | Lane | Status | Task | Depends on | Acceptance criterion |
| --- | --- | --- | --- | --- | --- |
| K01 | PILOT | TODO | Select the first actual downstream data consumer. | A09 | A concrete training/evaluation loader and its expected fields are identified. |
| K02 | PILOT | TODO | Define the consumer-required observation/action schema. | K01, J01 | Units, coordinate frames, controls, frequencies, cameras, and missing fields are explicit. |
| K03 | PILOT | TODO | Check timestamps and sample alignment. | F11, K02 | Missing/duplicate/out-of-order samples are detected and reported. |
| K04 | PILOT | TODO | Check finite values and action ranges per episode. | K02 | Invalid samples are quarantined with reason rather than exported as valid data. |
| K05 | PILOT | TODO | Verify camera metadata where camera observations exist. | K02 | Image dimensions, intrinsics/extrinsics or their absence, and frame names are recorded accurately. |
| K06 | PILOT | TODO | Check complete episode termination metadata. | I08 | Success/failure/stop/timeout and terminal observation are unambiguous. |
| K07 | PILOT | TODO | Identify duplicate or near-duplicate generated episodes. | E09, I08 | Repeated seeds/trajectories are detectable and diversity claims use actual counts. |
| K08 | PILOT | TODO | Document generation, review, and rights provenance. | E12, I05 | Dataset source/license/consent/review fields are present and inspectable. |
| K09 | PILOT | TODO | Build a clean train/validation/test manifest. | J06, K07 | No scenario or derived episode crosses protected split boundaries. |
| K10 | PILOT | TODO | Run the selected consumer on a sample package. | K03, K04, K05, K06, K08, K09 | The consumer loads/uses the data; usefulness claims match the observed result. |

## L. Exports and transfer to robotics teams/labs — P

There is no assumed universal “frontier lab upload API.” A format-compatible package, a successful consumer load, recipient agreement, and demonstrated model benefit are four different milestones. No transfer to a third party happens without an explicitly authorized destination and dataset.

| ID | Lane | Status | Task | Depends on | Acceptance criterion |
| --- | --- | --- | --- | --- | --- |
| L01 | CURRENT | AUTOMATED-DEMO | Export the prototype’s own episode JSON. | I01 | Export includes its schema/controller and kinematic/idealized-grasp limitations. |
| L02 | CURRENT | IMPLEMENTED | Freeze native evidence interchange v1. | E05, I08 | Native episode v1 remains compatible inside evidence v1; required states/checks/provenance/review/outcome fields validate. |
| L03 | PILOT | TODO | Implement an adapter to the selected LeRobot dataset version. | L02, K01 | The target dataset library validates and reopens a small exported sample. |
| L04 | PILOT | TODO | Implement an RLDS adapter if required by the selected consumer. | L02, K01 | A real RLDS reader sees correct episode/step and terminal fields. |
| L05 | PILOT | IMPLEMENTED | Label native records as diagnostic kinematic evidence. | L02 | No native export is described as a ready-to-train LeRobot/RLDS dataset or measured robot-control data. |
| L06 | CURRENT | TODO | Generate a prototype dataset/artifact card and check report. | I08, L02 | Tasks, embodiment, source, splits, failures, license, and limitations accompany the files. |
| L07 | CURRENT | AUTOMATED-DEMO | Seal the native single-JSON package. | L02 | A section manifest and canonical SHA-256 digest verify after download and reject changed content; no author authentication is implied. |
| L08 | PILOT | TODO | Test exporting a dataset to the user’s selected private repository. | L03, L06, L07 | Authorized private upload completes and the manifest can be downloaded intact. |
| L09 | PILOT | USER | Identify and obtain agreement from a pilot lab/team. | K01, L06 | A named recipient states what data and workflow they can evaluate. |
| L10 | PILOT | TODO | Build the recipient-specific delivery adapter. | L09, L07 | The agreed storage/repository/API receives the approved package with a receipt. |
| L11 | PILOT | TODO | Verify recipient-side loading independently. | L10 | The recipient’s loader reports dimensions, episodes, and sample checks matching the manifest. |
| L12 | PILOT | TODO | Measure downstream benefit only if a training trial is agreed. | L11, J06 | Held-out evaluation compares an appropriate baseline; no benefit is asserted from upload alone. |

## M. Camera/video-assisted authoring — V

| ID | Lane | Status | Task | Depends on | Acceptance criterion |
| --- | --- | --- | --- | --- | --- |
| M01 | CURRENT | IMPLEMENTED | Define supported photo/video-frame task references. | E05 | One selected frame proposes a reviewed supported scene; temporal actions and full 3D reconstruction are excluded. |
| M02 | FUTURE | TODO | Implement authenticated, size-limited upload. | N01, N04 | Unsupported/oversized media is rejected and upload state is visible. |
| M03 | FUTURE | TODO | Retain timestamped temporal reference extraction. | M02 | Manual selected-frame time/hash are implemented and checked in AC; multi-frame temporal annotations remain W05–W07. |
| M04 | FUTURE | TODO | Detect candidate supported objects and uncertainty. | M03 | Unknown items and uncertain detections are explicit rather than invented geometry. |
| M05 | CURRENT | AUTOMATED-DEMO | Map a chosen reference into supported reviewed assets. | E05, E10 | A real reference request produced cup/cup/bowl assets and a valid draft; the layout still comes from fixed slots. |
| M06 | FUTURE | TODO | Require scale/calibration input where dimensions matter. | M05 | The system distinguishes supplied measurements from estimated/default dimensions. |
| M07 | FUTURE | TODO | Build a human scene-correction screen. | M05, E11 | A reviewer can edit identities, counts, poses, dimensions, and defaults before applying. |
| M08 | FUTURE | TODO | Preserve original media and derived-scene provenance. | M07, K08 | Source, model/version, transformations, assumptions, and approval are linked. |
| M09 | CURRENT | AUTOMATED-DEMO | Apply and run only the reviewed supported scene. | M05, E04 | Video analysis never directly executes robot actions or arbitrary generated code. |
| M10 | FUTURE | TODO | Evaluate suggestion quality on held-out videos. | M09 | Object/layout accuracy and reviewer effort are measured; exact physics reconstruction is not claimed. |

## N. Cloud, security, and scale — S

| ID | Lane | Status | Task | Depends on | Acceptance criterion |
| --- | --- | --- | --- | --- | --- |
| N01 | PRODUCTION | TODO | Add authenticated users to the full application/backend. | A09 | Anonymous requests cannot read or mutate private project records. |
| N02 | PRODUCTION | TODO | Enforce workspace/project isolation. | N01 | Cross-tenant scenario, run, episode, and artifact access is denied by tests. |
| N03 | PRODUCTION | TODO | Migrate record metadata into a durable transactional store. | H01, N02 | Scenario/job/episode state survives restart with versioned migrations. |
| N04 | PRODUCTION | TODO | Store media/trajectory artifacts in authorized object storage. | N02 | Access-controlled uploads/downloads use bounded signed operations and lifecycle rules. |
| N05 | PRODUCTION | TODO | Deploy the session/tool backend separately from static UI hosting. | C06, N01 | The hosted UI completes the same authenticated voice workflow as local development. |
| N06 | PRODUCTION | TODO | Add a durable queue for simulator work. | H06, N03 | Queued jobs survive restarts and worker retries preserve idempotency. |
| N07 | PRODUCTION | TODO | Isolate simulator workers from application/control secrets. | N06 | A worker receives only its permitted scenario, artifacts, and execution credentials. |
| N08 | PRODUCTION | TODO | Add per-workspace concurrency and spend limits. | N06 | Excess jobs/provider usage are bounded with visible retry/capacity feedback. |
| N09 | PRODUCTION | TODO | Add correlated operational logs and metrics. | H01, N05 | A run can be traced across UI, voice, tools, jobs, worker, and storage without logging secrets. |
| N10 | PRODUCTION | TODO | Implement backup and restore for approved records. | N03, N04 | A restore exercise recovers a selected project and verifies artifact hashes. |
| N11 | PRODUCTION | TODO | Test target load and record resource limits. | N06, N08, N09 | Named concurrent-session/job targets pass measured latency/error budgets. |
| N12 | PRODUCTION | TODO | Document and rehearse incident recovery. | N09, N10, N11 | Provider outage, stuck job, failed export, and service restart have tested runbooks. |

## O. End-to-end QA and release evidence — H then P/S

| ID | Lane | Status | Task | Depends on | Acceptance criterion |
| --- | --- | --- | --- | --- | --- |
| O01 | CURRENT | AUTOMATED-CHECK | Maintain the meaningful simulator/data/API test suite. | F01, E01, C01 | npm test covers current controller, authoring, candidate, human, integrity and server contracts. Record the actual run output; do not reuse a historical test count. |
| O02 | CURRENT | AUTOMATED-CHECK | Produce a production TypeScript/Vite bundle. | D02 | Successful build evidence exists; rerun after the current Review/navigation/variation changes before closing X03. |
| O03 | CURRENT | AUTOMATED-DEMO | Exercise library/composer/campaign controls in the browser. | D04, D05, D06 | Existing browser artifacts cover real built-in workflows, AI scene/reference, library import/tamper and evaluation; recheck changed controls under X04. |
| O04 | CURRENT | TODO | Complete the physical microphone/listener demonstration. | C12, O03 | HV-01: a person speaks a supported task, hears actual provider speech, observes execution and hears its factual result. |
| O05 | CURRENT | AUTOMATED-DEMO | Verify mobile microphone-denial/service-unavailable UI. | C04 | Five error-state groups pass; SDK microphone denied before provider start, visible sanitized error/reset and one actual empty-reset recovery. Physical media acceptance remains HV-01. |
| O06 | CURRENT | TODO | Verify callback timeout while motion is active. | C06 | Outcome is labelled unconfirmed; retry cannot duplicate the original action. |
| O07 | CURRENT | TODO | Verify stale approval, duplicate command, and interrupted save. | E07, C06, I07 | Each edge case preserves one authoritative outcome and an inspectable record. |
| O08 | CURRENT | AUTOMATED-DEMO | Verify all three bounded task families end to end. | G04, G07, G10, J02 | Workbench, kitchen and lab completed their distinct assignments, review, persistence and native consumer checks; this does not close learned-policy pilot gates. |
| O09 | PILOT | TODO | Verify a real consumer-loadable export. | K10, L03 | The selected external dataset loader opens the exact approved package. |
| O10 | CURRENT | IMPLEMENTED | Audit today’s product/demo claims against evidence. | O03, O04 | Completed, partial, research-only, and unsupported claims are accurately separated. |

## P. Demo delivery and operator handoff — H

| ID | Lane | Status | Task | Depends on | Acceptance criterion |
| --- | --- | --- | --- | --- | --- |
| P01 | CURRENT | AUTOMATED-DEMO | Create a compact scenario/task chooser for the demo. | A10, O03 | The operator reaches the first task without navigating developer setup screens. |
| P02 | CURRENT | TODO | Rehearse the planned three-minute live demonstration. | O04, A10 | Timing is recorded and the workflow ends with an actual persistence receipt. |
| P03 | CURRENT | TODO | Rehearse one judge-controlled supported change. | P02 | A changed object/goal produces a new valid plan and observable result. |
| P04 | CURRENT | IMPLEMENTED | Prepare an honest provider-outage fallback. | O05 | Local demonstration remains usable; required live integration is not misrepresented. |
| P05 | CURRENT | AUTOMATED-DEMO | Capture a labelled actual-build backup. | P02 | E28: 75.72 s automated clip with prerecorded command and captured real remote audio; approximate A/V alignment, no human microphone/listener claim. |
| P06 | CURRENT | IMPLEMENTED | Update setup and operator documentation from the verified build. | P02 | Fresh setup steps and supported command examples match the release. |
| P07 | CURRENT | TODO | Assemble source, architecture, evidence, and demo submission. | P05, P06, O10 | Required submission artifacts and source provenance are complete. |
| P08 | CURRENT | IMPLEMENTED | Review final submission scope against observed evidence. | A09 | Autonomous work proceeds within user authorization; final materials label every open gate and do not estimate winning odds. |


## Q. Dedicated Review and reversible-motion automation — CURRENT / F-03

These replace the old transcript approval dock. New approval-smoke evidence covers Review auto-selection, visible cancellation and one automatic two-action run; earlier dock screenshots do not prove every new boundary.

| ID | Lane | Status | Task | Depends on | Acceptance criterion |
| --- | --- | --- | --- | --- | --- |
| Q01 | CURRENT | IMPLEMENTED | Add a dedicated Review tab. | A07 | Pending approvals have a distinct panel outside the chat transcript. |
| Q02 | CURRENT | AUTOMATED-DEMO | Select Review when a motion plan appears. | Q01 | A supported command brings its semantic action list into view. |
| Q03 | CURRENT | IMPLEMENTED | Render ordered semantic action labels. | Q01 | Every proposed object/destination action is readable in execution order. |
| Q04 | CURRENT | IMPLEMENTED | Keep approval actions in the panel footer. | Q03 | Scrolling six steps does not move Approve/Discard into chat history. |
| Q05 | CURRENT | IMPLEMENTED | Show a useful empty Review state. | Q01 | No pending plan shows No motion awaiting review and the preference controls. |
| Q06 | CURRENT | IMPLEMENTED | Persist the auto-motion preference locally. | Q01 | Disabling auto run survives a fresh page load. |
| Q07 | CURRENT | AUTOMATED-DEMO | Display the three-second countdown. | Q06 | Eligible simulated motion shows its pending start before execution. |
| Q08 | CURRENT | AUTOMATED-DEMO | Add Cancel countdown. | Q07 | Cancelling leaves the same plan pending for manual approval. |
| Q09 | CURRENT | IMPLEMENTED | Stop the current timer when auto run is disabled. | Q07 | Toggling the preference off prevents that queued automatic start. |
| Q10 | CURRENT | IMPLEMENTED | Retain manual Approve & run. | Q07 | Manual approval starts one queue and does not duplicate on timer expiry. |
| Q11 | CURRENT | IMPLEMENTED | Gate auto run on ready live state. | Q07 | Busy, replay, modal and occupied workspace states cannot silently start motion. |
| Q12 | CURRENT | IMPLEMENTED | Pause automatic intent when the document hides. | Q07 | A backgrounded tab does not run an unobserved countdown action. |
| Q13 | CURRENT | IMPLEMENTED | Keep scene replacement explicit. | E04, Q01 | A draft cannot replace the live scene through a motion countdown. |
| Q14 | CURRENT | IMPLEMENTED | Keep reset explicit. | F02, Q01 | Reset requires its own deliberate action/confirmation. |
| Q15 | CURRENT | IMPLEMENTED | Keep evidence submission explicit. | I06, Q01 | Automatic movement cannot approve or publish its own recording. |
| Q16 | CURRENT | AUTOMATED-DEMO | Record manual versus automatic approval origin. | I01, Q10 | A recorded control event identifies how movement was approved. |
| Q17 | CURRENT | AUTOMATED-DEMO | Demo cancelled countdown beyond its deadline. | Q08 | Wait beyond three seconds with no active motion and the same pending plan; manual approval remains enabled. |
| Q18 | CURRENT | AUTOMATED-DEMO | Demo exactly one automatic queue. | Q09, Q10 | The visible three-second path completes actual actions once, records automatic approval and leaves the episode unsubmitted. |
| Q19 | CURRENT | TODO | Exercise every critical-action auto-run exclusion. | Q11, Q13, Q14, Q15 | Scene, reset, submit, replay, busy and occupied states remain explicit or blocked. |
| Q21 | CURRENT | TODO | Demo disabled automatic motion. | Q06, Q09 | Disable auto, reload, prepare a plan and wait beyond three seconds; no movement occurs until manual approval. |
| Q20 | CURRENT | AUTOMATED-DEMO | Repeat voice/action acknowledgment with the new approval policy. | C06, Q16 | Mobile live receipts identify pending versus actually running/completed work under the current preference; workcell regressions remain separate if changed. |

## S. Dense console and selection design — CURRENT / F-14

| ID | Lane | Status | Task | Depends on | Acceptance criterion |
| --- | --- | --- | --- | --- | --- |
| S01 | CURRENT | IMPLEMENTED | Record the no-left-edge-selection rule. | D01 | RELEASE_PLAN.md prohibits left stripes, inset markers and active pseudo-stripes. |
| S02 | CURRENT | IMPLEMENTED | Use full-surface/icon/text selection states. | S01 | Selected scene rows, tabs and rail controls do not add a left-edge cue. |
| S03 | CURRENT | TODO | Audit all styles and active pseudo-elements for stripes. | S02 | Source scan plus selected-state screenshots cover every navigation/control surface. |
| S04 | CURRENT | IMPLEMENTED | Reduce sidebar typography and hierarchy row height. | S01 | Dense console text targets 11 px and compact approximately 25 px rows without truncating identity. |
| S05 | CURRENT | IMPLEMENTED | Use restrained rounded action buttons. | S01 | Neutral compact actions remain legible at the target laptop width. |
| S06 | CURRENT | AUTOMATED-DEMO | Collapse and restore inspector/copilot/timeline. | D04 | Prior real browser checks restored each panel; repeat affected controls after Review changes. |
| S07 | CURRENT | AUTOMATED-DEMO | Review action hit areas at 1280×720. | Q04, S04 | E27: Review footer actions remain visible/reachable; mobile frozen-save approval separately hit-tested in E18. |
| S08 | CURRENT | AUTOMATED-DEMO | Review a six-step list in the compact panel. | Q04, S07 | E27: final regression has 96 px scroll area versus 408 px content and visible footer; new Review work collapses timeline. UI-01 closed. |
| S09 | CURRENT | AUTOMATED-DEMO | Repeat phone-width Review/modal geometry. | Q01, S07 | E27: 390-width no horizontal overflow and explicit critical controls checked; physical phone touch/audio remains separate. |
| S10 | CURRENT | TODO | Verify keyboard focus across tab and critical cards. | Q01 | Tab/Shift-Tab/focus rings expose all controls; Escape behavior remains coherent. |
| S11 | CURRENT | TODO | Inspect selected states in all three presentation modes. | S03 | Screenshot review finds no left stripes, clipped text or false active state. |
| S12 | CURRENT | TODO | Save final dense-console screenshots. | S08, S09, S11 | Images come from the final running build and label any simulated/provider boundary. |

## T. Mobile robot floor navigation — CURRENT / F-18

The separate mobile engine/renderer has actual controller, browser and prerecorded provider evidence (F-18/E13–E14), including main 5 browser groups plus focused visual checks. An articulated arm scene is not floor navigation; this work does not establish physical obstacle sensing or real robot readiness.

| ID | Lane | Status | Task | Depends on | Acceptance criterion |
| --- | --- | --- | --- | --- | --- |
| T01 | CURRENT | AUTOMATED-CHECK | Define a separate mobile-world type. | A03 | Floor pose, heading, robot footprint, obstacles and named goals have explicit units. |
| T02 | CURRENT | AUTOMATED-DEMO | Define supported navigation commands. | T01 | Exact goal aliases and stop/pause/resume meanings are bounded. |
| T03 | CURRENT | AUTOMATED-CHECK | Declare a kinematic mobile capability manifest. | T01 | No sensor, contact dynamics or hardware readiness is implied. |
| T04 | CURRENT | AUTOMATED-DEMO | Build one bounded floor environment. | T01 | Distinct start/goal locations and visible fixed obstacles are in the data model. |
| T05 | CURRENT | AUTOMATED-CHECK | Reject malformed floor geometry. | T04 | Nonfinite coordinates, invalid sizes and outside-bound goals fail explicitly. |
| T06 | CURRENT | AUTOMATED-CHECK | Define footprint clearance checks. | T04 | Obstacle tests include the declared robot radius/shape, not only a point. |
| T07 | CURRENT | AUTOMATED-CHECK | Implement a bounded path search. | T06 | A reachable goal produces finite ordered waypoints within a fixed search budget. |
| T08 | CURRENT | AUTOMATED-DEMO | Refuse blocked or unknown goals. | T07 | No path/unknown destination reports a specific failure without teleporting. |
| T09 | CURRENT | AUTOMATED-DEMO | Advance mobile pose on the simulator clock. | T07 | Motion is clock-driven and reaches the declared goal tolerance. |
| T10 | CURRENT | AUTOMATED-CHECK | Validate every traversed segment. | T09 | Interpolation cannot cross an obstacle between safe waypoints. |
| T11 | CURRENT | AUTOMATED-DEMO | Hold pose on pause and stop. | T09 | Neither control advances the path or reports arrival. |
| T12 | CURRENT | AUTOMATED-DEMO | Define resume/replan semantics. | T11 | Clearance alone does not resume; explicit resume continues a paused route; stopped cargo needs a fresh plan; a blocked segment is rechecked/refused without false success. |
| T13 | CURRENT | AUTOMATED-DEMO | Render mobile base, floor and route. | T09 | Visual pose and planned/remaining path follow actual state. |
| T14 | CURRENT | AUTOMATED-DEMO | Add distinct mobile environment selection. | T13 | UI labels navigation separately from arm manipulation. |
| T15 | CURRENT | AUTOMATED-DEMO | Connect navigation to current Review semantics. | T02, Q01 | Only eligible simulated navigation can use visible cancellable auto run. |
| T16 | CURRENT | AUTOMATED-DEMO | Record mobile events and outcome checks. | T09, I01 | Arrival, blocked, paused and stopped have observed-state evidence. |
| T17 | CURRENT | AUTOMATED-DEMO | Keep mobile export separate from arm episode assumptions. | T16, L02 | Schema/capability fields describe floor state; arm-specific fields are not fabricated. |
| T18 | CURRENT | AUTOMATED-CHECK | Controller-check free route, detour and impossible route. | T07, T10 | Exact expected outcomes and clearance assertions pass. |
| T19 | CURRENT | AUTOMATED-CHECK | Controller-check pause/resume/stop and repeated completion. | T11, T12 | Poses freeze and arrival is acknowledged once. |
| T20 | CURRENT | AUTOMATED-DEMO | Browser-demo route approval and visible arrival. | T14, T15, T18 | Robot follows the route and an actual arrival check passes. |
| T21 | CURRENT | AUTOMATED-DEMO | Browser-demo blocked goal and recovery. | T08, T19 | Refusal makes no false arrival claim; a subsequent valid route works. |
| T22 | CURRENT | TODO | Add navigation commands and evidence to the final demo. | T17, T20, T21 | Script names only supported goals and discloses kinematic navigation. |

## U. Constrained synthetic scene variation — CURRENT / F-19

The fixed nine-case campaign remains separate. A new bounded seeded generator and browser export have evidence for 100 cases: 60 accepted tasks, 40 expected refusals, zero provider calls. General arbitrary-scene validation, duplicate accounting and cancellation remain separate rows; this is not a training-data multiplier.

| ID | Lane | Status | Task | Depends on | Acceptance criterion |
| --- | --- | --- | --- | --- | --- |
| U01 | CURRENT | AUTOMATED-DEMO | Preserve the current seeded nine-case campaign. | J02 | Six task completions and three expected refusals remain distinct observed counts. |
| U02 | CURRENT | IMPLEMENTED | Define a bounded variation request schema. | E05 | Seed, count, allowed perturbations and task origin are explicit and size-limited. |
| U03 | CURRENT | IMPLEMENTED | Freeze the reviewed base scene and task. | U02 | Generated cases refer to one immutable starting contract. |
| U04 | CURRENT | AUTOMATED-CHECK | Implement a deterministic seeded generator. | U03 | The same seed/config yields the same candidate scenes. |
| U05 | CURRENT | IMPLEMENTED | Limit perturbations to declared pose/slot ranges. | U04 | No unsupported assets, dimensions or physics are silently introduced. |
| U06 | CURRENT | AUTOMATED-CHECK | Preserve object identities and task goals. | U05 | Variation cannot quietly change easier destinations or remove task objects. |
| U07 | CURRENT | AUTOMATED-CHECK | Preserve protected-reference initial states. | U06 | Unchanged targets are not jittered or relabelled. |
| U08 | CURRENT | TODO | Reject nonfinite, overlapping and out-of-bound cases. | U05 | Every retained case passes the shared scene validator. |
| U09 | CURRENT | IMPLEMENTED | Bound generation workload. | U02 | Count is limited to 1–100 and seed to uint32; execution iterates a finite requested case count. |
| U10 | CURRENT | IMPLEMENTED | Assign case IDs and immutable generation metadata. | U04 | Seed/config/base-scene identity and generation version are exportable. |
| U11 | CURRENT | TODO | Detect exact duplicate generated worlds. | U10 | Duplicates are reported/excluded from diversity counts. |
| U12 | CURRENT | AUTOMATED-DEMO | Label intended success versus intended refusal cases. | U06 | Expected outcome is a declared criterion rather than inferred from whichever result happened. |
| U13 | CURRENT | AUTOMATED-DEMO | Run each retained case through the actual controller. | U12 | Final state/checks come from execution; failures are not silently repaired. |
| U14 | PILOT | TODO | Expose progress and cancellation between cases. | U13 | Cancel retains completed case outcomes and starts no further case. |
| U15 | CURRENT | AUTOMATED-DEMO | Keep model calls outside automatic generation. | U02, V05 | Local variation does not trigger a paid model loop. |
| U16 | CURRENT | AUTOMATED-DEMO | Summarize tasks and refusals separately. | U13 | A matched rejection never increments completed tasks. |
| U17 | CURRENT | AUTOMATED-DEMO | Export every generated input and result. | U10, U13 | A consumer can rerun the same worlds and inspect rejected cases. |
| U18 | CURRENT | AUTOMATED-CHECK | Check reproducibility, invalid configuration and protected state. | U07, U09 | Controller tests assert exact seeded outputs and no reference drift. |
| U19 | CURRENT | AUTOMATED-DEMO | Browser-demo generation, loading and export. | U17 | 100 generated cases export 60 accepted tasks and 40 expected refusals; a selected situation loads and no provider call occurs. |
| U20 | PILOT | TODO | Freeze held-out variation splits before experiments. | U17 | Related base scenes/recordings do not leak across training and evaluation. |

## V. Task-planner comparisons — CURRENT / F-10

| ID | Lane | Status | Task | Depends on | Acceptance criterion |
| --- | --- | --- | --- | --- | --- |
| V01 | CURRENT | AUTOMATED-DEMO | Freeze one scene for all candidates. | E05 | Human/baseline/model results retain identical initial worlds. |
| V02 | CURRENT | AUTOMATED-DEMO | Compose a human exact-ID assignment plan. | V01 | Wrong-goal moves can complete while task acceptance remains false. |
| V03 | CURRENT | AUTOMATED-DEMO | Evaluate the declared bounded baseline. | V01 | Baseline is labelled honestly and checks the same saved task. |
| V04 | CURRENT | AUTOMATED-CHECK | Reject malformed/unknown/duplicate candidate assignments. | V01 | Invalid candidates remain invalid without hidden repair. |
| V05 | CURRENT | AUTOMATED-DEMO | Request exactly one selected real model plan from the UI. | V04 | Model identity, actual request duration and computed outcome survive export. |
| V06 | CURRENT | AUTOMATED-DEMO | Exercise the six predefined two-model cases. | V04 | Recorded six-case smoke stays labelled small and non-statistical. |
| V07 | CURRENT | AUTOMATED-DEMO | Export comparison source, failures and actual timing. | V02, V03, V05 | Local candidates have no fabricated LLM latency. |
| V08 | CURRENT | IMPLEMENTED | Expose server-executed evaluation as a distinct origin. | V04 | API computation is labelled; browser-only results are not called server-attested. |
| V09 | CURRENT | TODO | Repeat comparison UI after Review/layout changes. | Q01, S09 | No automatic workcell motion or accidental paid model call occurs. |
| V10 | PILOT | TODO | Define repeat counts and a held-out model experiment. | V06, U20 | No model ranking or policy generalization claim comes from six smoke cases. |

## W. Human-demonstration/Pronto data bridge — CURRENT foundations, PILOT utility / F-20

| ID | Lane | Status | Task | Depends on | Acceptance criterion |
| --- | --- | --- | --- | --- | --- |
| W01 | CURRENT | IMPLEMENTED | Verify the Pronto premise from a primary company source. | A09 | HUMAN_DEMONSTRATION_BRIDGE.md links official Verified terms and labels reported buyer claims separately. |
| W02 | CURRENT | IMPLEMENTED | Choose a narrow kitchen task pilot. | W01 | Rigid serving/counter tasks match present primitives; full domestic cleaning is not promised. |
| W03 | CURRENT | IMPLEMENTED | Distinguish reference frames from human trajectories. | M01 | UI/docs do not call one image a measured action sequence or training dataset. |
| W04 | PILOT | TODO | Define a reviewed temporal task graph. | W02 | Ordered task segments, object references and exceptions have a versioned schema. |
| W05 | PILOT | TODO | Add timestamped segment annotations. | W04 | Each label references its actual video interval rather than a guessed order. |
| W06 | PILOT | TODO | Hash the original reference media. | M08 | Derived annotations retain the exact source identity without exposing private media unnecessarily. |
| W07 | PILOT | TODO | Preserve selected-frame time and processing lineage. | W06 | Frame selection, resizing and model transformations are attributable. |
| W08 | PILOT | TODO | Represent uncertainty and unsupported observations. | W05 | Occlusion/unknown objects permit abstention; missing confidence is not invented. |
| W09 | PILOT | TODO | Separate observed, operator-confirmed, model-inferred and simulated values. | W08 | A consumer can identify which evidence produced each field. |
| W10 | PILOT | TODO | Record source-use permissions and restrictions. | W06 | Worker/household/media/recipient-use conditions are explicit project metadata. |
| W11 | PRODUCTION | TODO | Propagate revocation and retention actions. | W10, N03 | Derived artifacts affected by a source restriction can be identified and handled. |
| W12 | PILOT | TODO | Retain reviewer corrections append-only. | I04, W09 | Original annotations are not overwritten by the corrected task. |
| W13 | CURRENT | AUTOMATED-DEMO | Demonstrate a native evidence consumer. | L07 | JSON reload and integrity validation accept actual exports and reject tampering. |
| W14 | PILOT | TODO | Agree a recipient's real action/observation contract. | K01, W09 | No simulated pose delta is silently relabelled as a measured motor command. |
| W15 | PILOT | TODO | Validate units, frames and unavailable modalities. | W14 | Missing robot/sensor channels stay absent; hand and robot embodiments remain distinct. |
| W16 | PILOT | TODO | Implement and run one recipient loader. | W15 | The actual consumer reopens a sample and reports consistent shapes/semantics. |
| W17 | PILOT | TODO | Measure annotation/review utility prospectively. | W12, W16 | Time, correction rate and task-label agreement are measured on a fixed sample. |
| W18 | FUTURE | TODO | Demonstrate a held-out learning result and later transfer. | W16, J06, F08 | Training/robot claims require separate measured experiments and hardware gates. |

## X. Feature-specific review, demo checks and regression gates — CURRENT

| ID | Lane | Status | Task | Depends on | Acceptance criterion |
| --- | --- | --- | --- | --- | --- |
| X01 | CURRENT | IMPLEMENTED | Give every feature a source review checklist. | O10 | FEATURE_ACCEPTANCE.md names invariants and ownership/data boundaries. |
| X02 | CURRENT | IMPLEMENTED | Give every feature an observed-outcome demo check. | X01 | Each feature names inputs, expected state and failure/recovery behavior. |
| X03 | CURRENT | AUTOMATED-CHECK | Run integrated build and logic/API checks. | Q19, T19, U18 | Recorded snapshot: 282 tests (163 simulation/data + 119 server/scripts) and production build passed, including after the six-step UI fix; repeat affected checks after further source changes. |
| X04 | CURRENT | TODO | Update affected browser checks for Review/auto run. | Q18, S09 | Tests explicitly select manual or automatic behavior and avoid racing the countdown. |
| X05 | CURRENT | AUTOMATED-DEMO | Repeat the integrated provider workplace workflow. | X03, X04 | E25 passes real prerecorded voice→actual task→explicit save→accepted report in live context→factual spoken outcome. Exact saved-record GET/replay/reexport/consumer E26 and labelled automated backup E28 also pass; untested approval/keyboard edges remain separate. |
| X06 | CURRENT | USER | Perform the physical microphone/listener check HV-01. | C03, C04, X05 | A person speaks/hears the final task and outcome; both human verification fields are recorded accurately. |
| X07 | CURRENT | TODO | Review final screenshots for actual selected-state behavior. | S12, X04 | No left-edge selection marker or hidden Review action is present. |
| X08 | CURRENT | TODO | Reconcile feature claims with final artifacts. | X03, X05, T22, U19 | TODO/implemented/automated-demo/human-demo distinctions remain accurate in all submission material. |
| X09 | CURRENT | AUTOMATED-DEMO | Record a labelled automated workflow backup. | X08, P02 | E28 actual 75.72 s video matches provider/task/save outcomes; prerecorded input, real remote audio mix, approximate A/V. Not a human three-minute stage rehearsal. |
| X10 | CURRENT | TODO | Freeze the final release manifest and handoff. | X09 | Source/build/artifact versions and local-versus-hosted instructions match. |

## Y. Saved collection and native import — CURRENT / F-08

| ID | Lane | Status | Task | Depends on | Acceptance criterion |
| --- | --- | --- | --- | --- | --- |
| Y01 | CURRENT | AUTOMATED-DEMO | List and read saved records through real GET APIs. | I06 | Latest valid approved episode reopens with the real server record ID. |
| Y02 | CURRENT | AUTOMATED-DEMO | Preserve review/outcome/trajectory during replay. | Y01 | Reopened sample count, initial/final state and recorded status match the original. |
| Y03 | CURRENT | AUTOMATED-DEMO | Import a sealed native package locally. | L07 | Original review/outcome are retained; no server submission occurs automatically. |
| Y04 | CURRENT | AUTOMATED-DEMO | Strip external storage/report links from imported content. | Y03 | Imported savedId/reportId are not trusted as local receipts. |
| Y05 | CURRENT | AUTOMATED-DEMO | Reject a changed SHA without history mutation. | Y03 | A visible error appears and browser history remains byte-identical. |
| Y06 | CURRENT | TODO | Repeat reopen/import after the new Review and timeline flow. | Q01, Y05 | Current replay and explicit resubmission controls remain reachable and truthful. |


## Z. Native pose trace and independent consumer — CURRENT / F-21

Evidence: [shared workcell trace](../src/data/robot-trace.ts), [mobile arm](../src/sim/mobile-arm.ts), [mobile evidence](../src/data/mobile-evidence.ts), [consumer](../scripts/consume-evidence.mjs), [consumer tests](../scripts/consume-evidence.test.mjs). CLI manifests live under `.local/qa/consumer/`; their existence on this checkout does not make them mandatory tracked repository data.

| ID | Lane | Status | Task | Depends on | Acceptance criterion |
| --- | --- | --- | --- | --- | --- |
| Z01 | CURRENT | AUTOMATED-CHECK | Derive displayed/exported workcell pose from one analytic source. | F03, L02 | Trace joint/link/TCP/gripper values agree with the native world; additive signed FK checks catch altered angles. |
| Z02 | CURRENT | AUTOMATED-CHECK | Share mobile analytic IK between renderer and recorder. | T13, T17 | Actual base/yaw/shoulder/elbow/wrist/TCP use declared frames and rendered object-center offsets. |
| Z03 | CURRENT | AUTOMATED-CHECK | Declare trace coordinate and clock conventions. | Z01, Z02 | Meters/radians, base anchors, joint order and relative workcell versus absolute mobile clocks are explicit. |
| Z04 | CURRENT | AUTOMATED-CHECK | Verify SHA in a standalone native consumer. | L07, Z03 | Independent code rejects tampering before producing analysis; no app-module import is required. |
| Z05 | CURRENT | AUTOMATED-CHECK | Independently recompute FK from recorded angles. | Z04 | Re-signed bad angles fail geometry checks, including mobile yaw/TCP offsets and unstretched links. |
| Z06 | CURRENT | AUTOMATED-DEMO | Consume actual workcell and mobile exports. | Z05, T20 | Actual manifests report workbench 70 observations/67 positive-time pairs/2 exclusions and mobile 111/110/0, with verified SHA/FK. |
| Z07 | CURRENT | AUTOMATED-CHECK | Separate zero-clock audit events from state-change pairs. | Z06 | Same-clock transitions are retained as observations but excluded from positive-duration pairs; a terminal-only attempt invents no targets. |
| Z08 | CURRENT | AUTOMATED-CHECK | Preserve stopped/failed outcomes and consumer boundaries. | Z06 | Consumer retains original outcome and declares sourceTaskChecksRecomputed:false; deltas are not relabelled as applied motor actions. |
| Z09 | PILOT | TODO | Validate a recipient-specific learning loader separately. | W14, W15, Z08 | A named version-pinned external consumer loads actual declared actions/observations; native analysis alone cannot close this gate. |

## AA. Actual mobile AI predeployment evaluation — CURRENT / F-22

Evidence: [candidate controller](../src/sim/mobile-candidates.ts), [17 tests](../src/sim/mobile-candidates.test.ts), [five cases](../src/sim/mobile-evaluation-cases.ts), [bench](../src/components/MobilePlannerBench.tsx), [model service](../server/mobile-planner.mjs), [browser smoke](../scripts/mobile-planner-smoke.mjs). These are task-level primitive plans, not VLA or learned motor policies.

| ID | Lane | Status | Task | Depends on | Acceptance criterion |
| --- | --- | --- | --- | --- | --- |
| AA01 | CURRENT | AUTOMATED-CHECK | Freeze the same native world and independent delivery goal. | T01, V01 | Human/baseline/model attempts retain the same supplied initial state; the model cannot choose its own acceptance target. |
| AA02 | CURRENT | AUTOMATED-CHECK | Validate exact bounded mobile candidate JSON. | AA01 | 1–12 exact navigate/reach-check/pickup/place primitives, known stations and Cup/Bowl IDs; aliases/extras/functions are rejected without execution. |
| AA03 | CURRENT | AUTOMATED-CHECK | Compile only declared navigation primitives. | AA02, T07 | Collision-checked paths preserve candidate order; missing navigation/reach/placement is never inserted. |
| AA04 | CURRENT | AUTOMATED-CHECK | Execute candidates through the actual bounded controller. | AA03 | At most 6000 ticks at 1/30 s; wrong-order pickup fails the real dock guard; no candidate self-score determines success. |
| AA05 | CURRENT | AUTOMATED-CHECK | Retain true failure taxonomy and action attribution. | AA04 | Invalid/refused/failed/blocked/completed remain separate; reach/no-route/docking/object/human errors preserve actual step/message; genuine success invents no error. |
| AA06 | CURRENT | AUTOMATED-DEMO | Separate controller completion from frozen task acceptance. | AA04 | Table delivery can complete its declared actions while the independent Cup→Sink task fails; missing place retains cargo and fails. |
| AA07 | CURRENT | AUTOMATED-CHECK | Detect protected disturbance through every native tick. | AA04 | Unrequested Bowl pick-and-return fails protected-object even when full final state equals initial; partial handling cannot erase history. |
| AA08 | CURRENT | AUTOMATED-DEMO | Record and replay actual candidate attempt states. | AA05 | Approximately 10 Hz plus control/error/terminal frames, max 2005; initial/final world and relative clock agree; browser replay changes canvas/time. |
| AA09 | CURRENT | AUTOMATED-DEMO | Execute a predeclared five-case authored baseline suite. | AA05, AA07 | Two actual accepted tasks plus explicit reach/no-route/human-blocked outcomes; expected refusal never counts as task success. |
| AA10 | CURRENT | AUTOMATED-DEMO | Make one explicit real mobile-model UI request. | AA02, C01 | Exactly one gpt-4o-mini request retained 5 returned actions, actual 2797.58 ms request latency and server-computed accepted task; no paid loop. |
| AA11 | CURRENT | AUTOMATED-DEMO | Export actual attempts and a derived observed-results CSV. | AA08, AA10 | Report retains 9 attempts/4 accepted/5 controller completions/1 wrong-goal completion/4 failed-refused-blocked; request errors separate. |
| AA12 | CURRENT | AUTOMATED-DEMO | Check planner bench desktop and phone geometry. | AA08 | Actual 1280×720 and 390×844 dialogs/controls stay within viewport without horizontal overflow. |
| AA13 | CURRENT | AUTOMATED-CHECK | Protect static-arm references across evaluator/native/server. | AA07, V04, L07 | Integrated regression rejects touched-and-returned reference despite exact final pose; legitimate human intervention remains valid; tests pass in the 282-check snapshot. |
| AA14 | CURRENT | AUTOMATED-CHECK | Recheck static protected-history report contracts. | AA13 | Candidate/native/server recomputation regressions agree on touched-and-returned reference and preserve legitimate intervention. Current continuous provider/report rehearsal stays X05. |
| AA15 | PILOT | TODO | Run a preregistered held-out repeated model comparison. | AA09, AA11, U20 | Freeze cases/model revisions/repeats; export all denominators and failures; one passing model request is never a ranking or physical-transfer result. |


## AB. Explicit mobile review, local persistence and saved replay — CURRENT / F-23

Evidence: `.local/qa/mobile-store-smoke-results.json` (five real API/browser groups). No successful store response is mocked; one deliberate unavailable-network attempt tests retry.

| ID | Lane | Status | Task | Depends on | Acceptance criterion |
| --- | --- | --- | --- | --- | --- |
| AB01 | CURRENT | AUTOMATED-DEMO | Freeze mobile evidence for explicit human review. | T20 | Task completion opens Review; evidence save cannot inherit the motion countdown. |
| AB02 | CURRENT | AUTOMATED-DEMO | Save reviewed mobile evidence through the real local API. | AB01, I06 | Actual HTTP 201 receipt returns saved ID/report with matching source digest. |
| AB03 | CURRENT | AUTOMATED-CHECK | Independently recompute mobile geometry and recorded protected history. | AB02, AA07 | Posted check flags do not decide acceptance; identity/physical motion replay is not claimed. |
| AB04 | CURRENT | AUTOMATED-DEMO | Reopen saved mobile record through GET and SHA verification. | AB02, Y01 | Fresh browser lists records; replay changes actual states/time; Return live preserves exact live world. |
| AB05 | CURRENT | AUTOMATED-DEMO | Retain frozen source through service error/export/retry. | AB01, AB02 | Injected failure changes no source digest; actual retry stores the same frozen evidence. |
| AB06 | CURRENT | AUTOMATED-DEMO | Preserve stopped held-cargo outcome in saved report. | AB03 | Stopped Cup remains held, zero placements, outcome stopped and acceptance false. |
| AB07 | CURRENT | AUTOMATED-DEMO | Keep critical approval visible and lock competing controls. | AB01 | At 1280×720 approval is in viewport and hit-tested; header/tabs/commands cannot abandon review. |

## AC. Submitted photo/frame identity — CURRENT / F-24

Evidence: `.local/qa/reference-provenance-results.json` (four groups; two explicitly mocked generation responses, zero paid calls).

| ID | Lane | Status | Task | Depends on | Acceptance criterion |
| --- | --- | --- | --- | --- | --- |
| AC01 | CURRENT | AUTOMATED-CHECK | Hash the exact submitted resized JPEG bytes. | M01 | SHA-256 matches independently hashed request bytes; changed bytes change fingerprint. |
| AC02 | CURRENT | AUTOMATED-DEMO | Distinguish image and selected video frame with actual time. | AC01 | Native recording/export retains kind/time/hash, without media/filename; calibration/rights false. |
| AC03 | CURRENT | AUTOMATED-DEMO | Cancel stale generation after reference changes. | AC01 | New upload clears old draft; changing reference during hash sends no stale API request. |
| AC04 | CURRENT | AUTOMATED-DEMO | Enforce local reference size/readiness bounds. | M01 | Source above 50 MiB rejects before generation; selected video requires a ready frame. |
| AC05 | CURRENT | AUTOMATED-DEMO | Preserve metadata through approved actual controller recording. | AC02, L07 | Photo/video source metadata matches native initial/sample worlds; comparison canvas stays in its cell. |

## AD. Correlated variation lineage and native consumer — CURRENT / F-25

Evidence: `.local/qa/lineage-smoke-results.json`, `lineage-child-*-consumer-manifest.json` (three actual browser checks), helper/native/consumer tests.

| ID | Lane | Status | Task | Depends on | Acceptance criterion |
| --- | --- | --- | --- | --- | --- |
| AD01 | CURRENT | AUTOMATED-CHECK | Canonically hash the source scene and task without mutation. | U02 | Key order/clocks/generated task ID do not change digest; geometry/task changes do. |
| AD02 | CURRENT | AUTOMATED-DEMO | Attach parent/seed/index/kind when loading a generated child. | AD01, U13 | Two different child layouts retain one declared parent with distinct real indices. |
| AD03 | CURRENT | AUTOMATED-CHECK | Validate native derivation and temporal immutability. | AD02, L07 | Invalid fields/identityVerified:true or changing metadata are rejected; old missing lineage remains compatible. |
| AD04 | CURRENT | AUTOMATED-DEMO | Carry child ancestry through real recording/native export. | AD03 | Actual browser child exports retain the same parent fingerprint; separate helper tests preserve any existing reference metadata. |
| AD05 | CURRENT | AUTOMATED-DEMO | Group child exports in the standalone consumer. | AD04, Z04 | Same parent group despite distinct computed child hashes; groupingSource and unverified ancestry explicit; no split performed. |
| AD06 | CURRENT | AUTOMATED-CHECK | Keep controller timing separate from lineage hashing. | AD01 | Batch exposes actual parent/seed/case index plus separately measured hash duration. |

## AE. Visible mobile voice recovery — CURRENT / F-26

Evidence: `.local/qa/mobile-voice-recovery-results.json` (five error-state groups; zero provider starts; one actual empty reset).

| ID | Lane | Status | Task | Depends on | Acceptance criterion |
| --- | --- | --- | --- | --- | --- |
| AE01 | CURRENT | AUTOMATED-DEMO | Display persistent sanitized mobile connection errors. | O05 | Microphone/service errors remain visible despite App mobile return; no implementation/secret dump. |
| AE02 | CURRENT | AUTOMATED-DEMO | Prevent duplicate Connect while microphone is pending. | AE01 | Two rapid clicks issue one microphone request; Connect disabled and Reset available. |
| AE03 | CURRENT | AUTOMATED-DEMO | Reuse existing generation-owned reset from mobile. | AE01 | Failed reset remains recoverable, actual empty reset confirms cleanup and clears shared state. |
| AE04 | CURRENT | AUTOMATED-DEMO | Verify error/Reset visibility at desktop and phone widths. | AE01 | 1280/390 control bounds and hit tests pass without horizontal overflow. |
| AE05 | CURRENT | IMPLEMENTED | Catch disconnect errors and preserve recovery state. | AE03 | Rejected stop is caught, error visible and Reset offered; no unhandled event promise. Physical audio recovery remains HV-01. |

## Release gates

| ID | Status | Release gate | Depends on | Required evidence |
| --- | --- | --- | --- | --- |
| R01 | GATE | Human voice acceptance | X06 | HV-01 physical microphone speech and human-heard real Murf response; automated provider evidence alone is insufficient. |
| R02 | AUTOMATED-DEMO | Continuous provider workplace outcome | X05, C12, AB02 | E25 one-session voice/action/explicit 201 save/accepted report/factual captured speech passes. Exact saved-record handoff/reexport/consumer E26 and labelled backup E28 verified. Final source/publish freeze stays X10; general approval-edge gate R07 and human gate R01 remain open. |
| R03 | GATE | External policy/environment pilot | F04, J03, J07 | A real selected policy interface is evaluated across declared task families; three arm fixtures alone do not close this. |
| R04 | GATE | Recipient data usefulness | K10, L11, W16 | The agreed recipient actually loads/uses the package with declared modality and fidelity limits. |
| R05 | GATE | Scalable production software | N11, N12, D09 | Auth/isolation, durable jobs/storage, measured load and recovery are exercised. |
| R06 | GATE | Real-robot readiness claim | F08, F10, W18 | A separate hardware validation protocol is completed; no laptop-only pass can close this. |
| R07 | GATE | New Review and three-second auto-motion policy | Q17, Q18, Q19, Q20 | Auto once/cancel/manual/critical exclusions and voice receipts pass on the same revision. |
| R08 | AUTOMATED-DEMO | Mobile floor navigation | T18, T19, T20, T21 | Collision-aware supported routes, blocked-goal refusal, recovery and a labelled native artifact are demonstrated. |
| R09 | GATE | Constrained scene variation | U18, U19 | Reproducible valid cases, protected references, bounded generation and truthful export counts pass; any exposed cancellation must also be checked. |
| R10 | GATE | Human-reference operational pilot | W12, W16, W17 | Independent task review, permissions/provenance and an actual recipient trial support the stated utility. |
| R11 | AUTOMATED-DEMO | Native state-analysis handoff | Z04, Z05, Z06, Z07, Z08 | Independent SHA/FK consumer reopens actual workcell/mobile exports; source checks are not called independently recomputed. External training loader remains Z09. |
| R12 | AUTOMATED-DEMO | Demonstrated AI predeployment evaluation integrity | AA07, AA11, AA13, AA14 | Actual mobile evaluator/report/replay and static native/server protected-history regressions pass, including exact restored references. This is scoped symbolic/kinematic evaluation; physical policy, statistical model ranking, R07 untested edges and HV-01 remain separate. |

Do not hold routine authorized implementation waiting for a new permission. The real external dependencies are a person for HV-01 and an agreed recipient/hardware evaluation for later gates. Internal rubric weights and feature count do not justify estimating a chance of winning.
