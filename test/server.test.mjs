import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const bin=fileURLToPath(new URL('../bin/simulator-bridge.mjs',import.meta.url));
function session(){
 const p=spawn(process.execPath,[bin,'mcp']);let buf='',stderr='';let id=0;const pending=new Map();
 p.stdout.on('data',b=>{buf+=b;for(let n;(n=buf.indexOf('\n'))>=0;){const line=buf.slice(0,n);buf=buf.slice(n+1);const r=JSON.parse(line);pending.get(r.id)?.(r);pending.delete(r.id)}});
 p.stderr.on('data',b=>stderr+=b);p.on('error',()=>{});
 return {p,stderr:()=>stderr,request(method,params={},raw){const current=++id;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(current);reject(new Error('MCP request timed out; '+stderr));p.kill()},3000);pending.set(current,r=>{clearTimeout(timer);resolve(r)});p.stdin.write((raw??JSON.stringify({jsonrpc:'2.0',id:current,method,params}))+'\n')})},close(){p.stdin.end();p.kill()}};
}
test('real stdio MCP initialize and tool discovery',async t=>{
 const s=session();t.after(()=>s.close());const r=await s.request('initialize',{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'test',version:'1'}});
 assert.equal(r.result.protocolVersion,'2024-11-05');assert.equal(r.result.serverInfo.name,'ios-simulator-bridge');
 const list=await s.request('tools/list');assert.ok(list.result.tools.some(t=>t.name==='screenshot'));assert.ok(list.result.tools.some(t=>t.name==='preview'));assert.equal(s.stderr(),'');
});
test('unknown tools and invalid arguments return tool errors without subprocess execution',async t=>{
 const s=session();t.after(()=>s.close());
 const bad=await s.request('tools/call',{name:'boot',arguments:{udid:'--erase'}});assert.equal(bad.result.isError,true);assert.match(bad.result.content[0].text,/Invalid udid/);
 const unknown=await s.request('tools/call',{name:'shell',arguments:{command:'rm'}});assert.equal(unknown.result.isError,true);
 const wrong=await s.request('bogus');assert.equal(wrong.error.code,-32601);
});
test('invalid JSON receives a JSON-RPC parse error',async t=>{
 const s=session();t.after(()=>s.close());const r=await new Promise(resolve=>{s.p.stdout.once('data',b=>resolve(JSON.parse(b.toString())));s.p.stdin.write('{bad json}\n')});assert.equal(r.error.code,-32700);assert.equal(r.id,null);
});
test('CLI help exits with usable instructions',async()=>{
 const p=spawn(process.execPath,[bin,'--help']);let out='';p.stdout.on('data',b=>out+=b);const code=await new Promise(r=>p.once('exit',r));assert.equal(code,0);assert.match(out,/doctor/);assert.match(out,/preview/);
});
