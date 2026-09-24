import {readFileSync,readdirSync,existsSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const manifest=JSON.parse(readFileSync('assets/manifest.json','utf8'));
function files(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]);}
const errors=[],publicPaths=files('web/public');
for(const p of publicPaths){const entry=manifest.assets.find(x=>x.path===p);if(!entry)errors.push(`Missing provenance: ${p}`);else if(entry.sha256!==sha(p))errors.push(`Provenance hash changed: ${p}`);}
const approved=new Map(manifest.assets.map(a=>[a.path.replace('web/public/',''),a]));
for(const p of files('dist')){const rel=p.slice(5);if(rel==='index.html'||rel==='sw.js'||/^assets\/[A-Za-z0-9_-]+(?:\.worker)?-[A-Za-z0-9_-]+\.(js|css)$/.test(rel)){const text=readFileSync(p,'utf8');if(/__chacha|CHACHA_DATA|\/Users\/ko\/|好きすぎて滅|M!LK|sk-proj-|-----BEGIN.*PRIVATE KEY/.test(text))errors.push(`Private or test data in compiled code: ${p}`);continue;}const e=approved.get(rel);if(!e||sha(p)!==e.sha256)errors.push(`Unapproved build asset: ${p}`);}
const tracked=spawnSync('git',['ls-files','-z'],{encoding:'utf8'}).stdout.split('\0').filter(Boolean);for(const p of tracked){if(/(^|\/)(_private|\.venv|node_modules|reference|\.env)(\/|$)|\.(MP4|MP3|M4A|mov|logicx)$/i.test(p))errors.push(`Private candidate tracked: ${p}`);if(/\.(wav|m4a|mp3|zip|png|jpe?g|webp)$/i.test(p)&&!p.startsWith('web/public/')&&!p.startsWith('fixtures/'))errors.push(`Unapproved tracked binary: ${p}`);}
const report={date:new Date().toISOString(),status:errors.length?'FAIL':'PASS',scope:'tracked files and complete dist/public allowlist',trackedFileCount:tracked.length,publicAssetCount:publicPaths.length,distFileCount:files('dist').length,assets:manifest.assets,errors};mkdirSync('reports',{recursive:true});writeFileSync('reports/public-audit.json',JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,trackedFiles:tracked.length,publicAssets:publicPaths.length,distFiles:report.distFileCount,errors},null,2));if(errors.length||!existsSync('dist/index.html'))process.exit(1);
