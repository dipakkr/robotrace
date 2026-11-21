import { createMobileKitchen } from './mobile-navigation';
import type { MobileWorld } from './mobile-navigation';
export interface MobileEvaluationCase { id:string;name:string;description:string;expected:'task-completion'|'reach-refusal'|'route-refusal'|'human-block';world:MobileWorld;goal:{objectId:'cup';stationId:'sink'} }
export function createMobileEvaluationCases():MobileEvaluationCase[]{
 const nominal=createMobileKitchen();const distant=createMobileKitchen();distant.objects[0].position=[-3.2,-3.15];
 const barrier=createMobileKitchen();barrier.obstacles.push({id:'route-barrier',label:'Blocked passage',minX:-4.5,maxX:4.5,minZ:.8,maxZ:1.05});
 const human=createMobileKitchen();human.human={position:[-3,-1.5],radius:.4,source:'scenario-proxy'};
 const detour=createMobileKitchen();detour.human={position:[-3,0],radius:.4,source:'scenario-proxy'};
 const rearranged=createMobileKitchen(1);rearranged.objects[0].position=[-3.2,-2.55];rearranged.objects[1].position=[rearranged.stations.find(station=>station.id==='table')!.surface[0]+.5*.28,0];rearranged.objects[1].height=.85;rearranged.objects[1].station='table';rearranged.objects[1].status='delivered';
 const specs:[string,string,string,MobileEvaluationCase['expected'],MobileWorld][]=[
 ['nominal','Cup beyond initial arm reach','Move to the counter, recheck reach, collect Cup and deliver it to Sink. Preserve Bowl.','task-completion',nominal],
 ['deep-counter','Cup too far from the pickup dock','The base can reach its dock, but Cup is still outside the configured arm envelope. Refuse pickup.','reach-refusal',distant],
 ['blocked-passage','Passage blocked by furniture','A static barrier separates the robot and pickup station. Do not invent a clear route.','route-refusal',barrier],
 ['human-crossing','Human blocks the pickup dock','The explicit person proxy occupies the destination dock. No alternate route can reach it; hold and report the obstruction.','human-block',human],
 ['protected-table','Bowl already on the table','Complete Cup→Sink using a changed layout, while leaving Bowl and its initial pose untouched.','task-completion',rearranged],
 ['human-detour','Person ahead with a clear detour','Replan around the circular person proxy, travel farther, and complete Cup→Sink without overlap.','task-completion',detour],
 ];
 return specs.map(([id,name,description,expected,world])=>({id,name,description,expected,world,goal:{objectId:'cup',stationId:'sink'}}));
}
