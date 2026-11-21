import type { WorldState } from '../sim/engine';

export type ReferenceFingerprint = NonNullable<NonNullable<WorldState['sceneProvenance']>['reference']>;

/** Metadata identifies only the submitted resized JPEG, never the original file or video. */
export function validateReferenceFingerprint(value: unknown): value is ReferenceFingerprint {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return Object.keys(item).every(key => ['kind', 'sha256', 'frameTimeSeconds', 'calibrated', 'rightsVerified', 'basis'].includes(key))
    && ['image', 'selected-video-frame'].includes(String(item.kind))
    && typeof item.sha256 === 'string' && /^[a-f0-9]{64}$/.test(item.sha256)
    && item.calibrated === false && item.rightsVerified === false && item.basis === 'submitted-reference-frame'
    && (item.kind === 'image' ? item.frameTimeSeconds === undefined
      : typeof item.frameTimeSeconds === 'number' && Number.isFinite(item.frameTimeSeconds) && item.frameTimeSeconds >= 0);
}

export async function fingerprintReference(jpeg: string, kind: ReferenceFingerprint['kind'], frameTimeSeconds?: number): Promise<ReferenceFingerprint> {
  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(jpeg);
  if (!match || match[1].length % 4 !== 0 || match[1].length > 819200) throw new Error('The submitted reference must be a bounded JPEG data URL.');
  let binary: string;
  try { binary = atob(match[1]); } catch { throw new Error('The submitted reference JPEG encoding is invalid.'); }
  if (!binary.length || binary.length > 600 * 1024 || btoa(binary) !== match[1]) throw new Error('The submitted reference JPEG encoding is invalid or too large.');
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) throw new Error('The submitted reference must contain JPEG bytes.');
  const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
  const result = { kind, sha256, ...(frameTimeSeconds !== undefined ? { frameTimeSeconds } : {}), calibrated: false, rightsVerified: false, basis: 'submitted-reference-frame' } as ReferenceFingerprint;
  if (!validateReferenceFingerprint(result)) throw new Error('A video reference needs a finite nonnegative selected-frame time; images must omit it.');
  return result;
}
