import { expectedBehaviorVerdict } from './mobile-qa-verdict';
import type { MobileQaResult } from './mobile-qa-verdict';
import type { MobileCandidateResult } from '../sim/mobile-candidates';
export interface MobileQAObservation extends MobileQaResult {
 id:string;recordedAt:string;caseId:string;caseName:string;expected:string;campaignId:string|null;
 source:MobileCandidateResult['source'];label:string;model?:string;historySaved:boolean;
 protectedViolationCount:number;simulatedSeconds:number;requestDurationMs?:number;completedSteps:number;
}
export interface MobileQARecord {caseId:string;caseName:string;expected:string;campaignId:string|null;recordedAt:string;historySaved:boolean;result:MobileCandidateResult}
export function observationFromMobileQA(record:MobileQARecord):MobileQAObservation {
 const r=record.result;return {id:r.id,recordedAt:record.recordedAt,caseId:record.caseId,caseName:record.caseName,expected:record.expected,campaignId:record.campaignId,
 source:r.source,label:r.label,...(r.model?{model:r.model}:{}),historySaved:record.historySaved,outcome:r.outcome,taskAccepted:r.taskAccepted,failureCategory:r.failureCategory,
 completedPickups:r.completedPickups,completedPlacements:r.completedPlacements,distanceTravelled:r.distanceTravelled,checks:r.checks,
 protectedViolationCount:r.checks.filter(check=>check.id.startsWith('protected-')&&check.passed===false).length,simulatedSeconds:r.simulatedSeconds,completedSteps:r.completedSteps,...(r.requestDurationMs!==undefined?{requestDurationMs:r.requestDurationMs}:{})};
}
/** A persisted copy and its current-session result are one attempt, keyed by actual result ID. */
export function mergeMobileQAObservations(local:MobileQAObservation[],history:MobileQAObservation[]):MobileQAObservation[]{
 const records=new Map(history.map(run=>[run.id,run]));for(const run of local)records.set(run.id,run);
 return [...records.values()].sort((a,b)=>Date.parse(b.recordedAt)-Date.parse(a.recordedAt)||a.id.localeCompare(b.id));
}
export function summarizeMobileQA(runs:MobileQAObservation[],conditionIds:string[],requestFailures=0){
 const verdicts=runs.map(run=>expectedBehaviorVerdict(run.expected,run));
 return {attempts:runs.length,acceptedTasks:runs.filter(run=>run.taskAccepted).length,notAcceptedTasks:runs.filter(run=>!run.taskAccepted).length,
 controllerCompletions:runs.filter(run=>run.outcome==='completed').length,expectedMatches:verdicts.filter(verdict=>verdict.status==='matched').length,
 scoredExpectations:verdicts.filter(verdict=>verdict.status!=='unscored').length,unscoredExpectations:verdicts.filter(verdict=>verdict.status==='unscored').length,
 protectedViolations:runs.reduce((count,run)=>count+run.protectedViolationCount,0),conditionsCovered:new Set(runs.filter(run=>conditionIds.includes(run.caseId)).map(run=>run.caseId)).size,
 standardConditions:conditionIds.length,requestFailures};
}
export function mobileQACandidateKey(run:MobileQAObservation){return run.source==='llm'?`llm:${run.model??run.label}`:`${run.source}:${run.label}`;}
export function buildMobileQAMatrix(runs:MobileQAObservation[],conditions:{id:string;name:string}[]){
 const candidates=[...new Map(runs.map(run=>[mobileQACandidateKey(run),{id:mobileQACandidateKey(run),name:run.source==='llm'?run.model??run.label:run.label,source:run.source}])).values()];
 const rows=[...conditions];for(const run of runs)if(!rows.some(row=>row.id===run.caseId))rows.push({id:run.caseId,name:run.caseName});
 return {candidates,rows:rows.map(condition=>({...condition,cells:candidates.map(candidate=>{const attempts=runs.filter(run=>run.caseId===condition.id&&mobileQACandidateKey(run)===candidate.id).sort((a,b)=>Date.parse(b.recordedAt)-Date.parse(a.recordedAt));const latest=attempts[0]??null;return {candidateId:candidate.id,attempts:attempts.length,latest,verdict:latest?expectedBehaviorVerdict(latest.expected,latest):null};})}))};
}
