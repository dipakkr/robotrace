import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { ArrowUpFromLine, Check, FileJson, FolderOpen, HardDrive, Loader2, RefreshCw, ShieldCheck, TriangleAlert } from 'lucide-react';
import { buildEvidencePackage, validateEvidencePackage, verifyEvidencePackage } from '../data/evidence';
import type { EvidenceEpisode, EvidencePackage } from '../data/evidence';
import './EpisodeLibrary.css';

export interface EpisodeLibraryProps {
  onLoad: (episode: EvidenceEpisode & { savedId?: string }) => void;
}
interface SavedEpisode { id: string; title: string; savedAt: string }
const maxBytes = 10 * 1024 * 1024;
const uuid = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const describeValidation = (errors: string[]) => errors.slice(0, 3).join(' ').slice(0, 420);

async function readJson(response: Response): Promise<unknown> {
  if (!response.ok) throw new Error(response.status === 404 ? 'The saved episode is no longer available on this server.' : `The local episode service returned HTTP ${response.status}.`);
  if (Number(response.headers.get('content-length')) > maxBytes) { await response.body?.cancel(); throw new Error('This record exceeds the 10 MB viewer limit.'); }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('The local episode service returned an empty response.');
  const decoder = new TextDecoder();
  let text = '', size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new Error('This record exceeds the 10 MB viewer limit.'); }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
  } finally { reader.releaseLock(); }
  try { return JSON.parse(text); }
  catch { throw new Error('The local episode service did not return supported JSON.'); }
}

/** Keep external/local storage links separate from recorded review and outcome fields. */
function withoutStorageLinks(source: EvidenceEpisode): EvidenceEpisode {
  const copy = structuredClone(source) as EvidenceEpisode & { savedId?: unknown; reportId?: unknown };
  delete copy.savedId;
  delete copy.reportId;
  return copy;
}

