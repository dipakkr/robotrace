# Current terminal UI: component purpose audit

21 November 2026. **Read-only audit; no runtime edits, provider calls or API
writes.** Source inspected: [App](../src/App.tsx),
[mobile workspace](../src/components/MobileKitchen.tsx),
[activity terminal](../src/components/ActivityTerminal.tsx) and
[independent trace viewer](../public/trace-analysis.html). Existing local screenshots
`mobile-store`/`immediate`/terminal QA are supporting point-in-time evidence, not a
new acceptance run. The original audit was read-only. A targeted workcell follow-up subsequently fixed and browser-verified UIA-01 through UIA-05; other findings retain their own status below.

The operator's main job is to issue a task, understand the current action/error,
stop or recover it, then save/export the **same attempt**. Secondary jobs are
scene/task selection, matched evaluation and independent trace inspection.
Primary controls should serve one of those decisions. Current policy is immediate
local simulation with one activity terminal and direct unreviewed save/export;
there is no approval/countdown workflow to reintroduce.

## Main workcell

| Component / visible control | Operator purpose | Recommended placement / condition | Actual issue or boundary |
| --- | --- | --- | --- |
| Environment name and Environment entry | Choose the task/scene that gives commands meaning. | **Keep primary**; name the currently displayed source. | Replay must identify its recorded environment rather than imply live state. |
| Mobile kitchen / workcell navigation | Switch between bounded arm tasks and mobile transport. | **Keep primary**; disable while an active task cannot be safely abandoned. | Navigation is task selection, not evidence of robot capability. |
| Studio / Copilot / Simulation layouts | Trade inspection detail for a larger execution view. | **Collapse advanced** presentation controls after the main task choice. | Keep a visible exit/restore path. Changing layout must not change task state. |
| Current mode and phase | Know whether the robot is ready, executing, paused, stopped or replaying. | **Keep primary**, adjacent to scene/terminal. | One authoritative state: do not mix Ready world with Completed old episode. |
| 3D scene | Observe movement, object location and the human proxy. | **Keep primary**. | The rendered result is kinematic state, not physics/safety validation. |
| Orbit / Top / Robot views | Inspect occlusion, route and placements. | Keep a compact view switch; **collapse advanced** grid/path toggles. | Camera changes need actual view changes, not decorative selections. |
| Human activity scenario | Exercise hold/clear/resume without hardware. | Keep reachable during motion, labelled **scenario**. | No real person detection or certified safety claim. |
| Stop and Pause/Resume | Immediately interrupt or continue current motion. | **Keep primary**; active/disabled states follow the actual live controller. | Replay must not expose controls that alter live motion. Clearance alone must not resume. |
| Reset | Start again from the source scene. | Keep compact and direct under latest policy. | It must reset current-attempt evidence association; old saved records remain separate. |
| Command field / Send | State the next requested action. | **Keep primary**, consistently reachable. | Supported commands start immediately; unknown/ambiguous commands should log an error without partial motion. |
| Voice Connect/End/status/Reset | Initiate conversation or recover a stale/failed connection. | **Keep primary**; Reset only for connecting/error; show meaningful error. | Configured is not live; live transport is not human hearing. Do not hide errors in another workspace's modal. |
| Activity terminal and severity labels | See command, context, plan, action, check, tool and error evidence in order. | **Keep primary** with one heading and scroll-follow recovery. | UIA-01/04/05 below: duplicate context/heading and intro-as-tool classification. |
| Latest activity action | Resume following after inspecting older lines. | **Only when scrolled away**. | Auto-follow must not pull the operator away from evidence being read. |
| Task title and instruction | Understand the selected job and targets. | Short primary title; **collapse advanced** SOP/capabilities/details. | A repeated full assignment banner and context sentence can compete with actual action/error lines. |
| Check count / outcome | Distinguish controller completion from task acceptance. | **Only when a current attempt or selected replay exists**. | UIA-02: initial-state invariants passing do not mean this task is partly completed. |
| Current attempt Save / Export / Replay | Preserve or inspect the work just performed. | **Only for the current attempt**, with direct save/export; clearly labelled unreviewed. | UIA-03: `selectedEpisode` falls back to the first stored episode even when no active episode is selected. |
| Saved episode/library navigation | Explicitly select historical evidence. | **Collapse advanced** or one clear navigation entry. | Header/rail/sidebar duplicates should not suggest three different storage systems. Historical evidence needs its own ID/source label. |
| Timeline / Auto-record / Record episode | Inspect sampled history or deliberately record an exceptional/manual session. | Timeline **only when data exists**; manual recording and auto-record settings **advanced**. | Default auto-record plus prominent Record episode can imply an unnecessary prerequisite. Never show old action totals as current evidence. |
| Scene tree, properties and coordinates | Debug identities, geometry, joints and exact source state. | **Collapse advanced** inspector. | Valuable for diagnosis/export verification, not required to issue an ordinary task. |
| Planner/evaluation navigation | Test candidates and controlled negative cases. | Keep one discoverable **task navigation** entry; detail inside evaluation. | The selected model or an expected refusal must not appear as a completed task. |
| Readiness/help/setup | Explain configuration, limits and known gates. | **Collapse advanced** help/settings. | Internal readiness is not an organizer score; setup details do not belong in the main employee flow. |

