# Account and configuration checklist

Setup status updated on **21 November 2026**. Start with Agora, then Murf.
This checklist remains reusable for a fresh checkout; checked development
milestones below do not transfer credentials or entitlements to another machine.
User actions below include sign-in, accepting account terms, creating credentials,
and any billing decision. After the values are stored locally, the implementation
work can continue without exposing them in chat.

## Current development evidence

- [x] Official Agora CLI 0.2.10 installed; browser OAuth login completed.
- [x] Agora project doctor passes for the configured project.
- [x] RoboTrace's certificate-authenticated real agent start returned HTTP 201;
  the agent was stopped successfully with HTTP 200.
- [x] Latest reported automated test run: 65 passing tests.
- [ ] Browser RTC microphone publishing verified in a real session.
- [ ] Audible Murf agent response and end-to-end voice/tool workflow verified.

These milestones verify local setup and server-side REST access. They do not
prove audio playback or a complete workplace voice demonstration.

## 1. Agora — required

- [ ] **User:** Follow [Start with AI](https://docs.agora.io/en/introduction/start-with-ai)
  to install the official CLI; run `agora login` and complete browser sign-in.
  [Agora Console](https://console.agora.io/) remains the account-management UI.
- [ ] Run `agora project list`, then `agora project use "YOUR_PROJECT_NAME"`.
  Run `agora project doctor --feature convoai` for the selected project.
- [ ] For a separate official reference, use `agora init my-voice-reference --template nextjs`.
  For an already cloned reference, use `agora quickstart env write PATH_TO_REFERENCE --project "YOUR_PROJECT_NAME"`;
  the CLI selects its template-specific env path. Keep reference code separate
  from RoboTrace. See [the exact reference commands](../server/SETUP.md).
- [ ] Create/select a dedicated RoboTrace project.
- [ ] On project Home, open **Manage credentials**. Save the **App ID** as
  `AGORA_APP_ID` and **Primary certificate** as `AGORA_APP_CERTIFICATE`.
- [ ] Under **RTC Services → Intelligence**, enable **Conversational AI Engine**.
  Confirm access to the managed speech-recognition service used by the adapter.
- [ ] Write project credentials to this custom app using
  `agora project env write .env.local --template standard --project "YOUR_PROJECT_NAME"`.
  Do not use `--overwrite` on a populated file. Review prompts and retain the
  Murf, LLM, and callback values. Never print the resulting file.
- [ ] **Optional only:** If choosing the Basic-auth override, create RESTful API
  credentials in the Console account menu and set both `AGORA_CUSTOMER_ID` and
  `AGORA_CUSTOMER_SECRET`. Leave both empty to use the default certificate-token
  route. The internal Project ID is not the App ID.
- [ ] Check project access, available usage/credits, and any event-provided
  entitlement before agreeing to paid service.

These console locations and credential meanings are documented in
[Agora Console overview](https://docs.agora.io/en/introduction/console-setup).
The current server uses a short-lived certificate-signed token for REST by default
and separate RTC channel tokens; an optional Customer ID/Secret pair enables Basic auth;
see [Main authentication](https://docs.agora.io/en/api-reference/api-ref/conversational-ai/authentication).

## 2. Murf Falcon — required by the track

- [ ] **User:** Sign in to the [Murf API dashboard](https://murf.ai/api/dashboard).
- [ ] Generate an API key and store it as `MURF_API_KEY`. Save it securely when
  shown; Murf says it cannot be retrieved later.
- [ ] Confirm the account can use **Falcon streaming**, with available usage.
  API access is the relevant product; verify access rather than assuming a
  voiceover-Studio subscription supplies it.
- [ ] Keep the documented initial configuration: `FALCON`, voice ID `en-US-matthew`,
  `en-US`, 24,000 Hz, streaming WebSocket endpoint
  `wss://global.api.murf.ai/v1/speech/stream-input`.

Sources: [Murf key guide](https://help.murf.ai/generating-api-key),
[Agora's Main Murf configuration](https://docs.agora.io/en/ai/models/tts/murf).
Trial eligibility, credits, and any upgrade must be checked in the actual account;
this checklist promises no free allocation or price.

## 3. LLM — current implementation uses a separate key

- [ ] **User:** Open [OpenAI API keys](https://platform.openai.com/api-keys),
  select/create the intended project, and create a project key.
- [ ] Save it as `LLM_API_KEY`; verify model access and usage/billing limits.
  The existing adapter targets OpenAI Chat Completions and `gpt-4o-mini`.

Follow the [official API quickstart](https://developers.openai.com/api/docs/quickstart).
OpenAI is our current provider choice, not a track requirement. Agora also
documents [managed LLM access](https://docs.agora.io/en/ai/build/managed-mode),
which could remove the separate LLM-key requirement after a code change and live
test. Keep Murf Falcon for spoken output either way. No separate Deepgram key is
needed for the current Agora-managed ASR path, subject to account access.

## 4. Local configuration and HTTPS tools

- [ ] Edit the ignored `teachtrace/.env.local`; the template already exists.
  Never paste keys into chat or use `VITE_` names for server secrets.
- [ ] Ensure these five required fields are set: `AGORA_APP_ID`,
  `AGORA_APP_CERTIFICATE`, `MURF_API_KEY`, `LLM_API_KEY`, `PUBLIC_API_BASE_URL`.
  The two `AGORA_CUSTOMER_*` fields are optional and must be paired for Basic auth.
- [ ] Use `MURF_VOICE_ID=en-US-matthew`, as returned by the Murf voices API during
  onboarding. Alias `Matthew` was also accepted; prefer the canonical ID.
- [ ] Start/restart `npm run server` after editing configuration.
- [ ] Expose **only tool port 8788** using the selected HTTPS tunnel. With a
  configured ngrok account/agent, `ngrok http 8788` starts that tunnel; follow
  [ngrok's setup](https://ngrok.com/docs/start) for installation and authentication.
- [ ] Put the returned HTTPS origin, without an `/api` suffix, in
  `PUBLIC_API_BASE_URL`; restart the server. Keep local management/data port
  **8787** off the public tunnel.
- [ ] Use the local UI at `http://127.0.0.1:5189/` for initial verification.
  The private static hosted UI does not deploy this local Node backend.

## 5. Configuration is complete only after a live test

- [ ] Run `npm run doctor -- --health`. It reports field presence, local format
  checks, and loopback UI/API health without displaying values or calling paid
  provider APIs. Add `--check` for a nonzero exit when required setup is missing.
- [ ] Presence check: `curl http://127.0.0.1:8787/api/integrations/status` reports
  `configured: true` without printing keys. This alone is not a connectivity test.
- [ ] Connect voice and allow the local site's microphone when requested.
- [ ] Hear actual agent audio using Murf Falcon; speak a task and retrieve context.
- [ ] Approve a plan; verify motion and the returned placement result.
- [ ] Check a failure/clarification, progress narration, and session shutdown.
- [ ] Approve/save the episode and verify the API's persisted record.

No Hugging Face, GPU-cloud, database, object-storage, or robot-hardware account is
needed for this first voice workflow. Dataset publication and scalable cloud
operations can add deliberately scoped services later. See [the detailed setup
guide](../server/SETUP.md) for troubleshooting and [validation status](VALIDATION.md).
