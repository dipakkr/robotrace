import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {tsImport} from 'tsx/esm/api';
import {physicalReportForRecord,renderPhysicalReportHtml,renderPhysicalRouteSvg} from './physical-report.mjs';
import {createExperimentStore} from './experiment-store.mjs';
import {createApiServer} from './index.mjs';
const nav=await tsImport('../src/sim/mobile-navigation.ts',import.meta.url);
const {createMobileEvidence}=await tsImport('../src/data/mobile-evidence.ts',import.meta.url);
function fixture(){
 const initial=nav.createMobileKitchen();let world=initial;const samples=[{time:0,world:structuredClone(initial)}];
 world=nav.startMobilePlan(initial,nav.planMobileTask('Go straight 1 meter',initial),'immediate').world;
 for(let i=0;i<1000;i++){const result=nav.advanceMobileWorld(world,.1);world=result.world;samples.push({time:world.simTime,world:structuredClone(world)});if(result.done||result.blocked)break;}
 const startedAt=1700000000000;
 return {schema:'robotrace.voice-experiment.v1',id:randomUUID(),startedAt,endedAt:startedAt+20000,environmentId:'mobile-kitchen',initialWorld:initial,finalWorld:world,events:[],transcripts:[{id:'user:1',speaker:'user',text:'Go straight one meter',final:true,receivedAt:startedAt+100}],attempts:[{id:'attempt-1',command:'Go straight 1 meter',outcome:world.mission.status,payload:createMobileEvidence(initial,samples,world,null),metadata:{userTurnId:'user:1',startedAt:startedAt+200,endedAt:startedAt+10000}}],recording:{truncated:false,droppedEvents:0,droppedTranscripts:0,droppedAttempts:0}};
}
async function saved(t){const dir=await mkdtemp(join(tmpdir(),'robotrace-report-'));t.after(()=>rm(dir,{recursive:true,force:true}));const store=createExperimentStore({dataDirectory:dir}),receipt=await store.save({experiment:fixture()});return {dir,store,record:await store.get(receipt.id)};}
test('standalone analysis keeps the sealed historical grade and uses actual native routes without mutating source',async t=>{
 const {record}=await saved(t),before=structuredClone(record),report=await physicalReportForRecord(record);
 assert.deepEqual(record,before);assert.deepEqual(report.requests,record.report.rows);assert.deepEqual(report.requestSummary,record.report.counts);assert.equal(report.sourceRecord.integrity.sha256,record.integrity.sha256);
 assert.equal(report.attempts[0].taskAccepted,true);assert.equal(report.attempts[0].metrics.actualTravelMeters,1);assert.ok(report.attempts[0].routes.actual.length>2);assert.ok(report.attempts[0].routes.planned.length>=2);
 const html=renderPhysicalReportHtml(report);assert.match(html,/Print \/ Save PDF/);assert.match(html,/class="actual"/);assert.match(html,/class="planned"/);assert.match(html,/historical results/);assert.match(html,/No physical validation/);assert.doesNotMatch(html,/\[object Object\]/);
});
test('untrusted report text and SVG labels are escaped with no external assets or executable input',async t=>{
 const {record}=await saved(t),report=await physicalReportForRecord(record),attack='<img src=x onerror="alert(1)"><script>alert(1)</script>';
 report.title=attack;report.requests[0].source.text=attack;report.attempts[0].command=attack;report.attempts[0].routes.obstacles[0].label=attack;
 const html=renderPhysicalReportHtml(report);assert.doesNotMatch(html,/<img|<script|src="https?:|href="https?:/);assert.match(html,/&lt;img/);assert.match(html,/&lt;script/);assert.match(html,/&quot;alert/);
 assert.equal(renderPhysicalRouteSvg({...report.attempts[0],routes:{...report.attempts[0].routes,bounds:{minX:0,maxX:0,minZ:0,maxZ:0}}}),'<p>Route bounds could not be established.</p>');
});
test('local report HTML and JSON reopen persisted evidence and download without any provider request',async t=>{
 const {dir,record,store}=await saved(t),server=createApiServer({env:{},dataDirectory:dir,fetchImpl:()=>assert.fail('No provider calls')});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));const base=`http://127.0.0.1:${server.address().port}/api/experiments/`;
 const response=await fetch(`${base}${record.id}/report.json`),report=await response.json();assert.equal(response.status,200);assert.equal(report.schema,'robotrace.physical-evaluation-report.v1');assert.equal(report.identity.experimentId,record.id);assert.deepEqual(report.requests,record.report.rows);
 const html=await fetch(`${base}${record.id}/report.html?download=1`);assert.equal(html.status,200);assert.match(html.headers.get('content-type'),/text\/html/);assert.match(html.headers.get('content-disposition'),/attachment; filename="robotrace-physical-evaluation/);assert.equal(html.headers.get('x-content-type-options'),'nosniff');assert.match(await html.text(),/<svg/);
 assert.equal((await fetch(`${base}${randomUUID()}/report.html`)).status,404);assert.deepEqual(await store.get(record.id),record);
});

