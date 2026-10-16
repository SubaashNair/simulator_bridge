#!/usr/bin/env node
import {install} from './src/install.mjs';
const args=process.argv.slice(2);
if(args.some(a=>a!=='--project-only')){console.error('Usage: node install.mjs [--project-only]');process.exitCode=1;}
else install({projectOnly:args.includes('--project-only')}).catch(e=>{console.error('Installation incomplete: '+e.message);process.exitCode=1});
