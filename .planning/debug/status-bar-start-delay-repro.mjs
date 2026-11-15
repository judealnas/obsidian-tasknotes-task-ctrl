import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const expression = String.raw`(async()=>{
 const vaultPath=app.vault.adapter.getBasePath().split(String.fromCharCode(92)).join('/');
 if(vaultPath!=='C:/Users/ja384/Home/obsidian-tasknotes-timer-pane/dev-vault')throw Error('Unexpected vault');
 const api=app.plugins.getPlugin('tasknotes').api;
 if((await api.time.active()).length)throw Error('Existing timers; refusing test');
 const run='statusbar-start-delay-'+Date.now(),ctx={source:'statusbar-debug',reason:'disposable start-delay test',correlationId:run};
 const out={run,vaultPath,tasknotes:app.plugins.getPlugin('tasknotes').manifest.version,samples:[]};let task;
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
 const sample=async label=>{const el=document.querySelector('.tasknotes-status-bar:not(.tasknotes-pomodoro-status)');out.samples.push({label,at:Date.now(),active:(await api.time.active()).length,visible:!!el&&getComputedStyle(el).display!=='none',text:el?.querySelector('.tasknotes-status-text')?.textContent});};
 try{await wait(5500);task=await api.tasks.create({title:run,status:'open'},ctx);out.fixture=task.path;await wait(650);await sample('empty-status-cache-primed');await api.time.start(task.path,{},ctx);await wait(650);await sample('start-after-cached-empty-list');await wait(5500);await sample('after-former-cache-expiry');await api.tasks.update(task.path,{priority:'high'},ctx);await wait(650);await sample('after-later-task-event');}
 finally{if(task){if((await api.time.active()).some(x=>x.taskPath===task.path))await api.time.stop(task.path,ctx);await api.tasks.update(task.path,{archived:true},ctx);out.remainingFixtureTimers=(await api.time.active()).filter(x=>x.taskPath===task.path).length;}}
 return out;
})()`;
const response=spawnSync(process.execPath,['scripts/uat/cdp.mjs','eval','--timeout-ms','30000','--expr',expression],{encoding:'utf8',timeout:35000});
if(response.status!==0)throw Error(response.stderr||response.stdout);
const result=JSON.parse(response.stdout);
if(process.argv.includes('--fixed'))result.validation=result.samples.every(sample=>sample.visible===(sample.active>0));
writeFileSync(process.argv.includes('--fixed')?'.planning/debug/status-bar-start-delay-fixed.json':'.planning/debug/status-bar-start-delay-native.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
if(result.validation===false)process.exitCode=1;
