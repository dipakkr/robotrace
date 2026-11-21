import test from 'node:test';import assert from 'node:assert/strict';
import {createMobileEvaluationCases} from './mobile-evaluation-cases';
import {baselineMobileCandidate,evaluateMobileCandidate} from './mobile-candidates';
test('mobile fixtures expose actual successes, geometric failures and guard refusals without fake completions',()=>{
 const cases=createMobileEvaluationCases();const results=cases.map(c=>evaluateMobileCandidate({world:c.world,candidate:baselineMobileCandidate(c.world,c.goal),goal:c.goal,source:'baseline',label:c.name}));
 assert.equal(results.filter(r=>r.taskAccepted).length,2);
 assert.equal(results[1].failureCategory,'reach');assert.equal(results[1].completedPickups,0);
 assert.equal(results[2].failureCategory,'no-route');assert.equal(results[2].distanceTravelled,0);
 assert.equal(results[3].failureCategory,'human-blocked');assert.equal(results[3].completedPlacements,0);
 assert.equal(results[4].taskAccepted,true);assert.deepEqual(results[4].finalWorld.objects.find(o=>o.id==='bowl'),cases[4].world.objects.find(o=>o.id==='bowl'));
});
