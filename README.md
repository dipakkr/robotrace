# TeachTrace · Workcell Studio

A laptop-first robotics demonstration workbench: describe a bounded task, inspect
the plan, approve it, watch an articulated arm execute it, and review the recorded
simulator episode. No physical robot is required.

The interface is informed by Intrinsic Flowstate's workcell/skill workflow,
Foxglove's synchronized recordings, and Formant's operator controls. It uses its
own branding and implementation. See [design references](docs/DESIGN_REFERENCES.md)
and the [detailed product plan](docs/PRODUCT_PLAN.md).

## Run locally

```sh
npm install
npm run server
```

In a second terminal:

```sh
npm run dev
```

Open **http://127.0.0.1:5189**. Port 5189 avoids an unrelated local application
already using port 5173. The API listens on loopback port 8787; Vite proxies
`/api`. Port 8788 accepts authenticated cloud-agent tool callbacks only.

## Try the full local workflow

1. Click **Sort all parts**, then **Approve & run**.
2. Watch the arm approach, grasp, lift, transfer, release, and verify each part.
3. Pause and resume while the task is running. Stop cancels the queue and holds
   the current pose; reset is required before a new collection after stopping.
4. After completion, replay the episode or scrub its timeline.
5. Review and approve the episode. With the local API running, this saves a
   JSON record under ignored `.local/episodes/`; otherwise approval stays in this
   browser. JSON export is available in either mode.
6. Reset the scene, select a part, and change its starting position. Commands
   resolve against the current positions rather than a pre-recorded animation.

Supported local commands include:

```text
Sort all parts
Move red and blue to tray A
Move green to review
Return red to table
Pause
Resume
Stop
Reset
```

The local command interpreter is deliberately bounded. Unknown objects and
ambiguous destinations cause clarification rather than invented actions. Live
LLM interpretation becomes available through the optional voice integration.

## Real Agora + Murf voice

Follow [the credential setup guide](server/SETUP.md). The ignored `.env.local`
file needs Agora project credentials, Agora REST credentials, a Murf Falcon key,
an LLM key, and a public HTTPS callback origin. Keep provider secrets out of the
browser and never use `VITE_` variables for them.

The integration adapter is implemented and tested against mocked provider
requests. **A real Agora/Murf session has not yet been verified.** Configuration
presence does not prove account access or successful provider connectivity.

The UI distinguishes local commands, an RTC connection waiting for agent audio,
and a live agent audio connection. Voice commands prepare a plan. Explicit
operator approval executes it. A tool result reports completion only after the
simulator verifies the requested placements.

## What is simulated

- An articulated arm with analytic inverse kinematics and a downward gripper.
- Deterministic, high-clearance pick-and-place movements.
- Idealized object attachment/release, reach checks, and destination occupancy.
- Simulator-grounded object positions, action events, and outcome checks.

This version has **no contact dynamics, friction-based grasping, complete
swept-link/self-collision checking, learned robot policy, or demonstrated
sim-to-real transfer**. Its exports are kinematic demonstration records,
explicitly tagged with these boundaries, rather than validated real-robot data.

## Checks

```sh
npm test
npm run build
```

Tests cover task outcomes, sorting, occupied placements, command ambiguity,
pause/stop, unreachable targets, idempotent action completion, inverse kinematics,
missing voice credentials, provider payloads, authenticated command receipts,
and local episode persistence.

## Source layout

| Path | Responsibility |
| --- | --- |
| `src/App.tsx` | Command center, approvals, execution queue, recorder, replay |
| `src/sim/engine.ts` | Authoritative world state, grounded plans, motion controller |
| `src/components/RobotScene.tsx` | 3D rendering and camera controls |
| `src/integrations/voice.ts` | Agora RTC client and voice-command bridge |
| `server/config.mjs` | Server-only provider config and task knowledge |
| `server/index.mjs` | Session lifecycle, tool callbacks, episode storage |
| `docs/` | Product plan, architecture, design research, demo and validation gates |

## Hosted UI

The private hosted build is a static simulator/console. It supports browser-local
recordings and JSON export. It does not deploy the local Node API or automatically
connect to the laptop's voice service. Use the local version for provider setup
and end-to-end voice testing. Deploying the voice backend is a separate stage.
