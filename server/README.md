# Local integration service

The workcell runs without provider keys. This optional server adds durable local
episode records and the real Agora Conversational AI + Murf Falcon voice adapter.
No live provider session has been tested without user credentials.

## Run

1. Install the project dependencies, including `agora-token` and
   `agora-rtc-sdk-ng`.
2. Copy `.env.example` to `.env.local` and configure credentials on the server.
3. Start `node --env-file-if-exists=.env.local server/index.mjs`.
4. Proxy `/api` from Vite to `http://127.0.0.1:8787`.
5. For live tool calls, provide `PUBLIC_API_BASE_URL`: a public HTTPS tunnel to
   the **tool-only listener on port 8788**, or a separately deployed equivalent.
   Agora's servers cannot reach `localhost`. Both listeners bind to loopback;
   the public tunnel forwards only 8788, keeping session creation and datasets local.

Never put provider secrets in `VITE_` variables, browser storage, or frontend
settings. The browser receives only a public Agora App ID and a short-lived RTC
client token. The tool callback uses a separate random per-session secret.

## UI contract

```ts
import { getIntegrationStatus, startVoiceSession, stopVoiceSession } from './src/integrations/voice';

const status = await getIntegrationStatus();
// Show disconnected/configuration-required when status.configured is false.

await startVoiceSession(async command => {
  // Reuse the same validated dispatcher as the typed command composer.
  // WAIT for the actual simulator operation to end. Do not return success when
  // merely accepting a queued command.
  const outcome = await executeAndWait(command);
  return { completed: outcome.success, summary: outcome.message, world: getWorld() };
}, {
  getWorld,
  onStatus: (state, message) => updateVoiceStatus(state, message),
});
```

The provider callback stays open until the browser reports an outcome (40-second
limit). A timeout is reported as unconfirmed, not completed; it does not guarantee
that a previously submitted simulator action has stopped. The collector must
inspect state or press Stop before retrying. Commands are deduplicated by tool
call ID within each session. Dataset approval remains an explicit UI action.

## Endpoints

| Route | Purpose |
| --- | --- |
| `GET /api/integrations/status` | Configuration presence; never credential values |
| `GET /api/task-guide` | Approved collection brief and acceptance rules |
| `POST /api/episodes` | Persist an episode JSON object under `.local/episodes/` |
| `GET /api/episodes` | List up to 100 saved episode summaries |
| `POST /api/voice/start` | Create a real Agora conversational agent and RTC credentials |
| `POST /api/voice/stop` | Stop the provider agent and close the local bridge |
| `GET /api/voice/events?sessionId=...` | Browser command stream (SSE) |
| `POST /api/voice/context` | Refresh server's view of simulator state |
| `POST /api/voice/ack` | Report actual command outcome |
| `POST /api/voice/tools/:sessionId/context` | Authenticated provider context tool |
| `POST /api/voice/tools/:sessionId/command` | Authenticated provider action tool |

The service is a single-user development adapter, not a multi-tenant production
backend. Private static hosting of the UI does not also deploy this Node service.
The host/tunnel and API process must remain running for live voice.

## Official references

- [Start / stop an Agora agent](https://docs.agora.io/en/ai/build/start-stop-agent)
- [Murf Falcon configuration](https://docs.agora.io/en/ai/models/tts/murf)
- [Custom synchronous HTTPS tools](https://docs.agora.io/en/ai/build/tools/custom-tools)
- [Official RTC token builder](https://github.com/AgoraIO/Tools/blob/master/DynamicKey/AgoraDynamicKey/nodejs/src/RtcTokenBuilder2.js)

The implementation uses the Main REST `/v2/projects/{appId}/join` API, not the
separate preview platform's persistent-agent/session API. ASR uses Agora-managed
Deepgram (requires the project's managed capability); the LLM and Murf use supplied
provider keys. Check current account and regional availability before the demo.

### Main REST payload review

The configuration was checked against the official **Main** API documentation
(rather than the separate Platform Preview schema):

| Configuration | Main contract used here |
| --- | --- |
| Murf | `tts.credential_mode: "byok"`; provider `api_key`, `base_url`, `voiceId`, `model`, and `sample_rate` inside `tts.params` |
| Managed ASR | `asr.credential_mode: "managed"`; `vendor: "deepgram"`; endpoint/model/language inside `asr.params` |
| LLM | `llm.credential_mode: "byok"`; `api_key` and `url` directly inside `llm`; model inside `llm.params` |
| Tools | `function`, `execution`, and `server` are sibling fields; execution is synchronous; full-value `{{args.command}}` and `{{tool_call_id}}` body substitutions |

See the [Main join API reference](https://docs.agora.io/en/api-reference/api-ref/conversational-ai/join),
[Main Murf vendor page](https://docs.agora.io/en/ai/models/tts/murf), and
[Main custom-tools guide](https://docs.agora.io/en/ai/build/tools/custom-tools).
Documentation review and mocked tests establish the request's intended contract;
only a real account test can establish provider availability and live operation.
