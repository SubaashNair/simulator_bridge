import {Bridge,TOOLS} from './core.mjs';
import {serve} from './server.mjs';
export async function main(argv){
 const [command,...rest]=argv;
 if(!command||['--help','help','-h'].includes(command)){
  console.log('Simulator Bridge 0.1.0\n\nUsage: simulator-bridge <command> [JSON arguments]\n\n  mcp        Start stdio MCP server\n  doctor     Check installation and simulator access\n  devices    List available UDIDs\n  preview    Start live viewer (foreground; Ctrl+C to stop)\n  config     Print Claude Code and Codex configuration\n\nDevice tools: '+TOOLS.map(t=>t.name).join(', ')+'\n\nExample: simulator-bridge preview \'{"udid":"YOUR-UDID","port":3200}\'\nRun Install.command to install the viewer and register agent tools.');return;
 }
 if(command==='mcp'){if(rest.length)throw new Error('mcp takes no arguments');await serve();return;}
 if(command==='config'){const {configurations}=await import('./install.mjs');console.log(JSON.stringify(configurations(),null,2));return;}
 if(rest.length>1)throw new Error('Supply one JSON object of arguments');
 let args={};if(rest[0]){try{args=JSON.parse(rest[0]);}catch{throw new Error('Arguments must be valid JSON');}}
 const bridge=new Bridge();
 if(command==='preview'){
  const shutdown=async()=>{await bridge.dispose();process.exit(0)};
  process.once('SIGINT',shutdown);process.once('SIGTERM',shutdown);
 }
 try{const result=await bridge.call(command,args);console.log(JSON.stringify(result,null,2));if(command==='doctor'&&!result.ok)process.exitCode=1;if(command!=='preview')await bridge.dispose();}
 catch(e){await bridge.dispose();throw e;}
}
