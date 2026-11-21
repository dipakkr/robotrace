import {createMobileKitchen,planMobileTask,findMobileRoute,mobileSegmentIsClear} from './mobile-navigation';
import type {MobileWorld,MobilePlan,MobilePoint} from './mobile-navigation';

export const PHOTO_HALL_PROVENANCE={
 basis:'manually-authored-photo-informed-layout',estimated:true,calibrated:false,dimensionsMeters:{width:7,depth:8},
 referenceSha256:['fa9ed582d144f9b5dc6fd338d178de60e3ce3c41558e3815097eeb2947fa5a9e','0eec25ed832cd2735346a29e184262f2221ed8928cac3e015660055fd544dd49'],
 photosIncluded:false,peopleReconstructed:false,rightsVerified:false,
 limitations:['Dimensions, furniture sizes and placement are explicit estimates from two reference views, not measured reconstruction.','Tables, stools, chairs and bench use conservative axis-aligned floor proxies.','The reference photos and identifiable people are not embedded in this scene or exported by this factory.','Navigation only: no Cup, Bowl, Sink, grasping, perception, SLAM or physical-deployment validation.'],
} as const;
export interface PhotoHallProvenance {basis:string;estimated:true;calibrated:false;dimensionsMeters:{width:number;depth:number};referenceSha256:readonly string[];photosIncluded:false;peopleReconstructed:false;rightsVerified:false;limitations:readonly string[];features?:{windows:('back'|'left')[];tvWall:'right'|'none'}}
export type PhotoHallWorld=MobileWorld&{environmentId:'photo-hall';photoHallProvenance:PhotoHallProvenance};
export interface PhotoRoomLayout {schema:'robotrace.room-spec.v1';title:string;widthMeters:number;depthMeters:number;fixtures:{id:string;kind:'desk'|'chair'|'bench';label:string;center:[number,number];size:[number,number]}[];windows:('back'|'left')[];tvWall:'right'|'none';assumptions:string[];safeSpawn:[number,number];calibrated:false;basis:'image-informed-estimated-office-layout'}
export const PHOTO_HALL_COMMANDS=['Go to front desk','Go to window desk','Go Home','Go straight 1 meter','Go to x -2.2 z -2.8'];

/** An estimated office layout informed by the supplied images, never a calibrated digital twin. */
export function createPhotoHallWorld():PhotoHallWorld{
 const base=createMobileKitchen();
 const obstacle=(id:string,label:string,x:number,z:number,width:number,depth:number)=>({id,label,minX:x-width/2,maxX:x+width/2,minZ:z-depth/2,maxZ:z+depth/2});
 return {...base,environmentId:'photo-hall',photoHallProvenance:structuredClone(PHOTO_HALL_PROVENANCE),bounds:{minX:-3.5,maxX:3.5,minZ:-4,maxZ:4},objects:[],
  stations:[{id:'home',label:'Home',dock:[-2.3,3.15],surface:[-2.3,3.15],height:0},{id:'counter',label:'Front desk',dock:[-2.1,1.05],surface:[.4,1.05],height:1.02},{id:'table',label:'Window desk',dock:[-2.1,-1.8],surface:[.4,-1.8],height:1.02}],
  obstacles:[obstacle('hall-front-desk','Front desk',.4,1.05,3.5,.94),obstacle('hall-window-desk','Window desk',.4,-1.8,3.5,.94),
   ...[-.8,.35,1.5].map((x,index)=>obstacle(`hall-front-stool-${index+1}`,'White stool',x,2.08,.46,.46)),
   ...[-.8,.35,1.5].map((x,index)=>obstacle(`hall-window-stool-${index+1}`,'White stool',x,-.79,.46,.46)),
   obstacle('hall-office-chair-1','Black office chair',2.65,1.05,.60,.66),obstacle('hall-office-chair-2','Black office chair',2.65,-1.8,.60,.66),
   obstacle('hall-wall-bench','Wall bench',3.18,-.2,.54,6.3),obstacle('hall-side-desk','Side desk',-3.21,.3,.54,2.0)],
  robot:{...base.robot,position:[-2.3,3.15],yaw:Math.PI,phase:'Ready in photo-informed office hall'},
  simulation:{...base.simulation,limitations:[...base.simulation.limitations,...PHOTO_HALL_PROVENANCE.limitations]},
 };
}

