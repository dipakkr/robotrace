import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { callbackDnsHealth } from './callback-dns-health.mjs';
const url='https://demo-example.trycloudflare.com/api/voice/tools/00000000-0000-0000-0000-000000000000/context';
test('DNS fallback preserves hostname, SNI, certificate validation and credential-free health request',async()=>{
 let calls=0;
 const healthy=await callbackDnsHealth(url,{resolve4:async host=>{assert.equal(host,'demo-example.trycloudflare.com');return['104.16.230.132'];},requestImpl:(target,options,receive)=>{
  calls++;assert.equal(target.href,url);assert.equal(options.servername,target.hostname);assert.equal(options.rejectUnauthorized,true);assert.equal(options.method,'POST');assert.equal(options.headers.Authorization,undefined);assert.equal(target.username,'');assert.equal(options.autoSelectFamily,false);
  options.lookup(target.hostname,{},(error,address,family)=>{assert.equal(error,null);assert.equal(address,'104.16.230.132');assert.equal(family,4);});
  const req=new EventEmitter();req.setTimeout=()=>req;req.end=body=>{assert.equal(body,'{}');queueMicrotask(()=>receive({statusCode:401,resume(){}}));};return req;
 }});assert.equal(healthy,true);assert.equal(calls,1);
});
test('fallback refuses unrelated destinations, credentials and non-health callback paths before DNS',async()=>{
 for(const target of ['http://demo-example.trycloudflare.com',url.replace('demo-example.trycloudflare.com','example.org'),url.replace('https://','https://user:secret@'),url.replace('/context','/command'),url+'?x=1'])assert.equal(await callbackDnsHealth(target,{resolve4:async()=>{throw new Error('Must never query');},requestImpl:()=>{throw new Error('Must never connect');}}),false);
});
test('fallback never mistakes HTTP success or redirects for authenticated callback health',async()=>{
 for(const statusCode of [200,301,404,502])assert.equal(await callbackDnsHealth(url,{resolve4:async()=>['104.16.230.132'],requestImpl:(_url,_options,receive)=>{const req=new EventEmitter();req.setTimeout=()=>req;req.end=()=>queueMicrotask(()=>receive({statusCode,resume(){}}));return req;}}),false);
});
test('DNS failure and HTTPS certificate failure remain failed health checks',async()=>{
 assert.equal(await callbackDnsHealth(url,{resolve4:async()=>{throw new Error('DNS unavailable');}}),false);
 assert.equal(await callbackDnsHealth(url,{resolve4:async()=>['104.16.230.132'],requestImpl:()=>{const req=new EventEmitter();req.setTimeout=()=>req;req.end=()=>queueMicrotask(()=>req.emit('error',new Error('certificate mismatch')));return req;}}),false);
});
