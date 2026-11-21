import type {MobileWorld} from './mobile-navigation';
export type InventoryPosition=[number,number,number];
export interface KitchenSceneItem {id:string;label:string;kind:string;category:'movable-object'|'fixed-visual-context';surfaceId:string;position:InventoryPosition;manipulable:boolean;color?:string}
/** Mirrors the authored KitchenVisualDetails geometry, not camera detections.
 * Exposed constants make fixture counts/offsets reviewable for renderer reuse. */
export const KITCHEN_VISIBLE_FIXTURES=Object.freeze({kettleOffsetX:-.69,kettleOffsetZ:-.02,spiceJarCount:4,spiceShelfOffsetX:.26,spiceShelfOffsetZ:-.42,spiceJarStartX:-.08,spiceJarSpacing:.22,wallUtensilCount:3,plateCount:5,drainerOffsetX:.67,drainerOffsetZ:-.035,tumblerOffsetX:-.72,tumblerOffsetZ:-.31,herbX:.73});
export function kitchenSceneInventory(world:MobileWorld){
 const items:KitchenSceneItem[]=world.objects.map(object=>({id:object.id,label:object.label,kind:object.id,category:'movable-object',surfaceId:object.station==='robot'?'robot-carrier':object.station,position:[object.position[0],object.height+.09,object.position[1]],manipulable:true,...(object.color?{color:object.color}:{})}));
 const surfaces=new Map<string,string>(world.stations.filter(station=>station.id!=='home').map(station=>[station.id,station.label]));surfaces.set('robot-carrier','Robot carrier');
 const add=(id:string,label:string,kind:string,surfaceId:string,position:InventoryPosition)=>items.push({id,label,kind,category:'fixed-visual-context',surfaceId,position,manipulable:false});
 const hall=(world as MobileWorld&{environmentId?:string}).environmentId==='photo-hall';
 if(!hall){const counter=world.stations.find(station=>station.id==='counter'),sink=world.stations.find(station=>station.id==='sink'),back=world.bounds.minZ+.074,f=KITCHEN_VISIBLE_FIXTURES;
  if(counter){const [x,z]=counter.surface,y=counter.height;surfaces.set('spice-shelf','Rear spice shelf');surfaces.set('wall-rail','Wall-mounted utensil rail');
   add('visual-kettle','Steel kettle','kettle','counter',[x+f.kettleOffsetX,y+.158,z+f.kettleOffsetZ]);
   add('visual-spice-shelf','Spice shelf','shelf','counter',[x+f.spiceShelfOffsetX,y+.055,z+f.spiceShelfOffsetZ]);
   for(let index=0;index<f.spiceJarCount;index++)add(`visual-spice-${index+1}`,`Spice canister ${index+1}`,'spice-canister','spice-shelf',[x+f.spiceJarStartX+index*f.spiceJarSpacing,y+.16,z+f.spiceShelfOffsetZ]);
   for(let index=0;index<f.wallUtensilCount;index++)add(`visual-utensil-${index+1}`,index===1?'Hanging spatula':`Hanging spoon ${index===0?1:2}`,index===1?'spatula':'spoon','wall-rail',[x-.32+index*.31,1.285,back+.085]);
  }
  if(sink){const x=sink.surface[0]+f.drainerOffsetX,z=sink.surface[1]+f.drainerOffsetZ,y=sink.height;surfaces.set('sink-drainer','Sink-side plate drainer');
   add('visual-dish-drainer','Plate drainer','dish-drainer','sink',[x,y+.032,z]);
   for(let index=0;index<f.plateCount;index++)add(`visual-plate-${index+1}`,`Upright plate ${index+1}`,'plate','sink-drainer',[x-.17+index*.085,y+.205,z]);
   add('visual-tumbler','Steel tumbler','tumbler','sink',[sink.surface[0]+f.tumblerOffsetX,y+.075,sink.surface[1]+f.tumblerOffsetZ]);
  }
  surfaces.set('window-sill','Window sill');add('visual-herb','Potted herb','potted-herb','window-sill',[f.herbX,1.62,back+.15]);
 }
 const byKind:Record<string,number>={};for(const item of items)byKind[item.kind]=(byKind[item.kind]??0)+1;
 return{basis:'known-simulator-scene' as const,countingRule:'Authored semantic items, not perceived detections. Tiles, cabinet skins, mesh pieces and leaves are not separately counted. Fixed visual items are not graspable or task-plannable.',items,surfaces:[...surfaces].map(([id,label])=>({id,label,itemCount:items.filter(item=>item.surfaceId===id).length,itemIds:items.filter(item=>item.surfaceId===id).map(item=>item.id)})),counts:{total:items.length,manipulable:items.filter(item=>item.manipulable).length,fixedVisualContext:items.filter(item=>!item.manipulable).length,byKind}};
}
export const deriveSceneInventory=kitchenSceneInventory;
