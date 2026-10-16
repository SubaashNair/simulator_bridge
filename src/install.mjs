import path from 'node:path';
import os from 'node:os';
import {readFile,writeFile,rename,cp,mkdir,access,chmod} from 'node:fs/promises';
import {ROOT,VIEWER_VERSION,mergeMcpConfig,run} from './core.mjs';
export const NAME='ios-simulator-bridge';
export function configurations(root=ROOT){
 const entry={command:process.execPath,args:[path.join(root,'bin/simulator-bridge.mjs'),'mcp']};
 return {claude:{mcpServers:{[NAME]:entry}},codex:`[mcp_servers.${NAME}]\ncommand = ${JSON.stringify(entry.command)}\nargs = ${JSON.stringify(entry.args)}\n`,entry};
}
export async function writeProjectConfig(project,root=ROOT){
 const file=path.join(project,'.mcp.json');let original;
 try{original=await readFile(file,'utf8')}catch(e){if(e.code!=='ENOENT')throw e;}
 const config=mergeMcpConfig(original?JSON.parse(original):{},configurations(root).entry);
 const next=JSON.stringify(config,null,2)+'\n';if(next===original)return file;
 if(original)await writeFile(file+'.backup-'+Date.now(),original,{mode:0o600,flag:'wx'});
 const temp=file+'.tmp-'+process.pid;
 await writeFile(temp,next,{mode:0o600,flag:'wx'});await rename(temp,file);return file;
}
export async function copyPayload(target){
 if(path.resolve(ROOT)===path.resolve(target))return;
 let exists=true;try{await access(target)}catch(e){if(e.code==='ENOENT')exists=false;else throw e;}
 if(exists){
  let old;try{old=JSON.parse(await readFile(path.join(target,'package.json'),'utf8'))}catch{throw new Error('Installation directory is not owned by this bridge; preserved it.');}
  if(old.name!=='portable-ios-simulator-bridge')throw new Error('Installation directory is not owned by this bridge; preserved it.');
 }
 await mkdir(target,{recursive:true});
 for(const item of ['src','bin','docs','test','package.json','install.mjs','LICENSE','README.md','Install.command','Open Preview.command'])await cp(path.join(ROOT,item),path.join(target,item),{recursive:true});
}
async function existingClaude(){
 try{const json=JSON.parse(await readFile(path.join(os.homedir(),'.claude.json'),'utf8'));return json.mcpServers?.[NAME];}catch(e){if(e.code==='ENOENT')return;throw e;}
}
async function register(client,entry){
 if(client==='claude'){
  const old=await existingClaude();
  if(old){if(old.command===entry.command&&JSON.stringify(old.args)===JSON.stringify(entry.args))return 'Already registered';throw new Error('Existing Claude registration differs; it was preserved.');}
  return await run('claude',['mcp','add','--scope','user',NAME,'--',entry.command,...entry.args]);
 }
 let old;
 try{old=JSON.parse(await run('codex',['mcp','get',NAME,'--json']));}catch(e){
  if(!/not found|no mcp server|does not exist|no server named|unknown mcp server/i.test(e.message)){
   // Older Codex versions may not support get --json; check support before mutating.
   const help=await run('codex',['mcp','get','--help']);if(!help.includes('--json'))throw new Error('Update Codex or add the printed TOML configuration manually.');
   if(!/not found|no mcp server|does not exist|no server named|unknown mcp server/i.test(e.message))throw e;
  }
 }
 if(old){const transport=old.transport??old;if(transport.command===entry.command&&JSON.stringify(transport.args)===JSON.stringify(entry.args))return 'Already registered';throw new Error('Existing Codex registration differs; it was preserved.');}
 return await run('codex',['mcp','add',NAME,'--',entry.command,...entry.args]);
}
export async function install({projectOnly=false,project=process.cwd()}={}){
 if(projectOnly){console.log('Project configuration: '+await writeProjectConfig(project));return;}
 if(os.platform()!=='darwin'||os.arch()!=='arm64')throw new Error('This integration currently requires an Apple Silicon Mac.');
 if(Number(process.versions.node.split('.')[0])<20)throw new Error('Node.js 20 or newer is required.');
 const target=path.join(os.homedir(),'.local/share/portable-ios-simulator-bridge');
 await copyPayload(target);
 const results=[];
 try{await run('npm',['install','--prefix',path.join(target,'vendor'),'--no-audit','--no-fund','--fetch-retries=0','--fetch-timeout=20000','--cache',path.join(target,'.npm-cache'),'serve-sim@'+VIEWER_VERSION],120000);results.push({step:'viewer',ok:true});}
 catch(e){results.push({step:'viewer',ok:false,error:e.message});}
 const entry=configurations(target).entry;
 for(const client of ['claude','codex']){
  try{await register(client,entry);results.push({step:client,ok:true});}catch(e){results.push({step:client,ok:false,error:e.message});}
 }
 console.log(JSON.stringify({installedAt:target,results},null,2));
 console.log('Restart your agent sessions. In Conductor or Cloudroom choose a LOCAL session, then ask: Run the simulator doctor, list devices, boot my chosen device and open its preview.');
 if(results.some(r=>!r.ok))process.exitCode=1;
}
