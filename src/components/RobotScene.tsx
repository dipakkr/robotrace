import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Billboard, ContactShadows, Edges, Line, OrbitControls, RoundedBox, Text } from '@react-three/drei';
import { Color, PerspectiveCamera, Quaternion, Vector2, Vector3 } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { ARM_BASE, DESTINATIONS, solveArmIK, TABLE_TOP } from '../sim/engine';
import type { SceneObject, Vec3, WorldState } from '../sim/engine';
import { EnvironmentBackdrop } from './EnvironmentBackdrop';
import { HumanPresenceProxy } from './HumanPresenceProxy';
import { ENVIRONMENTS } from '../sim/environments';
import './RobotScene.css';

export interface RobotSceneProps {
  world: WorldState;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  view: 'perspective' | 'top' | 'robot';
  showGrid: boolean;
  showPath: boolean;
  targetPosition?: Vec3;
  onReady?: () => void;
}

function CameraRig({ view, onReady, humanPresent = false }: Pick<RobotSceneProps, 'view' | 'onReady'> & { humanPresent?: boolean }) {
  const { camera, gl, invalidate, size } = useThree();
  const controls = useRef<OrbitControlsImpl>(null);
  useEffect(() => {
    const target = new Vector3(0, view === 'top' ? 0.85 : 1.45, 0);
    const direction = new Vector3(...(view === 'top' ? [0, 1, 0.001] : view === 'robot' ? [-0.65, 0.35, 1] : [0.12, 0.28, 1]) as Vec3).normalize();
    camera.position.copy(target).add(direction);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    if (camera instanceof PerspectiveCamera) {
      camera.fov = 38;
      camera.aspect = Math.max(0.4, size.width / Math.max(1, size.height));
      camera.updateProjectionMatrix();
      const right = new Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
      const up = new Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
      const tangent = Math.tan(camera.fov * Math.PI / 360);
      const bounds = view === 'top'
        ? [-2.25, 2.25].flatMap(x => [-1.45, 1.45].map(z => new Vector3(x, TABLE_TOP, z)))
        : [
          ...[-2.18, 2.18].flatMap(x => [-1.4, 1.4].map(z => new Vector3(x, 0.7, z))),
          new Vector3(-2.4, 2.78, 0.4),
          new Vector3(-1.47, 2.92, 0.32),
          new Vector3(1.5, 2.1, -0.8),
        ];
      if (humanPresent) bounds.push(new Vector3(0.6, 1.9, 2.15), new Vector3(0.6, 0, 2.15));
      let distance = 2.8;
      for (const point of bounds) {
        const offset = point.sub(target);
        distance = Math.max(distance,
          offset.dot(direction) + Math.abs(offset.dot(right)) / (tangent * camera.aspect * 0.9),
          offset.dot(direction) + Math.abs(offset.dot(up)) / (tangent * 0.91));
      }
      camera.position.copy(target).addScaledVector(direction, distance);
    }
    camera.lookAt(target);
    if (controls.current) { controls.current.target.copy(target); controls.current.update(); }
    invalidate();
  }, [view, camera, invalidate, size.width, size.height, humanPresent]);
  useEffect(() => {
    gl.domElement.setAttribute('aria-label', 'Interactive 3D robot workcell. Use the scene-object buttons to select parts.');
    onReady?.();
  }, [gl, onReady]);
  return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.12} minDistance={2.8} maxDistance={10} maxPolarAngle={Math.PI / 2.05} enableRotate={view !== 'top'} />;
}

function Link({ a, b, radius = 0.1, color = '#ee793e' }: { a: Vec3; b: Vec3; radius?: number; color?: string }) {
  const { position, quaternion, length } = useMemo(() => {
    const start = new Vector3(...a), end = new Vector3(...b);
    const direction = end.clone().sub(start);
    return { position: start.add(end).multiplyScalar(0.5), quaternion: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.clone().normalize()), length: direction.length() };
  }, [a[0], a[1], a[2], b[0], b[1], b[2]]);
  return <mesh position={position} quaternion={quaternion} castShadow receiveShadow>
    <cylinderGeometry args={[radius * 0.8, radius, length, 20]} />
    <meshStandardMaterial color={color} metalness={0.52} roughness={0.31} />
  </mesh>;
}

