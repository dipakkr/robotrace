import {mobileGoalChecks} from './mobile-navigation';
import type {MobileWorld} from './mobile-navigation';
/** Translate actual goal checks into a factual receipt and past-tense announcement. */
export function mobileCompletionOutcome(world:MobileWorld){
 const goal=world.mission?.plan.goal;const checks=mobileGoalChecks(world);
 const verified=checks.length>0&&checks.every(check=>check.passed);
 const taskKind=goal?.hold?(world.mission?.plan.steps.at(-1)?.kind==='pickup'?'pickup':'carry'):goal?.objectId?'delivery':goal?'navigation':'unknown';
 const destination=world.stations.find(station=>station.id===goal?.stationId)?.label??goal?.stationId??'the target';
 const object=world.objects.find(item=>item.id===goal?.objectId)?.label??goal?.objectId;
 const summary=!verified?'The controller finished, but the task checks did not all pass.':taskKind==='pickup'?`${object} pickup at ${destination} verified; the object remains held.`:taskKind==='carry'?`${object} carry to ${destination} verified; the object remains held.`:taskKind==='delivery'?`${object} delivery to ${destination} verified after ${world.distanceTravelled.toFixed(2)} m of total base travel.`:`Navigation to ${destination} verified. ${world.robot.cargoObjectId?'The existing payload remains on the carrier.':'The carrier is empty.'}`;
 const announcement=!verified?'The mobile task checks did not all pass.':taskKind==='pickup'?`Pickup verified: ${object} is held at ${destination}.`:taskKind==='carry'?`Carry verified: ${object} reached ${destination} and remains held.`:taskKind==='delivery'?`Verified delivery: ${object} was released at ${destination}.`:`Navigation verified: the base reached ${destination}.${world.robot.cargoObjectId?' The existing payload remains held.':''}`;
 return {verified,taskKind,summary,announcement,receipt:{status:verified?'succeeded':'failed',verified,taskKind,checks,...(goal?{goal:{...goal}}:{}),placements:world.objects.map(item=>({objectId:item.id,objectLabel:item.label,observedLocation:item.station,destinationLabel:world.stations.find(station=>station.id===item.station)?.label??(item.station==='robot'?'Robot carrier':item.station)}))}};
}
