# Final UI acceptance audit

21 November 2026. This is a local prototype acceptance record, not a production accessibility certification. Source-only findings, recorded browser behavior and human audio verification remain separate. No provider call, voice reset or persistent-data write is authorized by this audit script.

The focused check is [ui-acceptance-smoke.mjs](../scripts/ui-acceptance-smoke.mjs), using isolated Chrome contexts. Its scene-generation response is explicitly **QA MOCK / no provider**: six supported blocks exercise scene validation and Review scrolling. It is not evidence of a live model generating a scene. Actual provider evidence remains in the separate voice/model artifacts.

## Source review

| Requirement | Inspected source and interpretation |
| --- | --- |
| Dense dark console | [styles](../src/styles.css), [Review styles](../src/components/ApprovalReview.css), [mobile styles](../src/components/MobileKitchen.css). Compact sidebar rows/text, dark neutral surfaces and rounded action controls are implemented. Exact source target is not a substitute for actual visibility checks. |
| No left selection stripe | Reviewed CSS for border-left, directional inset shadows and selected-state pseudo-elements. A full-surface background, complete rounded outline, icon/text contrast and bottom tab underline are allowed. The non-selection skill connector and complete object-swatch outline are not selected-row markers. Actual selected controls also need computed-style inspection. |
| Dedicated Review | [ApprovalReview](../src/components/ApprovalReview.tsx) keeps ordered actions in a scrollable content area and controls in its own footer. [App](../src/App.tsx) owns approval timers and opens Review for plans/scene drafts; finished recordings also open Review. New Review work collapses the timeline to preserve action-list space; laptop-height Review retains at least 96 px of content. |
| Narrow automatic approval | The checkbox names simulated plans and the boundary text explicitly excludes scene replacement, reset and evidence submission. Critical work still uses explicit apply/reset/submit handlers. Review preferences do not constitute physical robot deployment approval. |
| Chat/presentation recovery | Studio and Copilot expose command/chat controls. Simulation intentionally concentrates on the viewport, with Show copilot and Exit/Escape available; it does not literally show a chat transcript at the same time. Collapsed inspector/copilot/timeline have restore controls. |
| Factual mobile outcomes | [mobile outcome helper](../src/sim/mobile-outcome.ts) distinguishes navigation, delivery and retained custody. Home navigation must not announce that an object was released. This helper has separate controller checks; actual UI text is checked where recorded below. |

## Existing observed evidence reused

Avoid rerunning every established workflow for presentation-only changes. The following are dated, narrow acceptance records, rather than assertions about all future inputs:

- `mobile-smoke-results.json`: five local mobile UI groups covering actual delivery, pause/cargo/clear/explicit resume, fixed/mobile same-scene comparison, furniture detour, explicit reset, stopped-cargo recovery and responsive controls.
- `mobile-visual-smoke-results.json`: focused actual canvas/camera/immersive/Escape checks.
- `protected-mobile-results.json`: four current groups; exact restored Bowl state still fails protected history at pickup step8; actual report and replay agree. Actual protected-object UI/report/replay captures are retained under `.local/qa/protected-mobile-*`.
- Existing workcell browser, library and approval records cover distinct completed tasks, explicit reports, import/tamper rejection and the cancellation window. They do not silently certify a newly changed selector or approval boundary.

Generated `.local/qa` evidence is ignored local material and may be absent in another checkout. Final focused results and screenshot links are recorded below once the check finishes.

## Focused observed results

The first run passed two new critical groups; four other groups had harness assumptions (Copilot is the initial mode, draft title includes its validation prefix, and navigation text is in Assistant). The corrected follow-up reran those four groups only. No runtime source was changed. See `.local/qa/ui-acceptance-results.json` for the original raw run (including preserved harness failures), `ui-acceptance-corrected-groups-observed.json` for the explicitly labelled summary of the corrected four-group command output, and `ui-acceptance-review-regression-results.json` for the final raw focused regression. A shared follow-up filename was overwritten by a subsequent focused run; the summary is not presented as a new test execution.

