import fs from 'node:fs';
import {spawn} from 'node:child_process';
const step=process.argv[2],dir='artifacts/creature-facts-specific';
const commands={build:['node_modules/next/dist/bin/next','build','--webpack'],bundle:['node_modules/@opennextjs/cloudflare/dist/cli/index.js','build','--skipNextBuild'],deploy:['node_modules/@opennextjs/cloudflare/dist/cli/index.js','deploy'],deployments:['node_modules/wrangler/bin/wrangler.js','deployments','list','--json'],whoami:['node_modules/wrangler/bin/wrangler.js','whoami']};
if(!commands[step])throw Error('Unknown release step');
const logfile=`${dir}/${step}-release.log`,out=fs.openSync(logfile,'w');
const child=spawn(process.execPath,commands[step],{stdio:['ignore',out,out],env:{...process.env,WRANGLER_LOG_PATH:process.cwd()+`/${dir}/wrangler-release.log`}});
child.on('error',e=>{console.error(e.message);process.exitCode=1});
child.on('close',code=>{
 fs.closeSync(out);
 for(const p of [`${dir}/wrangler-release.log`,logfile])if(fs.existsSync(p))fs.writeFileSync(p,fs.readFileSync(p,'utf8').split('\n').filter(line=>!/(?:refresh_token|access_token|oauth_token|id_token|client_secret|fetching auth token)/i.test(line)).join('\n'));
 fs.writeFileSync(`${dir}/${step}-result.json`,JSON.stringify({step,exitCode:code,finishedAt:new Date().toISOString(),logfile},null,2));
 console.log(JSON.stringify({step,exitCode:code,logfile}));process.exitCode=code??1;
});
