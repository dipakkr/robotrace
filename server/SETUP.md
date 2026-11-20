# Set up real Agora + Murf voice

The 3D workcell, typed commands, recording and browser exports work without
provider accounts. Real voice additionally needs the services below, an API
process, and a publicly reachable HTTPS callback. No physical robot is needed.

## 1. Create a local configuration file

From the `teachtrace` directory:

```sh
cp .env.example .env.local
```

Edit `.env.local` in your editor. It is ignored by Git, as are local episode
records. Do not paste keys into chat, screenshots, the command composer, or
browser settings. Do not use a `VITE_` prefix: that would expose the value in the
browser bundle. The API's status response and startup log report presence only.

## 2. Agora project: App ID and App Certificate

Open [Agora Console](https://console.agora.io/). New users can follow the
[official account guide](https://docs.agora.io/en/introduction/account).

1. Create/select a project using the Projects dropdown. Use token authentication.
2. On the project Home page, open **Manage credentials**.
3. Copy **App ID** to `AGORA_APP_ID`.
4. Copy **Primary certificate** to `AGORA_APP_CERTIFICATE`.
5. Open **RTC Services** and confirm **Conversational AI Engine** is enabled.
   New projects may have it enabled already. Confirm that the project also has
   access to the managed ASR used in this adapter.

The App ID identifies the project. The certificate signs short-lived RTC tokens
on the server. An internal Project ID or manually generated temporary token does
not replace either value in this adapter. See the
[Console credentials and service controls](https://docs.agora.io/en/introduction/console-setup).

## 3. Agora REST credentials: Customer ID and Customer Secret

The current server uses Basic authentication for the Main Conversational AI REST
API, plus separate RTC tokens for channel access.

1. In Agora Console, open the account menu from your username at the bottom of
   the sidebar and choose **RESTful API Keys**.
2. Choose **Create API Key** and save the downloaded credential securely.
3. The download's **Key** is `AGORA_CUSTOMER_ID`; its **Secret** is
   `AGORA_CUSTOMER_SECRET`.

Some Console versions show this under **Developer Toolkit → RESTful API**.
These account-level credentials are different from the App ID and certificate.
The server constructs the Basic authorization header; do not manually encode or
log it. See [Agora REST authentication](https://docs.agora.io/en/api-reference/api-ref/conversational-ai/platform/authentication)
and the [Main start/stop API](https://docs.agora.io/en/ai/build/start-stop-agent).

## 4. Murf API key with Falcon streaming access

Open the [Murf API dashboard](https://murf.ai/api/dashboard), sign in/create an API
account, and generate an API key. Save it when shown; Murf says it cannot be
retrieved later. Put it in `MURF_API_KEY`.

Follow [Murf's key-generation guide](https://help.murf.ai/generating-api-key) and
[API getting-started guide](https://help.murf.ai/getting-started-with-murf-api).
Use the API account/dashboard, rather than assuming a Studio voiceover
subscription supplies API access.

The adapter requests Murf's **FALCON** streaming model and defaults to the
`Matthew` voice. Set `MURF_VOICE_ID` if your account uses a different supported
voice. [Agora's Murf integration](https://docs.agora.io/en/ai/models/tts/murf)
documents the exact vendor configuration. Provider access and credits must be
checked in your own account; no live key has been tested in this project yet.

## 5. LLM key

The adapter defaults to the OpenAI Chat Completions endpoint and the
`gpt-4o-mini` model used in Agora's Main API examples. Create a project API key
using the [official OpenAI quickstart](https://developers.openai.com/api/docs/quickstart),
which links to the [API key dashboard](https://platform.openai.com/api-keys).
Store that value in this project's `LLM_API_KEY` variable. Check access to the
configured model in the API account. `LLM_MODEL` can be changed for another
function-calling model supported by the integration; do not substitute a
speech-to-speech model that bypasses the mandatory Murf voice output.

API account access is separate from this project's local simulator. The key is
used server-side in the agent configuration and is never returned to the browser.

## 6. Make only the tool callback publicly reachable

Start the local API:

```sh
npm run server
```

It starts two loopback listeners:

| Port | Use |
| --- | --- |
| `8787` | Local UI API: configuration status, episode storage, session lifecycle |
| `8788` | Tool callbacks only; all other paths return 404 |

Use your chosen HTTPS tunnel provider to forward the **tool-only port 8788**.
For example, if ngrok is already installed and configured, its HTTP tunnel
command can target that port. Follow your tunnel provider's official setup;
this repository does not install, authenticate, or create a tunnel for you.

Set `PUBLIC_API_BASE_URL` to the tunnel's HTTPS origin, for example
`https://your-assigned-host.example`. Do not append `/api` or an endpoint path.
Restart `npm run server` after changing `.env.local`.

Agora's cloud cannot call `localhost`, a private LAN address, or a URL protected
by an interactive sign-in page. The per-session tool endpoints receive random
bearer credentials, separate from all provider keys. Do not forward port 8787
publicly: that listener is the single-user development API.

## 7. Start the frontend and connect

```sh
npm run dev
```

Open the printed localhost URL on the laptop. The browser needs microphone
permission. The Vite server proxies `/api` to port 8787; keep that backend running.
If the frontend uses a different origin or port, update `FRONTEND_ORIGIN` to match
and restart the backend. A phone needs HTTPS for microphone access; the laptop's
localhost exception does not apply to plain HTTP on a LAN IP.

Check configuration without printing secrets:

```sh
curl http://127.0.0.1:8787/api/integrations/status
```

`configured: true` means fields are present and the callback URL has the expected
shape. It does **not** prove credentials, account access, public routing, or live
provider operation. A successful connected session and an acknowledged simulator
action are the actual end-to-end verification.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Voice says setup required | API is running; all seven required fields are filled; API restarted |
| Agora rejects start | Correct App ID/certificate pair; REST credentials; enabled Conversational AI; provider/model access |
| Voice connects but tools fail | Public HTTPS tunnel reaches 8788; URL matches environment; browser's command bridge remains open |
| Agent voice absent | Mic permission, browser audio playback policy, account's Murf Falcon voice/key availability |
| Motion outcome unconfirmed | Inspect the workcell; an accepted/timed-out command can still be running; stop before retrying |
| No server episode storage on hosted preview | Static UI hosting does not deploy the local Node API; use browser export or deploy a separate backend |

The prototype is not yet verified with live provider credentials. Do not show an
unconfigured interface as a completed Agora/Murf integration in the hackathon.
