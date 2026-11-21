# Voice transcript transport

## Simulation audio controls and quiet validation

The adapter exports `setVoiceSessionPaused(paused)`. Pause leaves RTC joined, awaits the Agora microphone track's `setMuted(true)`, and sets existing and newly subscribed remote playback tracks to volume zero. Resume unmutes the microphone and restores remote playback volume to 100. The microphone may remain locally captured by the SDK while publication is muted; this is not a device-permission shutdown. Stop simulation separately ends the session and closes the microphone.

While paused, movement commands are rejected and discarded rather than buffered. Stop/Pause controls remain available. Resume requires a new actual user transcript turn before accepting another movement tool; previously observed pre-pause or paused turns cannot unlock it. The UI also invalidates pending asynchronous instruction interpretation when pausing. Three dedicated pause-gate tests cover rejection, fresh-turn handling and repeated state calls.

The corrected live quiet rehearsal passed **5/5 checks**: one normal unpaused RTC session stayed connected for **35.048 seconds**, with one greeting, zero user transcripts, zero reminders/fillers and zero simulator announcement requests. The raw inbound audio was captured before application playback gain: the greeting measured **−25.26 dB RMS**, followed by **−110.80 dB RMS** after the greeting allowance. The test did not hide or block announcement audio.

After that quiet window, the same session completed the real SDK Pause/Resume promises without reconnecting. Top-level Stop simulation ended voice and preserved the `/kitchen` route. Total session time was 39.495 seconds. Evidence is under `.local/qa/voice-quiet-attempt2/`, including `results.json`, `quiet-connected.png`, `paused-same-session.png` and `remote-audio-1.webm`. This validates a silent synthetic microphone fixture; it does not establish human microphone, acoustic echo or listening acceptance.

The initial quiet harness failed before its 35-second window because it checked superseded status copy. It also assumed MediaRecorder WebM had duration metadata. The raw failed attempt remains under `.local/qa/voice-quiet/`. The corrected harness uses stable status attributes and decoded-audio `atrim` before RMS analysis, without relying on container duration metadata.

## Validation on 21 November 2026

The second bounded real-provider rehearsal passed all four checks: remote RTC audio subscription, recognized user speech in the panel, the actual five-step delivery controller acknowledgment/completion, and assistant speech text. The 32.7-second session received 138 RTC data frames, decoded 60 transcript updates, and displayed three partial updates (two user, one assistant). Audio and video were recorded. No human microphone or human listening pass is claimed. Evidence: ignored `.local/qa/live-voice-captions-attempt2/results.json` and `voice-captions.mp4`.

The initial rehearsal failed to display captions despite working audio and tool execution. Its raw failure remains in `.local/qa/live-voice-captions/results.json`. Interoperability changes accept zero- or one-based fragment indices and SDK ArrayBuffer/string payloads, and the agent explicitly selects the data stream channel. The successful replay establishes that the integrated path now works; it does not isolate which earlier compatibility assumption caused the initial failure.

The later two-column layout keeps both speakers visible independently. It was checked at 1280px and 390px using captured genuine rows, explicitly labelled as recorded-event layout verification; those checks are not another live provider session.

## Direct speech controls

The later full multilingual workflow rehearsal passed **4/4 observed outcomes**: English navigation with Cup untouched, Hindi Stop interrupting the unfinished route and freezing the clock, Hindi pickup leaving Cup held at Counter, and Hindi carry reaching Sink with Cup still held and zero placement events. This one live session lasted 72.049 seconds. Native exports preserve each actual attempt under `.local/qa/voice-speech-controls-attempt3/` alongside `results.json`, screenshots and the format-only MP4 conversion.

Direct final-navigation dispatch was measured at **1 ms after its ASR event reached the application**. The Hindi Stop used the LLM tool path because its recognition included a garbled polite prefix; its observed caption-to-simulator-acknowledgment interval was **2,144 ms**. These are different metrics. Neither measures microphone-to-robot latency. The original raw results remain unchanged; `latency-analysis.json` records their SHA-256 and the derived timing calculation. Hindi direct Stop latency and human microphone/hearing acceptance remain unverified.

Strict recognized Stop imperatives invoke the simulator handler as soon as that ASR transcript event arrives, including a partial event. Examples include `Stop`, `No. Stop. Stop.`, `रुको`, `रुक जाओ`, `रोक दो`, `stop karo` and `ruk jao`. Completed negations, conditions and descriptions such as `do not stop`, `रुको मत` or `if I say stop` do not match. An ASR provider can revise a partial phrase; the application cannot foresee words it has not received and never resumes automatically after stopping.

Exact station-navigation imperatives run only on final transcripts: `Go to Sink`, `sink par jao` and `सिंक पर जाओ` dispatch the canonical `Go to Sink`, with no object or delivery added. Other speech continues through the grounded LLM tool workflow. A later matching tool call reuses the actual direct-handler receipt; a tool that adds pickup or delivery to that navigation turn is refused. After Stop, a stale tool cannot restart movement or resume. A new actual user utterance clears this turn guard so a later legitimate pickup remains possible.

