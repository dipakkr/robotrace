import type { VoiceTranscript } from './voice-captions';
import type { VoiceCommandResult } from './voice';
import type { VoiceCommandContext } from './voice-command-context';

const normalize = (text: string) => text.toLowerCase().replace(/[!?,;:।]+/g, ' ').replace(/(?<!\d)\.|\.(?!\d)/g, ' ').replace(/\s+/g, ' ').trim();
export type DirectSpeechCommand = { kind: 'stop' | 'navigation' | 'relative-motion'; command: string };
const distanceWords: Record<string, number> = {one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,half:.5,'एक':1,'दो':2,'तीन':3,'चार':4,'पाँच':5,'पांच':5,'छह':6,'छः':6,'सात':7,'आठ':8,'नौ':9,'दस':10,'आधा':.5,ek:1,do:2,teen:3,char:4,panch:5,paanch:5,chhe:6,chhah:6,che:6,saat:7,aath:8,nau:9,das:10,aadha:.5};
const distanceToken = `(?:\\d{1,3}(?:\\.\\d{1,3})?|[०-९]{1,3}(?:\\.[०-९]{1,3})?|${Object.keys(distanceWords).join('|')})`;
function relativeSpeech(value: string): DirectSpeechCommand | null {
  const english = value.match(new RegExp(`^(?:please )?(?:(?:can|could|would) you (?:please )?)?(?:go|move|drive) (straight|forward|backward|backwards|left|right) (${distanceToken}) (?:m|meters?|metres?)(?: please)?$`));
  const indian = value.match(new RegExp(`^(?:(?:कृपया|रोबोट|please|robot) )*(${distanceToken}) (?:मीटर|meter|meters|metre|metres) (आगे|सीधे|पीछे|बाएं|बाएँ|दाएं|दाएँ|aage|seedha|piche|peeche|baaye|baayen|daaye|daayen) (?:जाओ|चलो|बढ़ो|jao|chalo|badho)(?: कृपया| please)?$`));
  const reversed = value.match(new RegExp(`^(?:(?:कृपया|रोबोट|please|robot) )*(आगे|सीधे|पीछे|बाएं|बाएँ|दाएं|दाएँ|aage|seedha|piche|peeche|baaye|baayen|daaye|daayen) (${distanceToken}) (?:मीटर|meter|meters|metre|metres) (?:जाओ|चलो|बढ़ो|jao|chalo|badho)(?: कृपया| please)?$`));
  if (!english && !indian && !reversed) return null;
  const word = english?.[2] ?? indian?.[1] ?? reversed![2];
  const meters = Object.hasOwn(distanceWords, word) ? distanceWords[word] : Number(word.replace(/[०-९]/g, digit => String('०१२३४५६७८९'.indexOf(digit))));
  if (!Number.isFinite(meters)) return null;
  const directions:Record<string,string> = {straight:'straight',forward:'forward',backward:'backward',backwards:'backward',left:'left',right:'right','आगे':'forward','सीधे':'straight','पीछे':'backward','बाएं':'left','बाएँ':'left','दाएं':'right','दाएँ':'right',aage:'forward',seedha:'straight',piche:'backward',peeche:'backward',baaye:'left',baayen:'left',daaye:'right',daayen:'right'};
  // This recognizes the requested amount, not its feasibility. The native
  // controller must still refuse invalid distances, furniture and floor bounds.
  return {kind:'relative-motion', command:`Move ${directions[english?.[1] ?? indian?.[2] ?? reversed![1]]} ${meters} meter${meters===1?'':'s'}`};
}
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
  const relative = relativeSpeech(value);
  if (relative) return relative;
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
type Dispatch = (command: string, context?: VoiceCommandContext) => Promise<VoiceCommandResult> | VoiceCommandResult;
interface Guard { turnId: string; intent: DirectSpeechCommand; receipt: Promise<VoiceCommandResult> }
const failed = (error: unknown): VoiceCommandResult => ({ completed: false, error: error instanceof Error ? error.message : 'The simulator did not acknowledge the speech control.' });

