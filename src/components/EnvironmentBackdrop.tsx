import { CatmullRomCurve3, Vector3 } from 'three';

type Point = [number, number, number];
export interface EnvironmentBackdropProps { family: 'workbench' | 'kitchen' | 'lab' | string | undefined }

function Box({ position, size, color, metalness = 0.05, roughness = 0.8 }: {
  position: Point; size: Point; color: string; metalness?: number; roughness?: number;
}) {
  return <mesh position={position} castShadow receiveShadow><boxGeometry args={size}/><meshStandardMaterial color={color} metalness={metalness} roughness={roughness}/></mesh>;
}

function Cabinet({ x, y = 0.48, width = 1.35, height = 0.88, depth = 0.62, color = '#716d60', upper = false }: {
  x: number; y?: number; width?: number; height?: number; depth?: number; color?: string; upper?: boolean;
}) {
  const z = upper ? -2.06 : -1.98;
  return <group position={[x, y, z]}>
    <Box position={[0, 0, 0]} size={[width, height, depth]} color={upper ? '#68665e' : '#413f38'}/>
    {[-1, 1].map(side => <group key={side}>
      <Box position={[side * width / 4, 0.015, depth / 2 + 0.009]} size={[width / 2 - 0.018, height - 0.055, 0.025]} color={color}/>
      <Box position={[side * 0.065, height * 0.14, depth / 2 + 0.035]} size={[0.022, 0.15, 0.027]} color="#b0aaa0" metalness={0.75} roughness={0.35}/>
    </group>)}
    {!upper && <Box position={[0, -height / 2 - 0.015, 0.02]} size={[width - 0.09, 0.055, depth - 0.08]} color="#353530"/>}
  </group>;
}

function Room({ kitchen = false }: { kitchen?: boolean }) {
  return <group>
    <Box position={[0, 1.8, -2.37]} size={[7.7, 3.6, 0.10]} color={kitchen ? '#a5a194' : '#8b8e8a'}/>
    <Box position={[-3.83, 1.8, -0.35]} size={[0.10, 3.6, 4.0]} color={kitchen ? '#8d8b80' : '#777d7a'}/>
    <Box position={[0, 0.10, -2.30]} size={[7.6, 0.16, 0.035]} color="#4c4e48"/>
    <Box position={[-3.76, 0.10, -0.35]} size={[0.035, 0.16, 4.0]} color="#4c4e48"/>
  </group>;
}

const faucetCurve = new CatmullRomCurve3([
  new Vector3(0.23, 0, -0.12), new Vector3(0.23, 0.34, -0.12), new Vector3(0.10, 0.43, -0.12),
  new Vector3(-0.10, 0.35, 0.02), new Vector3(-0.10, 0.22, 0.06),
]);

