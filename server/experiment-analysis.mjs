import {tsImport} from 'tsx/esm/api';
let shared;
const helpers=()=>shared??=tsImport('../src/data/voice-experiment.ts',import.meta.url);

/** Explicit read-only reanalysis. The original sealed report is returned separately. */
export async function reanalyzeExperimentRecord(record){
 const {buildVoiceExperimentReport}=await helpers();
 return {
  report:buildVoiceExperimentReport(record.experiment),
  savedReport:structuredClone(record.report),
  sourceRecord:{id:record.id,integrity:structuredClone(record.integrity),savedAt:record.savedAt},
  analysisProvenance:'Current rules reanalysis of recorded evidence; no new execution. The original saved report and its integrity seal remain immutable.'
 };
}