| Check | Actual evidence and current acceptance |
| --- | --- |
| 1280×720 layouts/recovery | Studio/Copilot command input within viewport; inspector/copilot collapse and restore, timeline expand/collapse, Simulation→Show copilot and Escape→Studio passed. Orbit/Top/Robot selection states inspected. Initial Copilot intentionally hides the inspector. |
| Dense selected states | Actual tree row is 11 px / 25 px. Computed selected rail/tree/sidebar/copilot/layout/camera/episode/environment-tab styles have no directional left-only selection border or inset marker. Full-surface outline and bottom underline remain permitted. This is source/computed-state coverage, not a manual accessibility certification. |
| Motion review | New plan selected Review; Cancel countdown held it beyond 3 seconds with no episode/movement; manual approval completed one actual action. Completion selected Review and exposed the dataset review action within the laptop viewport. |
| Critical submission/reset | More than 3 seconds passed without submission; episode remained `review`. Explicit publish modal still waited for Approve & submit evidence. Reset modal still waited for deliberate Reset scene; Keep current scene preserved the episode. No API writes or voice-reset requests occurred. |
| Scene replacement | Explicit QA MOCK draft with six supported objects remained unapplied after more than 3 seconds. Only Approve & apply AI scene changed the workplace. This tests UI/schema behavior, not a real AI model. |
| Six-step Review footer | All six declared actions existed; footer stayed reachable after content scroll. The initial 12 px list was rejected during visual review. The corrected final regression starts Studio with the timeline expanded, opens the six-step plan, verifies automatic timeline collapse and a 96 px scrollable action area, and keeps Approve reachable. UI-01 is closed for this tested layout. |
| Disabled automation | Unchecking the motion preference survived reload; a new plan remained pending beyond 3 seconds until explicit approval. |
| 390×844 phone emulation | Document/body/viewport widths all 390 px. Review Approve and command input were reachable by scrolling, with no horizontal overflow. This does not imply both controls remain visible without scrolling, or physical phone touch/audio validation. |
| Go Home semantics | Actual local mobile navigation completed and Assistant said: `Navigation to Home verified. The carrier is empty.` No invented object-release or delivery statement. |

### UI-01 · Review action list squeezed by expanded timeline — FIXED / VERIFIED

At **1280×720 / Studio / timeline expanded**, the six-step mock Review had only **12 px** of content height versus **408 px** of scroll content. Approve/Discard remained reachable, but the action list was effectively unreadable in the screenshot. The test now requires at least 80 px for meaningful inspection, rather than accepting any nonzero scroll area. The implementation allocates a 96 px minimum on laptop-height layouts; this is a concrete acceptance guard, not a universal UX standard.

Root authorized a narrow fix after the finding: new motion/critical review and completed recordings collapse the timeline; laptop-height Review gets a 96 px content minimum and omits the redundant workflow strip. [Current six-step laptop evidence](screenshots/ui-acceptance-six-step-review-1280.png) shows the corrected state. The final actual browser regression explicitly expanded the timeline before creating the plan, observed automatic collapse, measured **96 px / 408 px** scroll content and hit-tested Approve within the viewport. No paid calls, API writes or runtime/page errors occurred.

`npm run build` (including TypeScript) passed after the runtime fix. The existing large-bundle warning remains; this check is not a performance/load audit. Only the affected Review group was repeated after that change.

### Actual screenshots

- [Dense Studio at 1280×720](screenshots/ui-acceptance-studio-1280.png).
- [Dataset Review automatically opened after completion](screenshots/ui-acceptance-dataset-review-1280.png).
- [Phone Review / scroll-reachable command and approval](screenshots/ui-acceptance-review-390.png).
- [Go Home navigation outcome](screenshots/ui-acceptance-mobile-home.png).

The focused requirements above have observed evidence and UI-01 is closed for 1280×720. This does not mean every possible layout, keyboard path or accessibility requirement has been tested. Physical microphone/hearing remains separately open below.

## Remaining human / release checks

**HV-01 remains OPEN:** a person must speak into the physical laptop microphone, hear the actual Agora/Murf reply, observe the action and hear the factual outcome. Captured RTC audio and automated transcription verify different things; they do not certify a human microphone/listener test.

Responsive emulation does not verify physical-phone touch/audio. A full keyboard/screen-reader audit, contrast measurement, physical robot operation, contact/safety validation and production multi-user operations are separate acceptance scopes. No internal rubric points or winning probability are awarded here.

## Final R07 timer edge audit

The bounded [approval-edge-smoke.mjs](../scripts/approval-edge-smoke.mjs) run used real UI commands in isolated Chrome contexts and the actual local controller. `.local/qa/approval-edge-results.json` records **two passed groups**, no page errors and no non-GET API requests. No voice session, paid model, reset endpoint or persistent API write was used.

| Edge case | Observed result / limit |
| --- | --- |
| Manual approval near deadline | Clicked at **2453 ms** after command preparation; exactly one explicit manual approval, one actual action and one episode. Waiting another 3.3 seconds produced no late duplicate. |
| Discarded pending plan | Discard before expiry, then wait beyond the old three-second deadline: no movement, no episode and unchanged zero simulation clock. |
| Replaced pending plan | Red plan replaced with Blue plan. Old deadline passed without movement; only the replacement `Move blue to tray B` executed, once, with one approval and Red unchanged. |
| Genuine hidden tab | **NOT EXERCISED.** Actual headless Chrome tab focus reported `visible → visible`. The script did not override `document.hidden` or dispatch a synthetic visibility event. Source has a visibility guard, but this is not browser evidence that it fired. |
| Busy / replay / modal / occupied pending-plan combinations | Source eligibility guards were inspected. Manual-near-expiry proves cancellation of its obsolete timer as the queue becomes busy. Separate stale-timer browser combinations for replay, modal and occupied state were not added to this bounded release audit; existing critical-action and human-interruption evidence tests different requirements. These specific unrun combinations remain open rather than receiving inferred acceptance. |

This closes the two observed timer-race questions; it does not declare every R07 edge or human microphone/listening acceptance complete. No runtime source changed during this timer audit.
