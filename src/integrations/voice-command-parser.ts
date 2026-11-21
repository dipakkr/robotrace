import type { VoiceTranscript } from './voice-captions';
import type { VoiceCommandResult } from './voice';

const normalize = (text: string) => text.toLowerCase().replace(/[.!?,;:।]+/g, ' ').replace(/\s+/g, ' ').trim();
export type DirectSpeechCommand = { kind: 'stop' | 'navigation'; command: string };
/** Deliberately narrow imperatives. Conditions, negations and object actions never match. */
export function directSpeechCommand(text: string, final: boolean): DirectSpeechCommand | null {
  const value = normalize(text);
  const stop = 'stop(?: (?:the )?(?:robot|simulation|movement|moving))?(?: now)?(?: please)?';
  const hindiStop = '(?:रुको|रुक जाओ|रोक दो|रोको)';
  const hinglishStop = '(?:stop karo|stop kar do|ruk jao|ruko|rok do|robot ko roko)';
  if (new RegExp(`^(?:(?:no|please|robot) )*${stop}(?: ${stop})*$`).test(value)
    || new RegExp(`^(?:(?:कृपया|बस|अभी|रोबोट) )*${hindiStop}(?: ${hindiStop})*(?: अभी| कृपया)?$`).test(value)
    || new RegExp(`^(?:(?:please|bas|abhi|robot) )*${hinglishStop}(?: ${hinglishStop})*(?: please)?$`).test(value)) return { kind: 'stop', command: 'stop' };
  if (!final) return null;
  const indian = value.match(/^(?:(?:कृपया|रोबोट|please|robot) )*(sink|सिंक|सिन्क|table|टेबल|counter|काउंटर|home|होम|घर|ghar|dock)(?: पर| पे| तक| की ओर| par| pe| tak)? (?:जाओ|चलो|jao|chalo)(?: कृपया| please)?$/);
  if (indian) {
    const destinations: Record<string, string> = { sink: 'Sink', 'सिंक': 'Sink', 'सिन्क': 'Sink', table: 'Table', 'टेबल': 'Table', counter: 'Counter', 'काउंटर': 'Counter', home: 'Home', 'होम': 'Home', 'घर': 'Home', ghar: 'Home', dock: 'Home' };
    return { kind: 'navigation', command: `Go to ${destinations[indian[1]]}` };
  }
  const match = value.match(/^(?:please )?(?:(?:can|could|would) you (?:please )?)?(?:go|navigate|drive|return|move)(?: to)? (?:the )?(sink|sync|table|counter|home|dock)(?: please)?$/);
  if (!match) return null;
  const station = match[1] === 'dock' ? 'home' : match[1] === 'sync' ? 'sink' : match[1];
  return { kind: 'navigation', command: `Go to ${station[0].toUpperCase()}${station.slice(1)}` };
}

export interface SpeechControlObservation {
  turnId: string; command: string; kind: DirectSpeechCommand['kind']; receivedAt: number; invokedAt: number;
  /** Measured app dispatch time after the ASR event, not microphone/ASR latency. */
  dispatchDelayMs: number;
}
type Dispatch = (command: string) => Promise<VoiceCommandResult> | VoiceCommandResult;
interface Guard { turnId: string; intent: DirectSpeechCommand; receipt: Promise<VoiceCommandResult> }
const failed = (error: unknown): VoiceCommandResult => ({ completed: false, error: error instanceof Error ? error.message : 'The simulator did not acknowledge the speech control.' });

/** Coordinate the fast path and the later LLM tool, using the latest actual user turn. */
export class VoiceSpeechControlGate {
  private currentTurn: string | null = null;
  private guard: Guard | null = null;
  private handledThisTurn = false;
  private toolForTurn: { intent: DirectSpeechCommand; receipt: Promise<VoiceCommandResult> } | null = null;
  constructor(private dispatch: Dispatch, private observe?: (event: SpeechControlObservation) => void, private now: () => number = Date.now) {}
  clear() { this.currentTurn = null; this.guard = null; this.handledThisTurn = false; this.toolForTurn = null; }
  receive(transcript: VoiceTranscript): SpeechControlObservation | null {
    if (transcript.speaker !== 'user' || !transcript.text.trim()) return null;
    if (this.currentTurn !== transcript.id) {
      this.currentTurn = transcript.id; this.guard = null; this.handledThisTurn = false; this.toolForTurn = null;
    }
    const intent = directSpeechCommand(transcript.text, transcript.final);
    if (!intent) return null;
    // A newly recognized Stop must still override navigation if ASR reuses a turn.
    if (this.handledThisTurn && !(intent.kind === 'stop' && this.guard?.intent.kind === 'navigation')) return null;
    this.handledThisTurn = true;
    // If the same tool beat its final caption, reuse the actual existing invocation.
    if (this.toolForTurn?.intent.command === intent.command) {
      this.guard = { turnId: transcript.id, intent, receipt: this.toolForTurn.receipt }; return null;
    }
    const invokedAt = this.now();
    const observation = { turnId: transcript.id, command: intent.command, kind: intent.kind, receivedAt: transcript.receivedAt, invokedAt,
      dispatchDelayMs: Math.max(0, invokedAt - transcript.receivedAt) };
    // Invoke before awaiting anything: Stop does not wait on an LLM or tool callback.
    const receipt = this.invoke(intent.command);
    this.guard = { turnId: transcript.id, intent, receipt };
    this.observe?.(observation); return observation;
  }
  private invoke(command: string): Promise<VoiceCommandResult> {
    try { return Promise.resolve(this.dispatch(command)).then(receipt => receipt && typeof receipt.completed === 'boolean' ? receipt : failed('Invalid simulator receipt.'), failed); }
    catch (error) { return Promise.resolve(failed(error)); }
  }
  async executeTool(command: string): Promise<VoiceCommandResult> {
    const intent = directSpeechCommand(command, true), guard = this.guard;
    if (guard) {
      if (intent?.command === guard.intent.command) {
        const receipt = await guard.receipt;
        return { ...receipt, speechControlDeduplicated: true, summary: `${receipt.summary ?? 'The recognized speech command already reached the simulator.'} This matching tool request did not execute it again.` };
      }
      // Stop can always make the simulator more conservative, even after navigation.
      if (intent?.kind !== 'stop') return { completed: false, status: 'rejected', error: guard.intent.kind === 'stop'
        ? 'The latest recognized speech requested Stop. No later movement from this turn was executed. Speak a new task to proceed.'
        : `The latest recognized speech requested navigation only: ${guard.intent.command}. This tool request adds or changes an action, so it was not executed.` };
    }
    if (intent && this.toolForTurn?.intent.command === intent.command) return { ...await this.toolForTurn.receipt, speechControlDeduplicated: true };
    const receipt = this.invoke(command);
    if (intent) this.toolForTurn = { intent, receipt };
    return receipt;
  }
}
