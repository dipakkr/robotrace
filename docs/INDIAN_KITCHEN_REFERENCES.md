# Indian kitchen references and photo-to-simulation scope

Checked 2026-11-21 against creator, institution, research-project and official documentation pages. These are research leads, not assets already imported into RoboTrace. No new dataset or model has been downloaded or integrated through this research.

## Practical recommendation

Use an operator-owned kitchen photograph to author an explicitly approximate, editable test environment. A dataset is not necessary for that workflow. Keep the photograph, proposed map, operator corrections and simulation assumptions separate. Demonstrate that tasks run and obstacle interventions change actual outcomes on the resulting map.

Do not describe a single uploaded image as a calibrated digital twin. A perspective image leaves hidden surfaces, metric scale, support heights and object mechanisms underdetermined. This is a geometric limitation, not something a convincing render resolves. Shelves require actual support heights and arm reach; cabinet doors require articulated geometry and collision handling. These capabilities are not established by recognising a cabinet in an image.

## Indian or India-labelled sources

### 1. Closest public structural image lead: indian-kitchen-zones

The creator-published [Roboflow project](https://universe.roboflow.com/dipangshus-workspace/indian-kitchen-zones) lists **118 images**, **CC BY 4.0**, and 11 detection labels: refrigerator, sink, window, wall, chimney, backsplash, cabinet_lower, cabinet_upper, countertop, flooring and stove_hob. These are useful structural categories for reviewing kitchen photographs. There is no shelf-interior label or 3D geometry.

The page has no published collection description. Its name alone does **not** establish capture locations, representativeness of Indian homes, original image rights or a documented consent process. The published model reports mAP@50 27.1%, precision 28.6% and recall 23.7%; do not make it the trusted source of collision geometry. Treat it as a small community annotation/reference lead and retain attribution if used. Publisher licensing is a starting point, not independent verification of every source image.

### 2. Indian human activity: World Archive sample

The publisher's [World Archive Mono — India Workplace Egocentric Manipulation card](https://huggingface.co/WorldArchive/mono-india-workplace-sample/blob/main/README.md) describes nine clips, approximately 48 minutes, and 218 action segments, including commercial catering among several workplace domains. It lists action segments, hand keypoints, object boxes, contact and QA/consent metadata, and names India as the capture geography. The public sample is **CC BY-NC 4.0**. Consent documentation for capture is not a substitute for the public sample's noncommercial license.

This is relevant to human-demonstration research and task vocabulary. It is **not** a dataset of reconstructable kitchen floor plans, shelves with measured dimensions, calibrated robot actions or interactive kitchen fixtures. A LeRobot-labelled mirror does not by itself prove that a robot can execute the human actions. Do not call our simulator an integrated consumer of this data until a concrete import is implemented and checked.

### 3. Indian commercial capture lead: Arctic Engines

[Arctic Engines' own mono dataset page](https://www.arcticengines.ai/datasets/egocentric-mono) describes head-mounted recordings from Indian factories and service businesses, with action segments, solved camera pose and sparse reconstruction. Its listed processes include kitchen operations and kitchen-counter cleaning. The page offers a request-samples route; this review did not establish an openly downloadable, openly licensed kitchen-scene pack. These are publisher claims and a possible future partner lead, not verified simulator assets or a dependency for the hackathon.

**Conclusion on geography:** this search found useful Indian activity sources and a small India-labelled kitchen-image source. It did not verify an open, calibrated, simulation-ready 3D benchmark of Indian household kitchen structures. That is a statement about this research, not proof that none exists.

## Stronger international alternatives

| Resource | Verified scope and relevance | Access/license and compatibility boundary |
|---|---|---|
| [RoboCasa365](https://robocasa.ai/) | The project reports 365 tasks and 2,500+ kitchen scenes, with interactable cabinets, sinks and appliances; supports mobile manipulators. Strong reference for a real kitchen robotics roadmap. | No India-specific coverage established here. Not a drop-in Three.js asset pack; inspect repository and individual asset terms before importing. |
| [Habitat-Matterport 3D](https://aihabitat.org/datasets/hm3d/) | 1,000 scanned building-scale indoor spaces for embodied AI. Useful for navigation geometry and scanned-room benchmarks. | Official page states academic, noncommercial research access. A room scan does not automatically provide movable dishes, functional shelves or validated grasp behavior. No Indian coverage established. |
| [Apple ARKitScenes](https://github.com/apple-aiml-research/ARKitScenes) | 5,047 captures of 1,661 scenes; RGB-D, camera poses, reconstructed surfaces and annotated furniture boxes. [Data documentation](https://github.com/apple-aiml-research/ARKitScenes/blob/main/DATA.md) specifies mesh, depth, intrinsics and trajectories. | [Its own license](https://github.com/apple-aiml-research/ARKitScenes/blob/main/LICENSE) has Apple-specific terms, including conditional commercial permission; do not relabel it CC0 or unrestricted. No India-specific coverage established. A downstream importer must produce checked collision/support geometry. |
| [ProcTHOR](https://procthor.allenai.org/) | Procedurally generated, customizable interactive houses, including kitchens. Good reference for systematically varied test layouts. | Belongs to the AI2-THOR ecosystem. Check generation code, house data and asset licenses separately; open-source code does not establish identical rights for every asset. No Indian coverage established. |
| [BEHAVIOR](https://behavior.stanford.edu/) | 1,000 household activities instantiated in 50 interactive scenes; a reference for long-horizon household evaluation. | [Official component documentation](https://github.com/StanfordVL/BEHAVIOR-1K/blob/main/docs/getting_started/important_concepts.md) explains OmniGibson's Isaac Sim dependency and encrypted third-party licensed dataset assets. This is a future simulator migration, not a laptop/browser feature to add during the demo. |

These resources answer different questions. Photographs support recognition/reference; scans support measured visible geometry; simulation-ready interactive assets support actions and state changes. None should be substituted silently for another.

## What is implemented in the current repository

`src/components/AiSceneComposer.tsx` already accepts an image or a manually selected video frame, resizes it, computes reference provenance, and submits it to `/api/scenes/draft`. The existing scene-draft prompt in `server/planner-models.mjs` explicitly limits the image to supported rigid tabletop assets and approximate colours. The application assigns validated tabletop slots.

This is **photo-referenced tabletop scene authoring**, with uncalibrated scale and no video-motion or 3D reconstruction. It does not reconstruct a room or generate the mobile kitchen from a photograph. **Mobile photo-to-environment import is not currently implemented.**

The working mobile sandbox has a known symbolic map and idealized handling. It supports successive Cup/Bowl tasks, movable person and floor-block scenarios, geometric rerouting, task checks and native recordings. Adding a photograph does not upgrade its physics, perception or real-robot transfer fidelity.

## Bounded next implementation

For a roughly 30-minute extension, prefer a reference-photo workflow with a few validated kitchen layout presets. The model can suggest a preset and visible labels; the operator can choose or correct it. Show the reference beside the proposed map and explicitly label inferred dimensions and unsupported surfaces. Reuse existing image upload/fingerprint handling. Keep robot action semantics unchanged.

A more useful follow-on is an editable top-down map: room dimensions, Counter/Sink/Table rectangles, docking points, support heights and object locations. Require known scale or measured dimensions; reject overlapping furniture/base placements, unreachable docks and unsupported handling surfaces. Apply a validated world, then rerun the same task/obstacle checks. Arbitrary geometry editing, calibration and reliable image-driven layout extraction require more implementation and verification than the small preset extension.

Concrete tasks:

1. Add a mobile reference upload and preview, without claiming reconstruction.
2. Record submitted-image hash and whether dimensions are measured, supplied or inferred.
3. Define a bounded mobile layout draft schema with existing supported stations and assets.
4. Suggest a validated preset; expose corrections instead of silently treating estimates as ground truth.
5. Validate every proposed obstacle, docking point, support height and object source.
6. Show unsupported shelves, occluded regions and uncertain geometry explicitly.
7. Test a known successful route, a detour and an unreachable destination on the authored map.
8. Preserve layout provenance in exports and prevent edited layouts being presented as identical matched comparisons.

## Future measured capture route

[Apple RoomPlan](https://developer.apple.com/augmented-reality/roomplan/) combines camera and LiDAR on compatible iPhone/iPad devices to produce a dimensioned parametric room representation, including walls and furniture such as cabinets, exported as USD/USDZ. This is a defensible future source of measured room geometry. It requires compatible hardware and a native capture/import path; it is not available simply because a user has any mobile phone.

Even a RoomPlan capture needs review and downstream collision meshes, support surfaces, articulated mechanisms, object identities, robot calibration and task definitions. A rendered room, a navigable map and a validated physical robot environment remain separate deliverables.

Recommended demo claim: **“Turn a kitchen reference into an editable robot test environment, then test instructions and interruptions before hardware trials.”** Do not claim automatic photo-to-physics conversion or validated policy-training data.