export default function EpisodeLibrary({ onLoad }: EpisodeLibraryProps) {
  const [episodes, setEpisodes] = useState<SavedEpisode[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [listReady, setListReady] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState('Choose a saved episode or import a sealed native package.');
  const alive = useRef(true);
  const listRequest = useRef<AbortController | null>(null);
  const loadRequest = useRef<AbortController | null>(null);
  const operation = useRef<string | null>(null);
  const generation = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    listRequest.current?.abort();
    const controller = new AbortController();
    listRequest.current = controller;
    setRefreshing(true); setListError(null);
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const payload = await readJson(await fetch('/api/episodes', { signal: controller.signal, cache: 'no-store' }));
      if (!record(payload) || !Array.isArray(payload.episodes) || !payload.episodes.every(item => record(item)
        && typeof item.id === 'string' && uuid.test(item.id) && typeof item.title === 'string'
        && typeof item.savedAt === 'string' && Number.isFinite(Date.parse(item.savedAt)))) {
        throw new Error('The saved collection contains unsupported metadata. Refresh after checking the local episode service.');
      }
      if (!alive.current || listRequest.current !== controller) return;
      setEpisodes((payload.episodes as SavedEpisode[]).map(item => ({ id: item.id, title: item.title, savedAt: item.savedAt }))
        .sort((left, right) => Date.parse(right.savedAt) - Date.parse(left.savedAt)));
      setListReady(true);
    } catch (error) {
      if (alive.current && listRequest.current === controller) setListError(controller.signal.aborted
        ? 'The local episode service did not respond in time. Refresh to retry.'
        : error instanceof TypeError ? 'The local episode service is unavailable. You can still import a native package.'
          : error instanceof Error ? error.message : 'The local episode service is unavailable. You can still import a native package.');
    } finally {
      clearTimeout(timeout);
      if (alive.current && listRequest.current === controller) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    void refresh();
    return () => {
      alive.current = false; generation.current++;
      listRequest.current?.abort(); loadRequest.current?.abort();
    };
  }, [refresh]);

  const loadSaved = async (entry: SavedEpisode) => {
    if (operation.current) return;
    operation.current = entry.id;
    const attempt = ++generation.current;
    const controller = new AbortController(); loadRequest.current = controller;
    setBusyId(entry.id); setActionError(null); setMessage('Checking the saved native episode…');
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const payload = await readJson(await fetch(`/api/episodes/${encodeURIComponent(entry.id)}`, { signal: controller.signal, cache: 'no-store' }));
      if (!record(payload) || payload.id !== entry.id || !record(payload.episode)) throw new Error('The saved response does not match the selected episode record.');
      const candidate = buildEvidencePackage(payload.episode as unknown as EvidenceEpisode);
      const validation = validateEvidencePackage(candidate);
      if (!validation.valid) throw new Error(`This saved record cannot be replayed: ${describeValidation(validation.errors)}`);
      if (!alive.current || generation.current !== attempt) return;
      setMessage(`Loaded server record. Recorded outcome: ${candidate.episode.outcome}; review: ${candidate.episode.status}.`);
      onLoad({ ...withoutStorageLinks(candidate.episode), savedId: entry.id });
    } catch (error) {
      if (alive.current && generation.current === attempt) {
        setActionError(controller.signal.aborted ? 'Loading timed out. Select the episode again to retry.'
          : error instanceof TypeError ? 'The local episode service is unavailable. Retry loading after it reconnects.'
            : error instanceof Error ? error.message.slice(0, 450) : 'This legacy or unsupported record could not be loaded.');
        setMessage('The selected episode was not loaded.');
      }
    } finally {
      clearTimeout(timeout);
      if (generation.current === attempt) { operation.current = null; if (alive.current) setBusyId(null); }
    }
  };

  const importPackage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file || operation.current) return;
    operation.current = 'import';
    const attempt = ++generation.current;
    setBusyId('import'); setActionError(null); setMessage('Verifying the native package and its SHA-256 digest…');
    try {
      if (file.size > maxBytes) throw new Error('Choose a native evidence package smaller than 10 MB.');
      let payload: unknown;
      try { payload = JSON.parse(await file.text()); }
      catch { throw new Error('The selected file is not valid JSON. Choose a sealed .teachtrace.json evidence package.'); }
      if (!alive.current || generation.current !== attempt) return;
      const validation = await verifyEvidencePackage(payload);
      if (!validation.valid) throw new Error(`Package not imported. ${describeValidation(validation.errors)}`);
      if (!alive.current || generation.current !== attempt) return;
      const evidence = payload as EvidencePackage;
      setMessage(`Imported native package. Recorded outcome: ${evidence.episode.outcome}; review: ${evidence.episode.status}. Nothing was saved to the server.`);
      onLoad({ ...withoutStorageLinks(evidence.episode) });
    } catch (error) {
      if (alive.current && generation.current === attempt) {
        setActionError(error instanceof Error ? error.message.slice(0, 450) : 'The native package could not be verified.');
        setMessage('The selected package was not imported.');
      }
    } finally {
      if (generation.current === attempt) { operation.current = null; if (alive.current) setBusyId(null); }
    }
  };

  return <section className="episode-library" aria-labelledby="episode-library-title">
    <div className="modal-symbol" aria-hidden="true"><FolderOpen size={24}/></div>
    <span className="eyebrow">COLLECTION RECORDS</span>
    <h2 id="episode-library-title">Reopen the evidence.</h2>
    <p className="library-intro">Inspect a recording saved by this local API, or verify an exported native package before loading its replay.</p>

    <div className="library-section-heading"><div><HardDrive size={15}/><h3>Saved on this server</h3><span>{listReady ? episodes.length : '—'}</span></div>
      <button type="button" className="library-button" onClick={() => void refresh()} disabled={refreshing}><RefreshCw size={13} className={refreshing ? 'spin' : ''}/>{refreshing ? 'Refreshing…' : 'Refresh'}</button>
    </div>
    <p className="library-note">Local server storage. The latest records returned by this API appear first.</p>
    {listError && <div className="library-error" role="alert"><TriangleAlert size={15}/><p>{listError}</p></div>}
    <div className="library-records" aria-busy={refreshing}>
      {!listReady && refreshing && <p className="library-empty"><Loader2 size={17} className="spin"/> Reading saved records…</p>}
      {listReady && episodes.length === 0 && <p className="library-empty"><FileJson size={19}/>No saved episodes yet. Submit a reviewed recording from the workcell to add one.</p>}
      {episodes.map(entry => <article className="library-record" key={entry.id}>
        <div className="library-record-copy"><strong>{entry.title || 'Recorded episode'}</strong><span>{new Date(entry.savedAt).toLocaleString()}<i/>Server saved</span><code>{entry.id}</code></div>
        <button type="button" className="library-button" disabled={busyId !== null} onClick={() => void loadSaved(entry)} aria-label={`Load and inspect ${entry.title || 'recorded episode'}`}>
          {busyId === entry.id ? <Loader2 size={13} className="spin"/> : <FolderOpen size={13}/>}{busyId === entry.id ? 'Checking…' : 'Load and inspect'}
        </button>
      </article>)}
    </div>

    <div className="library-import"><div><ArrowUpFromLine size={18}/><h3>Import a native package</h3></div>
      <p>Choose a sealed <code>.teachtrace.json</code> file, up to 10 MB. Its content and SHA-256 digest must verify. Recorded review status and outcome stay unchanged.</p>
      <input ref={fileInput} type="file" accept=".json,application/json" className="sr-only" tabIndex={-1} aria-label="Native evidence package" onChange={event => void importPackage(event)} disabled={busyId !== null}/>
      <button type="button" className="library-button library-button-primary" disabled={busyId !== null} onClick={() => fileInput.current?.click()}>{busyId === 'import' ? <Loader2 size={14} className="spin"/> : <FileJson size={14}/>} {busyId === 'import' ? 'Verifying package…' : 'Choose native package'}</button>
      <span className="library-import-note"><Check size={12}/> Imports open locally. No server record or service-report approval is created.</span>
    </div>
    {actionError && <div className="library-error" role="alert"><TriangleAlert size={15}/><p>{actionError}</p></div>}
    <p className="library-status" role="status" aria-live="polite">{message}</p>
    <p className="library-boundary"><ShieldCheck size={14}/><span>Integrity checks detect content changes; they do not authenticate an author or validate physical robot performance. Imported server/report links are not trusted.</span></p>
  </section>;
}
