import {useEffect,useMemo} from 'react';
import {BoxGeometry,BufferGeometry,CylinderGeometry,Euler,Matrix4,Quaternion,SphereGeometry,TorusGeometry,Vector3} from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type {MobileWorld} from '../sim/mobile-navigation';

type XYZ=[number,number,number];
const finishes={
 cabinet:{color:'#343b37',roughness:.64,metalness:.06},
 wood:{color:'#967251',roughness:.76,metalness:0},
 tile:{color:'#dddccf',roughness:.34,metalness:.03},
 grout:{color:'#737c70',roughness:.9,metalness:0},
 steel:{color:'#bdc7c0',roughness:.24,metalness:.84},
 dark:{color:'#272c29',roughness:.62,metalness:.18},
 ceramic:{color:'#ece5d4',roughness:.28,metalness:.03},
 terracotta:{color:'#ae7455',roughness:.87,metalness:0},
 leaf:{color:'#587454',roughness:.84,metalness:0},
 spice:{color:'#b28c42',roughness:.68,metalness:.04},
} as const;
type Finish=keyof typeof finishes;

/** All fixtures are baked into one geometry per finish, including the tile grid.
 * They provide visual context only: they are not scene inventory or floor obstacles. */
function buildDetails(world:MobileWorld){
 const parts=new Map<Finish,BufferGeometry[]>();
 const add=(finish:Finish,geometry:BufferGeometry,position:XYZ,rotation:XYZ=[0,0,0])=>{
  geometry.applyMatrix4(new Matrix4().compose(new Vector3(...position),new Quaternion().setFromEuler(new Euler(...rotation)),new Vector3(1,1,1)));
  const list=parts.get(finish)??[];list.push(geometry);parts.set(finish,list);
 };
 const box=(finish:Finish,size:XYZ,position:XYZ,rotation:XYZ=[0,0,0])=>add(finish,new BoxGeometry(...size),position,rotation);
 const cylinder=(finish:Finish,top:number,bottom:number,height:number,position:XYZ,rotation:XYZ=[0,0,0])=>add(finish,new CylinderGeometry(top,bottom,height,16),position,rotation);
 const ring=(finish:Finish,radius:number,tube:number,position:XYZ,rotation:XYZ=[0,0,0],arc=Math.PI*2)=>add(finish,new TorusGeometry(radius,tube,7,24,arc),position,rotation);
 const sphere=(finish:Finish,radius:number,position:XYZ)=>add(finish,new SphereGeometry(radius,14,10),position);
 const back=world.bounds.minZ+.074;

 // Narrow ceramic backsplash above the working counter; grouted, subtly staggered.
 for(const stationId of ['counter','sink']){
  const station=world.stations.find(item=>item.id===stationId);if(!station)continue;
  const x=station.surface[0];
  box('grout',[1.98,.68,.018],[x,1.32,back]);
  for(let row=0;row<4;row++)for(let column=0;column<8;column++){
   const width=.235,height=.153;
   box('tile',[width,height,.022],[x-.86+column*.245,1.065+row*.164,back+.016]);
  }
  // Door/drawer skins sit just in front of the existing cabinet, not a new unit.
  const furniture=world.obstacles.find(item=>item.id===(stationId==='counter'?'counter-unit':'sink-unit'));
  if(furniture){const center=(furniture.minX+furniture.maxX)/2,width=furniture.maxX-furniture.minX,z=furniture.maxZ+.023;
   box('dark',[width-.06,.1,.024],[center,.073,z]);
   box('wood',[width-.06,.16,.028],[center,.755,z]);
   box('steel',[.34,.014,.035],[center,.755,z+.03]);
   for(const side of[-1,1]){
    const doorX=center+side*(width-.085)/4;
    box('cabinet',[(width-.1)/2,.51,.03],[doorX,.405,z]);
    box('steel',[.23,.014,.035],[doorX,.58,z+.032]);
   }
  }
  // Upper doors and a slim timber lip add depth to the renderer's upper units.
  for(const side of[-1,1]){
   box('cabinet',[.862,.70,.026],[x+side*.445,2.25,-3.041]);
   box('steel',[.018,.15,.03],[x+side*.08,2.19,-3.012]);
  }
  box('wood',[1.82,.034,.40],[x,1.87,-3.25]);
 }

 const counter=world.stations.find(item=>item.id==='counter');
 if(counter){const x=counter.surface[0],y=counter.height;
  // Steel kettle at the far left; both manipulation lanes remain empty.
  const kettleX=x-.69,kettleZ=counter.surface[1]-.02;
  cylinder('dark',.14,.15,.035,[kettleX,y+.025,kettleZ]);
  cylinder('steel',.115,.145,.235,[kettleX,y+.158,kettleZ]);
  cylinder('steel',.125,.125,.025,[kettleX,y+.288,kettleZ]);
  sphere('dark',.025,[kettleX,y+.32,kettleZ]);
  ring('dark',.118,.022,[kettleX-.13,y+.17,kettleZ],[0,Math.PI/2,0],Math.PI);
  cylinder('steel',.027,.047,.15,[kettleX+.145,y+.20,kettleZ],[0,0,-Math.PI/3]);
  // A rear spice shelf with small capped steel canisters and warm spice bands.
  const shelfZ=counter.surface[1]-.42;
  box('wood',[.99,.045,.23],[x+.26,y+.055,shelfZ]);
  box('wood',[.99,.025,.03],[x+.26,y+.19,shelfZ+.105]);
  for(let index=0;index<4;index++){
   const jarX=x-.08+index*.22;
   cylinder('spice',.065,.065,.16,[jarX,y+.16,shelfZ]);
   cylinder('steel',.069,.069,.032,[jarX,y+.252,shelfZ]);
   box('ceramic',[.06,.047,.009],[jarX,y+.16,shelfZ+.063]);
  }
  // Utensil rail is wall-mounted, safely behind the working surface.
  const railZ=back+.085;
  cylinder('steel',.013,.013,1.35,[x,1.60,railZ],[0,0,Math.PI/2]);
  for(const side of[-1,1])cylinder('dark',.022,.022,.08,[x+side*.64,1.60,railZ-.035],[Math.PI/2,0,0]);
  for(let index=0;index<3;index++){
   const utensilX=x-.32+index*.31;
   ring('steel',.025,.006,[utensilX,1.56,railZ]);
   cylinder('steel',.008,.008,.21,[utensilX,1.43,railZ]);
   if(index===1){box('steel',[.085,.11,.015],[utensilX,1.285,railZ]);for(let slot=0;slot<3;slot++)box('dark',[.008,.067,.018],[utensilX-.025+slot*.025,1.292,railZ+.008]);}
   else{sphere('steel',index===0?.052:.043,[utensilX,1.285,railZ]);}
  }
 }

 const sink=world.stations.find(item=>item.id==='sink');
 if(sink){const x=sink.surface[0]+.67,z=sink.surface[1]-.035,y=sink.height;
  // Side drainer and upright plates; the sink placement center stays unobstructed.
  box('dark',[.48,.025,.49],[x,y+.032,z]);
  for(const side of[-1,1]){
   cylinder('steel',.009,.009,.47,[x,y+.12,z+side*.225],[0,0,Math.PI/2]);
   cylinder('steel',.009,.009,.45,[x+side*.23,y+.12,z],[Math.PI/2,0,0]);
  }
  for(let index=0;index<5;index++){
   const plateX=x-.17+index*.085;
   ring('ceramic',.153,.018,[plateX,y+.205,z],[0,Math.PI/2,0]);
   cylinder('ceramic',.145,.145,.012,[plateX,y+.205,z],[0,0,Math.PI/2]);
   cylinder('steel',.007,.007,.43,[plateX,y+.07,z],[Math.PI/2,0,0]);
  }
  // Rear steel tumbler stays away from the delivery/arm handoff region.
  cylinder('steel',.055,.045,.13,[sink.surface[0]-.72,y+.075,sink.surface[1]-.31]);
 }

 // Window sill, upper blinds and one potted herb; all wall fixtures above 1.45m.
 box('wood',[2.18,.065,.30],[0,1.49,back+.13]);
 for(let index=0;index<5;index++)box('wood',[1.94,.064,.037],[0,2.43-index*.074,back+.112],[-.19,0,0]);
 for(const side of[-1,1])box('ceramic',[.012,.39,.012],[side*.67,2.25,back+.14]);
 const plantX=.73,plantZ=back+.15;
 cylinder('terracotta',.125,.09,.19,[plantX,1.62,plantZ]);
 cylinder('dark',.106,.106,.008,[plantX,1.718,plantZ]);
 for(let index=0;index<7;index++){
  const angle=index*Math.PI*2/7,radius=.055+(index%2)*.035,tipY=1.82+(index%3)*.055;
  const leaf=new SphereGeometry(.062,10,7);leaf.scale(.52,1.65,.72);
  add('leaf',leaf,[plantX+Math.cos(angle)*radius,tipY,plantZ+Math.sin(angle)*radius],[Math.sin(angle)*.42,angle,Math.cos(angle)*.42]);
  cylinder('leaf',.005,.005,tipY-1.71,[plantX,1.71+(tipY-1.71)/2,plantZ]);
 }

 // Low wall trim adds a room edge without adding any traversable-floor geometry.
 box('wood',[world.bounds.maxX-world.bounds.minX,.10,.026],[0,.065,back-.01]);
 box('wood',[.026,.10,world.bounds.maxZ-world.bounds.minZ],[world.bounds.minX+.07,.065,0]);

 const batches:{finish:Finish;geometry:BufferGeometry}[]=[];
 for(const[finish,geometries]of parts){const geometry=mergeGeometries(geometries,false);for(const part of geometries)part.dispose();if(geometry)batches.push({finish,geometry});}
 return batches;
}

export function KitchenVisualDetails({world}:{world:MobileWorld}){
 // Scene movement does not rebuild decorative geometry. Only the fixed map matters.
 const layoutKey=JSON.stringify({bounds:world.bounds,stations:world.stations,obstacles:world.obstacles.filter(item=>['counter-unit','sink-unit'].includes(item.id))});
 const batches=useMemo(()=>buildDetails(world),[layoutKey]);
 useEffect(()=>()=>{for(const batch of batches)batch.geometry.dispose();},[batches]);
 return <group name="kitchen-decorative-fixtures" userData={{actionable:false,basis:'visual-context-only'}}>
  {batches.map(({finish,geometry})=><mesh key={finish} geometry={geometry} castShadow receiveShadow><meshStandardMaterial {...finishes[finish]}/></mesh>)}
 </group>;
}
export default KitchenVisualDetails;
