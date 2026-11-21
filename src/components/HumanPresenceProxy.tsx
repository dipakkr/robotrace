import { useMemo } from 'react';
import { Quaternion, Vector3 } from 'three';
import { TABLE_TOP } from '../sim/engine';

type Point = [number, number, number];
export interface HumanPresenceProxyProps { state: 'clear' | 'nearby' | 'in-workspace' }

function BodySegment({ from, to, radius, color }: { from: Point; to: Point; radius: number; color: string }) {
  const { center, rotation, length } = useMemo(() => {
    const start = new Vector3(...from), finish = new Vector3(...to);
    const direction = finish.clone().sub(start);
    return {
      center: start.clone().add(finish).multiplyScalar(0.5),
      rotation: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.clone().normalize()),
      length: Math.max(0.001, direction.length()),
    };
  }, [from[0], from[1], from[2], to[0], to[1], to[2], radius]);
  return <mesh position={center} quaternion={rotation} castShadow receiveShadow>
    <capsuleGeometry args={[radius, length, 6, 12]}/>
    <meshStandardMaterial color={color} roughness={0.9}/>
  </mesh>;
}

/** A posed scenario marker, not a tracked person or a contact/collision model. */
export function HumanPresenceProxy({ state }: HumanPresenceProxyProps) {
  if (state === 'clear') return null;
  const occupied = state === 'in-workspace';
  const torso = '#77766f', trousers = '#595a57', skin = '#a9a397';
  const shoulderZ = occupied ? 1.57 : 1.82;
  const headZ = occupied ? 1.50 : 1.82;
  const leftShoulder: Point = [0.40, 1.34, shoulderZ];
  const leftElbow: Point = occupied ? [0.13, 1.14, 1.20] : [0.31, 1.08, 1.72];
  const leftHand: Point = occupied ? [0.05, 0.95, 0.75] : [0.32, 0.87, 1.61];
  const rightShoulder: Point = [0.80, 1.34, shoulderZ];
  const rightElbow: Point = occupied ? [0.88, 1.08, 1.74] : [0.90, 1.08, 1.76];
  const rightHand: Point = [0.87, 0.87, 1.64];
  return <group name="human-scenario-proxy">
    {occupied && <mesh position={[-0.2, TABLE_TOP + 0.009, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[1.4, 1.8]}/>
      <meshBasicMaterial color="#d5a266" transparent opacity={0.10} depthWrite={false}/>
    </mesh>}
    <BodySegment from={[0.60, 0.88, 1.82]} to={[0.60, 1.34, shoulderZ]} radius={0.17} color={torso}/>
    <BodySegment from={[0.45, 0.82, 1.82]} to={[0.75, 0.82, 1.82]} radius={0.12} color={trousers}/>
    <BodySegment from={[0.49, 0.78, 1.82]} to={[0.47, 0.15, 1.83]} radius={0.075} color={trousers}/>
    <BodySegment from={[0.71, 0.78, 1.82]} to={[0.74, 0.15, 1.83]} radius={0.075} color={trousers}/>
    {[0.47, 0.74].map(x => <mesh key={x} position={[x, 0.07, 1.76]} rotation={[Math.PI / 2, 0, 0]} castShadow>
      <capsuleGeometry args={[0.065, 0.13, 5, 10]}/>
      <meshStandardMaterial color="#41433f" roughness={0.95}/>
    </mesh>)}
    <BodySegment from={[0.60, 1.38, shoulderZ]} to={[0.60, 1.49, headZ]} radius={0.06} color={skin}/>
    <mesh position={[0.60, 1.61, headZ]} castShadow>
      <sphereGeometry args={[0.115, 18, 14]}/>
      <meshStandardMaterial color={skin} roughness={0.9}/>
    </mesh>
    <mesh position={[0.60, 1.60, headZ - 0.108]}>
      <sphereGeometry args={[0.026, 10, 8]}/>
      <meshStandardMaterial color={skin} roughness={0.9}/>
    </mesh>
    <BodySegment from={leftShoulder} to={leftElbow} radius={0.061} color={occupied ? '#aa926f' : torso}/>
    <BodySegment from={leftElbow} to={leftHand} radius={0.048} color={occupied ? '#b39b77' : skin}/>
    <BodySegment from={rightShoulder} to={rightElbow} radius={0.061} color={torso}/>
    <BodySegment from={rightElbow} to={rightHand} radius={0.048} color={skin}/>
    {[leftHand, rightHand].map((position, index) => <mesh key={index} position={position} castShadow>
      <sphereGeometry args={[0.052, 12, 10]}/>
      <meshStandardMaterial color={occupied && index === 0 ? '#c0a47c' : skin} roughness={0.9}/>
    </mesh>)}
  </group>;
}

export default HumanPresenceProxy;
