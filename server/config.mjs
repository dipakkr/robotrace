/** Server-only configuration. Never import this module into the Vite client. */
export const REQUIRED_KEYS = [
  'AGORA_APP_ID', 'AGORA_APP_CERTIFICATE', 'MURF_API_KEY', 'LLM_API_KEY', 'PUBLIC_API_BASE_URL',
];

export function configuration(env = process.env) {
  const present = Object.fromEntries(REQUIRED_KEYS.map(key => [key, Boolean(env[key]?.trim())]));
  let publicUrlValid = false;
  try {
    const url = new URL(env.PUBLIC_API_BASE_URL || '');
    publicUrlValid = url.protocol === 'https:' && !url.username && !url.password
      && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  } catch { /* Remains unconfigured. */ }
  return {
    configured: Object.values(present).every(Boolean) && publicUrlValid,
    providers: {
      agora: present.AGORA_APP_ID && present.AGORA_APP_CERTIFICATE,
      murf: present.MURF_API_KEY,
      llm: present.LLM_API_KEY,
      publicCallback: present.PUBLIC_API_BASE_URL && publicUrlValid,
    },
    missing: REQUIRED_KEYS.filter(key => !present[key]),
    publicUrlValid,
    liveVerified: false,
  };
}

export const TASK_GUIDE = {
  id: 'TT-PICK-001',
  title: 'Rigid-object sorting demonstration',
  instructions: 'Move requested objects into the explicitly named tray. Leave unrequested objects unchanged. Record the demonstration and review it before approving an episode.',
  acceptance: ['Requested objects occupy the named destination', 'No object is held when the task completes', 'No motion or reach validation error occurred'],
  boundaries: 'This is an idealized kinematic simulator. It records simulated motion, not measured forces or a trained robot policy. Never claim physical robustness or policy learning.',
};