## Mobile kitchen

| Component / visible control | Operator purpose | Recommended placement / condition | Actual issue or boundary |
| --- | --- | --- | --- |
| Known-map viewport, mode and current phase | Understand navigation versus reach/handling progress. | **Keep primary**. | Label known map and simulator scope; no SLAM/perception claim. |
| Orbit / Top and Simulation only / Show terminal | Inspect route or enlarge the scene during presentation. | Compact view control; presentation action secondary. | Keep terminal restoration and Escape available. |
| Stop, Pause/Resume, Human enters/Clear human | Supervise and interrupt the actual mission. | **Keep primary**, with current-state eligibility. | Proxy clearance is distinct from explicit Resume; retained cargo is visible evidence. |
| Command and voice/error controls | Brief the task and recover conversation. | **Keep primary** beside terminal. | Error/reset state must remain visible at phone width; no duplicate start while connecting. |
| Reach context line | Explain why base movement is needed before pickup. | Keep concise at task start; **collapse advanced** ongoing distances. | Distance is geometric, not a learned reasoning score; do not let stale target text contradict current phase. |
| Action queue and verified step count | Inspect exact declared execution order. | **Only when a mission exists**, collapsed detail after the active line. | A verified step is not necessarily full task acceptance. |
| Save mobile evidence / Export mobile evaluation | Hand off the current completed/stopped/failed recording. | **Only when a current recording exists and no active motion**; direct action. | Save stays unreviewed. Error retains recording; report acceptance and human review are separate. |
| Saved report details | Read persistence receipt, ID and actual accepted/not-accepted outcome. | **Only when saved or replaying**, collapsed detail. | Receipt should identify its exact source recording and never be a default current-world result. |
| Current task checks | Inspect goal/delivery/settled conditions. | **Only for a current mission/record**, collapsed detail. | Passing geometry cannot relabel a stopped attempt or a protected-history failure as accepted. |
| Telemetry & comparison | Inspect derived arm/base coordinates or fixed/mobile ablation. | **Collapse advanced**. | Coordinates are simulated; comparison must share source/goal and navigation capability is the changed condition. |
| Base travel / simulated time / arm reach | Orient motion and compare actual attempt costs. | Keep travel/time small; reach secondary after it explains the first action. | Simulated duration is not wall-clock latency or measured operational savings. |
| Saved recordings / replay slider / Return live | Reopen exact evidence without altering live state. | Library navigation primary-secondary; replay controls **only while replaying**. | Show read-only mode; Return live must restore the untouched live world. |
| AI deployment checks | Run controlled candidate comparisons. | Keep one clear **task navigation** entry. | Matched pair is separate from live judge interruption; both runs must share source/goal/interventions. |
| Speed selector | Shorten a simulated demonstration. | Compact secondary control. | It changes playback/execution rate, not task acceptance or physical performance. |

## Independent trace viewer

| Component / visible control | Operator purpose | Recommended placement / condition | Actual issue or boundary |
| --- | --- | --- | --- |
| File picker/drop target and load/error status | Open actual exported data without the app/API. | **Keep primary before load**; compact after load. | Rejected input must clear prior verdicts; no built-in fabricated plot. |
| Source/package/run IDs, shared-scene hash and conditions | Check which evidence and comparison is being inspected. | **Collapse advanced** source panel after verification; visible in full view. | Hash is content integrity, not authenticated authorship; matching IDs alone are not matching scenes. |
| Source controller/task versus independent protected verdicts | Separate completed movement from task correctness and independent analysis. | **Keep primary summary**. | The independent consumer recomputes protected history, not all source goal checks or physical motion. |
| Run/object selector | Choose the exact recorded object and candidate. | **Keep primary with chart**. | Preserve actual IDs and selected-source attribution; do not compare unrelated runs silently. |
| Displacement plot and violation marker | Locate the excursion hidden by an identical final frame. | **Keep primary**. | Zero-tolerance exact-record rule: status may change before position; a flat coordinate curve does not erase a record violation. |
| Jump to first violation / sample slider / time and XYZ | Inspect source coordinates, changed fields and action at the recorded event. | **Keep primary**, together in presentation view. | First recorded observation is not a measured physical contact time; preserve producer sampling limits. |
| First record/position, maximum/final displacement, restored flag | Explain why the history fails despite final restoration. | Keep compact next to chart; technical policy in advanced text. | Never substitute an invented 1 cm threshold for the declared exact simulator rule. |
| Presentation view | Fit chart and selected-sample coordinates on stage. | Keep one secondary toggle with exit. | Source metadata is hidden for space, not removed from the export. |
| Preference candidate and download actions | Share the exact analysis and an unreviewed candidate comparison. | **Only when data exists**; compact export/handoff area. | Heading “Reviewed data is the next handoff” can imply completed review under the new no-review policy; see UIA-07. |
| Simulation/policy limitations | Keep conclusions within evidence. | Concise persistent boundary; detailed copy advanced. | No training gain, approved preference label, physical transfer or calibrated motor action claim. |

