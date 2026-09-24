import {spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
mkdirSync('reports',{recursive:true});const results=[];
for(const command of ['typecheck','lint','test:unit','test:python','build','audit:public']){console.log(`\n[verify] ${command}`);const r=spawnSync('npm',['run',command],{encoding:'utf8',maxBuffer:32*1024*1024});process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'');writeFileSync(`reports/${command.replaceAll(':','-')}.log`,(r.stdout||'')+(r.stderr||''));results.push({command,status:r.status===0?'PASS':'FAIL',exitCode:r.status});writeFileSync('reports/verify.json',JSON.stringify({date:new Date().toISOString(),results},null,2));if(r.status!==0)process.exit(r.status??1);}