function Joint({ position, radius = 0.14, yaw = 0 }: { position: Vec3; radius?: number; yaw?: number }) {
  return <group position={position} rotation={[0, yaw, Math.PI / 2]}>
    <mesh castShadow>
      <cylinderGeometry args={[radius, radius, radius * 1.6, 28]} />
      <meshStandardMaterial color="#343b41" metalness={0.75} roughness={0.28} />
    </mesh>
    <mesh position={[0, radius * 0.82, 0]}>
      <cylinderGeometry args={[radius * 0.7, radius * 0.7, 0.012, 24]} />
      <meshStandardMaterial color="#aeb4b7" metalness={0.9} roughness={0.23} />
    </mesh>
    <mesh position={[0, radius * 0.85 + 0.01, 0]}>
      <cylinderGeometry args={[radius * 0.23, radius * 0.23, 0.014, 12]} />
      <meshStandardMaterial color="#5c646a" metalness={0.85} roughness={0.3} />
    </mesh>
  </group>;
}

function Robot({ world }: { world: WorldState }) {
  const ik = solveArmIK(world.robot.position);
  const tcp = world.robot.position;
  const activeObject = world.objects.find(object => object.id === (world.robot.heldObjectId ?? world.motion?.objectId));
  const closedGap = activeObject ? activeObject.size[0] / 2 + 0.018 : 0.145;
  const open = closedGap + world.robot.gripperOpen * 0.065;
  const cableStart: Vec3 = [ARM_BASE[0] - 0.08, ARM_BASE[1] + 0.1, ARM_BASE[2] + 0.12];
  const cableMid: Vec3 = [ik.elbow[0] - 0.08, ik.elbow[1] + 0.1, ik.elbow[2] + 0.1];
  const cableEnd: Vec3 = [ik.wrist[0], ik.wrist[1] + 0.08, ik.wrist[2]];
  return <group>
    <mesh position={[ARM_BASE[0], TABLE_TOP + 0.05, ARM_BASE[2]]} castShadow receiveShadow>
      <cylinderGeometry args={[0.34, 0.39, 0.1, 48]} />
      <meshStandardMaterial color="#41494e" metalness={0.85} roughness={0.36} />
    </mesh>
    <mesh position={[ARM_BASE[0], 0.94, ARM_BASE[2]]} castShadow>
      <cylinderGeometry args={[0.22, 0.27, 0.25, 32]} />
      <meshStandardMaterial color="#ec793c" metalness={0.5} roughness={0.32} />
    </mesh>
    <Joint position={ik.shoulder} radius={0.21} yaw={ik.yaw} />
    <Link a={ik.shoulder} b={ik.elbow} radius={0.14} />
    <Joint position={ik.elbow} radius={0.17} yaw={ik.yaw} />
    <Link a={ik.elbow} b={ik.wrist} radius={0.115} />
    <Joint position={ik.wrist} radius={0.115} yaw={ik.yaw} />
    <Line points={[cableStart, cableMid, cableEnd]} color="#252d33" lineWidth={3.5} />
    <group position={[tcp[0], tcp[1] + 0.15, tcp[2]]}>
      <RoundedBox args={[0.29, 0.12, 0.21]} radius={0.025} smoothness={2} castShadow>
        <meshStandardMaterial color="#464d53" metalness={0.8} roughness={0.3} />
      </RoundedBox>
      {[-1, 1].map(side => <group key={side} position={[side * open, -0.1, 0]}>
        <mesh castShadow><boxGeometry args={[0.035, 0.21, 0.15]} /><meshStandardMaterial color="#c0c6c9" metalness={0.9} roughness={0.28} /></mesh>
        <mesh position={[-side * 0.013, -0.06, 0]}><boxGeometry args={[0.022, 0.07, 0.115]} /><meshStandardMaterial color="#30383e" roughness={0.9} /></mesh>
      </group>)}
      <mesh position={[0.1, 0.065, 0.045]}><sphereGeometry args={[0.017, 12, 12]} /><meshStandardMaterial color="#82d5ae" emissive="#49b782" emissiveIntensity={0.8} /></mesh>
    </group>
    <Text font="/fonts/ibm-plex-sans-regular.ttf" position={[ARM_BASE[0] - 0.38, 0.85, ARM_BASE[2] - 0.45]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.075} color="#384047" anchorX="center" anchorY="middle">TT–01</Text>
  </group>;
}

