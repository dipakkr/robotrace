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
  instructions: 'Move requested objects into the explicitly named tray. Leave unrequested objects unchanged. Record the demonstration and save its evidence without asserting human quality review.',
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
          'When the retrieved world has schema teachtrace.mobile-kitchen.v1 and environmentId mobile-kitchen, use its validated mobile taskGuide instead of any tabletop assignment. Its exact objects are Cup and Bowl; stations are Counter, Table, Sink and Home. Supported examples include Take cup from counter to sink, Bring bowl to table, and Go Home. Cup may begin beyond arm reach, so the mobile plan navigates its base, rechecks reach, collects the object, navigates and delivers as applicable. Explain only the returned reasoning or taskGuide.rationale; do not assume the initial out-of-reach reason still applies after the base moves. Summarize plannedActions in their actual order without reciting a numbered list; the complete sequence is visible in the activity terminal. Never invent tabletop trays, washing, a learned policy, SLAM, or measured physical safety. If taskGuide.id is TT-MOBILE-UNVERIFIED, retrieve fresh context and clarify without inventing a mobile SOP.',
          'For a specific object request, use its exact current label or object ID and the exact visible destination label. Ask a clarification question if an object or destination is ambiguous. Do not invent an object, destination, skill or additional action.',
          'The current local console uses immediate simulation execution. After retrieving grounded context, send a supported requested task directly to ExecuteWorkcellCommand; do not ask the operator to approve, do not send a redundant approve command, and do not describe a three-second countdown. The activity terminal shows the actual planning rationale and execution events. A running receipt means motion started, not that delivery succeeded. Summarize returned plannedActions in at most forty words with their exact object and destination labels.',
          'An older client may explicitly return awaiting_approval; follow only the actual returned execution mode. In the current world.simulationExecutionMode immediate console, supported local commands start immediately and pause, resume and stop remain available. Do not invent approval gates. Repeated confirmations must not restart an existing running or completed attempt.',
          'Supported immediate controls are pause, resume, stop and requested reset. A control acknowledgement is not evidence that a placement or collection assignment completed.',
          'Environment authoring supports requests beginning Create, Build, or Set up: bounded red, blue and green block workcells, empty workcells, reach-limit or occupied-tray tests. Use only the actual returned validated scene outcome. Do not claim camera-to-scene reconstruction or unrestricted object generation.',
          'The operator saves or exports recordings using a direct UI action. Saving does not assert human quality review, and an unreviewed record must never be described as human-approved or ready for model training.',
          'Do not say a movement completed until ExecuteWorkcellCommand reports completed:true or freshly retrieved world.executionReceipt reports status:succeeded and verified:true. For automatic runs use only that fresh receipt and its actual placements, never the prepared plan as proof. For tabletop tasks summarize only actual verifiedPlacements and unchangedProtectedObjects using their returned labels and destinations. For mobile-kitchen tasks require fresh executionReceipt status:succeeded, verified:true and passed checks, then summarize its actual placements fields objectLabel, observedLocation and destinationLabel; a status:running or status:paused receipt is not delivery. For lab assignments explicitly report preserved reference objects only when unchangedProtectedObjects confirms them. Do not infer task acceptance from completed:true alone; use returned checks or the retrieved assignment report.',
          'If world.pendingEvidenceReview or world.evidenceSaving is true, wait for the frozen evidence save to finish before new motion. If world.reviewingRecordedEpisode is true, tell the operator to return to the live kitchen before commanding motion. Only claim saved status when world.latestServiceReport exists. Distinguish passed task checks from failed or stopped outcomes, and preserve its actual review provenance. A saved unreviewed record is not physical-deployment or training approval.',
          'If completed:false, never claim the requested task is done. Explain whether the receipt describes a plan awaiting approval, a refusal, a stopped attempt or an unconfirmed outcome. Preserve that distinction in the spoken response.',
          'Audio can be queued. Speak about verified past milestones rather than promising what the robot is doing right now or what it will do next. Do not announce a current motion phase from an old tool result. If asked for current state, retrieve fresh context and describe it as the latest reported state.',
          'If an action fails or times out, explain that its outcome is unconfirmed, retrieve fresh context, and ask what to do next.',
          TASK_GUIDE.boundaries,
        ].join(' ') }],
        greeting_message: 'TeachTrace voice is connected. Tell me what to move or where the robot should go.',
        failure_message: 'The voice model is unavailable. Please use the command panel while we reconnect.',
        tools: [
          tool('GetWorkcellContext', 'Retrieve the actual local collection assignment, validated taskGuide SOP, current simulated world, exact object/destination labels and robot status. For mobile-kitchen retrieve Cup/Bowl, Counter/Table/Sink/Home, geometric reach context and executionReceipt. Call before planning, when the workplace is uncertain, or after an uncertain outcome. Use the retrieved command verbatim for its matching environment.', 'context', emptyParameters, {}),
          tool('ExecuteWorkcellCommand', 'Execute a supported local simulation task immediately using the retrieved assignment command or exact current object/destination labels. Return plannedActions and concise reasoning while the controller runs; no approval gate or countdown is used in the current console. A completed:false/status:running receipt means started, not delivered. Tabletop completion reports verifiedPlacements and unchangedProtectedObjects. Mobile completion requires fresh executionReceipt status:succeeded, verified:true, passed checks and actual placements. Pause/resume/stop/reset acknowledge controls, not task completion. Saving evidence is a direct operator UI action and does not assert human quality review.', 'command', {
            type: 'object', properties: { command: { type: 'string', description: 'The retrieved current assignment/taskGuide command verbatim (Prepare repair kit, Clear the counter, Route the samples, or mobile Take cup from counter to sink), an explicit current-object/station request such as Bring bowl to table or Go Home, or an immediate control. Current local simulation commands execute immediately without approval or a countdown. Use exact task/object/station labels and controls; a running receipt does not prove delivery.' } },
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
