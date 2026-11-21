# Set up real Agora + Murf voice

The 3D workcell, typed commands, recording and browser exports work without
provider accounts. Real voice additionally needs the services below, an API
process, and a publicly reachable HTTPS callback. No physical robot is needed.

## 1. Create a local configuration file

From the `teachtrace` directory:

```sh
cp -n .env.example .env.local
```

`cp -n` leaves an existing local configuration in place. Edit `.env.local` in
your editor. It is ignored by Git, as are local episode
records. Do not paste keys into chat, screenshots, the command composer, or
browser settings. Do not use a `VITE_` prefix: that would expose the value in the
browser bundle. The API's status response and startup log report presence only.

## 2. Agora: official Start with AI onboarding

Follow [Agora Start with AI](https://docs.agora.io/en/introduction/start-with-ai)
to install the official CLI for your platform. The development checkout used CLI
0.2.10; use the current official installer for a fresh machine. Then:

```sh
agora login
agora project list
agora project use "YOUR_PROJECT_NAME"
agora project doctor --feature convoai
```

Choose the intended existing project. If you need a new standalone reference,
`agora init my-voice-reference --template nextjs` is the official onboarding flow;
it can reuse a project or guide project creation. Keep that app separate from
TeachTrace. For a reference app explicitly bound to your existing project:

```sh
agora quickstart create agora-reference --template nextjs --dir .local/agora-reference --project "YOUR_PROJECT_NAME"
agora quickstart env write .local/agora-reference --project "YOUR_PROJECT_NAME"
```

`quickstart env write` selects the reference template's expected environment file.
It does not configure TeachTrace's Murf or LLM provider keys. For this custom
React/Node app, write the project credentials using the standard server-only names:

```sh
agora project env write .env.local --template standard --project "YOUR_PROJECT_NAME"
```

Read the CLI prompt before changing an existing file; do not use `--overwrite`,
which replaces the file with only the two Agora values. Add the remaining fields
from `.env.example` in your editor if needed. Do not run env-print commands,
`cat .env.local`, or include credential values in terminal arguments or screenshots.
The reference app's `NEXT_PUBLIC_*` naming is specific to its template; TeachTrace's
provider settings stay server-only.

### Console alternative: App ID and App Certificate

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

## 3. Agora REST authentication: no extra key required by default

The server signs a short-lived Agora REST token with `AGORA_APP_ID` and
`AGORA_APP_CERTIFICATE`. It separately signs RTC tokens for channel access.
You do not need an account REST key for this default route.

If your deployment deliberately uses Basic authentication instead, create a
RESTful API key through the Agora Console account menu and set **both**
`AGORA_CUSTOMER_ID` and `AGORA_CUSTOMER_SECRET`. The server selects this optional
override only when both are present. Keep the pair empty for certificate auth;
a partially filled pair does not activate Basic auth.

## 4. Murf Falcon

Sign in to the [Murf API dashboard](https://murf.ai/api/dashboard), generate a
key, and save it as `MURF_API_KEY`. Check that the account has Falcon streaming
access and available usage. Follow the [key guide](https://help.murf.ai/generating-api-key)
and [Agora's Murf configuration](https://docs.agora.io/en/ai/models/tts/murf).
The default `MURF_VOICE_ID=en-US-matthew` matches the voice ID returned by the
Murf voices API during onboarding; the provider also accepted alias `Matthew`.
Use the canonical ID in new configurations. Provider access and billing remain
account-specific.

## 5. LLM API key

The current adapter uses OpenAI-compatible Chat Completions with `gpt-4o-mini`.
For the default provider, create a project key at
[OpenAI API keys](https://platform.openai.com/api-keys), save it as `LLM_API_KEY`,
and confirm model access and usage limits. See the
[official API quickstart](https://developers.openai.com/api/docs/quickstart).
OpenAI is the current implementation choice, not a track requirement. The key
stays on the server. No separate Deepgram key is required for the current
Agora-managed speech-recognition configuration, subject to project access.

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
| Voice says setup required | API is running; all five required fields are filled; API restarted |
| Agora rejects start | Correct App ID/certificate pair; optional Basic pair only if selected; enabled Conversational AI; provider/model access |
| Voice connects but tools fail | Public HTTPS tunnel reaches 8788; URL matches environment; browser's command bridge remains open |
| Agent voice absent | Mic permission, browser audio playback policy, account's Murf Falcon voice/key availability |
| Motion outcome unconfirmed | Inspect the workcell; an accepted/timed-out command can still be running; stop before retrying |
| No server episode storage on hosted preview | Static UI hosting does not deploy the local Node API; use browser export or deploy a separate backend |

## Verification status

On the development checkout, official CLI installation and OAuth login completed,
Agora project doctor passed, and the real TeachTrace API agent start returned
HTTP 201 followed by HTTP 200 on stop. The latest reported automated run passed
65 tests. These are point-in-time results, not guarantees for a fresh account.

Browser RTC microphone publishing, audible Murf playback, and the full spoken
request → approved action → spoken result flow are still unverified. Check all
three before presenting live voice as complete. Provider start acceptance alone
does not prove that any participant heard audio.
