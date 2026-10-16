import {createInterface} from 'node:readline/promises';
import {Bridge} from './core.mjs';
const b=new Bridge();
const ui=createInterface({input:process.stdin,output:process.stdout});
const stop=async()=>{ui.close();await b.dispose();process.exit(0)};
process.once('SIGINT',stop);process.once('SIGTERM',stop);
try{
 const data=await b.call('devices');
 const devices=Object.values(data.devices).flat().filter(d=>d.isAvailable!==false);
 if(!devices.length)throw new Error('No available simulator devices. Install an iOS runtime in Xcode first.');
 devices.forEach((d,i)=>console.log(`${i+1}. ${d.name} (${d.state}) ${d.udid}`));
 const answer=await ui.question('Choose device number: ');const i=Number(answer)-1;
 if(!Number.isInteger(i)||i<0||i>=devices.length)throw new Error('Invalid device number');
 ui.close();const udid=devices[i].udid;
 await b.call('boot',{udid});const result=await b.call('preview',{udid});
 console.log('Preview: '+result.url+'\nOpen this URL in Conductor or Cloudroom. Keep this Terminal window open. Ctrl+C stops the viewer.');
}catch(e){console.error(e.message);await b.dispose();process.exitCode=1;ui.close();}