Each direct command executes at most once per user turn; Stop can override earlier navigation if ASR reuses the turn identity. Assistant transcript updates do not clear the guard. Metrics measure elapsed time from receipt of the ASR event to invocation of the application handler; they do not measure microphone-to-ASR recognition latency, completion time or physical emergency-stop performance. The original live caption validation above predates this direct-control addition; its dedicated tests are in `src/data/voice-command-parser.test.ts`. Live multilingual control acceptance is recorded separately above.

The first combined multilingual rehearsal did **not** pass: the provider transcribed the offline Hindi `रुको` fixture as `लोगों`, so the application correctly did not invent a Stop command from that unrelated word. The pickup fixture was transcribed as `कब को उठाओ?`, and the assistant asked for clarification. English navigation was transcribed as `Go to sync.` and the model resolved it to base-only Sink navigation; the direct parser now explicitly accepts that known station homophone. The original failure is preserved in `.local/qa/voice-speech-controls/results.json`. No live Hindi Stop latency or multilingual pickup/carry completion is established by this failed run.

The second combined rehearsal demonstrated an actual navigation-only attempt and a Hindi Stop through the **LLM tool path**: the robot stopped before Sink after 1.92 m and its clock/objects stayed unchanged. However, ASR rendered the inputs as `Côtes सेंग.` and `رو بردरुक जाओ.`, so they did not match the strict direct controls. The harness correctly failed its fast-path assertion and stopped the session before the scheduled pickup/carry inputs. Evidence remains in `.local/qa/voice-speech-controls-attempt2/results.json` and `stopped-navigation.json`. This verifies the observed LLM-mediated Stop outcome, not direct-control dispatch latency or the unexecuted pickup/carry portion. Unknown words are not globally reinterpreted as Stop.

The kitchen conversation panel consumes actual Agora RTC `stream-message` events from the existing voice session. Both user ASR and assistant transcript events are received through that transport. Typed commands and local action logs remain separate; the panel never invents spoken text from them.

The agent request enables transcript protocol v2. The bounded decoder assembles base64 message fragments, decodes UTF-8 JSON, and accepts only user/assistant transcription events. Raw JSON transcript messages are also supported. User `final` and assistant `turn_status` control final/interrupted labels. Streaming updates replace their speaker/turn row, and delayed partials cannot replace a final result. The latest 200 rows remain in browser memory.

The listener is installed before RTC join so the actual greeting can arrive. Session IDs scope turn identities across reconnects. Stop clears pending fragments. Fragment count, total size, input size and fragment lifetime are bounded. Unsupported data events are ignored.

Text is rendered when its provider event arrives. Partial updates appear when supplied by Agora; the UI does not animate a fabricated word stream. It does not claim word-level audio synchronization, playback verification or human listening acceptance. RTC audio connection and transcript arrival are separate observations.

Primary references:

- [Agora's RTC transcript reference implementation](https://github.com/AgoraIO-Conversational-AI/vibe-claude) documents this RTC protocol and agent configuration.
- [Agora transcription event structure](https://agoraio.zendesk.com/hc/en-us/articles/43777229474836-What-s-the-structure-of-Conversational-AI-transcription) describes speaker and completion fields.
- [Agora live transcript guide](https://docs.agora.io/en/ai/platform/build/transcripts) describes the alternative toolkit/Signaling integration and its synchronization requirements. This app uses the existing RTC transport.

Run parser checks with `npx tsx --test src/data/voice-captions.test.ts`. The explicit live rehearsal `node scripts/voice-captions-smoke.mjs` makes one real Agora/Murf session using an existing prerecorded microphone fixture and records actual received rows, remote audio and controller acknowledgment. It requires configured services and must not be counted as a human microphone test.

## Hindi vocabulary prompting after the failed combined rehearsal

The initial combined rehearsal above remains failed. The next configuration keeps
Nova-3 `language: multi` and adds one literal Hindi Cup keyterm, `कप`, using Agora's
documented URL-encoded string field. This is vocabulary bias, not a transcript
replacement or a guarantee of recognition. It has not yet passed another live
Hindi audio check.

[Deepgram documents keyterm prompting for multilingual Nova-3](https://developers.deepgram.com/docs/keyterm),
and [Agora documents `params.keyterm` in managed Deepgram mode](https://docs.agora.io/en/ai/models/asr/deepgram).
The Agora field is a string. Deepgram requires repeated query parameters for
multiple independent terms; commas or semicolons silently create one literal
phrase. This configuration therefore sends one term, without weights, invented
array semantics or a model/credential change.

The voice model may resolve an ASR near-homophone only when the freshly retrieved
scene and full action make the reference unique: `कब को उठाओ` can refer to the
single visible Cup, and a navigation destination `sync` can refer to Sink. It
must preserve pickup/hold versus navigation versus release. It must not replace
words globally or reinterpret unrelated `लोगों` as Stop. Negated stop requests
remain negated. A longer affirmative phrase such as `रोबोट रुक जाओ` is a useful
next test fixture; it is not a claimed test result. English Murf output remains
configured. Unit configuration checks validate the payload and these boundaries;
they do not measure recognition accuracy or physical stopping safety.
