import { useMemo, useState } from 'react';
import type { VoiceExperiment } from '../data/voice-experiment';
import type { MobileWorld } from '../sim/mobile-navigation';
import { solveMobileArm } from '../sim/mobile-arm';

/** Reads saved samples only. Scrubbing never changes the live controller. */
export default function ExperimentTrajectory({ experiment }: { experiment: VoiceExperiment }) {
  const samples = useMemo(() => experiment.events.filter(event => event.type === 'world-sample' && event.data.world).map(event => ({ at: event.at, world: event.data.world as MobileWorld })), [experiment]);
  const [index, setIndex] = useState(0);
  if (!samples.length) return null;
  const selected = samples[Math.min(index, samples.length - 1)], world = selected.world;
  const bounds = experiment.initialWorld.bounds;
  const px = (value: number) => 12 + (value - bounds.minX) / (bounds.maxX - bounds.minX) * 276;
  const pz = (value: number) => 12 + (value - bounds.minZ) / (bounds.maxZ - bounds.minZ) * 176;
  const duration = Math.max(1, experiment.endedAt - experiment.startedAt);
  const baseline = experiment.initialWorld.distanceTravelled;
  const maxDistance = Math.max(1, ...samples.map(sample => sample.world.distanceTravelled - baseline));
  const tx = (at: number) => 30 + (at - experiment.startedAt) / duration * 440;
  const dy = (distance: number) => 175 - distance / maxDistance * 145;
  const path = samples.map(sample => `${px(sample.world.robot.position[0])},${pz(sample.world.robot.position[1])}`).join(' ');
  const distancePath = samples.map(sample => `${tx(sample.at)},${dy(sample.world.distanceTravelled - baseline)}`).join(' ');
  const arm = solveMobileArm(world);
  return <section className="experiment-trajectory" aria-label="Recorded coordinates and trajectory">
    <h3>Recorded motion · {samples.length} actual state samples</h3>
    <p>Scrub the saved coordinates. The floor plot shows the sampled route; distance is cumulative base travel since this session started.</p>
    <div className="experiment-plots"><svg viewBox="0 0 300 200" role="img" aria-label="Recorded robot floor trajectory">
      {world.obstacles.map(obstacle => <rect key={obstacle.id} x={px(obstacle.minX)} y={pz(obstacle.minZ)} width={px(obstacle.maxX) - px(obstacle.minX)} height={pz(obstacle.maxZ) - pz(obstacle.minZ)} fill="#363936"/>)}
      <polyline points={path} fill="none" stroke="#a5c7a4" strokeWidth="2"/>
      {world.human && <ellipse cx={px(world.human.position[0])} cy={pz(world.human.position[1])} rx={world.human.radius / (bounds.maxX-bounds.minX)*276} ry={world.human.radius / (bounds.maxZ-bounds.minZ)*176} fill="#c5a46b"><title>Recorded person proxy</title></ellipse>}
      <circle cx={px(world.robot.position[0])} cy={pz(world.robot.position[1])} r="4" fill="#f09b63"/>
      <text x="12" y="198">World X / Z · metres</text>
    </svg><svg viewBox="0 0 500 200" role="img" aria-label="Actual cumulative travel over session time">
      <path d="M30 20V175H475" stroke="#555" fill="none"/>
      <polyline points={distancePath} fill="none" stroke="#a5c7a4" strokeWidth="2"/>
      <path d={`M${tx(selected.at)} 20V175`} stroke="#f09b63" strokeDasharray="4 3"/>
      <text x="3" y="27">{maxDistance.toFixed(1)}m</text><text x="9" y="177">0</text>
      <text x="30" y="198">0 s</text><text x="420" y="198">{(duration / 1000).toFixed(1)} s</text>
    </svg></div>
    <input type="range" aria-label="Seek recorded coordinates" min="0" max={samples.length - 1} value={Math.min(index, samples.length - 1)} onChange={event => setIndex(Number(event.target.value))}/>
    <dl><div><dt>Session time</dt><dd>+{((selected.at - experiment.startedAt) / 1000).toFixed(2)} s</dd></div><div><dt>Recorded state</dt><dd>{world.robot.mode} · {world.robot.phase}</dd></div><div><dt>Base X / Z</dt><dd>{world.robot.position.map(value => value.toFixed(3)).join(' / ')} m</dd></div><div><dt>Yaw</dt><dd>{world.robot.yaw.toFixed(3)} rad</dd></div><div><dt>Cumulative travel</dt><dd>{(world.distanceTravelled - baseline).toFixed(3)} m</dd></div><div><dt>Analytic TCP X / Y / Z</dt><dd>{arm.objectTCP.map(value => value.toFixed(3)).join(' / ')}</dd></div></dl>
    <small>Known-map simulated coordinates and analytic arm pose; no measured hardware telemetry. Obstacle outlines and the person marker use the selected recorded sample. Scrubbing does not change the live environment.</small>
  </section>;
}
