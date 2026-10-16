#!/usr/bin/env node
import {main} from '../src/cli.mjs';
main(process.argv.slice(2)).catch(e=>{process.stderr.write('Simulator Bridge: '+e.message+'\n');process.exitCode=1});
