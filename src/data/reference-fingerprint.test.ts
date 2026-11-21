import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { fingerprintReference, validateReferenceFingerprint } from './reference-fingerprint';

const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]);
const jpeg = `data:image/jpeg;base64,${bytes.toString('base64')}`;
test('fingerprint hashes exact submitted JPEG bytes, without filename or image payload', async () => {
  const result = await fingerprintReference(jpeg, 'image');
  assert.equal(result.sha256, createHash('sha256').update(bytes).digest('hex'));
  assert.deepEqual(result, { kind: 'image', sha256: result.sha256, calibrated: false, rightsVerified: false, basis: 'submitted-reference-frame' });
  assert.equal(validateReferenceFingerprint(result), true);
  const changed = Buffer.from(bytes); changed[4] = 4;
  assert.notEqual((await fingerprintReference(`data:image/jpeg;base64,${changed.toString('base64')}`, 'image')).sha256, result.sha256);
});
test('selected-frame provenance requires actual finite nonnegative time and retains it', async () => {
  assert.equal((await fingerprintReference(jpeg, 'selected-video-frame', 1.25)).frameTimeSeconds, 1.25);
  for (const time of [undefined, -1, NaN, Infinity]) await assert.rejects(() => fingerprintReference(jpeg, 'selected-video-frame', time));
  await assert.rejects(() => fingerprintReference(jpeg, 'image', 0));
});
test('rejects malformed, oversized or falsely claimed reference metadata', async () => {
  for (const value of ['https://example.com/photo.jpg', 'data:image/png;base64,/9j/', 'data:image/jpeg;base64,AAAA', `${jpeg}=`, `data:image/jpeg;base64,${'A'.repeat(819204)}`]) await assert.rejects(() => fingerprintReference(value, 'image'));
  const valid = await fingerprintReference(jpeg, 'image');
  for (const patch of [{ calibrated: true }, { rightsVerified: true }, { sha256: 'fake' }, { filename: 'private.jpg' }, { kind: 'video' }, { basis: 'original-video' }]) assert.equal(validateReferenceFingerprint({ ...valid, ...patch }), false);
});
