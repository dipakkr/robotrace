# Hackathon positioning: what to show and what to claim

Checked **21 November 2026** against primary event, organizer and project sources. Product recommendations below are our inference, not a statement of judges’ private reasoning or winning probability.

## Lead with the operator’s job

> TeachTrace helps a robotics QA operator test a spoken task, expose an AI plan that fails, and save the exact attempt as reviewed, replayable evidence.

Use **voice-assisted predeployment task QA** as the core. Explain “predeployment” as a software test before a later engineering/hardware gate. Do not imply this prototype approves physical deployment. The visible robot gives decisions inspectable consequences; the deliverable is the task, attempt, failed predicate and persistent report.

The first customer hypothesis is a small robotics integration or demonstration-operations team. Its candidate pain is time spent reconstructing failed instructions and comparing inconsistent attempts. No interviews, commercial savings, purchasing commitment or frontier-lab acceptance have been established. Measure those next rather than putting invented numbers into the pitch.

## Current event facts

The official page requires **Agora Conversational AI**, **Murf Falcon speech output**, and agentic tool/API actions. It says judging criteria will be shared with shortlisted participants; the public page does not publish numerical weights. Its agenda lists submission by **12:30 PM**, mentor evaluation **12:30–2:30 PM**, and final demos from **3 PM** on 21 November. Confirm any on-site changes with organizers. [Official event](https://buildwithagora.knotic.co/)

The public mentor list includes Akash Kamerkar, Senior Data Scientist at ABB; Aharshraj Gunasekaran, Senior Engineer at Bosch; Agora architects Arunkumar Manoharan and Deenan S; and Murf engineers Gaurav Singh and Joel Gee Roy. These are published professional affiliations, not endorsements or evidence that someone specifically works on robotics. [Official mentor list](https://buildwithagora.knotic.co/)

Do not invent rubric scores, assume a sponsor approves the use case, or describe a local demo readiness checklist as the organizer’s scoring system.

## Previous winners we can actually verify

The **AI Mobile Coders organizer recap** names Pillion as winner, Sahara as first runner-up and DashLens as second runner-up in its completed Agora Voice AI Hackathon. These are a different event/edition; they do not establish the current event’s judging weights. [Organizer’s podium](https://www.aimobilecoders.com/hackathons/agora-voice-ai-hackathon)

Agora’s recipe archive labels the Pillion award as author-reported; the organizer recap supplies separate award confirmation. [Agora archive](https://recipes.agora.io/topics/voice-ai-hackathon-2026)

| Verified placed project | What its primary project materials describe | Transferable lesson for TeachTrace — our inference |
| --- | --- | --- |
| **Pillion — winner** | A rider-specific Android voice copilot using Agora, tools that reach phone capabilities, confirmation before messaging/calling, and a human/family handoff. Its recipe explains execution acknowledgements and demo steps. [Author’s repository recipe](https://github.com/jatinvats123/pillion/blob/main/docs/ai/RECIPE.md), [submitted project](https://www.commudle.com/builds/pillion) | Start with one employee and a hands-busy situation. Show an action reaching the real execution surface and a returned outcome; make confirmation and exceptions visible. |
| **Sahara — first runner-up** | A multilingual patient-support prototype with voice tools, record/logging workflows and caregiver handoff. Its README explicitly distinguishes simulated emergency dispatch from actual caregiver alerts. These are creator descriptions, not a clinical validation we performed. [Submitted project](https://www.commudle.com/builds/sahara-the-voice-for-complete-indic-patient-care), [source README](https://github.com/ace-ify/sahara-app) | An end-to-end story and explicit prototype boundaries are compatible. Demonstrate our actual record/report follow-up instead of promising unavailable robotics training. |
| **DashLens — second runner-up** | An Android voice/camera assistant grounded in vehicle manuals, a clarification question that can change the answer, and reported latency/classification limitations. We did not reproduce those measurements. [Submitted project](https://www.commudle.com/builds/dashlens), [source](https://github.com/shubhh00/DashLens) | Relevant retrieved knowledge and the right clarification matter. Show that our local SOP matches the current mobile world, and reveal failures rather than covering them with fluent speech. |

The evidence supports the awards and these published designs. It does **not** establish why judges chose them, prove every feature worked, validate their safety claims, or show that matching their feature count wins this event. Historical source pages differ on dates and participation counts; those numbers are unnecessary to this comparison and are not used here.

Do not clone every integration. Borrow the useful structure: a specific user, natural voice as a working interface, meaningful actions, grounded outcomes, critical confirmation, recovery, and a visible result the next person can inspect.

## The strongest demonstrated TeachTrace sequence

1. **Employee starts a task by voice.** The assistant retrieves the actual mobile scene and locally authored SOP, rather than claiming a connection to an external enterprise knowledge system.
2. **Action is visible and bounded.** The base navigates before a reach check, pickup and delivery. The main task is a deterministic known-map/idealized-handoff workflow.
3. **Outcome is verified before it is described.** Prepared plans and running receipts do not become delivery claims. Go Home is navigation and may preserve held cargo; it does not claim an object was delivered or released.
4. **The employee reviews and saves this same attempt.** The mobile local API verifies integrity/arm consistency and recomputes recorded-state acceptance, then returns a durable service report and ID.
5. **Another view can reopen and replay it.** A stopped attempt remains nonaccepted; replay does not move the live robot. Retry retains the same reviewed envelope rather than inventing new success evidence.
6. **Actual model candidates face the same software gate.** The evaluator keeps declared skill order and wrong destinations; it does not silently substitute the bounded baseline.

This is one complete mobile workplace workflow. Tabletop environments and seeded variations add breadth, but the mandatory story no longer depends on switching to a separate collection pipeline for follow-up.

## Measured evidence to use

| Evidence | Observed result | Practical limit |
| --- | --- | --- |
| Real provider mobile voice path | Prerecorded spoken input exercised Agora/LLM/Murf, actual Cup delivery, returned receipt and received/transcribed remote audio | A human microphone and human-heard playback check remain pending |
| Real model planner request | One `gpt-4o-mini` request; five actions; **2,797.58 ms** measured request time; completed and task accepted | One case study, not ranking, inference-only latency or motor-policy capability |
| Five-case mobile baseline | **Two accepted tasks**, plus reach failure, route refusal and human obstruction | Authored bounded situations; expected refusal is not a completed delivery |
| Wrong-destination test | Controller sequence completed; independent Sink goal rejected actual Table placement | Deliberately operator-authored candidate; not a claimed model mistake |
| Protected Bowl round trip | Exact final Bowl record restored; task rejected for actual pickup at **step 8** | Software history check on recorded controller states, not a physical sensor |
| Mobile evidence service | **Five browser checks passed**, including **two real HTTP 201 saves**: completed/accepted and stopped/not accepted; persistence/replay and unavailable-save recovery | Local durable service with explicit review; no cloud/multitenant/authenticated-reviewer claim |
| Standalone consumer | Sealed evidence becomes integrity/kinematics-checked state analysis outside the app | Next observed states are not requested motor actions or training-framework compatibility |
| Variation lineage | Two recorded child layouts share a declared parent group and have distinct computed child hashes | Ancestry/source identity unverified; no train/test split or learning benefit demonstrated |

Evidence files and exact demo controls are linked in [MENTOR_CHECKIN.md](MENTOR_CHECKIN.md). Use current saved artifacts or reproduce the test; do not transform historical observations into guarantees for a live turn.

## Mentor questions worth asking in person

The following are suggested check-in questions, not outreach messages or assumptions about a mentor’s specialty:

- **For an ABB/Bosch-affiliated mentor, if their experience is relevant:** “Would this task-and-failure package help an integration/QA engineer reproduce a planning error? Which missing field or simulator interface would make it usable in your workflow?”
- **For an Agora architect:** “Does our real voice→context→tool→controller→receipt path clearly demonstrate the required agentic workflow? Is delayed narration grounded appropriately in verified milestones?”
- **For a Murf engineer:** “Can we improve turn-taking or pronunciation while keeping tool-derived object/station labels exact? Which speech behavior should we validate live?”
- **For the product/track evaluator:** “Is the operator and measurable handoff clear in the first 90 seconds? Should we emphasize failure reproduction, review time, or a different concrete workflow outcome?”

Ask for one actionable gap, then show the relevant evidence. Public affiliation does not entitle us to use an employer’s logo, data, systems or endorsement.

## Physical-AI positioning and next proof

The present value is **task-level evaluation and evidence operations**. It is more specific than a generic 3D viewer or annotation platform: the declared plan executes against frozen task checks, and its recorded consequences are reviewable. Whether this saves useful work remains a customer hypothesis.

Human-reference interpretation, seeded case expansion and lineage could later help curate useful robot-learning inputs. That direction still requires a specified action/observation interface, appropriate dynamics and sensors, one genuine training consumer, learned closed-loop evaluation on held-out scenes, and separate calibrated hardware tests. A source hash establishes content identity; a provider API or a valid dataset file does not establish a learning gain.

For this event, lead with the working workflow and one difficult failure. Present the training bridge as explicit next gates, not an already completed contribution to a frontier lab. The result can be a strong, coherent entry without a fabricated perfect score or winning odds.
