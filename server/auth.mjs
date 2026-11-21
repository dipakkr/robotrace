import agoraToken from 'agora-token';

const TOKEN_SECONDS = 3600;
const present = value => typeof value === 'string' && value.trim().length > 0;

/** Server-only REST header. Mirrors the inspected official agora-agents ConvoAI token builder. */
export function agoraAuthorization(env, payload, buildToken = (...args) => agoraToken.RtcTokenBuilder.buildTokenWithRtm(...args)) {
  if (present(env.AGORA_CUSTOMER_ID) && present(env.AGORA_CUSTOMER_SECRET)) {
    return `Basic ${Buffer.from(`${env.AGORA_CUSTOMER_ID.trim()}:${env.AGORA_CUSTOMER_SECRET.trim()}`).toString('base64')}`;
  }
  const appId = env.AGORA_APP_ID?.trim();
  const certificate = env.AGORA_APP_CERTIFICATE?.trim();
  if (!/^[a-f\d]{32}$/i.test(appId ?? '') || !/^[a-f\d]{32}$/i.test(certificate ?? '')) {
    throw new Error('Agora App ID and App Certificate must each be 32 hexadecimal characters. Values are not displayed.');
  }
  // Join authenticates the agent's channel/UID. Control requests have no join
  // properties and receive a bounded control scope, matching the SDK's stop/0 pattern.
  const properties = payload?.properties;
  const channel = properties ? properties.channel : 'control';
  const uid = properties ? properties.agent_rtc_uid : 0;
  if (typeof channel !== 'string' || !channel.length || Buffer.byteLength(channel, 'utf8') > 64 || /[\x00-\x1f\x7f]/.test(channel)
    || !['number', 'string'].includes(typeof uid) || !/^\d+$/.test(String(uid))
    || !Number.isSafeInteger(Number(uid)) || Number(uid) > 4294967295) {
    throw new Error('Agora agent channel or UID is invalid. Values are not displayed.');
  }
  let token;
  try {
    token = buildToken(appId, certificate, channel, String(uid), agoraToken.RtcRole.PUBLISHER, TOKEN_SECONDS, TOKEN_SECONDS);
  } catch {
    throw new Error('Agora REST token could not be generated. Check server-only project credentials.');
  }
  if (typeof token !== 'string' || !token.length) throw new Error('Agora REST token could not be generated. Check server-only project credentials.');
  return `agora token=${token}`;
}