/** Coordinate the fast path and the later LLM tool, using the latest actual user turn. */
export class VoiceSpeechControlGate {
  private currentTurn: string | null = null;
  private currentTranscript: VoiceTranscript | null = null;
  private guard: Guard | null = null;
  private handledThisTurn = false;
  private toolForTurn: { intent: DirectSpeechCommand; receipt: Promise<VoiceCommandResult> } | null = null;
  constructor(private dispatch: Dispatch, private observe?: (event: SpeechControlObservation) => void, private now: () => number = Date.now) {}
  clear() { this.currentTurn = null; this.currentTranscript = null; this.guard = null; this.handledThisTurn = false; this.toolForTurn = null; }
  receive(transcript: VoiceTranscript): SpeechControlObservation | null {
    if (transcript.speaker !== 'user' || !transcript.text.trim()) return null;
    this.currentTranscript = { ...transcript };
    if (this.currentTurn !== transcript.id) {
      this.currentTurn = transcript.id; this.guard = null; this.handledThisTurn = false; this.toolForTurn = null;
    }
    const intent = directSpeechCommand(transcript.text, transcript.final);
    if (!intent) return null;
    // A newly recognized Stop must still override navigation if ASR reuses a turn.
    if (this.handledThisTurn && !(intent.kind === 'stop' && this.guard?.intent.kind !== 'stop')) return null;
    this.handledThisTurn = true;
    // If the same tool beat its final caption, reuse the actual existing invocation.
    if (this.toolForTurn?.intent.command === intent.command) {
      this.guard = { turnId: transcript.id, intent, receipt: this.toolForTurn.receipt }; return null;
    }
    const invokedAt = this.now();
    const observation = { turnId: transcript.id, command: intent.command, kind: intent.kind, receivedAt: transcript.receivedAt, invokedAt,
      dispatchDelayMs: Math.max(0, invokedAt - transcript.receivedAt) };
    // Invoke before awaiting anything: Stop does not wait on an LLM or tool callback.
    const receipt = this.invoke(intent.command, { source: 'speech-control', userTurnId: transcript.id, recognizedText: transcript.text, receivedAt: transcript.receivedAt, turnAssociation: 'exact-caption' });
    this.guard = { turnId: transcript.id, intent, receipt };
    this.observe?.(observation); return observation;
  }
  private invoke(command: string, context: VoiceCommandContext): Promise<VoiceCommandResult> {
    try { return Promise.resolve(this.dispatch(command, context)).then(receipt => receipt && typeof receipt.completed === 'boolean' ? receipt : failed('Invalid simulator receipt.'), failed); }
    catch (error) { return Promise.resolve(failed(error)); }
  }
  async executeTool(command: string, commandId?: string): Promise<VoiceCommandResult> {
    const intent = directSpeechCommand(command, true), guard = this.guard;
    if (guard) {
      if (intent?.command === guard.intent.command) {
        const receipt = await guard.receipt;
        return { ...receipt, speechControlDeduplicated: true, summary: `${receipt.summary ?? 'The recognized speech command already reached the simulator.'} This matching tool request did not execute it again.` };
      }
      // Stop can always make the simulator more conservative, even after navigation.
      if (intent?.kind !== 'stop') return { completed: false, status: 'rejected', error: guard.intent.kind === 'stop'
        ? 'The latest recognized speech requested Stop. No later movement from this turn was executed. Speak a new task to proceed.'
        : `The latest recognized speech requested ${guard.intent.kind === 'navigation' ? 'navigation only' : 'only this relative motion'}: ${guard.intent.command}. This tool request adds or changes an action, so it was not executed.` };
    }
    if (intent && this.toolForTurn?.intent.command === intent.command) return { ...await this.toolForTurn.receipt, speechControlDeduplicated: true };
    const caption = this.currentTranscript;
    const receipt = this.invoke(command, { source: 'voice-tool', ...(commandId ? { commandId } : {}), ...(caption ? { userTurnId: caption.id, recognizedText: caption.text, receivedAt: caption.receivedAt, turnAssociation: 'latest-observed-user-turn' as const } : {}) });
    if (intent) this.toolForTurn = { intent, receipt };
    return receipt;
  }
}