function Tray({ id, label, center, size }: typeof DESTINATIONS[number]) {
  const accent = id === 'tray-a' ? '#84a2b4' : id === 'tray-b' ? '#9caaa3' : '#bda68d';
  return <group position={center}>
    <RoundedBox args={size} radius={0.025} smoothness={2} receiveShadow>
      <meshStandardMaterial color={id === 'reject' ? '#77766d' : '#929c9f'} metalness={0.45} roughness={0.67} />
    </RoundedBox>
    {[[-size[0] / 2, 0, 0], [size[0] / 2, 0, 0]].map((position, index) => <mesh key={index} position={position as Vec3} receiveShadow><boxGeometry args={[0.018, 0.065, size[2]]} /><meshStandardMaterial color={accent} /></mesh>)}
    {[-1, 1].map(side => <mesh key={side} position={[0, 0, side * size[2] / 2]} receiveShadow><boxGeometry args={[size[0], 0.065, 0.018]} /><meshStandardMaterial color={accent} /></mesh>)}
    <Text font="/fonts/ibm-plex-sans-regular.ttf" position={[0, 0.01, size[2] / 2 + 0.095]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.072} maxWidth={size[0] * 0.94} color="#384047" anchorX="center" anchorY="middle">{label}</Text>
  </group>;
}

