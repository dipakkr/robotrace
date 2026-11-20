# Validation status

Updated 21 November 2026, India time.

## Verified

- Production TypeScript/Vite build completes.
- 25 simulation/authoring tests and 6 server tests pass.
- The actual deterministic controller completes the baseline and rearranged
  scenarios, and refuses the reach-limit and occupied-tray scenarios for the
  specified reasons. Expected refusals count as passing checks, not completed
  robot tasks.
- Authored scenes use supported types, unique IDs, finite coordinates,
  nonoverlapping initial blocks, explicit counts, and bounded object totals.
- The initial desktop UI was exercised in Chrome: approve a sorting plan,
  observe all three placements, pause/resume, record the run, open replay, approve
  the episode, and persist it through the local API.
- That browser run produced 3 verified actions and 134 recorded samples. The
  server returned a stored episode record; its file is under ignored local state.
- A desktop execution screenshot is saved in `screenshots/workcell-preview.jpg`.
- The private static UI was published successfully. The local preview and API
  were restarted as detached processes and checked by HTTP after an interrupted
  tool session.

## Not yet verified

- Live Agora/Murf credentials, account activation, microphone capture, agent audio,
  and cloud-to-local callback routing. Provider calls in automated tests are
  mocked. Presence checks never claim a verified live session.
- Audible progress narration. Its documented API path is implemented and mocked
  tests verify request fields, throttling, and acknowledgment semantics. APPEND
  can delay narration during a pending tool turn.
- Browser interaction with the newer environment-composer and test-suite panels:
  browser-control tools became unavailable after the original desktop workflow
  verification. Their underlying logic is tested and the complete app builds.
- Phone-sized layout and mobile microphone access. Responsive styles are present;
  physical-device and breakpoint visual QA remain separate checks.
- Contact dynamics, frictional grasps, full swept-link collision checking,
  learned-policy evaluation, or real-robot transfer.
- Production multi-user operations: tenant isolation, roles, shared durable cloud
  records, operational monitoring, and performance/load acceptance.

## Scope of the result

This is a working bounded simulation/workflow prototype. It is not yet the full
hackathon deliverable until real Agora + Murf interaction completes the workflow,
and it is not a production robot-validation platform. See PRODUCT_PLAN.md for
separate software and robotics readiness gates.