test('current evaluator assessment is separate from immutable supplied historical request grades',async t=>{
 const {record}=await saved(t);
 const historic=structuredClone(record);historic.report.evaluatorRevision='historical-test-revision';historic.report.rows[0].status='unscored';historic.report.counts={passed:0,failed:0,unscored:1,'request-failed':0,cancelled:0};
 const before=structuredClone(historic),report=await physicalReportForRecord(historic);
 assert.deepEqual(historic,before);assert.equal(report.requests[0].status,'unscored');assert.equal(report.currentAssessment.rows[0].status,'passed');assert.equal(report.currentAssessment.evaluatorRevision,'robotrace-request-eval.4');assert.equal(report.sourceRecord.historicalEvaluatorRevision,'historical-test-revision');
 const html=renderPhysicalReportHtml(report);assert.match(html,/current assessment/);assert.match(html,/Sealed historical grades/);assert.match(html,/historical-test-revision/);assert.match(html,/Current assessment above does not overwrite/);
});

test('workstation-facing diagnostic reports review and degrees separately from native historical grade',async t=>{
 const {record}=await saved(t),report=await physicalReportForRecord(record);
 report.attempts[0].orientationAssessment={status:'review',expectedYawRadians:0,observedYawRadians:.2,errorRadians:.2,toleranceRadians:.12,stationLabel:'Counter',basis:'Recorded analytic base yaw.'};
 const html=renderPhysicalReportHtml(report);assert.match(html,/Workstation facing diagnostic/);assert.match(html,/review · 11.5° error/);assert.match(html,/review does not rewrite the saved native grade/);assert.equal(report.attempts[0].taskAccepted,true);
});

function proposedAnalysis(report){return {schema:'robotrace.speech-test-cases.v1',sourceExperimentId:report.identity.experimentId,model:'test-model',proposed:true,executionPerformed:false,coverage:{totalUserRequests:2,coveredUserRequests:1,uncoveredSourceTurnIds:['uncovered-turn'],generatedCaseCount:1},cases:[{sourceTurnId:'user:1',intent:'navigate',expectedBehavior:'execute',expectedSummary:'Reach the requested station without pickup.',predicates:[{type:'base-at-station',stationId:'counter'}],verification:{status:'failed',checks:[{predicate:{type:'base-at-station',stationId:'counter'},passed:false,detail:'Recorded base remained at home.'}],association:{confidence:'explicit'},actualCommands:['Go Home'],assistantReplies:[{id:'reply:1',text:'The cup cannot be removed.',at:1700000001000}],source:{text:'Go to counter',kind:'recorded-asr'},reason:'The proposed station predicate was not met.'},conversationReview:{status:'issue',reason:'The response described an unsupported capability limitation.',evidenceReplyIds:['reply:1'],proposed:true}}]};}

test('conversation report renders actual coverage, measured predicates and separately proposed semantic review',async t=>{
 const {record}=await saved(t),report=await physicalReportForRecord(record);report.llmQA=proposedAnalysis(report);const html=renderPhysicalReportHtml(report);
 for(const text of ['Conversation-derived test cases','1/2 final user requests covered','Go to counter','Reach the requested station without pickup.','Base at counter','Recorded base remained at home.','Go Home','Unreviewed LLM conversation judgment: issue','The cup cannot be removed.','reply:1','uncovered-turn','Review priorities','not human gold'])assert.ok(html.includes(text),text);
 assert.match(html,/class="verdict failed"/);assert.doesNotMatch(html.replace(/<style>[\s\S]*?<\/style>/g,''),/100%|universally sufficient/);
});

test('missing, invalid or source-mismatched speech analysis cannot masquerade as completed QA',async t=>{
 const {record}=await saved(t),report=await physicalReportForRecord(record);assert.match(renderPhysicalReportHtml(report),/Pending\./);
 report.llmQA=proposedAnalysis(report);report.llmQA.sourceExperimentId='other-record';assert.match(renderPhysicalReportHtml(report),/source experiment does not match/);assert.doesNotMatch(renderPhysicalReportHtml(report),/Recorded base remained at home/);
 report.llmQA.sourceExperimentId=report.identity.experimentId;report.llmQA.coverage={totalUserRequests:NaN,coveredUserRequests:50};assert.match(renderPhysicalReportHtml(report),/Request coverage not established/);
});

test('model expectations, coverage IDs, semantic reasons and quoted replies are escaped',async t=>{
 const {record}=await saved(t),report=await physicalReportForRecord(record);report.speechTestAnalysis=proposedAnalysis(report);const attack='<img src=x onerror="alert(1)"><script>alert(1)</script>',analysis=report.speechTestAnalysis;
 analysis.model=attack;analysis.coverage.uncoveredSourceTurnIds=[attack];Object.assign(analysis.cases[0],{intent:attack,expectedSummary:attack});analysis.cases[0].verification.assistantReplies[0].text=attack;analysis.cases[0].conversationReview.reason=attack;
 const html=renderPhysicalReportHtml(report);assert.doesNotMatch(html,/<img|<script|\[object Object\]/);assert.match(html,/&lt;script/);assert.match(html,/&quot;alert/);
});

test('recorded speed diagnostics name simulation clock and never imply measured hardware speed',async t=>{
 const {record}=await saved(t),report=await physicalReportForRecord(record);report.attempts[0].metrics.speed={averageMetersPerSimSecond:.5,configuredMetersPerSimSecond:.8,movingSeconds:2,stationarySeconds:1,peakSampledMetersPerSimSecond:.8,rotationSeconds:.2,basis:'native-simulated-state-intervals; not motor telemetry or wall-clock speed'};
 const html=renderPhysicalReportHtml(report);assert.match(html,/Average base speed/);assert.match(html,/0.500 m\/sim s/);assert.match(html,/Moving \/ stationary/);assert.match(html,/not wall-clock playback or measured motor telemetry/);
});