function KitchenBackdrop() {
  return <group name="decorative-kitchen-context">
    <Room kitchen/>
    {[-2.80, -1.40, 0, 1.40, 2.80].map(x => <Cabinet key={x} x={x} color="#746b58"/>)}
    <Box position={[-1.35, 0.955, -1.98]} size={[4.25, 0.07, 0.74]} color="#b2ada0" roughness={0.55}/>
    <Box position={[2.54, 0.955, -1.98]} size={[1.88, 0.07, 0.74]} color="#b2ada0" roughness={0.55}/>
    <Box position={[1.18, 0.89, -1.98]} size={[0.75, 0.055, 0.47]} color="#515a59" metalness={0.7} roughness={0.35}/>
    {[-1, 1].map(side => <Box key={side} position={[1.18 + side * 0.385, 0.946, -1.98]} size={[0.035, 0.13, 0.51]} color="#a6b0ad" metalness={0.85} roughness={0.28}/>)}
    {[-1, 1].map(side => <Box key={side} position={[1.18, 0.946, -1.98 + side * 0.245]} size={[0.80, 0.13, 0.035]} color="#a6b0ad" metalness={0.85} roughness={0.28}/>)}
    <mesh position={[1.18, 1.0, -1.98]} castShadow><tubeGeometry args={[faucetCurve, 24, 0.022, 8, false]}/><meshStandardMaterial color="#b7bdb9" metalness={0.85} roughness={0.27}/></mesh>
    <Cabinet x={-2.55} y={2.15} width={1.5} height={0.9} depth={0.38} color="#a49b85" upper/>
    <Cabinet x={2.5} y={2.15} width={1.5} height={0.9} depth={0.38} color="#a49b85" upper/>
    <Box position={[-0.25, 2.12, -2.29]} size={[2.15, 1.02, 0.035]} color="#414c4b"/>
    <mesh position={[-0.25, 2.12, -2.262]}><planeGeometry args={[1.98, 0.87]}/><meshStandardMaterial color="#8b9d9c" emissive="#72817d" emissiveIntensity={0.28} roughness={0.4}/></mesh>
    {[-1.3, 0.8].map(x => <Box key={x} position={[x, 2.12, -2.235]} size={[0.055, 1.05, 0.04]} color="#cbc8b9"/>)}
    <Box position={[-0.25, 2.12, -2.23]} size={[2.16, 0.055, 0.04]} color="#cbc8b9"/>
    {[-1, 1].map(side => <Box key={side} position={[-0.25, 2.12 + side * 0.51, -2.23]} size={[2.16, 0.055, 0.04]} color="#cbc8b9"/>)}
    {[-2.55, 2.50].map(x => <group key={x}>
      <mesh position={[x, 1.69, -1.91]} rotation={[Math.PI / 2, 0, 0]}><planeGeometry args={[1.30, 0.26]}/><meshStandardMaterial color="#f0c995" emissive="#e8bb82" emissiveIntensity={0.6}/></mesh>
      <pointLight position={[x, 1.57, -1.72]} color="#f5d6a6" intensity={0.30} distance={3.0} decay={2}/>
    </group>)}
    <Box position={[-2.9, 1.025, -1.96]} size={[0.55, 0.025, 0.40]} color="#92714c" roughness={0.95}/>
    <Box position={[-2.58, 1.10, -1.95]} size={[0.10, 0.20, 0.10]} color="#c7c4b5" roughness={0.65}/>
    <Box position={[3.30, 1.07, -1.98]} size={[0.14, 0.18, 0.17]} color="#9d9277" roughness={0.8}/>
  </group>;
}

function LabBackdrop() {
  return <group name="decorative-lab-context">
    <Room/>
    <Box position={[0, 1.54, -2.29]} size={[6.9, 1.05, 0.028]} color="#b8bdb7"/>
    {[-2.6, -1.3, 0, 1.3, 2.6].map(x => <Box key={x} position={[x, 1.54, -2.27]} size={[0.008, 1.05, 0.008]} color="#8e9790"/>)}
    {[1.30, 1.80].map(y => <Box key={y} position={[0, y, -2.27]} size={[6.9, 0.008, 0.008]} color="#8e9790"/>)}
    {[-2.70, -0.90, 0.90, 2.70].map(x => <Cabinet key={x} x={x} width={1.74} color="#a1aaa4"/>)}
    <Box position={[0, 0.96, -1.98]} size={[7.15, 0.08, 0.74]} color="#56635e" roughness={0.45}/>
    <Cabinet x={2.55} y={2.14} width={1.5} height={1.0} depth={0.36} color="#b5bcb6" upper/>
    <Cabinet x={-2.55} y={2.14} width={1.5} height={1.0} depth={0.36} color="#b5bcb6" upper/>
    <Box position={[-1.65, 1.27, -1.98]} size={[0.65, 0.55, 0.40]} color="#c0c5bd" metalness={0.2} roughness={0.55}/>
    <Box position={[-1.65, 1.34, -1.772]} size={[0.38, 0.22, 0.012]} color="#35413f" roughness={0.35}/>
    <Box position={[-1.38, 1.15, -1.76]} size={[0.055, 0.055, 0.035]} color="#777f74" metalness={0.6}/>
    <Box position={[0.65, 1.04, -1.98]} size={[0.75, 0.08, 0.44]} color="#c4c9c0" metalness={0.3}/>
    {[0, 1, 2, 3].map(index => <mesh key={index} position={[0.41 + index * 0.16, 1.18, -1.98]} castShadow><cylinderGeometry args={[0.035, 0.035, 0.22, 12]}/><meshStandardMaterial color="#86978e" metalness={0.15} roughness={0.4}/></mesh>)}
    <Box position={[0, 2.30, -2.23]} size={[2.1, 0.075, 0.10]} color="#c0c5bc"/>
    <mesh position={[0, 2.28, -2.17]}><planeGeometry args={[1.85, 0.025]}/><meshStandardMaterial color="#e4e9db" emissive="#d0dfce" emissiveIntensity={0.45}/></mesh>
  </group>;
}