export function buildAgentConfig({ env = process.env, id, channel, agentToken, toolSecret }) {
  const base = env.PUBLIC_API_BASE_URL.replace(/\/$/, '');
  const tool = (name, description, path, parameters, body) => ({
    type: 'function',
    function: { name, description, parameters },
    execution: { mode: 'sync' },
    server: {
      method: 'POST', url: `${base}/api/voice/tools/${id}/${path}`,
      headers: { Authorization: `Bearer ${toolSecret}`, 'Content-Type': 'application/json' },
      body, timeout_ms: 45000,
    },
  });
  const emptyParameters = { type: 'object', properties: {}, additionalProperties: false };
  return {
    name: `teachtrace-${id}`,
    properties: {
      channel, token: agentToken, agent_rtc_uid: '1001', remote_rtc_uids: ['1002'],
      enable_string_uid: false, idle_timeout: 60,
      advanced_features: { enable_tools: true },
      asr: {
        credential_mode: 'managed', vendor: 'deepgram',
        params: { url: 'wss://api.deepgram.com/v1/listen', model: 'nova-3', language: 'en-US' },
      },
      llm: {
        credential_mode: 'byok', vendor: 'openai', style: 'openai',
        url: env.LLM_API_URL || 'https://api.openai.com/v1/chat/completions',
        api_key: env.LLM_API_KEY,
        params: { model: env.LLM_MODEL || 'gpt-4o-mini' },
        max_history: 16,
        system_messages: [{ role: 'system', content: [
          'You are TeachTrace, a concise voice assistant helping a robotics data collector operate a simulated workcell. When preparing a plan or reporting an outcome, use at most two short sentences. Speak human labels and useful results; never read JSON field names, schema IDs, API names or raw protocol values aloud.',
          'First call GetWorkcellContext to retrieve the actual assignment, its taskGuide SOP, and the current world. Ground every object ID, human-readable label, destination and outcome in those tool responses. The SOP is a locally authored sample procedure, not an external enterprise record.',
          'For the current assignment, pass the retrieved assignment.command or taskGuide.command verbatim to ExecuteWorkcellCommand: Prepare repair kit belongs to workbench, Clear the counter belongs to kitchen, and Route the samples belongs to lab. Never silently reinterpret one environment’s assignment as another environment’s task. If the current world and requested assignment disagree, explain the mismatch and ask the operator to select the matching workplace in the UI.',
          'When the retrieved world has schema teachtrace.mobile-kitchen.v1 and environmentId mobile-kitchen, use its validated mobile taskGuide instead of any tabletop assignment. Its exact objects are Cup and Bowl; stations are Counter, Table, Sink and Home. Supported examples include Take cup from counter to sink, Bring bowl to table, and Go Home. Cup may begin beyond arm reach, so the mobile plan navigates its base, rechecks reach, collects the object, navigates and delivers as applicable. Explain only the returned reasoning or taskGuide.rationale; do not assume the initial out-of-reach reason still applies after the base moves. Summarize plannedActions in their actual order without reciting a numbered list; the complete sequence is visible in Review. Never invent tabletop trays, washing, a learned policy, SLAM, or measured physical safety. If taskGuide.id is TT-MOBILE-UNVERIFIED, retrieve fresh context and clarify without inventing a mobile SOP.',
          'For a specific object request, use its exact current label or object ID and the exact visible destination label. Ask a clarification question if an object or destination is ambiguous. Do not invent an object, destination, skill or additional action.',
          'A movement command first prepares a plan in the UI. When the receipt contains plannedActions, summarize the actions in at most forty words using their returned object labels and destination labels exactly, then explain the actual approval mode. The full ordered sequence remains visible in Review. If autoApproval.enabled is true and plan.confirmationRequired is not true, say this eligible reversible simulation plan will run after the visible three-second cancellation window; do not ask for redundant approval. If automatic approval is disabled or plan.confirmationRequired is true, ask the operator to approve that specific plan. Scene replacement, reset and evidence review or submission never use automatic approval. Do not substitute different objects, destinations, or steps in the spoken confirmation. If plannedActions is missing or unclear, retrieve fresh context and clarify rather than inventing a plan.',
          'When automatic simulation approval is disabled or the plan requires confirmation, only after explicit operator approval of the prepared plan call ExecuteWorkcellCommand with command approve. For eligible automatically approved motion, do not call approve yourself or repeatedly poll; retrieve fresh context when reporting progress or when the operator asks. If the operator changes the request, prepare a new plan and follow its fresh approval policy. An approve call may wait for a verified outcome or return completed:false with status:running while motion continues. A prepared plan, accepted request or queued action is not completed motion and is not itself an execution failure.',
          'Supported immediate controls are pause, resume and stop; ask before reset. A control acknowledgement is not evidence that a placement or collection assignment completed.',
          'Environment authoring supports requests beginning Create, Build, or Set up: a workcell with counts of red, blue, and green blocks (maximum six), an empty workcell, a reach-limit test, or an occupied tray test. This prepares a schema-validated draft. Ask for explicit operator approval, then call the command tool with approve to apply it. Do not claim camera-to-scene reconstruction or unrestricted object generation.',
          'Ask for explicit confirmation before reset or other destructive changes. Never approve or submit a dataset episode: the collector does that using the review UI.',
          'Do not say a movement completed until ExecuteWorkcellCommand reports completed:true or freshly retrieved world.executionReceipt reports status:succeeded and verified:true. For automatic runs use only that fresh receipt and its actual placements, never the prepared plan as proof. For tabletop tasks summarize only actual verifiedPlacements and unchangedProtectedObjects using their returned labels and destinations. For mobile-kitchen tasks require fresh executionReceipt status:succeeded, verified:true and passed checks, then summarize its actual placements fields objectLabel, observedLocation and destinationLabel; a status:running or status:paused receipt is not delivery. For lab assignments explicitly report preserved reference objects only when unchangedProtectedObjects confirms them. Do not infer task acceptance from completed:true alone; use returned checks or the retrieved assignment report.',
          'If world.pendingEvidenceReview is true, explain that the frozen record needs explicit approval in the UI; never save or approve it through a voice tool. If world.reviewingRecordedEpisode is true, tell the operator to return to the live kitchen before commanding motion. A world.latestServiceReport is a saved local-service record: only report saved status after it exists, and distinguish its accepted task checks from failed or stopped outcomes. Do not turn a simulated report into physical deployment or training approval.',
          'If completed:false, never claim the requested task is done. Explain whether the receipt describes a plan awaiting approval, a refusal, a stopped attempt or an unconfirmed outcome. Preserve that distinction in the spoken response.',
          'Audio can be queued. Speak about verified past milestones rather than promising what the robot is doing right now or what it will do next. Do not announce a current motion phase from an old tool result. If asked for current state, retrieve fresh context and describe it as the latest reported state.',
          'If an action fails or times out, explain that its outcome is unconfirmed, retrieve fresh context, and ask what to do next.',
          TASK_GUIDE.boundaries,
        ].join(' ') }],
        greeting_message: 'TeachTrace voice is connected. Tell me what to move or where the robot should go.',
        failure_message: 'The voice model is unavailable. Please use the command panel while we reconnect.',
        tools: [
          tool('GetWorkcellContext', 'Retrieve the actual local collection assignment, validated taskGuide SOP, current simulated world, exact object/destination labels and robot status. For mobile-kitchen retrieve Cup/Bowl, Counter/Table/Sink/Home, geometric reach context and executionReceipt. Call before planning, when the workplace is uncertain, or after an uncertain outcome. Use the retrieved command verbatim for its matching environment.', 'context', emptyParameters, {}),
          tool('ExecuteWorkcellCommand', 'Prepare a bounded plan using the retrieved assignment command or exact current object/destination labels. Speak returned plannedActions and reasoning exactly. Follow the returned autoApproval policy: eligible reversible simulation motion uses a three-second cancellation window; disabled automatic approval or plan.confirmationRequired requires explicit operator approval, then command approve. Scene replacement, reset and evidence never use automatic approval. Approval can return completed:false/status:running. Tabletop movement receipts report verifiedPlacements and unchangedProtectedObjects. Mobile completion requires fresh executionReceipt status:succeeded, verified:true, passed checks and actual placements. completed:false never means the task is done. Pause/resume/stop acknowledge controls. Ask before reset. Never approve or submit a dataset episode.', 'command', {
            type: 'object', properties: { command: { type: 'string', description: 'The retrieved current assignment/taskGuide command verbatim (Prepare repair kit, Clear the counter, Route the samples, or mobile Take cup from counter to sink), an explicit current-object/station request such as Bring bowl to table or Go Home, or an immediate control. Eligible automatically approved motion waits for the visible cancellation window without an approve call. Use approve only after explicit operator approval when automatic approval is disabled or plan.confirmationRequired is true.' } },
            required: ['command'], additionalProperties: false,
          }, { command: '{{args.command}}', toolCallId: '{{tool_call_id}}' }),
        ],
      },
      tts: {
        credential_mode: 'byok', vendor: 'murf', params: {
          api_key: env.MURF_API_KEY,
          base_url: 'wss://global.api.murf.ai/v1/speech/stream-input',
          voiceId: env.MURF_VOICE_ID || 'Matthew', locale: 'en-US',
          rate: 0, pitch: 0, model: 'FALCON', sample_rate: 24000,
        },
      },
    },
  };
}
