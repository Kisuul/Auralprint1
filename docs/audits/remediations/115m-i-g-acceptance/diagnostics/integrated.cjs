// Independent G.4 opt-in acceptance against the generated portable application.
// Observation hooks expose existing modules in served memory only. No source edit.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const assert = require('node:assert/strict'), crypto = require('node:crypto');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../../../../..');
const args = process.argv.slice(2), option = key => args.includes(key) ? args[args.indexOf(key)+1] : null;
const version = fs.readFileSync(path.join(root,'version'),'utf8').trim();
const html = fs.readFileSync(path.join(root,`dist/auralprint_${version.slice(1)}.html`),'utf8');
const marker = '  main();\n})();'; assert.equal(html.split(marker).length,2);
const observed = html.replace(marker,'  window.__acceptance={preferences,runtime,state,UI,BandBank,BandBankController,analysisFrame,AudioEngine,InputSourceManager,VisualizerRuntime,createAnalysisFrame,updateAnalysisFrame,selectOrbAnalysis,ColorPolicy,Renderer,CONFIG};\n'+marker);
const close = (actual,expected) => assert.ok(Math.abs(actual-expected) <= Math.max(1,Math.abs(expected))*1e-12,`${actual} != ${expected}`);
const orb = (id,ids=[0,255],speed=.123456) => ({id,chanId:'L',bandIds:ids,startAngleRad:.123456,hueOffsetDeg:37,motion:{angularSpeedRadPerSec:speed},trace:{numLines:15.5},particles:{emitPerSecond:13.5}});
function delayResume() {
 const Native=window.AudioContext;
 window.__pending={release:null,completed:false};
 window.AudioContext=class extends Native {
  constructor(...args){super(...args);this.suspend();}
  resume(){
   if(!__pending.release&&!__pending.completed)return new Promise((resolve,reject)=>{
    __pending.release=()=>{__pending.completed=true;return Native.prototype.resume.call(this).then(resolve,reject)};
   });
   return Native.prototype.resume.call(this);
  }
 };
}
function wav() {
 const samples=44100*8,b=Buffer.alloc(44+samples*4);
 b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(2,22);b.writeUInt32LE(44100,24);b.writeUInt32LE(176400,28);b.writeUInt16LE(4,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(samples*4,40);
 for(let i=0;i<samples;i++)for(let c=0;c<2;c++)b.writeInt16LE(Math.round((c?4500:10000)*Math.sin(2*Math.PI*(c?880:440)*i/44100)),44+i*4+c*2);
 return b;
}
async function main() {
 const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost').pathname;
  if(url==='/observed'||url==='/plain'){res.setHeader('Content-Type','text/html');res.end(url==='/plain'?html:observed);return;}
  const prefix=url.startsWith('/nested/auralprint/')?'/nested/auralprint/':url.startsWith('/hosted/')?'/hosted/':null;
  if(prefix){const relative=url.slice(prefix.length)||'index.html',file=path.resolve(root,'dist/hosted',relative);
   if(file.startsWith(path.resolve(root,'dist/hosted')+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile()){
    res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.json')||file.endsWith('.webmanifest')?'application/json':file.endsWith('.svg')?'image/svg+xml':'application/octet-stream');res.end(fs.readFileSync(file));return;
   }
  }
  res.writeHead(404);res.end();
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
 const evidence={auditedSha:'18d47e32e40d79d48f48409d0efa1bacce0f53fe',browser:await browser.version(),version,htmlSha256:crypto.createHash('sha256').update(html).digest('hex'),cases:[]};
 async function page(route='/observed',delayed=false){
  const p=await browser.newPage({viewport:{width:1440,height:1000}});p.setDefaultTimeout(15000);p.errors=[];
  p.on('pageerror',error=>p.errors.push(error.message));p.on('console',message=>{if(message.type()==='error')p.errors.push(message.text())});
  await p.addInitScript(()=>{window.__unhandled=[];addEventListener('unhandledrejection',e=>__unhandled.push(String(e.reason)))});
  if(delayed)await p.addInitScript(delayResume);
  await p.goto(base+route);
  await p.evaluate(()=>{if(getComputedStyle(document.getElementById('visualizersPanel')).display==='none')document.getElementById('btnOpenVisualizers').click()});return p;
 }
 async function apply(p,prefs){await p.evaluate(prefs=>{
  const payload=btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify({schema:10,prefs})))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  history.replaceState(null,'','#p='+payload);document.getElementById('btnApplyUrl').click();
 },prefs);await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
 async function share(p){return p.evaluate(()=>{
  document.getElementById('btnShare').click();return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(location.hash.slice(3).replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0))));
 });}
 async function opened(p,id='A'){await p.evaluate(id=>{
  const root=[...document.querySelectorAll('#orbEditorList [data-orb-id]')].find(r=>r.dataset.orbId===id);root.open=true;root.querySelectorAll('details').forEach(d=>d.open=true);
 },id);}
 async function capture(p,action='edit',id='A'){
  return p.evaluate(({action,id})=>{
   const c=[...document.querySelectorAll('#visualizerList button')].find(b=>b.dataset.action===action&&(action==='edit-ring'||b.dataset.orbId===id));
   if(!c)throw new Error(`Missing action ${action} for ${id}; inventory: ${[...document.querySelectorAll('#visualizerList button')].map(b=>b.dataset.action+':'+b.dataset.orbId).join(',')}`);
   c.focus();window.__focus=c;window.__focusRow=c.closest('.visualizer-item');
   return {action:c.dataset.action,id:c.dataset.orbId||null,focused:document.activeElement===c};
  },{action,id});
 }
 async function retained(p){await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const result=await p.evaluate(()=>({same:document.activeElement===__focus,connected:__focus.isConnected,sameRow:__focus.closest('.visualizer-item')===__focusRow,action:document.activeElement.dataset.action||null,id:document.activeElement.dataset.orbId||null}));assert.ok(result.same&&result.connected&&result.sameRow);return result;}
 async function check(name,fn){let p;try{p=await page();const data=await fn(p);assert.deepEqual(p.errors,[]);assert.deepEqual(await p.evaluate(()=>__unhandled),[]);evidence.cases.push({name,passed:true,data})}catch(e){evidence.cases.push({name,passed:false,failure:e.message,errors:p?.errors})}finally{if(p)await p.close()}}
 async function selection(p,id='A',uniform=false){
  return p.evaluate(({id,uniform})=>{
   const a=__acceptance,b=a.state.bands,count=a.runtime.settings.bands.count;
   const full={L:.73,R:.19,C:.46},wave={L:.25,R:-.4,C:.1};
   for(const [channel,db]of[['L',-30],['R',-80],['C',-45]]){
    a.BandBank.computeEnergiesFromAnalyser({analyser:{minDecibels:-100,maxDecibels:0},freqDb:new Float32Array(4096).fill(db)},48000,b.channels[channel].energies01);
    if(!uniform){const scale=channel==='L'?.9:channel==='R'?.2:.5;for(let i=0;i<count;i++)b.channels[channel].energies01[i]=scale*((i%3+1)/3);}
   }
   a.BandBank.updateGlobalDominant(2<count?2:0);
   const sample={ready:true,monoLike:false,bands:Object.fromEntries(['L','R','C'].map(channel=>[channel,{energy01:full[channel],timeDomain:Float32Array.of(wave[channel])}]))};
   const frame=a.updateAnalysisFrame(a.createAnalysisFrame(),sample,b),o=a.state.orbs.find(o=>o.id===id),result=a.selectOrbAnalysis(o,frame);
   a.VisualizerRuntime.update({dtSec:0,motionDtSec:0,nowSec:performance.now()/1000,simPaused:false,analysisFrame:frame});
   const rgb=a.ColorPolicy.pickParticleColorRgb01(0,o,frame.spectrum.dominantIndex,result.selectedDominantBandIndex),expectedRgb=a.ColorPolicy.bandRgb01(result.selectedDominantBandIndex??frame.spectrum.dominantIndex,o.hueOffsetDeg);
   return {channel:o.chanId,ids:[...o.bandIds],count,energies:[...frame.channels[o.chanId].bandEnergies01],lengths:Object.fromEntries(['L','R','C'].map(c=>[c,frame.channels[c].bandEnergies01.length])),sharedGeometry:frame.spectrum.lowHz===b.lowHz&&frame.spectrum.highHz===b.highHz,selected:result.energyOverride01,dominant:result.selectedDominantBandIndex,full:full[o.chanId],radius:o.baseRadiusPx,displacement:o.radialDispPx,minDim:Math.min(a.state.widthPx,a.state.heightPx),response:{...o.response},wave:frame.channels[o.chanId].waveform[0],rgb,expectedRgb};
  },{id,uniform});
 }
 function validateSelection(row){
  const active=row.ids.filter(i=>i<row.count),values=active.map(i=>row.energies[i]);
  const expected=row.ids.length?(values.length?values.reduce((sum,v)=>sum+v,0)/values.length:0):null;
  if(expected===null)assert.equal(row.selected,null);else close(row.selected,expected);
  let dominant=null,energy=-Infinity;for(const i of active)if(row.energies[i]>energy){dominant=i;energy=row.energies[i]}
  assert.equal(row.dominant,dominant);assert.ok(row.sharedGeometry);assert.deepEqual(row.lengths,{L:row.count,R:row.count,C:row.count});
  const responseEnergy=expected??row.full;
  close(row.radius,row.minDim*(row.response.minRadiusFrac+(row.response.maxRadiusFrac-row.response.minRadiusFrac)*responseEnergy));
  close(row.displacement,row.radius*row.response.waveformRadialDisplaceFrac*row.wave);
  for(const component of ['r','g','b'])close(row.rgb[component],row.expectedRgb[component]);
 }
 try {
  await check('A: extreme-log 3-band mixed inactive targets, actual FFT extraction and Orb response',async p=>{
   await apply(p,{bands:{count:3,floorHz:Number.MIN_VALUE,ceilingHz:22500,distributionMode:'log'},orbs:[orb('A')]});await opened(p);
   const data=[];
   for(const channel of ['L','R','C']){
    await p.locator('#orbEditorList [data-orb-id="A"] [id$="-channel"]').evaluate((c,value)=>{c.value=value;c.dispatchEvent(new Event('change',{bubbles:true}))},channel);
    const row=await selection(p,'A',true);validateSelection(row);close(row.selected,channel==='L'?.7:channel==='R'?.2:.55);assert.equal(row.dominant,0);
    data.push({channel,selected:row.selected,dominant:row.dominant,radius:row.radius});
   }
   const geometry=await p.evaluate(()=>({low:[...__acceptance.state.bands.lowHz],high:__acceptance.state.bands.highHz.slice(0,-1),summary:document.querySelector('#orbEditorList .band-selection-summary').textContent,choices:[...document.querySelectorAll('#orbEditorList .picker-band input:not(:disabled)')].length}));
   assert.deepEqual(geometry.low,[0,Number.MIN_VALUE,22500]);assert.deepEqual(geometry.high,[Number.MIN_VALUE,22500]);assert.equal(geometry.choices,3);assert.match(geometry.summary,/1 active target.*1 inactive target \(255\)/);
   return {geometry,responses:data};
  });
  await check('B: precision/count reactivation with stable editor and exact action focus',async p=>{
   await apply(p,{bands:{count:256},orbs:[orb('A',[5,100,255])]});await opened(p);
   await p.evaluate(()=>{const r=document.querySelector('#orbEditorList [data-orb-id="A"]');window.__editor=r;window.__speed=r.querySelector('[id$="-angular-speed"]');__speed.focus();});
   const original=(await share(p)).prefs.orbs[0],results=[];assert.equal(original.trace.numLines,16);
   for(const count of [32,3,256]){
    const payload=await share(p);payload.prefs.bands.count=count;await apply(p,payload.prefs);
    const stability=await p.evaluate(()=>({root:__editor===document.querySelector('#orbEditorList [data-orb-id="A"]'),control:__speed===__editor.querySelector('[id$="-angular-speed"]'),focus:document.activeElement===__speed,connected:__speed.isConnected,value:Number(__speed.value),open:__editor.open}));
    assert.ok(stability.root&&stability.control&&stability.focus&&stability.connected&&stability.open);close(stability.value,.123456);assert.deepEqual((await share(p)).prefs.orbs[0],original);
    const row=await selection(p);validateSelection(row);results.push({count,active:original.bandIds.filter(i=>i<count),energy:row.selected,dominant:row.dominant,stability});
   }
   await capture(p,'duplicate');const payload=await share(p);payload.prefs.bands.count=32;payload.prefs.orbs[0].chanId='R';await apply(p,payload.prefs);await retained(p);
   return {canonical:original.motion.angularSpeedRadPerSec,lines:original.trace.numLines,transitions:results,actionFocus:await retained(p)};
  });
  await check('D: mixed Bulk edits, inventory reorder/count changes and stable logical focus',async p=>{
   await apply(p,{bands:{count:256},orbs:[orb('A',[5,100,255],.123456),orb('B',[255],.234567),orb('spectral-ring',[0,2],.345678)]});
   assert.equal(await p.locator('#valOmega').textContent(),'mixed');const before=(await share(p)).prefs.orbs;
   await p.locator('#rngTTL').evaluate(c=>{c.closest('details').open=true;c.value='35.123456';c.dispatchEvent(new Event('input',{bubbles:true}));c.focus();window.__bulk=c;});
   let payload=await share(p);const edited=payload.prefs.orbs;
   edited.forEach((o,i)=>{assert.equal(o.particles.ttlSec,35.123456);const expected=structuredClone(before[i]);expected.particles.ttlSec=35.123456;assert.deepEqual(o,expected)});
   payload.prefs.orbs.reverse();payload.prefs.bands.count=3;await apply(p,payload.prefs);
   assert.ok(await p.evaluate(()=>document.activeElement===__bulk&&__bulk.isConnected));assert.equal(await p.locator('#valOmega').textContent(),'mixed');
   await capture(p,'remove','spectral-ring');payload=await share(p);payload.prefs.orbs.reverse();payload.prefs.bands.count=32;await apply(p,payload.prefs);await retained(p);
   const final=(await share(p)).prefs.orbs;for(const o of final)assert.deepEqual(o,edited.find(e=>e.id===o.id));
   return {order:final.map(o=>o.id),speeds:final.map(o=>o.motion.angularSpeedRadPerSec),targets:final.map(o=>o.bandIds),bulkTtl:final.map(o=>o.particles.ttlSec),focus:await retained(p)};
  });
  await check('E: idle refresh performs no inventory/editor reconstruction, listener growth or preference writes',async p=>{
   await apply(p,{bands:{count:3,floorHz:1e-307},orbs:[orb('A'),orb('B',[255],.234567)]});await opened(p);await capture(p,'edit');
   const measurement=await p.evaluate(()=>{
    const a=__acceptance,list=document.getElementById('visualizerList'),editors=document.getElementById('orbEditorList'),before=JSON.stringify(a.preferences),settings=a.runtime.settings,collection=a.VisualizerRuntime.getVisualizers();
    const identities=[...list.querySelectorAll('.visualizer-item,button'),...editors.querySelectorAll('.orb-editor-card,input,select,button')];
    const records=[],observer=new MutationObserver(r=>records.push(...r));observer.observe(list,{subtree:true,childList:true,attributes:true,characterData:true});observer.observe(editors,{subtree:true,childList:true,attributes:true,characterData:true});
    const start=performance.now();for(let i=0;i<2000;i++)a.UI.refreshAllUiText();const elapsedMs=performance.now()-start;records.push(...observer.takeRecords());observer.disconnect();
    const detachedStructural=records.filter(record=>[...record.removedNodes].some(node=>identities.some(identity=>node===identity||(node.nodeType===1&&node.contains(identity))))).length;
    return {iterations:2000,elapsedMs,presentationMutationRecords:records.length,detachedStructural,allIdentitiesConnected:identities.every(node=>node.isConnected),preferencesUnchanged:before===JSON.stringify(a.preferences),sameSettings:settings===a.runtime.settings,sameCollection:collection===a.VisualizerRuntime.getVisualizers(),focus:document.activeElement===__focus};
   });assert.equal(measurement.detachedStructural,0);assert.ok(measurement.allIdentitiesConnected);assert.ok(measurement.preferencesUnchanged&&measurement.sameSettings&&measurement.sameCollection&&measurement.focus);
   const before=(await share(p)).prefs.orbs;await p.locator('#visualizerList [data-action="duplicate"][data-orb-id="A"]').evaluate(c=>c.click());const after=(await share(p)).prefs.orbs;assert.equal(after.length,before.length+1);const created=after.find(o=>!before.some(previous=>previous.id===o.id));assert.ok(created);assert.deepEqual(created.bandIds,[0,255]);
   return {...measurement,duplicateDelta:1};
  });
  await check('independent target domains, L/R/C and first-active ties across both transition sequences',async p=>{
   const results=[];
   for(const ids of [[],[255],[0,255],[0,2],[5,100,255]])for(const sequence of [[256,32,3,256],[3,256,3]]){
    await apply(p,{bands:{count:sequence[0]},orbs:[orb('A',ids)]});const initial=(await share(p)).prefs.orbs[0];
    for(const count of sequence){const payload=await share(p);payload.prefs.bands.count=count;await apply(p,payload.prefs);
     for(const channel of ['L','R','C']){
      await p.locator('#orbEditorList [data-orb-id="A"] [id$="-channel"]').evaluate((c,v)=>{c.value=v;c.dispatchEvent(new Event('change',{bubbles:true}))},channel);
      const row=await selection(p);validateSelection(row);assert.deepEqual(row.ids,ids);results.push({ids,count,channel,energy:row.selected,dominant:row.dominant});
     }
     const current=(await share(p)).prefs.orbs[0];const expected={...initial,chanId:'C'};assert.deepEqual(current,expected);
    }
   }
   await apply(p,{bands:{count:3},orbs:[orb('A',[255,2,0])]});
   const tie=await p.evaluate(()=>{const a=__acceptance;for(const c of ['L','R','C'])a.state.bands.channels[c].energies01.fill(.375);const frame=a.updateAnalysisFrame(a.createAnalysisFrame(),{ready:true,bands:{}},a.state.bands);return a.selectOrbAnalysis(a.state.orbs.find(o=>o.id==='A'),frame)});
   assert.equal(tie.energyOverride01,.375);assert.equal(tie.selectedDominantBandIndex,2);
   return {samples:results.length,examples:results.filter(r=>r.count===3&&r.channel==='R').slice(0,10),firstActiveTie:tie.selectedDominantBandIndex};
  });
  await check('independent geometry matrix: real controller/bank/extraction and Nyquist',async p=>{
   const rows=[];
   for(const count of [3,4,32,256])for(const floor of [Number.MIN_VALUE,1e-307,20,22500-1e-10,22500]){
    await apply(p,{bands:{count,floorHz:floor,ceilingHz:22500,distributionMode:'log'},orbs:[orb('A',[0,255])]});
    const row=await p.evaluate(()=>{
     const a=__acceptance;a.BandBankController.onAudioContextKnown(48000);a.BandBankController.rebuildNow();const b=a.state.bands;
     for(const [id,db]of[['L',-30],['R',-80],['C',-45]])a.BandBank.computeEnergiesFromAnalyser({analyser:{minDecibels:-100,maxDecibels:0},freqDb:new Float32Array(4096).fill(db)},48000,b.channels[id].energies01);
     return {low:[...b.lowHz],high:b.highHz.slice(0,-1),channelEnergies:Object.fromEntries(['L','R','C'].map(id=>[id,[...b.channels[id].energies01]])),floor:b.meta.effectiveFloorHz,ceiling:b.meta.effectiveCeilingHz};
    });assert.equal(row.low[1],floor);assert.equal(row.high.at(-1),22500);assert.equal(row.low.at(-1),22500);
    row.low.forEach((edge,i)=>{assert.ok(Number.isFinite(edge)&&edge<=22500);if(i){assert.ok(edge>=floor);assert.ok(edge>=row.low[i-1]);}});
    if(floor<1e-100&&count>3){const mid=Math.floor(count/2);assert.ok(row.low[mid]>floor&&row.low[mid]<22500,'actual interior geometry survives extreme floor');}
    for(const [channel,expected]of[['L',.7],['R',.2],['C',.55]])row.channelEnergies[channel].forEach((energy,i)=>close(energy,i<count-1&&row.high[i]<=row.low[i]?0:expected));
    rows.push({count,floor,midpoint:row.low[Math.floor(count/2)],equalInteriorEdges:row.high.filter((v,i)=>i>0&&v===row.low[i]).length,zeroBands:row.channelEnergies.C.filter(e=>e===0).length});
   }
   for(const distributionMode of ['linear','mel','bark','erb']){
    await apply(p,{bands:{count:32,floorHz:20,ceilingHz:22500,distributionMode},orbs:[]});
    const g=await p.evaluate(()=>{const a=__acceptance;a.BandBankController.onAudioContextKnown(32000);a.BandBankController.rebuildNow();return{low:[...a.state.bands.lowHz],high:a.state.bands.highHz.slice(0,-1),cap:a.state.bands.meta.effectiveCeilingHz}});
    assert.equal(g.cap,16000);assert.equal(g.low.at(-1),16000);g.low.forEach((v,i)=>{assert.ok(Number.isFinite(v)&&v<=16000);if(i)assert.ok(v>=g.low[i-1]);});
   }
   return {logMatrices:rows,nyquistNonLogModes:['linear','mel','bark','erb'],nyquistCap:16000};
  });
  await check('native action identity, type collision, cancellation, remove fallback and action dispatch',async p=>{
   await apply(p,{bands:{count:256},orbs:[orb('A'),orb('B',[255],.234567),orb('spectral-ring',[5,100,255])]});
   const results=[];
   for(const action of ['edit','duplicate','remove','edit-ring']){
    await capture(p,action,'spectral-ring');let preset=await share(p);preset.prefs.bands.count=3;preset.prefs.orbs.reverse();await apply(p,preset.prefs);await retained(p);
    await p.evaluate(()=>{const c=document.getElementById('chkMute');c.checked=!c.checked;c.dispatchEvent(new Event('change',{bubbles:true}))});
    results.push({action,retained:await retained(p)});await p.keyboard.press('h');assert.ok(await p.locator('#visualizersPanel').isVisible());
   }
   await capture(p,'edit-ring');await p.keyboard.press('Enter');assert.ok(await p.evaluate(()=>document.getElementById('spectralRingEditor').open));
   await capture(p,'edit','spectral-ring');await p.keyboard.press('Enter');assert.ok(await p.evaluate(()=>document.activeElement===document.querySelector('#orbEditorList [data-orb-id="spectral-ring"] > summary')));
   const before=(await share(p)).prefs.orbs;await capture(p,'remove','B');p.once('dialog',d=>d.dismiss());await p.keyboard.press('Enter');assert.deepEqual((await share(p)).prefs.orbs,before);await retained(p);
   await capture(p,'duplicate','B');await p.keyboard.press('Enter');let after=(await share(p)).prefs.orbs;const copy=after.find(o=>!before.some(x=>x.id===o.id));assert.ok(copy);assert.deepEqual(copy.bandIds,before.find(o=>o.id==='B').bandIds);
   assert.deepEqual(await p.evaluate(()=>({action:document.activeElement.dataset.action,id:document.activeElement.dataset.orbId})),{action:'edit',id:copy.id});
   await capture(p,'remove','B');const index=after.findIndex(o=>o.id==='B'),expected=after[index+1]?.id||after[index-1]?.id;p.once('dialog',d=>d.accept());await p.keyboard.press('Enter');assert.equal(await p.evaluate(()=>document.activeElement.dataset.orbId),expected);assert.equal(await p.evaluate(()=>document.activeElement.dataset.action),'edit');
   await capture(p,'duplicate','A');p.once('dialog',d=>d.accept());await p.locator(`#visualizerList [data-action="remove"][data-orb-id="${copy.id}"]`).evaluate(c=>c.click());await retained(p);
   await p.locator('#btnVisualizersAddOrb').click();const added=(await share(p)).prefs.orbs.at(-1);assert.deepEqual(await p.evaluate(()=>({action:document.activeElement.dataset.action,id:document.activeElement.dataset.orbId})),{action:'edit',id:added.id});
   return {actions:results,collisionTypeSafe:true,cancelledRemoveUnchanged:true,duplicateId:copy.id,nearestSurvivor:expected,unrelatedRemovalFocus:true,addedId:added.id};
  });
  await check('native numeric keyboard boundaries, modified combinations and exactly one commit',async p=>{
   await apply(p,{orbs:[orb('A'),orb('B',[255],.234567)]});await opened(p);
   const speed=p.locator('#orbEditorList [data-orb-id="A"] [id$="-angular-speed"]');
   await speed.evaluate(c=>{window.__inputCount=0;c.addEventListener('input',()=>__inputCount++);window.__keyPrevented=[];c.addEventListener('keydown',e=>__keyPrevented.push({key:e.key,ctrl:e.ctrlKey,shift:e.shiftKey,prevented:e.defaultPrevented}));});
   const rows=[];
   for(const key of ['ArrowRight','Home','End','Control+ArrowLeft','Shift+ArrowLeft']){
    const countBefore=await p.evaluate(()=>__inputCount);await speed.press(key);
    const r=await speed.evaluate(c=>({native:Number(c.value),canonical:__acceptance.preferences.orbs[0].motion.angularSpeedRadPerSec,inputCount:__inputCount,focus:document.activeElement===c,last:__keyPrevented.at(-1),other:__acceptance.preferences.orbs[1].motion.angularSpeedRadPerSec}));
    close(r.native,r.canonical);assert.ok(r.focus);assert.equal(r.other,.234567);assert.ok(r.inputCount-countBefore<=1,'one input commit at most');if(key==='ArrowRight'){close(r.canonical,.133456);assert.equal(r.inputCount-countBefore,1);assert.equal(r.last.prevented,true);}if(key==='Home'){assert.equal(r.canonical,.01);assert.equal(r.last.prevented,false);}if(key==='End'){assert.equal(r.canonical,3);assert.equal(r.last.prevented,false);}if(key==='Control+ArrowLeft')assert.equal(r.last.prevented,false);rows.push({key,...r});
   }
   // Compare modified-key value to an ordinary native range with matching metadata.
   await speed.evaluate(c=>{const plain=document.createElement('input');plain.type='range';plain.min=c.min;plain.max=c.max;plain.step=c.step;plain.value=c.value;plain.id='acceptance-native-reference';document.body.appendChild(plain);window.__nativeReferenceStart=c.value;});
   await p.locator('#acceptance-native-reference').press('Control+ArrowRight');const reference=await p.locator('#acceptance-native-reference').inputValue();await speed.press('Control+ArrowRight');close(Number(await speed.inputValue()),Number(reference));
   const lines=p.locator('#orbEditorList [data-orb-id="A"] [id$="-line-count"]');for(const count of [11,15,16,39]){
    await lines.evaluate((c,n)=>{c.value=String(n);c.dispatchEvent(new Event('input',{bubbles:true}))},count);assert.equal(Number(await lines.inputValue()),count);assert.equal((await share(p)).prefs.orbs[0].trace.numLines,count);
   }
   await lines.press('ArrowRight');assert.equal((await share(p)).prefs.orbs[0].trace.numLines,49);await lines.press('Home');assert.equal((await share(p)).prefs.orbs[0].trace.numLines,10);await lines.press('End');assert.equal((await share(p)).prefs.orbs[0].trace.numLines,1000);
   return {speedKeys:rows,modifiedNativeReference:reference,integralCounts:[11,15,16,39],tenLineIncrement:49,home:10,end:1000};
  });
  await check('independent inactive picker/exact drafts, focused count transition and explicit full spectrum',async p=>{
   await apply(p,{bands:{count:3},orbs:[orb('spectral-ring',[255])]});await opened(p,'spectral-ring');
   const prefix='#orbEditorList [data-orb-id="spectral-ring"]';
   const checkbox=p.locator(prefix+' .picker-band input').first();await checkbox.check();assert.deepEqual((await share(p)).prefs.orbs[0].bandIds,[255,0]);
   const range=p.locator(prefix+' .orb-band-picker input[type="number"]');await range.nth(0).fill('1');await range.nth(1).fill('2');
   await p.locator(prefix+' .orb-band-picker button').filter({hasText:'Use range'}).click();assert.deepEqual((await share(p)).prefs.orbs[0].bandIds,[1,2,255]);
   const exact=p.locator(prefix+' [id$="-bands"]');await exact.fill('0, 256, invalid');await exact.dispatchEvent('change');await exact.focus();
   const payload=await share(p);payload.prefs.bands.count=32;await apply(p,payload.prefs);
   assert.equal(await exact.inputValue(),'0, 256, invalid');assert.equal(await exact.getAttribute('aria-invalid'),'true');assert.ok(await exact.evaluate(c=>document.activeElement===c&&c.isConnected));assert.deepEqual((await share(p)).prefs.orbs[0].bandIds,[1,2,255]);
   await p.locator(prefix+' .orb-band-picker button').filter({hasText:'Full Spectrum'}).click();assert.deepEqual((await share(p)).prefs.orbs[0].bandIds,[]);assert.equal(await exact.getAttribute('aria-invalid'),'false');
   return {checkboxPreserved:[255,0],rangePreserved:[1,2,255],invalidDraft:'0, 256, invalid',countTransitionFocus:true,fullSpectrum:[]};
  });
  await check('independent native/canonical/rendered integral count in combined reduced-bank scene',async p=>{
   const rows=[];
   for(const count of [15.5,11,15,16,39]){
    await apply(p,{bands:{count:3,floorHz:Number.MIN_VALUE,distributionMode:'log'},orbs:[{...orb('A',[0,255]),trace:{numLines:count}}]});
    const row=await p.evaluate(()=>{
     const a=__acceptance,o=a.state.orbs.find(o=>o.id==='A'),control=document.querySelector('#orbEditorList [data-orb-id="A"] [id$="-line-count"]'),context=a.state.ctx;let rendered=0;
     const particles={length:1100,*suffix(n){for(let i=0;i<n;i++)yield{xSim:i,ySim:0}},*[Symbol.iterator](){}};
     a.state.ctx={save(){},restore(){},beginPath(){},moveTo(){},lineTo(){rendered++},stroke(){}};
     try{a.Renderer.drawOrb({trail:{particles},particles:o.particles,trace:{...o.trace,lineColorMode:'fixed'}},0,0)}finally{a.state.ctx=context}
     return {canonical:a.preferences.orbs[0].trace.numLines,runtime:o.trace.numLines,native:Number(control.value),step:control.step,readout:control.parentElement.querySelector('.val').textContent,rendered};
    });const expected=Math.ceil(count);assert.equal(row.canonical,expected);assert.equal(row.runtime,expected);assert.equal(row.native,expected);assert.equal(row.rendered,expected);assert.equal(row.step,'1');assert.equal(row.readout,String(expected));assert.equal((await share(p)).prefs.orbs[0].trace.numLines,expected);rows.push({imported:count,...row});
   }return rows;
  });

  // This case creates a separate page with a gate on native AudioContext.resume.
  // Decode, source activation, FFT sampling and actual playback remain production.
  {
   let p;try{
    p=await page('/observed',true);await apply(p,{bands:{count:3,floorHz:1e-307,distributionMode:'log'},orbs:[orb('A',[0,255])]});await opened(p);
    await p.locator('#fileInput').setInputFiles([{name:'g4-delayed-real.wav',mimeType:'audio/wav',buffer:wav()},{name:'g4-next-real.wav',mimeType:'audio/wav',buffer:wav()}]);
    await p.waitForFunction(()=>!!__pending.release);
    const before=await p.evaluate(()=>{
     const c=document.querySelector('#orbEditorList [data-orb-id="A"] [id$="-angular-speed"]');c.focus();window.__numericFocus=c;window.__numericRoot=c.closest('.orb-card');window.__unexpectedInputs=0;c.addEventListener('input',()=>__unexpectedInputs++);
     return {prefs:structuredClone(__acceptance.preferences.orbs[0]),native:Number(c.value),analysisReady:__acceptance.analysisFrame.ready,focus:document.activeElement===c};
    });assert.equal(before.native,.123456);assert.ok(before.focus);assert.equal(before.analysisReady,false);
    await p.evaluate(()=>__pending.release());await p.waitForFunction(()=>__acceptance.analysisFrame.ready&&__acceptance.state.source.kind==='file'&&document.getElementById('audioStatus').textContent.includes('g4-delayed-real.wav'));
    const after=await p.evaluate(()=>({prefs:structuredClone(__acceptance.preferences.orbs[0]),native:Number(__numericFocus.value),focus:document.activeElement===__numericFocus,connected:__numericFocus.isConnected,sameRoot:__numericRoot===document.querySelector('#orbEditorList [data-orb-id="A"]'),inputEvents:__unexpectedInputs,analysisReady:__acceptance.analysisFrame.ready,channelLengths:Object.fromEntries(['L','R','C'].map(c=>[c,__acceptance.analysisFrame.channels[c].bandEnergies01.length])),sampleRate:__acceptance.analysisFrame.spectrum.metadata.sampleRateHz,source:__acceptance.state.source.kind}));
    assert.deepEqual(after.prefs,before.prefs);assert.equal(after.native,.123456);assert.ok(after.focus&&after.connected&&after.sameRoot&&after.analysisReady);assert.equal(after.inputEvents,0);assert.deepEqual(after.channelLengths,{L:3,R:3,C:3});assert.equal(after.source,'file');assert.ok(after.sampleRate>0);
    await capture(p,'remove');for(const key of ['n','p','h','ArrowRight'])await p.keyboard.press(key);await retained(p);assert.match(await p.locator('#audioStatus').textContent(),/g4-delayed-real.wav/);
    assert.deepEqual(p.errors,[]);assert.deepEqual(await p.evaluate(()=>__unhandled),[]);
    evidence.cases.push({name:'C: precise focused editor during delayed actual File completion, source/AnalysisFrame readiness and interactive shortcut suppression',passed:true,data:{before,after}});
   }catch(e){evidence.cases.push({name:'C: precise focused editor during delayed actual File completion',passed:false,failure:e.message,errors:p?.errors})}finally{if(p)await p.close()}
  }
  for(const deployment of ['/hosted/','/nested/auralprint/']){
   let p;try{
    p=await page(deployment);await apply(p,{bands:{count:3,floorHz:1e-307,distributionMode:'log'},orbs:[orb('A',[0,255])]});
    await capture(p,'edit');await p.evaluate(()=>{const c=document.getElementById('rngVol');c.value='.37';c.dispatchEvent(new Event('input',{bubbles:true}))});await retained(p);
    const payload=await share(p);assert.deepEqual(payload.prefs.orbs[0].bandIds,[0,255]);assert.equal(payload.prefs.orbs[0].motion.angularSpeedRadPerSec,.123456);assert.equal(payload.prefs.orbs[0].trace.numLines,16);await p.reload();
    const native=await p.locator('#orbEditorList [data-orb-id="A"] [id$="-angular-speed"]').inputValue();assert.equal(Number(native),.123456);
    const resources=await p.evaluate(async()=>{const manifest=document.querySelector('link[rel="manifest"]');const r=await fetch(manifest.href);const json=await r.json();return{manifest:r.status,url:manifest.href,icons:await Promise.all(json.icons.map(async icon=>{const u=new URL(icon.src,manifest.href),r=await fetch(u);return{url:u.pathname,status:r.status,bytes:(await r.arrayBuffer()).byteLength}})),instrumented:!!window.__acceptance}});
    assert.equal(resources.manifest,200);assert.equal(resources.instrumented,false);assert.ok(resources.icons.every(i=>i.status===200&&i.bytes>0));assert.ok(resources.icons.every(i=>i.url.startsWith(deployment)));
    assert.deepEqual(p.errors,[]);assert.deepEqual(await p.evaluate(()=>__unhandled),[]);
    evidence.cases.push({name:`uninstrumented hosted smoke ${deployment}`,passed:true,data:{native,resources,shareReload:true}});
   }catch(e){evidence.cases.push({name:`uninstrumented hosted smoke ${deployment}`,passed:false,failure:e.message,errors:p?.errors})}finally{if(p)await p.close()}
  }
 }finally{
  await browser.close();await new Promise(resolve=>server.close(resolve));
  evidence.summary={total:evidence.cases.length,passed:evidence.cases.filter(c=>c.passed).length,failed:evidence.cases.filter(c=>!c.passed).length};
  fs.writeFileSync(option('--output')||'/tmp/g4-integrated.json',JSON.stringify(evidence,null,2)+'\n');
  console.log(JSON.stringify({...evidence.summary,failures:evidence.cases.filter(c=>!c.passed)}));if(evidence.summary.failed)process.exitCode=1;
 }
}
main().catch(e=>{console.error(e);process.exitCode=1});
