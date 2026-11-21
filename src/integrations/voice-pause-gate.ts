import type { VoiceTranscript } from './voice-captions';

/** Paused voice never buffers commands for a later resume. */
export class VoicePauseCommandGate {
  paused = false;
  private awaitingFreshSpeech = false;
  private turns = new Set<string>();
  setPaused(paused: boolean) {
    if (paused === this.paused) return;
    this.paused = paused;
    if (!paused) this.awaitingFreshSpeech = true;
  }
  observe(transcript: VoiceTranscript) {
    if (transcript.speaker !== 'user' || !transcript.text.trim()) return;
    const fresh = !this.turns.has(transcript.id);
    this.turns.add(transcript.id);
    if (this.turns.size > 200) this.turns.delete(this.turns.values().next().value!);
    if (!this.paused && fresh) this.awaitingFreshSpeech = false;
  }
  blockReason(command: string): string | null {
    if (/^(?:stop|pause)[.!]*$/i.test(command.trim())) return null;
    if (this.paused) return 'The voice session is paused. This command was discarded, not queued. Resume and speak a new instruction.';
    if (this.awaitingFreshSpeech) return 'This command arrived after a voice pause without new user speech. It was discarded; speak a fresh instruction.';
    return null;
  }
  clear() { this.paused = false; this.awaitingFreshSpeech = false; this.turns.clear(); }
}
