# Agora official setup and source alignment

The user requested the official [Start with AI](https://docs.agora.io/en/introduction/start-with-ai) route. Agora CLI 0.2.10 was installed from the official installer, and the official AgoraIO/skills repository was cloned locally. CLI install, version, PATH, and network checks pass. Browser OAuth sign-in succeeded.

## Existing app inventory

- React 19 / Vite / TypeScript frontend, Node HTTP API backend.
- Existing packages: agora-rtc-sdk-ng and agora-token.
- The voice adapter uses fresh certificate-signed ConvoAI REST tokens by default, plus BYOK Murf Falcon and LLM. Paired account REST credentials remain an optional Basic-auth override. No browser voice round trip is verified yet.
- Preserve this application's simulation UI; use the official Next.js quickstart separately as the voice reference and account baseline.

## Official source inspected

The CLI cloned `AgoraIO-Conversational-AI/agent-quickstart-nextjs` to ignored `.local/agora-baseline` using `agora quickstart create --template nextjs --template-only`. Its README, contributor instructions, invite-agent route, token route, shared agent UID, and client RTC lifecycle were inspected.

| Official source | Existing app destination | Alignment / adaptation |
| --- | --- | --- |
| app/api/invite-agent/route.ts | server/index.mjs and server/config.mjs | Agent start/stop and provider configuration; official sample now uses agora-agents certificate auth and managed providers, the app now mirrors its certificate-signed REST token generation using the existing agora-token dependency and retains BYOK Murf/LLM. Optional paired Basic credentials remain supported. |
| app/api/generate-agora-token/route.ts | server/index.mjs | Keep token generation server-side; consistent channel/UID and bounded lifetime. Sample combined RTC/RTM token is needed if adopting its transcript path. Current app uses RTC audio only. |
| components/ConversationComponent.tsx | src/integrations/voice.ts | Join/publish/subscribe/cleanup; preserve consistent agent UID and avoid duplicate media initialization. |
| lib/agora.ts | server/index.mjs and src/integrations/voice.ts | Shared UID convention. |
| env.local.example | .env.example | Sample names remain unchanged in the reference app. Product env remains server-only and ignored. |

## Runtime evidence

- quickstart_repo_cloned: true
- official_start_command_run: true
- agent_join_verified: false
- rtc_client_connected: false
- integrated_voice_roundtrip_verified: false

Source inspection and compilation are not runtime proof. Verify the reference app with its documented commands, then verify the actual RoboTrace + Murf + tool workflow. No free-minute allowance is claimed as activated until the account confirms it.

The official reference app was launched with its documented `pnpm dev` command at localhost:3000 after the template-aware CLI env write. Agora project doctor passes: account access, RTC, RTM, Conversational AI, App credentials and token capability. This is still not proof of a voice round trip.

Live server-side reference check: `/api/invite-agent` returned HTTP 200 and RUNNING from a real Agora start; `/api/stop-conversation` returned HTTP 200/success. The agent was stopped immediately. No browser RTC connection or audible round trip is claimed.

Product verification: real RoboTrace agent start returned HTTP 201 and stop returned HTTP 200; the configured LLM returned HTTP 200; Murf Falcon returned HTTP 200 with 71,708 bytes of WAV speech. The public callback reached the tool-only service and returned the expected unauthenticated HTTP 401. Configuration reports no missing required settings. Audible browser playback and natural-voice tool execution still need verification.