/** Translate only exact visible desk aliases; retain the canonical command in the native plan. */
export function planPhotoHallTask(command:string,world:MobileWorld):MobilePlan{
 const named=command.trim().replace(/[.!?]+$/,'').toLowerCase().replace(/^(?:please )?(?:go|navigate|drive)(?: to)? (?:the )?/,'');
 const actual=world.stations.find(station=>station.label.toLowerCase()===named);
 if(actual)return planMobileTask(`Go to ${actual.id}`,world);
 const match=command.trim().replace(/[.!?]+$/,'').match(/^(?:please )?(?:go|navigate|drive)(?: to)? (?:the )?(front desk|window desk|home)$/i);
 const alias=match?.[1].toLowerCase();
 const canonical=alias?`Go to ${alias==='front desk'?'counter':alias==='window desk'?'table':'home'}`:command;
 return planMobileTask(canonical,world);
}
/** Apply only bounded generated footprints; all route targets are independently checked. */
export function createPhotoHallWorldFromSpec(spec:PhotoRoomLayout,reference?:{sha256:string}):PhotoHallWorld{
 if(spec.schema!=='robotrace.room-spec.v1'||spec.basis!=='image-informed-estimated-office-layout'||typeof spec.title!=='string'||!spec.title.trim()||spec.title.length>100||![spec.widthMeters,spec.depthMeters].every(value=>Number.isFinite(value)&&value>=4&&value<=12)||!Array.isArray(spec.fixtures)||!spec.fixtures.length||spec.fixtures.length>12||spec.calibrated!==false||!Array.isArray(spec.assumptions)||spec.assumptions.some(value=>typeof value!=='string'||value.length>300)||!Array.isArray(spec.windows)||spec.windows.length>2||spec.windows.some(wall=>!['back','left'].includes(wall))||!['right','none'].includes(spec.tvWall)||!Array.isArray(spec.safeSpawn)||spec.safeSpawn.length!==2||!spec.safeSpawn.every(Number.isFinite))throw new Error('The estimated room specification is malformed.');
 const world=createPhotoHallWorld(),w=spec.widthMeters,d=spec.depthMeters;world.bounds={minX:-w/2,maxX:w/2,minZ:-d/2,maxZ:d/2};
 const ids=new Set<string>();world.obstacles=spec.fixtures.map(item=>{
  if(!/^hall-(desk|chair|bench)-\d+$/.test(item.id)||ids.has(item.id)||!['desk','chair','bench'].includes(item.kind)||!item.id.startsWith(`hall-${item.kind}-`)||typeof item.label!=='string'||!item.label.trim()||item.label.length>80||![item.center,item.size].every(point=>Array.isArray(point)&&point.length===2&&point.every(Number.isFinite))||item.size.some(size=>size<.02||size>.95)||item.center.some((center,axis)=>center-item.size[axis]/2<0||center+item.size[axis]/2>1))throw new Error('Furniture footprints must stay within the supported estimated floor.');
  ids.add(item.id);return{id:item.id,label:item.label,minX:(item.center[0]-.5-item.size[0]/2)*w,maxX:(item.center[0]-.5+item.size[0]/2)*w,minZ:(item.center[1]-.5-item.size[1]/2)*d,maxZ:(item.center[1]-.5+item.size[1]/2)*d};
 });
 world.robot.position=[...spec.safeSpawn];world.robot.phase='Ready in operator-applied estimated office';
 if(!mobileSegmentIsClear(world,world.robot.position,world.robot.position))throw new Error('The estimated robot start intersects furniture or floor bounds.');
 if(!Array.isArray(spec.safeSpawn)||spec.safeSpawn.length!==2||!spec.safeSpawn.every(Number.isFinite)||!mobileSegmentIsClear(world,spec.safeSpawn,spec.safeSpawn))throw new Error('The draft has no valid collision-free robot start.');
 world.robot.position=[...spec.safeSpawn];world.robot.phase='Ready in image-informed estimated office';
 const desks=world.obstacles.filter(item=>item.id.startsWith('hall-desk-'));
 const used:MobilePoint[]=[[...spec.safeSpawn]];
 const reachable=(point:MobilePoint)=>mobileSegmentIsClear(world,point,point)&&used.every(prior=>Math.hypot(prior[0]-point[0],prior[1]-point[1])>.35)&&!!findMobileRoute(world,world.robot.position,point);
 const fallback=():MobilePoint|undefined=>{for(let z=world.bounds.minZ+.5;z<world.bounds.maxZ-.5;z+=.5)for(let x=world.bounds.minX+.5;x<world.bounds.maxX-.5;x+=.5){const point:MobilePoint=[x,z];if(reachable(point))return point;}return undefined;};
 const target=(index:number)=>{const desk=desks[index],candidates:MobilePoint[]=desk?[[desk.minX-.55,(desk.minZ+desk.maxZ)/2],[(desk.minX+desk.maxX)/2,desk.maxZ+.55],[desk.maxX+.55,(desk.minZ+desk.maxZ)/2],[(desk.minX+desk.maxX)/2,desk.minZ-.55]]:[];const point=candidates.find(reachable)??fallback();if(!point)throw new Error('The draft needs more connected clear floor for robot navigation.');used.push(point);return{point,label:desk?.label??(index===0?'Open floor A':'Open floor B'),surface:desk?[(desk.minX+desk.maxX)/2,(desk.minZ+desk.maxZ)/2] as MobilePoint:point};};
 const front=target(0),back=target(1);world.stations=[{id:'home',label:'Home',dock:[...spec.safeSpawn],surface:[...spec.safeSpawn],height:0},{id:'counter',label:front.label,dock:front.point,surface:front.surface,height:1.02},{id:'table',label:back.label,dock:back.point,surface:back.surface,height:1.02}];
 world.photoHallProvenance={basis:spec.basis,estimated:true,calibrated:false,dimensionsMeters:{width:w,depth:d},referenceSha256:reference&&/^[a-f\d]{64}$/.test(reference.sha256)?[reference.sha256]:[],photosIncluded:false,peopleReconstructed:false,rightsVerified:false,limitations:[...PHOTO_HALL_PROVENANCE.limitations,...spec.assumptions],features:{windows:[...spec.windows],tvWall:spec.tvWall}};
 world.simulation.limitations=[...world.simulation.limitations,...spec.assumptions];return world;
}
export function photoHallDock(world:MobileWorld,label:'Front desk'|'Window desk'|'Home'):MobilePoint{
 const station=world.stations.find(item=>item.label===label);if(!station)throw new Error('That desk is not present in this estimated hall.');return [...station.dock];
}
