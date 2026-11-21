/** Agora's RTC transcript messages: JSON or v2 messageId|index|count|base64.
 * Source: https://github.com/AgoraIO-Conversational-AI/vibe-claude
 * Rendering follows received text snapshots, without invented word timing.
 */
export interface VoiceTranscript {
  id: string; speaker: 'user' | 'assistant'; text: string; final: boolean; receivedAt: number;
  interrupted?: boolean;
}
const MAX_PACKET = 65536, MAX_MESSAGE = 262144;
interface Assembly { parts: Map<number, string>; count: number | null; bytes: number; receivedAt: number }
export function captionPacketBytes(payload: unknown): Uint8Array | null {
  if (typeof payload === 'string') return payload.length <= MAX_PACKET ? new TextEncoder().encode(payload) : null;
  if (payload instanceof Uint8Array) return payload;
  if (payload instanceof ArrayBuffer) return new Uint8Array(payload);
  if (ArrayBuffer.isView(payload)) return new Uint8Array(payload.buffer, payload.byteOffset, payload.byteLength);
  return null;
}
export class AgoraCaptionDecoder {
  private pending = new Map<string, Assembly>();
  clear() { this.pending.clear(); }
  receive(payload: unknown, receivedAt = Date.now()): VoiceTranscript | null {
    const packet = captionPacketBytes(payload);
    if (!packet || packet.byteLength > MAX_PACKET || !Number.isFinite(receivedAt)) return null;
    for (const [id, state] of this.pending) if (receivedAt - state.receivedAt > 30000) this.pending.delete(id);
    try {
      let raw = new TextDecoder('utf-8', { fatal: true }).decode(packet).trim();
      if (!raw.startsWith('{')) {
        const fields = raw.split('|'); if (fields.length !== 4) return null;
        const [id, indexText, countText, content] = fields;
        if (!/^[^\x00-\x20|]{1,160}$/.test(id) || !/^\d{1,3}$/.test(indexText) || !/^(?:\?\?\?|-1|\d{1,3})$/.test(countText) || !/^[A-Za-z0-9+/=]*$/.test(content)) return null;
        const index = Number(indexText), count = countText === '???' || countText === '-1' ? null : Number(countText);
        if (index > 128 || (count !== null && (count < 1 || count > 128 || index > count))) return null;
        let state = this.pending.get(id);
        if (!state) {
          if (this.pending.size >= 32) this.pending.delete(this.pending.keys().next().value!);
          state = { parts: new Map(), count, bytes: 0, receivedAt }; this.pending.set(id, state);
        }
        if (count !== null && state.count !== null && count !== state.count) { this.pending.delete(id); return null; }
        state.count = count ?? state.count;
        state.bytes += content.length - (state.parts.get(index)?.length ?? 0); state.parts.set(index, content);
        if (state.bytes > MAX_MESSAGE || (state.count !== null && [...state.parts.keys()].some(part => part > state.count!))) { this.pending.delete(id); return null; }
        if (state.count === null || state.parts.size !== state.count) return null;
        // The wire examples sort part indices; accept contiguous zero- or one-based senders.
        const base = state.parts.has(0) ? 0 : 1;
        if (!Array.from({ length: state.count }, (_, i) => state!.parts.has(i + base)).every(Boolean)) return null;
        const joined = Array.from({ length: state.count }, (_, i) => state!.parts.get(i + base)).join('');
        this.pending.delete(id);
        const bytes = Uint8Array.from(atob(joined), character => character.charCodeAt(0));
        raw = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      }
      if (raw.length > MAX_MESSAGE) return null;
      const value = JSON.parse(raw);
      const interruption = value?.object === 'message.interrupt';
      const speaker = value?.object === 'user.transcription' ? 'user' : value?.object === 'assistant.transcription' || interruption ? 'assistant' : null;
      const text = interruption && value.text === undefined ? '' : value?.text;
      const interrupted = speaker === 'assistant' && (value.turn_status === 2 || interruption);
      const final = speaker === 'user' ? value.final === true : value.turn_status === 1 || interrupted;
      if (!speaker || typeof text !== 'string' || text.length > 20000 || (!text.trim() && !final)) return null;
      const turn = Number.isSafeInteger(value.turn_id) && value.turn_id >= 0 ? String(value.turn_id)
        : typeof value.message_id === 'string' && /^[\w.-]{1,160}$/.test(value.message_id) ? value.message_id : null;
      if (turn === null) return null;
      return { id: `${speaker}:${turn}`, speaker, text, final, receivedAt, ...(interrupted ? { interrupted: true } : {}) };
    } catch { return null; }
  }
}

/** One row per provider turn/speaker. Final text cannot regress to a late partial. */
export function mergeVoiceTranscripts(entries: VoiceTranscript[], incoming: VoiceTranscript): VoiceTranscript[] {
  const index = entries.findIndex(item => item.id === incoming.id);
  if (index < 0) return incoming.text.trim() ? [...entries, incoming].slice(-200) : entries;
  if (entries[index].final && !incoming.final) return entries;
  const next = [...entries]; next[index] = { ...entries[index], ...incoming, text: incoming.text.trim() ? incoming.text : entries[index].text }; return next;
}
