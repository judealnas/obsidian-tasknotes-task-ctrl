import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const expression = String.raw`(async () => {
 const api = app.plugins.getPlugin('tasknotes').api;
 await api.lifecycle.ready();
 if ((await api.time.active()).length) throw new Error('Existing active timers; refusing to touch them');
 const run='statusbar-debug-'+Date.now();
 const context={source:'timer-pane-statusbar-debug',reason:'disposable status-bar reproduction',correlationId:run};
 const result={run,at:new Date().toISOString(),tasknotes:app.plugins.getPlugin('tasknotes').manifest.version,events:[],samples:[]};
 window.__statusBarDebug=result;
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
 const refs=['task.updated','time.started','time.stopped'].map(name=>api.events.on(name,()=>result.events.push({name,at:Date.now()})));
 let task=null;
 const sample=async label=>{
  const active=await api.time.active();
  const status=document.querySelector('.tasknotes-status-bar:not(.tasknotes-pomodoro-status)');
  const view=app.workspace.getLeavesOfType('tasknotes-timer-pane')[0].view;
  const entry=active.find(item=>item.taskPath===task?.path);
  result.samples.push({label,at:Date.now(),active:active.map(item=>({path:item.taskPath,startTime:item.entry.startTime})),fixtureElapsedMs:entry?Date.now()-Date.parse(entry.entry.startTime):null,statusVisible:!!status&&getComputedStyle(status).display!=='none',statusText:status?.querySelector('.tasknotes-status-text')?.textContent??null,paneSnapshot:view.services.store.getSnapshot(),notices:[...document.querySelectorAll('.notice')].map(n=>n.textContent)});
 };
 try {
  result.statusSetting=api.settings.snapshot().showTrackedTasksInStatusBar;
  if(result.statusSetting!==true)throw new Error('Native tracked-task status bar is disabled');
  task=await api.tasks.create({title:run,status:'open'},context);result.fixture=task.path;
  await wait(6000);await sample('baseline-after-cache-expiry');
  await api.time.start(task.path,{},context);await wait(650);await sample('direct-public-api-start');
  await api.time.stop(task.path,context);await wait(650);await sample('direct-public-api-stop-within-five-seconds');
  await wait(1600);await api.time.start(task.path,{},context);await wait(650);await sample('direct-public-api-restart-old-status-time');
  await api.time.stop(task.path,context);await wait(6500);await sample('direct-public-api-stopped-no-new-event-after-expiry');
  if(!(await api.time.active()).length){
   const status=document.querySelector('.tasknotes-status-bar:not(.tasknotes-pomodoro-status)');
   if(status&&getComputedStyle(status).display!=='none'){
    status.querySelector('.tasknotes-status-stop')?.click();await wait(450);await sample('click-stale-native-stop');
   }
  }
  await wait(6000);
  const view=app.workspace.getLeavesOfType('tasknotes-timer-pane')[0].view;
  result.paneStart=await view.services.controller.start({taskPath:task.path,title:task.title});
  await wait(650);await sample('pane-controller-start');
  const entry=(await api.time.active()).find(item=>item.taskPath===task.path);
  if(!entry)throw new Error('Pane did not start fixture');
  result.paneStop=await view.services.controller.stop({taskPath:task.path,title:task.title,startTime:entry.entry.startTime});
  await wait(650);await sample('pane-controller-stop-within-five-seconds');
  await wait(5500);await sample('pane-controller-stopped-after-expiry');
 } catch(error){result.error=String(error);}
 finally {
  if(task){
   const owned=(await api.time.active()).filter(item=>item.taskPath===task.path);
   if(owned.length)await api.time.stop(task.path,context);
   await api.tasks.update(task.path,{archived:true},context);
   result.cleanup={archivedFixture:task.path,remainingFixtureTimers:(await api.time.active()).filter(item=>item.taskPath===task.path).length};
  }
  for(const ref of refs)api.events.off(ref);
 }
 return result;
})()`;
const response=spawnSync(process.execPath,['scripts/uat/cdp.mjs','eval','--timeout-ms','60000','--expr',expression],{encoding:'utf8',timeout:65000,maxBuffer:5_000_000});
if(response.status!==0)throw new Error(response.stderr||response.stdout);
const result=JSON.parse(response.stdout);
writeFileSync('.planning/debug/status-bar-stale-native.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({run:result.run,error:result.error,cleanup:result.cleanup,samples:result.samples.map(({label,active,fixtureElapsedMs,statusVisible,statusText,notices})=>({label,activeCount:active.length,fixtureElapsedMs,statusVisible,statusText,notices}))}));
if(result.error)process.exitCode=1;
