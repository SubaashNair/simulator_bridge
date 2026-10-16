import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {configurations,writeProjectConfig} from '../src/install.mjs';
test('configuration uses absolute executable and entry paths',()=>{
 const c=configurations();assert.ok(path.isAbsolute(c.claude.mcpServers['ios-simulator-bridge'].command));assert.ok(path.isAbsolute(c.claude.mcpServers['ios-simulator-bridge'].args[0]));assert.equal(c.claude.mcpServers['ios-simulator-bridge'].args[1],'mcp');assert.match(c.codex,/\[mcp_servers\.ios-simulator-bridge\]/);
});
test('project registration is idempotent and preserves unrelated servers',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'bridge-config-'));
 try{const file=path.join(dir,'.mcp.json');await writeFile(file,JSON.stringify({mcpServers:{other:{command:'keep'}}}));await writeProjectConfig(dir);const once=await readFile(file,'utf8');await writeProjectConfig(dir);assert.equal(await readFile(file,'utf8'),once);assert.equal(JSON.parse(once).mcpServers.other.command,'keep');}finally{await rm(dir,{recursive:true,force:true})}
});
test('conflicting registration remains byte-for-byte unchanged',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'bridge-config-'));
 try{const file=path.join(dir,'.mcp.json'),original=JSON.stringify({mcpServers:{'ios-simulator-bridge':{command:'keep'}}});await writeFile(file,original);await assert.rejects(writeProjectConfig(dir),/already exists/);assert.equal(await readFile(file,'utf8'),original)}finally{await rm(dir,{recursive:true,force:true})}
});
test('installed payload contains its rerun entry point and license',async()=>{
 const {copyPayload}=await import('../src/install.mjs');const parent=await mkdtemp(path.join(os.tmpdir(),'bridge-payload-'));
 try{const target=path.join(parent,'installed');await copyPayload(target);assert.match(await readFile(path.join(target,'install.mjs'),'utf8'),/install/);assert.match(await readFile(path.join(target,'LICENSE'),'utf8'),/MIT/);}finally{await rm(parent,{recursive:true,force:true})}
});
test('installer refuses an existing unowned directory even without a package manifest',async()=>{
 const {copyPayload}=await import('../src/install.mjs');const target=await mkdtemp(path.join(os.tmpdir(),'bridge-unowned-'));
 try{await writeFile(path.join(target,'README.md'),'preserve');await assert.rejects(copyPayload(target),/not owned/);assert.equal(await readFile(path.join(target,'README.md'),'utf8'),'preserve');}finally{await rm(target,{recursive:true,force:true})}
});
