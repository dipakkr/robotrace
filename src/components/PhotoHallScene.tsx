import {Suspense,useEffect,useMemo} from 'react';
import {Canvas} from '@react-three/fiber';
import {Billboard,Line,OrbitControls,RoundedBox,Text} from '@react-three/drei';
import {BoxGeometry,BufferGeometry,CylinderGeometry,Euler,Matrix4,Quaternion,SphereGeometry,TorusGeometry,Vector3} from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {solveMobileArm} from '../sim/mobile-arm';
import type {MobilePoint,MobileWorld} from '../sim/mobile-navigation';
type P=[number,number,number];
const font='/fonts/ibm-plex-sans-regular.ttf';
const materials={white:{color:'#deded8',roughness:.63},dark:{color:'#333736',roughness:.48},wood:{color:'#ab865b',roughness:.8},black:{color:'#202525',roughness:.72},wall:{color:'#bbbcb7',roughness:.9},carpet:{color:'#777976',roughness:1},orange:{color:'#bd6b37',roughness:.91},pipe:{color:'#a04437',roughness:.54,metalness:.35},steel:{color:'#949b98',roughness:.4,metalness:.7},light:{color:'#f2efdc',emissive:'#fff2cb',emissiveIntensity:.8,roughness:.3}} as const;
type Mat=keyof typeof materials;
function roomBatches(world:MobileWorld){
 const parts=new Map<Mat,BufferGeometry[]>();let fixtureScale:{x:number;z:number;sx:number;sz:number}|null=null;
 const add=(mat:Mat,geometry:BufferGeometry,p:P,r:P=[0,0,0])=>{geometry.applyMatrix4(new Matrix4().compose(new Vector3(...p),new Quaternion().setFromEuler(new Euler(...r)),new Vector3(1,1,1)));if(fixtureScale)geometry.translate(-fixtureScale.x,0,-fixtureScale.z).scale(fixtureScale.sx,1,fixtureScale.sz).translate(fixtureScale.x,0,fixtureScale.z);const list=parts.get(mat)??[];list.push(geometry);parts.set(mat,list);};
 const box=(mat:Mat,size:P,p:P,r:P=[0,0,0])=>add(mat,new BoxGeometry(...size),p,r);
 const cyl=(mat:Mat,radius:number,height:number,p:P,r:P=[0,0,0])=>add(mat,new CylinderGeometry(radius,radius,height,12),p,r);
 const tube=(mat:Mat,a:P,b:P,radius=.014)=>{const start=new Vector3(...a),end=new Vector3(...b),delta=end.clone().sub(start);const geometry=new CylinderGeometry(radius,radius,delta.length(),8);geometry.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0,1,0),delta.normalize()));add(mat,geometry,start.add(end).multiplyScalar(.5).toArray() as P);};
 const b=world.bounds,width=b.maxX-b.minX,depth=b.maxZ-b.minZ;
 const features=(world as MobileWorld&{photoHallProvenance?:{features?:{windows:('back'|'left')[];tvWall:'right'|'none'}}}).photoHallProvenance?.features,windows=features?.windows??['back','left'];
 box('wall',[.10,3.1,depth],[b.maxX,1.55,0]);box('wall',[width,1.02,.10],[0,.51,b.minZ]);
 // Light-grey carpet tiles, an orange border and black binding seen in the references.
 box('orange',[.63,.012,depth],[b.minX+.315,.008,0]);box('black',[.10,.014,depth],[b.minX+.68,.009,0]);
 for(let x=b.minX+.77;x<b.maxX;x+=.50)box('carpet',[.006,.004,depth],[x,.004,0]);
 for(let z=b.minZ;z<b.maxZ;z+=.50)box('carpet',[width-.77,.004,.006],[.38,.004,z]);
 // Rear and left-side blinds are batched, not hundreds of individual draw calls.
 box('white',[width-.12,.12,.16],[0,1.06,b.minZ+.04]);box('white',[width-.12,.10,.18],[0,2.75,b.minZ+.04]);
 if(windows.includes('back'))for(let row=0;row<26;row++)box('white',[width-.18,.042,.055],[0,1.15+row*.060,b.minZ+.045],[-.12,0,0]);
 for(const x of[-2.3,0,2.3])box('steel',[.025,1.64,.04],[x,1.91,b.minZ+.085]);
 box('wall',[.10,.97,depth],[b.minX,.485,0]);
 if(windows.includes('left'))for(let row=0;row<24;row++)box('white',[.055,.042,depth-.16],[b.minX+.045,1.14+row*.063,0],[0,0,.12]);
 // Long desk tops, white T-frames and restrained generic devices; no personal data.
 for(const obstacle of world.obstacles){const x=(obstacle.minX+obstacle.maxX)/2,z=(obstacle.minZ+obstacle.maxZ)/2,w=obstacle.maxX-obstacle.minX,d=obstacle.maxZ-obstacle.minZ;
  fixtureScale=obstacle.id.includes('stool')?{x,z,sx:w/.46,sz:d/.46}:obstacle.id.includes('office-chair')||obstacle.id.startsWith('hall-chair-')?{x,z,sx:w/.60,sz:d/.66}:null;
  if(obstacle.id.includes('desk')){
   box('dark',[w,.058,d],[x,1.02,z]);
   for(const side of[-1,1]){const legX=x+side*w*.35;box('white',[.075,.96,.085],[legX,.51,z]);box('white',[.12,.065,d*.87],[legX,.045,z]);}
   box('white',[w*.7,.045,.06],[x,.29,z]);
   if(obstacle.id!=='hall-side-desk')for(const side of[-1,1]){
    const deviceX=x+side*.7;box('black',[.40,.018,.28],[deviceX,1.062,z-.05]);box('wall',[.33,.006,.23],[deviceX+.04,1.078,z+.19],[0,.14,0]);
    box('black',[.32,.21,.013],[deviceX,1.18,z-.16],[-.17,0,0]);
   }
  }else if(obstacle.id.includes('stool')){
   cyl('white',.224,.06,[x,.76,z]);
   for(const sx of[-1,1])for(const sz of[-1,1])tube('wood',[x+sx*.17,.03,z+sz*.17],[x+sx*.135,.73,z+sz*.135],.024);
   add('wood',new TorusGeometry(.185,.012,6,20),[x,.30,z],[Math.PI/2,0,0]);
   add('white',new TorusGeometry(.225,.018,6,20,Math.PI),[x,.91,z+.12]);
   for(let bar=0;bar<5;bar++){const offset=(bar-2)*.072;tube('white',[x+offset,.80,z+.12],[x+offset*.8,1.08-Math.abs(offset)*.8,z+.12],.008);}
   tube('white',[x-.19,.83,z+.12],[x+.17,1.01,z+.12],.008);tube('white',[x+.19,.83,z+.12],[x-.17,1.01,z+.12],.008);
  }else if(obstacle.id.includes('office-chair')||obstacle.id.startsWith('hall-chair-')){
   box('black',[.49,.075,.47],[x,.58,z]);box('black',[.055,.52,.49],[x+.19,.88,z]);
   for(const side of[-1,1])box('black',[.34,.034,.04],[x,.78,z+side*.24]);
   cyl('steel',.038,.45,[x,.29,z]);
   for(let leg=0;leg<5;leg++){const angle=leg*Math.PI*2/5,tip:P=[x+Math.sin(angle)*.27,.065,z+Math.cos(angle)*.27];tube('black',[x,.12,z],tip,.018);add('black',new SphereGeometry(.035,8,6),tip);}
  }else if(obstacle.id==='hall-wall-bench'||obstacle.id.startsWith('hall-bench-')){
   box('wood',[w,.065,d],[x,.56,z]);box('white',[w-.05,.11,d-.04],[x,.46,z]);
   for(const zz of[z-d*.38,z+d*.38])box('white',[w-.13,.43,.06],[x,.235,zz]);
  }
 }
 fixtureScale=null;
 // Wall-mounted screen above the bench, not an invented operable appliance.
 if(features?.tvWall!=='none'){box('black',[.07,1.05,1.75],[b.maxX-.07,1.82,-.3]);box('dark',[.009,.96,1.65],[b.maxX-.111,1.82,-.3]);
 tube('black',[b.maxX-.08,1.30,-.30],[b.maxX-.08,.61,-.30],.006);}
 // Exposed red services and two sculptural white box-pendant clusters.
 cyl('pipe',.039,width-.25,[0,3.18,-2.8],[0,0,Math.PI/2]);cyl('pipe',.039,depth-.4,[1.85,3.18,0],[Math.PI/2,0,0]);
 for(const z of[1.05,-1.8]){
  for(const x of[-.5,.4,1.3]){
   tube('black',[x,3.27,z],[x,2.48,z],.007);
   box('dark',[.52,.065,.36],[x,2.475,z]);box('pipe',[.52,.028,.36],[x,2.427,z]);box('white',[.52,.19,.36],[x,2.32,z]);box('light',[.48,.009,.32],[x,2.22,z]);
  }
 }
 box('dark',[width,.34,.08],[0,2.99,b.minZ]);box('white',[width,.16,.19],[0,2.79,b.minZ+.10]);
 const batches:{key:Mat;geometry:BufferGeometry}[]=[];for(const[key,list]of parts){const geometry=mergeGeometries(list,false);list.forEach(item=>item.dispose());if(geometry)batches.push({key,geometry});}return batches;
}
function PhotoRoom({world}:{world:MobileWorld}){
 const key=JSON.stringify({bounds:world.bounds,obstacles:world.obstacles.filter(item=>item.id!=='sandbox-floor-block')});const batches=useMemo(()=>roomBatches(world),[key]);useEffect(()=>()=>batches.forEach(item=>item.geometry.dispose()),[batches]);
 return <group name="estimated-photo-informed-office-fixtures">{batches.map(({key,geometry})=><mesh key={key} geometry={geometry} castShadow receiveShadow><meshStandardMaterial {...materials[key]}/></mesh>)}</group>;
}
function ArmLink({a,b}:{a:P;b:P}){const direction=new Vector3(...b).sub(new Vector3(...a));return <mesh position={new Vector3(...a).add(new Vector3(...b)).multiplyScalar(.5)} quaternion={new Quaternion().setFromUnitVectors(new Vector3(0,1,0),direction.clone().normalize())} castShadow><cylinderGeometry args={[.055,.07,direction.length(),12]}/><meshStandardMaterial color="#c27949" metalness={.6} roughness={.32}/></mesh>;}
function PhotoRobot({world}:{world:MobileWorld}){
 const pose=solveMobileArm(world),[x,z]=world.robot.position;return <group>
  <group position={[x,.19,z]} rotation={[0,world.robot.yaw,0]}><RoundedBox args={[.6,.30,.68]} radius={.07} castShadow><meshStandardMaterial color="#343b39" metalness={.52} roughness={.4}/></RoundedBox><mesh position={[0,.17,0]}><boxGeometry args={[.46,.05,.50]}/><meshStandardMaterial color="#a6afaa" metalness={.65}/></mesh>{[-1,1].flatMap(side=>[-1,1].map(front=><mesh key={`${side}-${front}`} position={[side*.30,-.05,front*.22]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.12,.12,.08,14]}/><meshStandardMaterial color="#151b19"/></mesh>))}<mesh position={[0,.08,.348]}><boxGeometry args={[.24,.018,.008]}/><meshStandardMaterial color="#a7ddba" emissive="#65a67c" emissiveIntensity={.8}/></mesh></group>
  <mesh position={[x,.62,z]} castShadow><cylinderGeometry args={[.13,.18,.60,16]}/><meshStandardMaterial color="#444d48" metalness={.6}/></mesh><ArmLink a={pose.joints.shoulder} b={pose.joints.elbow}/><ArmLink a={pose.joints.elbow} b={pose.joints.wrist}/>{[pose.joints.shoulder,pose.joints.elbow,pose.joints.wrist].map((point,index)=><mesh key={index} position={point}><sphereGeometry args={[.09,14,10]}/><meshStandardMaterial color="#323b37" metalness={.6}/></mesh>)}
  <mesh position={pose.objectTCP}><boxGeometry args={[.22,.08,.13]}/><meshStandardMaterial color="#b4bfb7" metalness={.7}/></mesh>
 </group>;
}
function Hall({world,top,onPlaceHuman}:{world:MobileWorld;top:boolean;onPlaceHuman?:(point:MobilePoint)=>void}){
 const mission=world.mission,route=mission?.plan.steps.slice(mission.stepIndex).flatMap((step,index)=>step.kind==='navigate'?(index===0?[world.robot.position,...step.path.slice(mission.waypointIndex)]:step.path).map(point=>[point[0],.03,point[1]] as P):[])??[];
 return <><color attach="background" args={['#202725']}/><ambientLight intensity={.85}/><hemisphereLight args={['#f2f4e9','#5b625b',1.5]}/><directionalLight position={[-5,7,-2]} intensity={2.5} castShadow shadow-mapSize={[2048,2048]}/><OrbitControls makeDefault target={[0,.7,0]} minDistance={5} maxDistance={20} maxPolarAngle={Math.PI/2.03} enableRotate={!top}/>
  <mesh receiveShadow rotation={[-Math.PI/2,0,0]} onClick={event=>{if(onPlaceHuman){event.stopPropagation();onPlaceHuman([event.point.x,event.point.z]);}}}><planeGeometry args={[world.bounds.maxX-world.bounds.minX,world.bounds.maxZ-world.bounds.minZ]}/><meshStandardMaterial color="#8d8c85" roughness={1}/></mesh><PhotoRoom world={world}/><PhotoRobot world={world}/>
  {route.length>1&&<Line points={route} color="#daa86e" lineWidth={2}/>}
  {world.stations.map(station=><group key={station.id}><mesh position={[station.dock[0],.025,station.dock[1]]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[.28,.30,32]}/><meshBasicMaterial color="#b2bda9" transparent opacity={.65}/></mesh><Billboard position={[station.dock[0],.52,station.dock[1]]}><Text font={font} fontSize={.14} color="#e7e9db" outlineColor="#222b25" outlineWidth={.006}>{station.label}</Text></Billboard></group>)}
  {world.obstacles.filter(item=>item.id==='sandbox-floor-block').map(item=><mesh key={item.id} position={[(item.minX+item.maxX)/2,.28,(item.minZ+item.maxZ)/2]} castShadow><boxGeometry args={[item.maxX-item.minX,.56,item.maxZ-item.minZ]}/><meshStandardMaterial color="#a37d54"/></mesh>)}
  {world.human&&<group position={[...world.human.position.slice(0,1),0,world.human.position[1]] as P}><mesh position={[0,1.10,0]} castShadow><capsuleGeometry args={[.18,.55,4,12]}/><meshStandardMaterial color="#b39d7b"/></mesh><mesh position={[0,1.64,0]}><sphereGeometry args={[.14,14,10]}/><meshStandardMaterial color="#b7a88c"/></mesh>{[-1,1].map(side=><mesh key={side} position={[side*.12,.42,0]}><capsuleGeometry args={[.08,.6,4,10]}/><meshStandardMaterial color="#434b47"/></mesh>)}</group>}
 </>;
}
/** Photo-informed navigation study; no source image pixels, people or calibrated reconstruction. */
export default function PhotoHallScene({world,top=false,onPlaceHuman}:{world:MobileWorld;top?:boolean;onPlaceHuman?:(point:MobilePoint)=>void}){
 const span=Math.max(world.bounds.maxX-world.bounds.minX,world.bounds.maxZ-world.bounds.minZ);
 return <Canvas frameloop="demand" key={top?'top':'orbit'} shadows dpr={[1,1.7]} camera={{position:top?[0,span*1.7,.01]:[-span*.875,span*.875,span*1.375],fov:44}} aria-label="Photo-informed office hall simulation"><Suspense fallback={null}><Hall world={world} top={top} onPlaceHuman={onPlaceHuman}/></Suspense></Canvas>;
}