function Part({ object, selected, onSelect }: { object: SceneObject; selected: boolean; onSelect: (id: string) => void }) {
  const materialColor = useMemo(() => new Color(object.color).offsetHSL(0, 0.15, -0.06), [object.color]);
  const vesselProfile = useMemo(() => {
    const radius = object.size[0] / 2, halfHeight = object.size[1] / 2;
    const isCup = object.semanticType === 'cup';
    const top = radius * (isCup ? 0.64 : 1), bottom = radius * (isCup ? 0.61 : 0.56);
    return [[0, -halfHeight], [bottom, -halfHeight], [top, halfHeight], [top - 0.014, halfHeight], [bottom - 0.014, -halfHeight + 0.018], [0, -halfHeight + 0.018]].map(([x, y]) => new Vector2(x, y));
  }, [object.size[0], object.size[1], object.semanticType]);
  const vessel = object.semanticType === 'cup' || object.semanticType === 'bowl';
  const sample = object.semanticType?.includes('sample');
  return <group position={object.position} onClick={event => { event.stopPropagation(); onSelect(object.id); }} onPointerOver={event => { event.stopPropagation(); document.body.style.cursor = 'pointer'; }} onPointerOut={() => { document.body.style.cursor = ''; }}>
    {vessel ? <>
      <mesh castShadow receiveShadow>
        <latheGeometry args={[vesselProfile, 40]} />
        <meshStandardMaterial color={materialColor} metalness={0.08} roughness={0.3} />
        {selected && <Edges scale={1.015} threshold={30} color="#ffffff" />}
      </mesh>
      {object.semanticType === 'cup' && <mesh position={[object.size[0] * 0.295, 0, 0]} castShadow>
        <torusGeometry args={[object.size[0] * 0.15, 0.006, 12, 28]} />
        <meshStandardMaterial color={materialColor} metalness={0.08} roughness={0.3} />
      </mesh>}
    </> : <>
      <mesh castShadow receiveShadow position={sample ? [0, -object.size[1] * 0.09, 0] : [0, 0, 0]}>
        {object.kind === 'cylinder' ? <cylinderGeometry args={[object.size[0] / 2, object.size[0] / 2, object.size[1] * (sample ? 0.82 : 1), 28]} /> : <boxGeometry args={[object.size[0], object.size[1] * (sample ? 0.82 : 1), object.size[2]]} />}
        <meshStandardMaterial color={materialColor} metalness={sample ? 0.24 : 0.15} roughness={0.4} />
        <Edges scale={selected ? 1.06 : 1.001} threshold={20} color={selected ? '#ffffff' : object.color} />
      </mesh>
      {sample && <>
        <mesh position={[0, object.size[1] * 0.41, 0]} castShadow>
          {object.kind === 'cylinder' ? <cylinderGeometry args={[object.size[0] / 2, object.size[0] / 2, object.size[1] * 0.18, 28]} /> : <boxGeometry args={[object.size[0], object.size[1] * 0.18, object.size[2]]} />}
          <meshStandardMaterial color="#d8dee0" metalness={0.6} roughness={0.4} />
        </mesh>
        <Text font="/fonts/ibm-plex-sans-regular.ttf" position={[0, object.size[1] / 2 + 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.047} maxWidth={object.size[0] * 0.9} color="#33434d" anchorX="center" anchorY="middle">{object.semanticType === 'sample-alpha' ? 'ALPHA' : object.semanticType === 'sample-beta' ? 'BETA' : 'REF'}</Text>
      </>}
      {object.semanticType === 'utensil-case' && <mesh position={[0, object.size[1] / 2 + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[object.size[0] * 0.72, object.size[2] * 0.48]} />
        <meshStandardMaterial color="#d5d7cd" metalness={0.4} roughness={0.45} />
      </mesh>}
    </>}
    {selected && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -object.size[1] / 2 + 0.005, 0]}>
      <ringGeometry args={[0.2, 0.215, 48]} /><meshBasicMaterial color="#f0b17f" transparent opacity={0.9} />
    </mesh>}
    {selected && <Billboard position={[0, object.size[1] / 2 + 0.23, 0]}><Text font="/fonts/ibm-plex-sans-regular.ttf" fontSize={0.075} maxWidth={1.8} color="#f0d0b5" outlineColor="#171717" outlineWidth={0.006} anchorX="center" anchorY="middle">{object.label}</Text></Billboard>}
  </group>;
}

