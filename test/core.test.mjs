import test from 'node:test';
import assert from 'node:assert/strict';
import {validateArgs, selectDevice, buildArgs, Bridge, mergeMcpConfig} from '../src/core.mjs';
const id='11111111-2222-3333-4444-555555555555';
test('required UDID rejects aliases, flags and unknown arguments',()=>{
 for(const a of [{udid:'booted'},{udid:'--help'},{udid:id,evil:true},{}]) assert.throws(()=>validateArgs('boot',a));
 assert.deepEqual(validateArgs('boot',{udid:id}),{udid:id});
});
test('input boundaries reject out of range coordinates and ports',()=>{
 for(const a of [{udid:id,x:-1,y:0},{udid:id,x:1.1,y:0},{udid:id,x:0,y:NaN}]) assert.throws(()=>validateArgs('tap',a));
 assert.throws(()=>validateArgs('preview',{udid:id,port:0}));
 assert.throws(()=>validateArgs('launch',{udid:id,bundleId:'--evil'}));
});
test('device selection is explicit and available',()=>{
 const d={devices:{runtime:[{udid:id,isAvailable:true,state:'Shutdown'}]}};
 assert.equal(selectDevice(d,id).udid,id);
 assert.throws(()=>selectDevice(d,'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'));
 d.devices.runtime[0].isAvailable=false; assert.throws(()=>selectDevice(d,id));
});
test('build paths and schemes remain single subprocess arguments',()=>{
 const a=buildArgs({udid:id,project:'/tmp/My App.xcodeproj',scheme:'My App',derivedData:'/tmp/Build'});
 assert.equal(a[a.indexOf('-project')+1],'/tmp/My App.xcodeproj');
 assert.equal(a[a.indexOf('-scheme')+1],'My App');
 assert.ok(a.includes('id='+id)); assert.equal(a.at(-1),'build');
 assert.throws(()=>validateArgs('build',{udid:id,project:'/a.xcodeproj',scheme:'-help'}));
});
test('doctor reports unavailable commands without claiming simulator success',async()=>{
 const bridge=new Bridge({run:async()=>{throw new Error('not available')}});
 const r=await bridge.call('doctor',{}); assert.equal(r.ok,false); assert.equal(r.checks.simulator.ok,false);
});
test('unknown device fails before install command executes',async()=>{
 let calls=[]; const b=new Bridge({run:async(c,a)=>{calls.push(a);return JSON.stringify({devices:{}})}});
 await assert.rejects(b.call('install',{udid:id,app:'/tmp/a.app'}),/not available/);
 assert.equal(calls.length,1);
});
test('config merge preserves unrelated entries and refuses a conflicting bridge',()=>{
 const e={command:'/node',args:['/bridge','mcp']};
 assert.deepEqual(mergeMcpConfig({other:true,mcpServers:{existing:{command:'x'}}},e),{other:true,mcpServers:{existing:{command:'x'},'ios-simulator-bridge':e}});
 assert.throws(()=>mergeMcpConfig({mcpServers:{'ios-simulator-bridge':{command:'different'}}},e),/already exists/);
});
test('screenshots return image data and remove private temporary files',async()=>{
 const {writeFile,access}=await import('node:fs/promises');let file;
 const b=new Bridge({run:async(cmd,args)=>{
  if(args.includes('list'))return JSON.stringify({devices:{runtime:[{udid:id,isAvailable:true,state:'Booted'}]}});
  file=args.at(-1);await writeFile(file,Buffer.from('fake-png'));return '';
 }});
 const result=await b.call('screenshot',{udid:id});assert.equal(result.mimeType,'image/png');assert.equal(Buffer.from(result.image,'base64').toString(),'fake-png');await assert.rejects(access(file));
});
test('screenshot temporary directory is removed after capture failure',async()=>{
 const {access}=await import('node:fs/promises');let file;
 const b=new Bridge({run:async(cmd,args)=>{if(args.includes('list'))return JSON.stringify({devices:{runtime:[{udid:id,isAvailable:true,state:'Booted'}]}});file=args.at(-1);throw new Error('capture failed')}});
 await assert.rejects(b.call('screenshot',{udid:id}),/capture failed/);await assert.rejects(access(file));
});
test('stop_preview touches only its owned viewer and leaves device alone',async()=>{
 const b=new Bridge({run:async()=>{throw new Error('must not invoke simulator commands')}});const {EventEmitter}=await import('node:events');const child=new EventEmitter();child.exitCode=null;child.signalCode=null;let signals=[];child.kill=signal=>{signals.push(signal);child.signalCode=signal;queueMicrotask(()=>child.emit('exit'))};b.viewer={child};
 assert.equal((await b.call('stop_preview')).stopped,true);assert.deepEqual(signals,['SIGTERM']);assert.equal((await b.call('stop_preview')).stopped,false);
});
test('project-source server can find viewer from full installation',async()=>{
 const {findViewer}=await import('../src/core.mjs');
 const installed='/installed/vendor/node_modules/.bin/serve-sim';
 assert.equal(findViewer('/source','/installed',p=>p===installed),installed);
 assert.equal(findViewer('/source','/installed',()=>true),'/source/vendor/node_modules/.bin/serve-sim');
});