function WorkbenchBackdrop() {
  return <group name="decorative-maintenance-context">
    <Room/>
    <Box position={[-0.35, 1.84, -2.27]} size={[4.8, 1.36, 0.06]} color="#5d635a" roughness={0.95}/>
    {[-2.4, -1.7, -1, -0.3, 0.4, 1.1, 1.8].flatMap(x => [1.42, 1.84, 2.26].map(y => <mesh key={`${x}-${y}`} position={[x, y, -2.225]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.016, 0.016, 0.012, 8]}/><meshStandardMaterial color="#343b34" roughness={1}/></mesh>))}
    {[-1.65, -0.9, -0.15, 0.6].map((x, index) => <group key={x} position={[x, 1.81, -2.19]}>
      <Box position={[0, -0.05, 0]} size={[0.045, 0.38 + index * 0.035, 0.035]} color={index === 1 ? '#97785a' : '#a5aaa0'} metalness={0.5}/>
      <mesh position={[0, 0.18, 0]}><torusGeometry args={[0.07, 0.022, 6, 12]}/><meshStandardMaterial color="#a2aaa0" metalness={0.7} roughness={0.45}/></mesh>
    </group>)}
    {[-2.7, -1.1, 0.5, 2.1].map(x => <Cabinet key={x} x={x} width={1.5} color="#596158"/>)}
    <Box position={[-0.3, 0.96, -1.98]} size={[6.6, 0.08, 0.74]} color="#8d8370" roughness={0.8}/>
    <Box position={[2.95, 1.57, -2.05]} size={[0.65, 1.2, 0.46]} color="#565f55" metalness={0.3}/>
    <Box position={[2.95, 1.57, -1.81]} size={[0.58, 1.12, 0.03]} color="#687463" metalness={0.3}/>
    <Box position={[2.75, 1.57, -1.78]} size={[0.025, 0.17, 0.025]} color="#a4ad9d" metalness={0.8}/>
    {[-2.7, -2.1].map((x, index) => <Box key={x} position={[x, 1.08, -1.96]} size={[0.42, 0.18, 0.35]} color={index ? '#7a735f' : '#655b4b'} roughness={0.85}/>)}
    <Box position={[-0.25, 2.63, -2.22]} size={[3.7, 0.07, 0.12]} color="#a6ac9d"/>
    <mesh position={[-0.25, 2.60, -2.15]}><planeGeometry args={[3.45, 0.035]}/><meshStandardMaterial color="#e9d9b5" emissive="#cbb98f" emissiveIntensity={0.45}/></mesh>
  </group>;
}

/** Decorative room context stays behind/outside the canonical active tabletop footprint. */
export function EnvironmentBackdrop({ family }: EnvironmentBackdropProps) {
  if (family === 'kitchen') return <KitchenBackdrop/>;
  if (family === 'lab') return <LabBackdrop/>;
  return <WorkbenchBackdrop/>;
}

export default EnvironmentBackdrop;