/** Decorative task fixtures share the controller's unchanged tray geometry. */
function EnvironmentFixtures({ environmentId }: { environmentId?: string }) {
  if (environmentId === 'kitchen') return <group>
    <mesh position={[-0.25, TABLE_TOP + 0.003, -0.05]} receiveShadow><boxGeometry args={[1.75, 0.006, 1.65]} /><meshStandardMaterial color="#c5c2ad" roughness={0.95} /></mesh>
    <mesh position={[0, TABLE_TOP + 0.17, -1.37]} receiveShadow><boxGeometry args={[4.1, 0.34, 0.06]} /><meshStandardMaterial color="#ced1c8" roughness={0.6} /></mesh>
    {[-1.5, -0.75, 0, 0.75, 1.5].map(x => <mesh key={x} position={[x, TABLE_TOP + 0.17, -1.338]}><boxGeometry args={[0.006, 0.34, 0.002]} /><meshStandardMaterial color="#a4afaa" /></mesh>)}
    <mesh position={[1.88, TABLE_TOP + 0.012, -1.03]}><boxGeometry args={[0.28, 0.024, 0.35]} /><meshStandardMaterial color="#b38d62" roughness={0.95} /></mesh>
  </group>;
  if (environmentId === 'lab') return <group>
    <mesh position={[-0.34, TABLE_TOP + 0.003, -0.05]} receiveShadow><boxGeometry args={[1.55, 0.006, 1.60]} /><meshStandardMaterial color="#829da5" roughness={0.9} /></mesh>
    <mesh position={[1.90, TABLE_TOP + 0.13, -1.10]} castShadow receiveShadow><boxGeometry args={[0.30, 0.26, 0.31]} /><meshStandardMaterial color="#d2dadb" metalness={0.3} roughness={0.5} /></mesh>
    <mesh position={[1.90, TABLE_TOP + 0.14, -0.942]}><boxGeometry args={[0.21, 0.10, 0.006]} /><meshStandardMaterial color="#263c48" roughness={0.4} /></mesh>
    <mesh position={[1.98, TABLE_TOP + 0.07, -0.936]}><sphereGeometry args={[0.012, 12, 12]} /><meshStandardMaterial color="#91c4b3" emissive="#4d977f" emissiveIntensity={0.35} /></mesh>
    <mesh position={[-0.30, TABLE_TOP + 0.004, 0.40]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.20, 0.21, 4]} /><meshStandardMaterial color="#d6e4df" /></mesh>
  </group>;
  return <group>
    <mesh position={[-0.25, TABLE_TOP + 0.003, -0.05]} receiveShadow><boxGeometry args={[1.75, 0.006, 1.65]} /><meshStandardMaterial color="#627c88" roughness={0.95} /></mesh>
    <mesh position={[1.88, TABLE_TOP + 0.015, -1.04]} receiveShadow><boxGeometry args={[0.28, 0.03, 0.36]} /><meshStandardMaterial color="#4d5d65" roughness={0.7} /></mesh>
    {[0, 1, 2].map(index => <mesh key={index} position={[1.79 + index * 0.085, TABLE_TOP + 0.037, -1.04]}><boxGeometry args={[0.022, 0.014, 0.24 - index * 0.04]} /><meshStandardMaterial color="#b1b9bb" metalness={0.8} roughness={0.3} /></mesh>)}
  </group>;
}

function TableGrid() {
  const positions = useMemo(() => {
    const points: number[] = [];
    for (let x = -2; x <= 2.001; x += 0.2) points.push(x, TABLE_TOP + 0.002, -1.3, x, TABLE_TOP + 0.002, 1.3);
    for (let z = -1.2; z <= 1.201; z += 0.2) points.push(-2.1, TABLE_TOP + 0.002, z, 2.1, TABLE_TOP + 0.002, z);
    return new Float32Array(points);
  }, []);
  return <lineSegments>
    <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
    <lineBasicMaterial color="#75868f" transparent opacity={0.17} />
  </lineSegments>;
}

