import {execFile, spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp, readFile, rm, access} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {tmpdir, platform, arch, homedir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import net from 'node:net';
const exec=promisify(execFile);
export const ROOT=fileURLToPath(new URL('../',import.meta.url));
export const VIEWER_VERSION='0.1.48';
export function findViewer(root,installedRoot,exists=existsSync){
 const local=path.join(root,'vendor/node_modules/.bin/serve-sim');
 const installed=path.join(installedRoot,'vendor/node_modules/.bin/serve-sim');
 return exists(local)?local:exists(installed)?installed:local;
}
export const VIEWER=findViewer(ROOT,path.join(homedir(),'.local/share/portable-ios-simulator-bridge'));
const str=(description,extra={})=>({type:'string',minLength:1,description,...extra});
const udid=str('Exact simulator UDID from devices; never use the alias booted.',{pattern:'^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$'});
const bundleId=str('Application bundle identifier',{pattern:'^[A-Za-z0-9][A-Za-z0-9._-]+$'});
const absolute=str('Absolute filesystem path',{pattern:'^/'});
const coordinate={type:'number',minimum:0,maximum:1,description:'Normalized screen coordinate (0 to 1)'};
const port={type:'integer',minimum:1024,maximum:65535};
const definitions={
 doctor:['Check Xcode, simulator service and pinned viewer installation.',{},[],true],
 devices:['List available simulator devices and their exact UDIDs.',{},[],true],
 boot:['Boot an existing simulator and wait for it to be ready.',{udid},['udid']],
 build:['Build an existing Xcode project for a simulator. Does not install or launch it.',{udid,project:absolute,scheme:str('Xcode scheme',{pattern:'^[^-].*'}),derivedData:absolute},['udid','project','scheme','derivedData']],
 install:['Install an existing simulator .app bundle.',{udid,app:absolute},['udid','app']],
 launch:['Launch an installed simulator application.',{udid,bundleId},['udid','bundleId']],
 screenshot:['Capture the simulator screen as a PNG image.',{udid},['udid'],true],
 preview:['Start the pinned serve-sim viewer on localhost for this device. Keep this MCP session open.',{udid,port},['udid']],
 stop_preview:['Stop this bridge session\'s viewer process. Does not shut down or erase the simulator.',{},[]],
 tap:['Tap at normalized screen coordinates using serve-sim.',{udid,x:coordinate,y:coordinate},['udid','x','y']],
 type:['Type text into the focused field using serve-sim. Keyboard support depends on Xcode.',{udid,text:str('Text to type',{maxLength:10000})},['udid','text']],
 button:['Press a supported simulator hardware button.',{udid,name:{type:'string',enum:['home','lock']}},['udid','name']],
};
export const TOOLS=Object.entries(definitions).map(([name,[description,properties,required,readOnly]])=>({name,description,inputSchema:{type:'object',properties,required,additionalProperties:false},annotations:{readOnlyHint:!!readOnly,destructiveHint:false,openWorldHint:false}}));
export function validateArgs(name,args={}){
 const def=TOOLS.find(t=>t.name===name); if(!def) throw new Error('Unknown tool: '+name);
 if(!args||typeof args!=='object'||Array.isArray(args)) throw new Error('Arguments must be an object');
 const s=def.inputSchema;
 for(const k of Object.keys(args)) if(!Object.hasOwn(s.properties,k)) throw new Error('Unknown argument: '+k);
 for(const k of s.required) if(!Object.hasOwn(args,k)) throw new Error('Required argument: '+k);
 for(const [k,v] of Object.entries(args)){
  const r=s.properties[k];
  if(r.type==='string'&&(typeof v!=='string'||v.length<(r.minLength??0)||v.length>(r.maxLength??32768)||v.includes('\0')||(r.pattern&&!new RegExp(r.pattern,'s').test(v)))) throw new Error('Invalid '+k);
  if((r.type==='number'||r.type==='integer')&&(typeof v!=='number'||!Number.isFinite(v)||(r.type==='integer'&&!Number.isInteger(v))||v<r.minimum||v>r.maximum)) throw new Error('Invalid '+k);
  if(r.enum&&!r.enum.includes(v)) throw new Error('Invalid '+k);
 }
 return args;
}
export function selectDevice(data,id){
 const d=Object.values(data.devices??{}).flat().find(d=>d.udid.toLowerCase()===id.toLowerCase()&&d.isAvailable!==false);
 if(!d) throw new Error('Simulator '+id+' is not available. Run devices and use an available UDID.');
 return d;
}
export function buildArgs(a){return ['-project',a.project,'-scheme',a.scheme,'-destination','id='+a.udid,'-derivedDataPath',a.derivedData,'CODE_SIGNING_ALLOWED=NO','build'];}
export function mergeMcpConfig(config,entry){
 if(!config||typeof config!=='object'||Array.isArray(config)) throw new Error('Invalid MCP config');
 if(config.mcpServers&&(typeof config.mcpServers!=='object'||Array.isArray(config.mcpServers))) throw new Error('Invalid mcpServers');
 const existing=config.mcpServers?.['ios-simulator-bridge'];
 if(existing&&JSON.stringify(existing)!==JSON.stringify(entry)) throw new Error('ios-simulator-bridge already exists with different settings; preserved it.');
 return {...config,mcpServers:{...config.mcpServers,'ios-simulator-bridge':entry}};
}
export async function run(command,args,timeout=30000){
 try {const {stdout,stderr}=await exec(command,args,{timeout,maxBuffer:8*1024*1024,encoding:'utf8'});return stdout||stderr;}
 catch(e){throw new Error(command+' failed: '+String(e.stderr||e.message).slice(-4000));}
}
function reachable(port){return new Promise(resolve=>{const s=net.connect({port,host:'127.0.0.1'});s.once('connect',()=>{s.destroy();resolve(true)});s.once('error',()=>resolve(false));s.setTimeout(500,()=>{s.destroy();resolve(false)});});}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
export class Bridge{
 constructor({run:runner=run}={}){this.run=runner;this.viewer=null;this.disposed=false;}
 async call(name,args={}){
  const a=validateArgs(name,args);
  if(this.disposed) throw new Error('Bridge session has closed');
  if(name==='doctor') return this.doctor();
  if(name==='devices') return JSON.parse(await this.run('xcrun',['simctl','list','devices','available','--json']));
  if(name==='stop_preview') return this.stopPreview();
  const device=selectDevice(await this.call('devices'),a.udid);
  if(name==='boot'){
   if(device.state!=='Booted') await this.run('xcrun',['simctl','boot',a.udid]);
   await this.run('xcrun',['simctl','bootstatus',a.udid,'-b'],120000);return {udid:a.udid,state:'Booted'};
  }
  if(name==='build'){
   if(!a.project.endsWith('.xcodeproj')) throw new Error('project must point to an .xcodeproj directory');
   await access(a.project);
   const output=await this.run('xcodebuild',buildArgs(a),600000);return {udid:a.udid,derivedData:a.derivedData,output:output.slice(-12000)};
  }
  if(device.state!=='Booted') throw new Error('Simulator is not booted. Call boot with this UDID first.');
  if(name==='install'){if(!a.app.endsWith('.app')) throw new Error('app must point to a .app bundle');await access(a.app);return {output:await this.run('xcrun',['simctl','install',a.udid,a.app])};}
  if(name==='launch') return {output:await this.run('xcrun',['simctl','launch',a.udid,a.bundleId])};
  if(name==='screenshot') return this.screenshot(a.udid);
  if(name==='preview') return this.startPreview(a.udid,a.port??3200);
  await access(VIEWER).catch(()=>{throw new Error('Viewer is not installed. Run Install.command to download serve-sim@'+VIEWER_VERSION);});
  let command;
  if(name==='tap') command=['tap',String(a.x),String(a.y),'-d',a.udid];
  if(name==='type') command=['type','--stdin','-d',a.udid];
  if(name==='button') command=['button',a.name,'-d',a.udid];
  if(name==='type') return {output:await this.typeText(command,a.text),verified:false,note:'Input command completed; capture a screenshot to verify the result.'};
  return {output:await this.run(VIEWER,command),verified:false,note:'Input command completed; capture a screenshot to verify the result.'};
 }
 async typeText(args,text){
  return new Promise((resolve,reject)=>{
   const child=spawn(VIEWER,args,{stdio:['pipe','pipe','pipe']});let output='';let timer=setTimeout(()=>child.kill('SIGTERM'),30000);
   for(const stream of [child.stdout,child.stderr]) stream.on('data',b=>{output=(output+b).slice(-4000)});
   child.stdin.on('error',()=>{});child.once('error',e=>{clearTimeout(timer);reject(e)});
   child.once('exit',code=>{clearTimeout(timer);code===0?resolve(output):reject(new Error('Typing failed: '+output))});child.stdin.end(text);
  });
 }
 async doctor(){
  const checks={platform:{ok:platform()==='darwin'&&arch()==='arm64',detail:platform()+'/'+arch()}};
  for(const [key,cmd,args] of [['xcode','xcode-select',['-p']],['simulator','xcrun',['simctl','list','devices','available','--json']]]){
   try{const detail=await this.run(cmd,args);checks[key]={ok:true,detail:key==='simulator'?JSON.parse(detail):detail.trim()};}catch(e){checks[key]={ok:false,detail:e.message};}
  }
  try{await access(VIEWER);checks.viewer={ok:true,detail:'serve-sim@'+VIEWER_VERSION};}catch{checks.viewer={ok:false,detail:'Not installed. Run Install.command.'};}
  return {ok:Object.values(checks).every(c=>c.ok),checks};
 }
 async screenshot(id){
  const dir=await mkdtemp(path.join(tmpdir(),'ios-bridge-'));
  try{const file=path.join(dir,'screen.png');await this.run('xcrun',['simctl','io',id,'screenshot','--type=png',file]);const b=await readFile(file);if(b.length>8*1024*1024)throw new Error('Screenshot exceeds 8 MiB');return {image:b.toString('base64'),mimeType:'image/png'};}
  finally{await rm(dir,{recursive:true,force:true});}
 }
 async startPreview(udid,port){
  if(this.viewer) throw new Error('This session already owns a preview. Call stop_preview first.');
  if(this.starting) throw new Error('A preview is already starting.');
  this.starting=true;
  try{
   await access(VIEWER).catch(()=>{throw new Error('Viewer is not installed. Run Install.command.');});
   if(await reachable(port)) throw new Error('Port '+port+' is already in use. Choose a different port.');
   const child=spawn(VIEWER,[udid,'--port',String(port),'--host','127.0.0.1'],{stdio:['ignore','pipe','pipe']});
   const state={child,udid,port,log:'',error:null};this.viewer=state;
   child.on('error',e=>{state.error=e;});
   child.on('exit',()=>{if(this.viewer===state)this.viewer=null;});
   for(const stream of [child.stdout,child.stderr]) stream.on('data',b=>{state.log=(state.log+b).slice(-4000)});
   const end=Date.now()+20000;
   while(Date.now()<end){
    if(state.error||child.exitCode!==null||child.signalCode!==null) throw new Error('Viewer failed: '+(state.error?.message??state.log));
    if(this.disposed) throw new Error('Bridge session closed while viewer was starting');
    if(await reachable(port)) return {url:'http://localhost:'+port,udid,port,note:'Open this URL in Conductor or Cloudroom browser. Keep this bridge session running.'};
    await delay(200);
   }
   throw new Error('Viewer did not become ready within 20 seconds: '+state.log);
  }catch(e){await this.stopPreview();throw e;}finally{this.starting=false;}
 }
 async stopPreview(){
  const s=this.viewer;this.viewer=null;
  if(s&&s.child.exitCode===null&&s.child.signalCode===null){
   s.child.kill('SIGTERM');
   await Promise.race([new Promise(r=>s.child.once('exit',r)),delay(1500)]);
   if(s.child.exitCode===null&&s.child.signalCode===null)s.child.kill('SIGKILL');
  }
  return {stopped:!!s,note:'Simulator remains running. Upstream shared simulator helpers may remain running.'};
 }
 async dispose(){this.disposed=true;await this.stopPreview();}
}
