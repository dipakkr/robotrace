export interface VoiceCommandContext {
  source: 'speech-control' | 'voice-tool'; userTurnId?: string; recognizedText?: string;
  receivedAt?: number; commandId?: string;
  /** Tool callbacks lack an LLM turn link; their latest observed caption is context only. */
  turnAssociation?: 'exact-caption' | 'latest-observed-user-turn';
}
