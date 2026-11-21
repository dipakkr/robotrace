import { useMemo, useState } from 'react';
import { buildPhysicalEvaluationReport } from '../data/physical-evaluation-report';
import type { VoiceExperiment, VoiceExperimentReport } from '../data/voice-experiment';
import type { MobilePoint } from '../sim/mobile-navigation';
import './PhysicalEvaluationOverview.css';

export default function PhysicalEvaluationOverview({ experiment, savedReport }: { experiment: VoiceExperiment; savedReport: VoiceExperimentReport }) {
  const report = useMemo(() => buildPhysicalEvaluationReport(experiment, savedReport), [experiment, savedReport]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const attempt = report.attempts[Math.min(selectedIndex, report.attempts.length - 1)];
  if (!attempt) return <section className="physical-overview"><h3>Route evidence</h3><p>No native movement attempt was recorded. The evaluation report retains refusals and requests without inventing a robot route.</p></section>;
  const route = attempt.routes, b = route.bounds;
  const width = b.maxX - b.minX, depth = b.maxZ - b.minZ;
  const scale = Math.min(280 / width, 190 / depth);
  const ox = (320 - width * scale) / 2, oz = (220 - depth * scale) / 2;
  const x = (v: number) => ox + (v - b.minX) * scale, z = (v: number) => oz + (v - b.minZ) * scale;
  const points = (path: MobilePoint[]) => path.map(p => `${x(p[0])},${z(p[1])}`).join(' ');
  return <section className="physical-overview" aria-label="Physical AI route evaluation">
    <header><div><span>ROBOTICS EVALUATION · SIMULATED TASK BEHAVIOR</span><h3>Planned route versus recorded motion</h3></div><span className="physical-review-label">Unreviewed evidence</span></header>
    <p>Inspect the actual run before sharing its evaluation. Path length alone does not establish safety or optimal routing.</p>
    <div className="physical-route-picker" role="group" aria-label="Choose recorded route">{report.attempts.map((item, i) => <button key={item.id} aria-pressed={selectedIndex === i} onClick={() => setSelectedIndex(i)}>{i + 1}. {item.command}</button>)}</div>
    <div className="physical-route-evidence"><div>
      <svg viewBox="0 0 320 220" role="img" aria-label={`Planned and recorded route for ${attempt.command}`}>
        <rect x={ox} y={oz} width={width * scale} height={depth * scale} fill="#111711" stroke="#434d40"/>
        {route.obstacles.map(o => <rect key={o.id} x={x(o.minX)} y={z(o.minZ)} width={(o.maxX - o.minX) * scale} height={(o.maxZ - o.minZ) * scale} fill="#394036"><title>{o.label ?? o.id}</title></rect>)}
        {route.humanPositions.map((person, i) => <circle key={i} cx={x(person.position[0])} cy={z(person.position[1])} r={person.radius * scale} fill="#c9a366" fillOpacity="0.14" stroke="#c9a366" strokeOpacity="0.45"><title>Person proxy at {person.timeSeconds.toFixed(2)} simulated seconds; not simultaneous occupancy</title></circle>)}
        {route.plannedSegments.map((segment, i) => <polyline key={i} points={points(segment.path)} fill="none" stroke="#d9b382" strokeWidth="2" strokeDasharray="5 4"/>)}
        <polyline points={points(route.actual)} fill="none" stroke="#a5d2a3" strokeWidth="2.5"/>
        <circle cx={x(route.start[0])} cy={z(route.start[1])} r="4" fill="#a5d2a3"/><circle cx={x(route.end[0])} cy={z(route.end[1])} r="4" fill="#e9ece2" stroke="#172017"/>
      </svg><div className="physical-route-legend"><span>— Recorded positions</span><span>┄ Initial declared plan</span><span>○ Person proxy samples</span></div>
    </div><dl>
      <div><dt>Declared plan length</dt><dd>{attempt.metrics.plannedLengthMeters.toFixed(2)} m</dd></div>
      <div><dt>Controller travel</dt><dd>{attempt.metrics.actualTravelMeters.toFixed(2)} m</dd></div>
      <div><dt>Net displacement</dt><dd>{attempt.metrics.netDisplacementMeters.toFixed(2)} m</dd></div>
      <div><dt>Simulated duration</dt><dd>{attempt.metrics.durationSeconds.toFixed(2)} s</dd></div>
      <div><dt>Recorded states</dt><dd>{attempt.metrics.sampleCount}</dd></div>
      <div><dt>Route changes</dt><dd>{attempt.routeAssessment.reroutes}</dd></div>
      <div><dt>Native task checks</dt><dd>{attempt.taskAccepted ? 'Passed' : 'Not accepted'}</dd></div>
    </dl></div>
    {attempt.routeAssessment.notes.map((note, i) => <p className="physical-route-note" key={i}>{note}</p>)}
    <small>Floor X/Z in metres. Person markers are recorded at different times. Request-level success is evaluated separately below. These are analytic simulator traces, not measured motors or physical deployment certification.</small>
  </section>;
}
