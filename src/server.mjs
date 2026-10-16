import {StringDecoder} from 'node:string_decoder';
import {Bridge,TOOLS} from './core.mjs';
export async function serve(){
 const bridge=new Bridge();let queue=Promise.resolve(),buffer='',closed=false;const decoder=new StringDecoder('utf8');
 const send=r=>{if(!closed)process.stdout.write(JSON.stringify({jsonrpc:'2.0',...r})+'\n');};
 async function handle(line){
  let r;try{r=JSON.parse(line);}catch{send({id:null,error:{code:-32700,message:'Invalid JSON'}});return;}
  if(!r||Array.isArray(r)||r.jsonrpc!=='2.0'||typeof r.method!=='string'||(Object.hasOwn(r,'id')&&typeof r.id!=='string'&&typeof r.id!=='number')){send({id:null,error:{code:-32600,message:'Invalid Request'}});return;}
  if(!Object.hasOwn(r,'id'))return;
  const reply=result=>send({id:r.id,result});
  switch(r.method){
   case 'initialize':{
    const supported=['2024-11-05','2025-03-26','2025-06-18','2025-11-25'];const requested=r.params?.protocolVersion;
    reply({protocolVersion:supported.includes(requested)?requested:'2025-06-18',serverInfo:{name:'ios-simulator-bridge',version:'0.1.0'},capabilities:{tools:{listChanged:false}},instructions:'Run doctor first. Use an exact simulator UDID. The preview and all app tools must target that same device. Verify input actions with screenshots; no automatic UI success is inferred.'});break;
   }
   case 'ping':reply({});break;
   case 'tools/list':reply({tools:TOOLS});break;
   case 'tools/call':{
    try{const result=await bridge.call(r.params?.name,r.params?.arguments??{});reply(result?.image?{content:[{type:'image',data:result.image,mimeType:result.mimeType}]}:{content:[{type:'text',text:JSON.stringify(result)}]});}
    catch(e){reply({isError:true,content:[{type:'text',text:e.message}]});}break;
   }
   default:send({id:r.id,error:{code:-32601,message:'Method not found'}});
  }
 }
 process.stdin.on('data',chunk=>{
  buffer+=decoder.write(chunk);
  if(buffer.length>1024*1024){send({id:null,error:{code:-32600,message:'Request exceeds 1 MiB'}});shutdown();return;}
  for(let n;(n=buffer.indexOf('\n'))>=0;){const line=buffer.slice(0,n);buffer=buffer.slice(n+1);if(line.trim())queue=queue.then(()=>handle(line)).catch(e=>process.stderr.write(e.message+'\n'));}
 });
 async function shutdown(){if(closed)return;closed=true;process.stdin.pause();await bridge.dispose();process.exit(0);}
 process.stdin.on('end',()=>queue.finally(shutdown));
 for(const signal of ['SIGTERM','SIGINT'])process.once(signal,shutdown);
 process.stdout.on('error',shutdown);
}
