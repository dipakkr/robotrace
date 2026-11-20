# TeachTrace design references and evidence

Researched 21 November 2026. Use these products as references for robotics workbench structure and interaction. TeachTrace should use its own name, assets, styling, and narrowly scoped workflow.

## Evidence method and limitations

The research used public primary product pages, official documentation, official demo descriptions, and visual inspection of public pages in Chrome through the computer-use tool. Sources below establish particular interface elements and workflow patterns. I did not sign in to the products or perform a hands-on product trial.

Visual inspection succeeded for Intrinsic's public workcell photograph and multiple rendered frames of Foxglove's public embedded workspace demo. Observed composition and color are identified in those sections. Formant's direct screenshot was blocked by the browser; its named elements are established by documentation rather than visual inspection. No precise pixel measurements were taken.

The separate Foxglove five-minute YouTube demo is verified as an official published video with an available chapter description. That video was not watched end-to-end. Chapter contents below are attributed to its published description, separate from the public embedded-demo frames that were visually inspected.

## 1. Intrinsic Flowstate — skill composition and workcell execution

**Primary source:** [Intrinsic Flowstate walkthrough](https://www.intrinsic.ai/flowstate)

The official walkthrough covers workcell design, a hardware and skill catalog, behavior-tree composition, skill parameters, reachability checks, and running a solution in simulation. It provides screenshots associated with those stages and distinguishes simulated and real workcells.

**Useful adaptation:** pair the large 3D workcell with a readable skill/action sequence. Show the current action and the relationship between objects and task steps. Place simulation execution controls near that sequence.

**Visually observed:** a public photograph of Flowstate on a monitor shows a light application, a central workcell with a purple-outlined arm, left property controls, a right scene hierarchy, and axis gizmos. This was a photograph on the product page, not a live editor session.

**Keep out of the first prototype:** a general asset editor, arbitrary behavior-tree authoring, hardware deployment, and broad motion-planning claims.

**Official linked image:** [Simulation execution poster](https://cdn.prod.website-files.com/65ef6590d3b13c549fc95d9b/6632738c9d8a27d100bc77d1_Validate_sim-poster-00001.jpg). Linked by the product page; not visually inspected in this research.

**Evidence status:** workflow and named elements verified in official text/captions; public workcell photograph inspected; authenticated application not used. Embedded walkthrough media did not play reliably, so no full walkthrough was observed.

## 2. Foxglove — synchronized observability and episode review

**Primary sources:** [Visualization product page](https://foxglove.dev/product/visualization), [3D panel docs](https://docs.foxglove.dev/docs/visualization/panels/3d), [Playback docs](https://docs.foxglove.dev/docs/visualization/playback)

Foxglove documents synchronized panels for 3D scenes, camera data, plots, and messages; layouts can support live data and recorded runs. Its 3D view supports object selection/inspection and view controls. Playback provides a common time axis for examining a run.

**Useful adaptation:** one authoritative clock and event stream; 3D selection synchronized with an inspector; readable action/result events; a bottom episode timeline; a clear Live versus Replay distinction.

**Visually observed:** public embedded-demo frames use dark panel chrome, a large 3D robot view with a grid floor, camera/depth views, joint or torque plots, and a bottom timeline with timestamp and transport controls. This supports a large observation surface with adjacent evidence panels.

**Official demo:** [Foxglove Visualization — a five-minute introduction](https://www.youtube.com/watch?v=jtmoPsVd2vg)

Published chapter guide:

| Time | Described topic |
| --- | --- |
| 00:38 | Opening a recorded MCAP file |
| 01:08 | Inspecting raw messages |
| 01:39 | Transforms and a robot model in 3D |
| 02:32 | LiDAR point clouds |
| 03:11 | Camera data |
| 03:55 | Numeric plots |
| 04:44 | Seeking across synchronized panels |

**Evidence status:** official documentation, video description, and public embedded-demo frames inspected; no signed-in trial or complete video viewing.

**Product positioning note:** Foxglove already describes agents and a robot-data workflow on its public site. TeachTrace should not claim that combining robotics data and an assistant is an untouched market.

## 3. Formant — operator authority and feedback

**Primary sources:** [Build a teleoperation interface](https://docs.formant.io/docs/getting-started-build-a-teleoperation-interface), [Teleoperation introduction](https://docs.formant.io/docs/advanced-teleoperation-introduction)

Formant documents a selected-device/view header, configurable observation and control modules, edit/operate modes, explicit session activation, a control lock, and connection/status feedback. Display modules receive state while controls send commands. Its guide describes swapping a secondary camera into the primary display.

**Useful adaptation:** keep command intent separate from observed robot status; expose session and control states; give Stop a persistent location; label the selected workcell and robot; preserve a large primary observation area with secondary inspectors.

**Keep out of the first prototype:** fake fleet health values, simulated network latency presented as measured connectivity, broad joystick/terminal tooling, or a control-lock feature without real semantics.

**Official linked image:** [Active teleoperation screenshot](https://files.readme.io/14ae256c95c87c546c89891c68411cc1b7c301d1ef612e82090b1bd88d1ff47b-Screenshot_2025-03-13_at_6.06.58_PM.png). Image URL resolved; the web tool did not expose inspectable pixels.

**Evidence status:** controls and layout roles verified from official guide; visual palette and dimensions unverified.

## 4. NVIDIA Isaac Sim — spatial context and scene inspection

**Primary source:** [User Interface Reference](https://docs.isaacsim.omniverse.nvidia.com/6.0.0/gui/reference_user_interface.html)

NVIDIA's reference identifies the viewport, main toolbar with simulation controls, asset/example browsers, Stage hierarchy, and property tools. The opening-page screenshot is annotated by the documentation.

**Useful adaptation:** a scene tree, selected-object properties, world grid/axes, camera controls, and clear play/pause/stop affordances. Keep the environment understandable even before any command is issued.

**Keep out of the first prototype:** Omniverse integration or RTX rendering claims, the complete industrial authoring surface, and device telemetry that the local simulator does not produce.

**Evidence status:** official element descriptions verified. The current prototype is not Isaac Sim merely because it borrows this workspace structure.

## 5. LeRobot — episode-centered data collection

**Primary sources:** [Using dataset tools](https://huggingface.co/docs/lerobot/v0.6.0/en/using_dataset_tools), [Dataset API](https://huggingface.co/docs/lerobot/main/api/datasets), [Human-in-the-loop collection](https://huggingface.co/docs/lerobot/main/hil_data_collection)

LeRobot provides episode-based collection and visualization of camera observations, robot states, and actions. Its data tooling supports episode inspection and explicit dataset writing. Its human-intervention documentation explains collecting corrections during robot rollouts.

**Useful adaptation:** make the episode the review/export unit; show task, duration, state/action coverage, outcome, and review decision. Keep correction events tied to the attempt where they occurred.

**Keep out of the first prototype:** a claim of LeRobot compatibility without a valid exporter and loading check; policy-learning claims without training and evaluation.

**Evidence status:** public tools and data model documented. No dataset was downloaded or model trained as part of this reference research.

## 6. Proposed TeachTrace visual direction

The following are original design recommendations inferred from the workflow, not observations of an individual product's exact styling.

- **Workbench, not marketing page:** dense but readable desktop layout; the robot environment dominates.
- **Restrained dark console:** neutral charcoal panels, clear dividing lines, high-contrast foreground text, one primary action accent. The 3D scene can use lighter floor/table materials to separate the arm and objects.
- **Purposeful color:** object colors help identify scene items; status colors represent execution/review states. Avoid decorating every label with a status dot.
- **Readable typography:** regular UI text around 14–16px or larger, headings around 18–24px, monospace only for IDs, timestamps, coordinates, and technical payloads. Do not shrink task-critical labels to fit more fake telemetry.
- **Visible motion:** good default camera framing, a clear gripper silhouette, object contact/attachment cues, selection outline, and an optional path/target overlay.
- **Stable controls:** microphone/command input stays in a predictable location; Stop remains reachable; camera controls do not move as task rows update.
- **Truthful status:** provider configuration, live simulation, recording, replay, and submission are separate states.
- **Progress with evidence:** queue rows update from engine receipts. A completed check refers to an observed scene condition, not an elapsed animation timer.

## 7. Screen composition

```text
┌────────────────────────────────────────────────────────────────────┐
│ Workspace / Workcell       SIMULATION   execution   recorder   Stop │
├──────────────┬──────────────────────────────────┬──────────────────┤
│ Scene / Task │                                  │ Mission          │
│              │            3D WORKCELL           │ task brief       │
│ Robot        │                                  │ action queue     │
│ Table        │  arm + objects + trays            │ result checks    │
│ Objects      │                                  ├──────────────────┤
│ Trays        │  camera / selection controls      │ Assistant        │
│              │                                  │ transcript       │
│ Episodes     │                                  │ confirmation     │
│              │                                  │ voice / command  │
├──────────────┴──────────────────────────────────┴──────────────────┤
│ Episode timeline       events / review / export                    │
└────────────────────────────────────────────────────────────────────┘
```

The actual implementation may collapse regions on smaller screens. Prioritize observation and command feedback over a large number of panels.

## 8. Interaction reference map

| TeachTrace interaction | Reference influence | TeachTrace requirement |
| --- | --- | --- |
| Object selection and properties | Isaac Sim, Foxglove | Selection is consistent across tree and scene. |
| Readable action queue | Flowstate | Every row corresponds to a supported executable action. |
| Live/replay controls | Foxglove | Replay cannot be confused with new execution. |
| Session and Stop controls | Formant | Control authority and execution status remain explicit. |
| Voice clarification | Original product interaction | Ambiguous references highlight the candidates. |
| Episode review | LeRobot, Foxglove | Actual captured data, outcome, and provenance are inspectable. |
| Approval/export | Original collection workflow | Distinguish downloaded files from successful service submission. |

## 9. Authenticity checklist

- The viewport reflects the same state that tools and completion checks use.
- Controller errors appear with their actual cause.
- Unsupported language receives a useful response.
- Empty episode and connection states are real empty states.
- Object IDs remain stable across command, action receipt, timeline, and export.
- No invented force, confidence, latency, frame rate, CPU, battery, or policy-improvement statistics.
- Any idealized grasp/kinematic execution is identified in product details and exported metadata.
- Actual Agora/Murf connectivity is verified before provider status says connected.
- UI inspiration does not imply those companies endorse or power the prototype.

## 10. Reference shortlist for the user to view

1. [Intrinsic Flowstate walkthrough](https://www.intrinsic.ai/flowstate) — closest overall workcell/process reference.
2. [Foxglove five-minute introduction](https://www.youtube.com/watch?v=jtmoPsVd2vg) — clearest guide to a synchronized robot workspace.
3. [Formant teleoperation interface guide](https://docs.formant.io/docs/getting-started-build-a-teleoperation-interface) — operator control and observation patterns.
4. [Isaac Sim UI reference](https://docs.isaacsim.omniverse.nvidia.com/6.0.0/gui/reference_user_interface.html) — scene hierarchy and spatial inspection.
5. [LeRobot dataset visualization](https://huggingface.co/docs/lerobot/v0.6.0/en/using_dataset_tools) — episode-centered review and data outputs.
