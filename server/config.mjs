/** Server-only configuration. Never import this module into the Vite client. */
export const REQUIRED_KEYS = [
  'AGORA_APP_ID', 'AGORA_APP_CERTIFICATE', 'AGORA_CUSTOMER_ID',
  'AGORA_CUSTOMER_SECRET', 'MURF_API_KEY', 'LLM_API_KEY', 'PUBLIC_API_BASE_URL',
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
      agora: present.AGORA_APP_ID && present.AGORA_APP_CERTIFICATE
        && present.AGORA_CUSTOMER_ID && present.AGORA_CUSTOMER_SECRET,
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
          'You are TeachTrace, a concise voice assistant helping a robotics data collector operate a simulated workcell.',
          'First retrieve the workcell context and task guide. Ground object IDs, positions and outcomes in tool responses.',
          'You may describe a plan and execute supported workcell commands. Ask which tray if the destination is ambiguous.',
          'Supported commands include moving colored objects to tray A or tray B, sorting, pause, resume, stop, and reset. A movement command first prepares a plan in the UI. Ask the operator to approve that plan; only after explicit approval call ExecuteWorkcellCommand with command approve. The approve command waits for verified completion. Never treat a prepared plan as a failure or completed motion.',
          'Environment authoring supports requests beginning Create, Build, or Set up: a workcell with counts of red, blue, and green blocks (maximum six), an empty workcell, a reach-limit test, or an occupied tray test. This prepares a schema-validated draft. Ask for explicit operator approval, then call the command tool with approve to apply it. Do not claim camera-to-scene reconstruction or unrestricted object generation.',
          'Ask for explicit confirmation before reset or other destructive changes. Never approve or submit a dataset episode: the collector does that using the review UI.',
          'Do not say an action completed until ExecuteWorkcellCommand reports completed:true. An accepted or queued command is not a completed motion.',
          'If an action fails or times out, explain that its outcome is unconfirmed, retrieve fresh context, and ask what to do next.',
          TASK_GUIDE.boundaries,
        ].join(' ') }],
        greeting_message: 'TeachTrace voice is connected. Tell me which objects to move and which tray to use.',
        failure_message: 'The voice model is unavailable. Please use the command panel while we reconnect.',
        tools: [
          tool('GetWorkcellContext', 'Retrieve live simulated scene, robot status, object IDs, and approved collection instructions. Call before planning or after any uncertain outcome.', 'context', emptyParameters, {}),
          tool('ExecuteWorkcellCommand', 'Prepare a movement plan from a supported natural-language command. After the user explicitly approves that plan, call with command approve and wait for its verified outcome. Pause, resume and stop are immediate controls. Ask before reset. Never approve or submit a dataset episode.', 'command', {
            type: 'object', properties: { command: { type: 'string', description: 'A precise command naming objects and destination. For example: Move the red block to tray A.' } },
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