function Workcell({ world, selectedId, onSelect, showGrid, showPath, targetPosition }: Pick<RobotSceneProps, 'world' | 'selectedId' | 'onSelect' | 'showGrid' | 'showPath' | 'targetPosition'>) {
  const family = world.baseEnvironmentId ?? world.environmentId;
  const environment = ENVIRONMENTS.find(candidate => candidate.id === family);
  const pathTarget = targetPosition ?? world.motion?.phases.at(-3)?.position;
  const path = pathTarget ? [world.robot.position, [world.robot.position[0], 1.7, world.robot.position[2]] as Vec3, [pathTarget[0], 1.7, pathTarget[2]] as Vec3, pathTarget] : null;
  return <>
    <color attach="background" args={['#18191b']} />
    <fog attach="fog" args={['#18191b', 13, 28]} />
    <ambientLight intensity={0.75} />
    <hemisphereLight args={['#eeeeee', '#292929', 1.05]} />
    <directionalLight position={[1, 7, 4]} intensity={2.7} castShadow shadow-mapSize={[1536, 1536]} shadow-camera-left={-4} shadow-camera-right={4} shadow-camera-top={4} shadow-camera-bottom={-4} shadow-bias={-0.0005} />
    <directionalLight position={[-4, 3, -3]} color="#dedede" intensity={1.25} />
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}><planeGeometry args={[50, 50]} /><meshStandardMaterial color="#18191b" roughness={0.95} /></mesh>
    {showGrid && <gridHelper args={[18, 36, '#404040', '#303030']} position={[0, 0.001, 0]} />}
    <RoundedBox args={[4.35, 0.1, 2.8]} radius={0.045} smoothness={3} position={[0, TABLE_TOP - 0.05, 0]} castShadow receiveShadow>
      <meshStandardMaterial color={family === 'kitchen' ? '#b9bcb4' : family === 'lab' ? '#bac6c9' : '#8a979e'} metalness={family === 'kitchen' ? 0.18 : 0.52} roughness={0.58} />
    </RoundedBox>
    <mesh position={[0, TABLE_TOP - 0.13, 0]} castShadow><boxGeometry args={[4.1, 0.15, 2.55]} /><meshStandardMaterial color="#3a4349" metalness={0.6} roughness={0.4} /></mesh>
    {[-1.8, 1.8].flatMap(x => [-1.05, 1.05].map(z => <mesh key={`${x}-${z}`} position={[x, 0.31, z]} castShadow><boxGeometry args={[0.12, 0.64, 0.12]} /><meshStandardMaterial color="#647079" metalness={0.8} roughness={0.45} /></mesh>))}
    {showGrid && <TableGrid />}
    <EnvironmentBackdrop family={family}/>
    <EnvironmentFixtures environmentId={family} />
    <mesh position={[-1.85, TABLE_TOP + 0.008, -1.12]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.13, 0.12]} /><meshBasicMaterial color="#e4b55d" /></mesh>
    <Text font="/fonts/ibm-plex-sans-regular.ttf" position={[-0.85, TABLE_TOP + 0.015, -1.18]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.045} maxWidth={2.4} color="#394349" anchorX="center" anchorY="middle">{world.customTask ? world.customTask.title.toUpperCase() : environment ? `${environment.id.toUpperCase()} / ${environment.name.toUpperCase()}` : 'WORKCELL 01 / DEMONSTRATION LAB'}</Text>
    {DESTINATIONS.map(tray => <Tray key={tray.id} {...tray} label={world.destinationLabels?.[tray.id] ?? tray.label} />)}
    <Robot world={world} />
    <HumanPresenceProxy state={world.humanPresence?.state ?? 'clear'}/>
    {world.objects.map(object => <Part key={object.id} object={object} selected={selectedId === object.id} onSelect={onSelect} />)}
    {showPath && path && <Line points={path} color="#f1ad79" lineWidth={1.6} dashed dashSize={0.065} gapSize={0.045} transparent opacity={0.8} />}
    {showPath && pathTarget && <mesh position={[pathTarget[0], TABLE_TOP + 0.08, pathTarget[2]]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.18, 0.19, 40]} /><meshBasicMaterial color="#ffc087" transparent opacity={0.9} /></mesh>}
    <ContactShadows position={[0, 0.005, 0]} opacity={0.35} scale={12} blur={2} far={4} resolution={256} />
  </>;
}

export function RobotScene(props: RobotSceneProps) {
  return <div className="robot-scene" data-testid="robot-scene">
    <Canvas frameloop="demand" shadows camera={{ position: [4.9, 4, 5.5], fov: 42, near: 0.05, far: 60 }} dpr={[1, 1.75]} gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }} onPointerMissed={() => props.onSelect(null)}>
      <Suspense fallback={null}>
        <Workcell {...props} />
        <CameraRig view={props.view} onReady={props.onReady} humanPresent={props.world.humanPresence?.state === 'nearby' || props.world.humanPresence?.state === 'in-workspace'} />
      </Suspense>
    </Canvas>
  </div>;
}

export default RobotScene;
