import { RobotScene } from './RobotScene';
import { useEffect, useRef, useState } from 'react';
import { Camera, Check, Loader2, Sparkles, Upload, X } from 'lucide-react';
import type { EnvironmentSpec } from './ScenarioStudio';
import { worldFromSceneSpec } from '../sim/scene-spec';
import { fingerprintReference } from '../data/reference-fingerprint';
import './AiSceneComposer.css';

type Props = { initialPrompt?: string; preparedDraft?: EnvironmentSpec | null; onApply: (draft: EnvironmentSpec) => void; onDraft?: (draft: EnvironmentSpec | null) => void };
export default function AiSceneComposer({ initialPrompt, preparedDraft, onApply, onDraft }: Props) {
  const [prompt, setPrompt] = useState(initialPrompt || 'Create a kitchen counter with two cups for the serving tray and a bowl for storage.');
  const [base, setBase] = useState<'workbench' | 'kitchen' | 'lab'>('kitchen');
  const [draft, setDraft] = useState<EnvironmentSpec | null>(preparedDraft ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<{ dataUrl: string; kind: 'image' | 'selected-video-frame'; frameTimeSeconds?: number } | null>(null);
  const [referenceLoading, setReferenceLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [referenceName, setReferenceName] = useState('');
  const [duration, setDuration] = useState(0);
  const video = useRef<HTMLVideoElement>(null);
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const loadingRef = useRef(false);
  const referenceGeneration = useRef(0);
  useEffect(() => { if (preparedDraft) setDraft(preparedDraft); }, [preparedDraft]);
  useEffect(() => () => { request.current?.abort(); }, []);
  useEffect(() => () => { if (videoUrl) URL.revokeObjectURL(videoUrl); }, [videoUrl]);
  const clearDraft = () => { generation.current++; request.current?.abort(); setDraft(null); onDraft?.(null); setError(null); };
  const frame = (source: CanvasImageSource, width: number, height: number, kind: 'image' | 'selected-video-frame' = 'image', frameTimeSeconds?: number) => {
    if (!width || !height) throw new Error('The reference frame is not ready.');
    const canvas = document.createElement('canvas'); const scale = Math.min(1, 1024 / Math.max(width, height));
    canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale);
    const context = canvas.getContext('2d'); if (!context) throw new Error('Image preview is unavailable.');
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    let data = canvas.toDataURL('image/jpeg', 0.72);
    if (data.length > 800000) data = canvas.toDataURL('image/jpeg', 0.45);
    if (data.length > 800000) throw new Error('Choose a smaller or simpler reference frame.');
    setReference({ dataUrl: data, kind, ...(frameTimeSeconds !== undefined ? { frameTimeSeconds } : {}) }); clearDraft();
  };
  const loadReference = async (file?: File) => {
    if (!file) return;
    clearDraft(); setReference(null); setVideoUrl(null); setReferenceName(file.name); setDuration(0); setReferenceLoading(true);
    const operation = generation.current;
    const referenceOperation = ++referenceGeneration.current;
    try {
      if (file.size > 50 * 1024 * 1024) throw new Error('Choose a reference file of at most 50 MiB.');
      if (file.type.startsWith('video/')) { setVideoUrl(URL.createObjectURL(file)); return; }
      if (!file.type.startsWith('image/')) throw new Error('Choose an image or a local video.');
      const image = await createImageBitmap(file);
      try { if (operation === generation.current) frame(image, image.width, image.height); } finally { image.close(); }
    } catch (cause) { if (operation === generation.current) setError(cause instanceof Error ? cause.message : 'Reference could not be opened.'); }
    finally { if (referenceOperation === referenceGeneration.current) setReferenceLoading(false); }
  };
  const generate = async () => {
    if (loadingRef.current || referenceLoading || !prompt.trim() || (videoUrl && !reference)) return;
    const frozenReference = reference ? { ...reference } : null;
    const frozenPrompt = prompt.trim(), frozenBase = base;
    loadingRef.current = true; setLoading(true); clearDraft();
    const operation = generation.current;
    const controller = new AbortController(); request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 35000);
    try {
      const fingerprint = frozenReference ? await fingerprintReference(frozenReference.dataUrl, frozenReference.kind, frozenReference.frameTimeSeconds) : undefined;
      if (operation !== generation.current || controller.signal.aborted) return;
      const response = await fetch('/api/scenes/draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ prompt: frozenPrompt, baseEnvironmentId: frozenBase, ...(frozenReference ? { referenceImage: frozenReference.dataUrl } : {}) }) });
      const result = await response.json();
      if (operation !== generation.current) return;
      if (!response.ok) throw new Error(result.error || 'Scene generation could not finish.');
      const world = worldFromSceneSpec(result.spec, { prompt: frozenPrompt, model: result.model, ...(fingerprint ? { reference: fingerprint } : {}) });
      const next: EnvironmentSpec = { id: 'custom', name: world.customTask!.title, world, instruction: world.customTask!.instruction };
      setDraft(next); onDraft?.(next);
    } catch (cause) { if (operation === generation.current) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Scene generation failed.'); else setError('Scene generation was cancelled or timed out.'); } }
    finally { clearTimeout(timeout); request.current = null; loadingRef.current = false; setLoading(false); }
  };
  return <div className="ai-scene-composer">
    <p className="scene-scope">Describe a supported scene, optionally using a photo or a selected video frame. The model proposes objects and goals; the application assigns validated slots and requires your approval.</p>
    <div className="scene-composer-fields"><label>Workplace template<select aria-label="AI scene workplace" value={base} onChange={event => { setBase(event.target.value as typeof base); clearDraft(); }}><option value="workbench">Repair workbench</option><option value="kitchen">Kitchen counter</option><option value="lab">Sample lab</option></select></label><label>Task and scene<textarea aria-label="AI scene description" rows={3} maxLength={1500} value={prompt} onChange={event => { setPrompt(event.target.value); clearDraft(); }}/></label></div>
    <div className="reference-controls"><label className="button button-secondary"><Upload size={13}/> Add photo / video<input type="file" accept="image/*,video/*" aria-label="Scene reference file" onChange={event => { void loadReference(event.target.files?.[0]); event.target.value = ''; }} hidden/></label>{(reference || videoUrl) && <button className="text-button" onClick={() => { setReference(null); setVideoUrl(null); setReferenceName(''); setReferenceLoading(false); clearDraft(); }}><X size={12}/> Remove reference</button>}<span>{referenceName || 'Reference stays local until you generate a draft.'}</span></div>
    {videoUrl && <div className="video-reference"><video ref={video} src={videoUrl} controls preload="metadata" onLoadedMetadata={() => setDuration(video.current?.duration ?? 0)}/><div><span>Choose a clear frame using playback controls{duration > 0 && ` · ${duration.toFixed(1)}s`}</span><button className="button button-secondary" onClick={() => { const item = video.current; if (!item) return; try { item.pause(); frame(item, item.videoWidth, item.videoHeight, 'selected-video-frame', item.currentTime); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Frame not ready.'); } }}><Camera size={13}/> Use this frame</button></div></div>}
    {reference && !draft && <div className="scene-reference-preview"><img src={reference.dataUrl} alt="Selected scene reference frame"/><p>This frame is sent to the configured model when you generate. Layout uses supported slots; scale, contact physics and human motion are not reconstructed.</p></div>}
    <div className="scene-ai-actions"><button className="button button-primary" disabled={loading || referenceLoading || !prompt.trim() || Boolean(videoUrl && !reference)} onClick={() => { void generate(); }}>{loading ? <Loader2 size={14} className="spin"/> : <Sparkles size={14}/>} {loading ? 'Drafting supported scene…' : reference ? 'Generate with reference frame' : 'Generate AI scene draft'}</button>{loading && <button className="text-button" onClick={() => request.current?.abort()}>Cancel</button>}</div>
    {error && <p className="scene-generation-error" role="alert">{error}</p>}
    {draft && <div className="scene-draft"><div className="scene-comparison">{reference && <figure><img src={reference.dataUrl} alt="Uploaded scene reference"/><figcaption>{draft.world.sceneProvenance?.reference?.kind === 'selected-video-frame' ? 'Selected video frame' : 'Photo reference'} · scale is not calibrated</figcaption></figure>}<figure><div className="scene-generated-preview" style={{ position: 'relative', overflow: 'hidden' }}><RobotScene world={draft.world} selectedId={null} onSelect={() => {}} view="perspective" showGrid={false} showPath={false}/></div><figcaption>Proposed scene · validated object slots</figcaption></figure></div><div><Check size={15}/><strong>Validated draft · {draft.name}</strong></div><p>{draft.instruction}</p><ul>{draft.world.objects.map(object => { const target = draft.world.customTask?.assignments.find(item => item.objectId === object.id); return <li key={object.id}><Check size={11}/>{object.label} → {target?.unchanged ? 'unchanged reference' : draft.world.destinationLabels?.[target?.destination ?? 'table']}</li>; })}</ul><p className="fine-print">{draft.world.sceneProvenance?.reference && <>Reference SHA-256 <code>{draft.world.sceneProvenance.reference.sha256.slice(0, 16)}</code> · {draft.world.sceneProvenance.reference.kind === 'selected-video-frame' ? `Selected video frame at ${draft.world.sceneProvenance.reference.frameTimeSeconds?.toFixed(2)}s` : 'Photo'} · Uncalibrated · Rights not verified. Fingerprint identifies the submitted resized JPEG only; no video motion or 3D reconstruction. </>}{draft.world.objects.length} supported objects · Fixed rigid-object assets · Idealized kinematic grasps</p><button className="button button-primary" onClick={() => onApply(draft)}>Approve & apply AI scene</button></div>}
  </div>;
}