## Concrete findings: open until verified

| ID | Finding and evidence | Necessary correction / acceptance | Status |
| --- | --- | --- | --- |
| UIA-01 | App context entry uses `time:'context'` and `kind:'context'`; terminal renders both columns. The initial row reads context/CONTEXT twice. | A meaningful clock or an empty/neutral time cell, with one context category. Inspect the actual initial terminal. | **FIXED · targeted browser check** |
| UIA-02 | Task checks are rendered from the initial/current world into assignment badge and terminal even before an attempt. The supplied screenshot's initial 3/5 can look like task progress. | Before a current task exists, say Ready / Task not run or expose named preconditions in detail. Only current-run/replay results may be called task checks passed. | **FIXED · targeted browser check** |
| UIA-03 | `selectedEpisode = ... ?? episodes[0]` permits old episode data while `activeEpisodeId` is null and live world is Ready. The supplied screenshot shows completed unsaved action totals unrelated to current world. | Evidence footer/timeline must require an explicit current recorder, active episode or selected replay, with matching ID. Reset/new environment cannot silently attach the latest old recording. | **FIXED · targeted browser check** |
| UIA-04 | Workcell retains outer Collection copilot heading plus inner Live activity heading. Mobile already uses one Activity terminal heading. | One terminal heading/status; reuse recovered vertical space for actual task/error lines. | **FIXED · targeted browser check** |
| UIA-05 | App fallback maps untyped assistant introductions to tool; initial welcome is not a tool call. SYSTEM is available in TerminalEntry. | Classify introduction as system/context; reserve tool for an actual tool result. Inspect initial and task-result rows. | **FIXED · targeted browser check** |
| UIA-06 | Supporting terminal screenshot contains old “Review the recording before approving it” copy; source still contains historical approval modal/empty-state language. The current policy is direct unreviewed save. | Reachable terminal/empty-state/save copy must describe direct unreviewed records. Historical proof can retain old UI if clearly labelled historical. Verify reachable controls rather than deleting code solely by keyword. | **COPY UPDATED · source-checked; earlier recordings remain historical** |
| UIA-07 | Independent viewer preference-panel heading says “Reviewed data is the next handoff”, while its actual candidate has no human review and current product avoids approval claims. | Renamed to “Candidate research handoff”; trainingValidated:false and actual source IDs remain intact. Shared HTML/analysis tests pass. | **FIXED · source and generated report check** |

## Keep/collapse rule for the final cut

Keep current phase/mode, Stop/Pause, command/voice/error recovery and ordered
activity/severity visible. Show evidence only for its current or explicitly chosen
attempt. Keep environment/evaluation navigation discoverable. Collapse SOP,
coordinates, detailed policy and manual recording controls until needed. In the
independent viewer, preserve comparison, plot, first-event/selected coordinates
and export; do not let branding or repeated explanations displace those facts.

This audit supplies component rationale and concrete findings. It is not a claim
that every control, keyboard path, screen reader, phone or future state has been
verified. No OPEN finding is marked fixed by source intent alone.

## Targeted workcell follow-up verification

`.local/qa/workcell-terminal-context-results.json` records **four passed groups** with a real prior three-action native episode preloaded into an isolated browser. The fresh 1280×720 scene showed one Activity terminal heading with compact announcement/collapse/settings controls, a neutral `—` context time, SYSTEM introduction, `Not run` / `No task executed in this scene`, and no prior recording's action count, Save/Export or timeline state as current evidence. Historical records remain behind an explicit Previous records action. A new actual one-action run then revealed only that current record's tools. Export and the intercepted unreviewed Save referenced its exact new ID. Phone emulation remained 390 px wide without horizontal overflow. No provider request or server write was made.

Artifacts: `.local/qa/workcell-terminal-fresh-1280.png`, `workcell-terminal-current-1280.png`, `workcell-terminal-current-390.png`. Local ignored artifacts are not guaranteed in a fresh checkout.

`.local/qa/workcell-cups-chain-results.json` records **three passed groups**: actual counter cleanup placed both cups at Sink; the natural follow-up `Move all cups from sink to drying rack` moved both cups to Drying, recorded a fresh task ID and corresponding destination goals, and showed 5/5 for the new task. A subsequent unsupported Fork request was visibly rejected, with `Latest command not executed`, no old Completed/5-of-5 claim and no primary tools for the prior attempt; its native record remained intact in history. The helper binds the task before recording and fails without motion if binding is refused. This is a UI/controller check, not a claim of server persistence for that follow-up.

App/shared-terminal source was frozen after these checks for the separate voice rehearsal. The remaining global accessibility, real microphone/listening and other OPEN component findings are not closed by these narrow results.


## Final copy follow-up

The scene controls now say **Apply AI scene** / **Apply environment** (one action), and current save/empty-state copy describes unreviewed evidence. The unused legacy publish modal no longer asserts human quality review. The independent viewer now says **Candidate research handoff**. These copy edits have source/generated-report checks; the earlier full UI checks remain scoped to their recorded controls and are not a universal accessibility certification.
