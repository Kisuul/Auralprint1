// Opt-in built portable native Chromium diagnostics. In-memory observed route
// exposes existing objects only; source and built artifacts are never modified.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../../../../..'),args=process.argv.slice(2),opt=k=>args.includes(k)?args[args.indexOf(k)+1]:null,baseline=args.includes('--baseline');
const html=fs.readFileSync(opt('--html')||path.join(root,'dist/auralprint_0.1.15m.i.g.html'),'utf8'),marker='  main();\n})();';assert.equal(html.split(marker).length,2);
const observed=html.replace(marker,'  window.__g3={preferences,runtime,state,UI,BandBank,BandBankController,Renderer,CONFIG,VisualizerRuntime,createAnalysisFrame,updateAnalysisFrame,selectOrbAnalysis};\n'+marker);
async function main(){
 const server=http.createServer((q,r)=>{r.setHeader('Content-Type','text/html');r.end(q.url==='/plain'?html:observed)});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const evidence={baseline,browser:await browser.version(),htmlSha256:crypto.createHash('sha256').update(html).digest('hex'),cases:[]};
 const p=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 async function apply(prefs){await p.evaluate(prefs=>{history.replaceState(null,'','#p='+btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify({schema:10,prefs})))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''));document.getElementById('btnApplyUrl').click()},prefs);}
 async function check(name,fn){try{evidence.cases.push({name,passed:true,data:await fn()})}catch(e){evidence.cases.push({name,passed:false,failure:e.message})}}
 try{
 await p.goto(`http://127.0.0.1:${server.address().port}`);await p.evaluate(()=>getComputedStyle(document.getElementById('visualizersPanel')).display==='none' && document.getElementById('btnOpenVisualizers').click());
 if(!args.includes('--geometry-only')) {
 await apply({orbs:[{id:'A',motion:{angularSpeedRadPerSec:.123456},trace:{numLines:15.5}}]});
 await check('original imported speed and trace: canonical/native/readout/renderer',async()=>{
  const data=await p.evaluate(()=>{const root=document.querySelector('#orbEditorList [data-orb-id="A"]');root.open=true;root.querySelectorAll('details').forEach(d=>d.open=true);const speed=root.querySelector('[id$="-angular-speed"]'),lines=root.querySelector('[id$="-line-count"]'),orb=__g3.preferences.orbs[0];
   let count=0;const ctx=__g3.state.ctx;__g3.state.ctx={save(){},restore(){},beginPath(){},moveTo(){},lineTo(){count++},stroke(){}};
   const particles={length:100,*[Symbol.iterator](){},*suffix(n){for(let i=0;i<n;i++)yield{xSim:i,ySim:0}}};try{__g3.Renderer.drawOrb({trail:{particles},trace:{...orb.trace,lineColorMode:'fixed'},particles:orb.particles},0,0)}finally{__g3.state.ctx=ctx}
   return{canonicalSpeed:orb.motion.angularSpeedRadPerSec,nativeSpeed:Number(speed.value),speedStep:speed.step,speedReadout:speed.parentElement.querySelector('.val').textContent,canonicalLines:orb.trace.numLines,nativeLines:Number(lines.value),lineStep:lines.step,renderedLines:count,bulkSpeed:Number(document.getElementById('rngOmega').value),bulkLines:Number(document.getElementById('rngNumLines').value)};
  });assert.equal(data.canonicalSpeed,.123456);assert.equal(data.nativeSpeed,baseline?.12:.123456);assert.equal(data.canonicalLines,baseline?15.5:16);assert.equal(data.nativeLines,baseline?20:16);assert.equal(data.renderedLines,16);assert.equal(data.bulkSpeed,data.nativeSpeed);assert.equal(data.bulkLines,data.nativeLines);return data;
 });
 }
 if(!baseline && !args.includes('--geometry-only')) {
 const specs=[['angular-speed','motion','angularSpeedRadPerSec',.123456],['center-x',null,'centerXFrac',.123456],['center-y',null,'centerYFrac',-.123456],['min-radius','response','minRadiusFrac',.123456],['max-radius','response','maxRadiusFrac',.654321],['waveform-displacement','response','waveformRadialDisplaceFrac',.123456],['emit-rate','particles','emitPerSecond',15.5],['size-min','particles','sizeMinPx',1.23456],['size-max','particles','sizeMaxPx',6.123456],['size-decay','particles','sizeToMinSec',2.34567],['lifetime','particles','ttlSec',180.123456],['min-placement-distance','particles','minPlacementDistancePx',.123456],['line-alpha','trace','lineAlpha',.123456],['line-width','trace','lineWidthPx',2.34567],['hue',null,'hueOffsetDeg',123.456789]];
 const near=(a,b)=>assert.ok(Math.abs(a-b)<=Math.max(1,Math.abs(b))*1e-13,`${a} != ${b}`);
 async function share(){return p.evaluate(()=>{document.getElementById('btnShare').click();return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(location.hash.slice(3).replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0))))})}
 for(const [id,group,field,precise] of specs)await check(`AUD-009 native precision/boundaries/persistence ${id}`,async()=>{
  const limits=await p.evaluate(({group,field})=>{const c=__g3.CONFIG;return group==='response'?c.limits.orbs.response[field]:group?c.limits[group][field]:c.limits.orbs[field]}, {group,field});
  const rows=[];
  for(const value of [limits.min,limits.min+(limits.max-limits.min)*1e-7,precise,limits.max-(limits.max-limits.min)*1e-7,limits.max]){
   const orb={id:'A',particles:{sizeMaxPx:12,sizeToMinSec:.1,ttlSec:600},bandIds:[0,255]};(group?(orb[group]??={}):orb)[field]=value;
   await apply({bands:{count:3},orbs:[orb]});
   const row=await p.evaluate(({id,group,field})=>{const a=__g3,root=document.querySelector('#orbEditorList [data-orb-id="A"]');root.open=true;root.querySelectorAll('details').forEach(d=>d.open=true);const c=root.querySelector(`[id$="-${id}"]`),o=a.preferences.orbs[0],r=a.runtime.settings.orbs[0],instance=a.state.orbs.find(o=>o.id==='A');return{canonical:(group?o[group]:o)[field],runtime:(group?r[group]:r)[field],instance:(group?instance[group]:instance)[field],native:Number(c.value),step:c.step,readout:c.parentElement.querySelector('.val').textContent,accessible:c.getAttribute('aria-valuetext')}},{id,group,field});
   assert.equal(row.canonical,value);assert.equal(row.runtime,value);assert.equal(row.instance,value);near(row.native,value);assert.equal(row.step,'any');assert.equal(parseFloat(row.readout),value);assert.equal(parseFloat(row.accessible),value);
   const payload=await share(),saved=payload.prefs.orbs[0];assert.equal((group?saved[group]:saved)[field],value);assert.deepEqual(saved.bandIds,[0,255]);
   rows.push({value,native:row.native});
  }return{bounds:limits,rows};
 });
 await apply({bands:{count:3},orbs:[{id:'A',bandIds:[0,255],motion:{angularSpeedRadPerSec:.123456},trace:{numLines:15.5}},{id:'B',bandIds:[255],motion:{angularSpeedRadPerSec:.234567},trace:{numLines:17}}]});
 await check('AUD-009 native individual explicit edits, CONFIG arrows and stable editor focus/drafts/scroll',async()=>{
  await p.evaluate(()=>{const root=document.querySelector('#orbEditorList [data-orb-id="A"]');root.open=true;root.querySelectorAll('details').forEach(d=>d.open=true);const band=root.querySelector('[id$="-bands"]');band.value='0,not-an-index';band.dispatchEvent(new Event('change',{bubbles:true}));const c=root.querySelector('[id$="-angular-speed"]');c.scrollIntoView({block:'center'});c.focus();window.__numericFocus=c;window.__numericRoot=root;window.__numericOpen=[...root.querySelectorAll('details')].map(d=>d.open);window.__numericScroll={top:root.closest('.panel-body')?.scrollTop||0,window:scrollY};document.getElementById('rngVol').value='.42';document.getElementById('rngVol').dispatchEvent(new Event('input',{bubbles:true}));});
  const before=await p.evaluate(()=>{const root=__numericRoot;return{same:document.activeElement===__numericFocus,connected:__numericFocus.isConnected,root:root===document.querySelector('#orbEditorList [data-orb-id="A"]'),open:root.open&&[...root.querySelectorAll('details')].every((d,i)=>d.open===__numericOpen[i]),draft:root.querySelector('[id$="-bands"]').value,invalid:root.querySelector('[id$="-bands"]').getAttribute('aria-invalid'),scroll:{top:root.closest('.panel-body')?.scrollTop||0,window:scrollY},oldScroll:__numericScroll,orbs:structuredClone(__g3.preferences.orbs)}});
  assert.ok(before.same&&before.connected&&before.root&&before.open);assert.equal(before.draft,'0,not-an-index');assert.equal(before.invalid,'true');assert.deepEqual(before.scroll,before.oldScroll);assert.equal(before.orbs[0].motion.angularSpeedRadPerSec,.123456);
  const speed=p.locator('#orbEditorList [data-orb-id="A"] [id$="-angular-speed"]');await speed.press('ArrowRight');
  let values=await p.evaluate(()=>__g3.preferences.orbs.map(o=>o.motion.angularSpeedRadPerSec));near(values[0],.133456);assert.equal(values[1],.234567);
  await speed.evaluate(c=>{c.value='.345678';c.dispatchEvent(new Event('input',{bubbles:true}))});values=await p.evaluate(()=>__g3.preferences.orbs.map(o=>o.motion.angularSpeedRadPerSec));assert.equal(values[0],.345678);assert.equal(values[1],.234567);
  const count=p.locator('#orbEditorList [data-orb-id="A"] [id$="-line-count"]');await count.focus();await count.press('ArrowRight');let lines=await p.evaluate(()=>__g3.preferences.orbs.map(o=>o.trace.numLines));assert.deepEqual(lines,[26,17]);
  await count.evaluate(c=>{c.value='27';c.dispatchEvent(new Event('input',{bubbles:true}))});lines=await p.evaluate(()=>__g3.preferences.orbs.map(o=>o.trace.numLines));assert.deepEqual(lines,[27,17]);
  return{focusAfterRefresh:before.same,draftPreserved:before.draft,scrollPreserved:true,speeds:values,lines};
 });
 await check('AUD-009 native Bulk uniform/mixed, unrelated field edits and CONFIG increments',async()=>{
  await apply({orbs:[{id:'A',motion:{angularSpeedRadPerSec:.123456},trace:{numLines:15.5},particles:{sizeMaxPx:6.123456}},{id:'B',motion:{angularSpeedRadPerSec:.123456},trace:{numLines:15.5},particles:{sizeMaxPx:6.123456}}]});
  let data=await p.evaluate(()=>({speed:Number(document.getElementById('rngOmega').value),speedOutput:document.getElementById('valOmega').textContent,lines:Number(document.getElementById('rngNumLines').value)}));assert.equal(data.speed,.123456);assert.equal(parseFloat(data.speedOutput),.123456);assert.equal(data.lines,16);
  await p.evaluate(()=>{const c=document.getElementById('rngTTL');c.value='40.123456';c.dispatchEvent(new Event('input',{bubbles:true}));});
  let orbs=await p.evaluate(()=>structuredClone(__g3.preferences.orbs));assert.ok(orbs.every(o=>o.motion.angularSpeedRadPerSec===.123456&&o.trace.numLines===16&&o.particles.sizeMaxPx===6.123456&&o.particles.ttlSec===40.123456));
  await p.evaluate(()=>{const root=document.querySelector('#orbEditorList [data-orb-id="B"]'),c=root.querySelector('[id$="-angular-speed"]');c.value='.234567';c.dispatchEvent(new Event('input',{bubbles:true}));});
  assert.equal(await p.locator('#valOmega').textContent(),'mixed');assert.equal(await p.locator('#rngOmega').getAttribute('aria-valuetext'),'mixed');
  await p.evaluate(()=>{const c=document.getElementById('rngOmega');c.closest('details').open=true;c.focus();window.__bulkFocus=c;const v=document.getElementById('rngVol');v.value='.6';v.dispatchEvent(new Event('input',{bubbles:true}));});
  assert.ok(await p.evaluate(()=>document.activeElement===__bulkFocus&&__bulkFocus.isConnected));
  const prior=await p.evaluate(()=>__g3.preferences.orbs.map(o=>o.motion.angularSpeedRadPerSec));assert.deepEqual(prior,[.123456,.234567]);
  await p.locator('#rngOmega').evaluate(c=>{c.value='.456789';c.dispatchEvent(new Event('input',{bubbles:true}))});
  await p.locator('#rngOmega').press('ArrowRight');orbs=await p.evaluate(()=>structuredClone(__g3.preferences.orbs));orbs.forEach(o=>near(o.motion.angularSpeedRadPerSec,.466789));assert.ok(orbs.every(o=>o.trace.numLines===16&&o.particles.sizeMaxPx===6.123456));
  await p.locator('#rngNumLines').evaluate(c=>{c.closest('details').open=true;c.value='17';c.dispatchEvent(new Event('input',{bubbles:true}))});await p.locator('#rngNumLines').press('ArrowRight');orbs=await p.evaluate(()=>structuredClone(__g3.preferences.orbs));assert.ok(orbs.every(o=>o.trace.numLines===27));
  const payload=await share();assert.deepEqual(payload.prefs.orbs,orbs);await p.reload();const after=await p.evaluate(()=>structuredClone(__g3.preferences.orbs));assert.deepEqual(after,orbs);
  return{uniform:data,mixedBeforeEdit:prior,after:orbs.map(o=>({id:o.id,speed:o.motion.angularSpeedRadPerSec,lines:o.trace.numLines})),shareReload:true};
 });
 await check('AUD-009 native designed phase, G.1 action focus and G.2 active target response',async()=>{
  await apply({bands:{count:3},orbs:[{id:'A',chanId:'R',bandIds:[0,255],startAngleRad:.123456,motion:{angularSpeedRadPerSec:.123456}}]});await p.evaluate(()=>getComputedStyle(document.getElementById('visualizersPanel')).display==='none' && document.getElementById('btnOpenVisualizers').click());
  const result=await p.evaluate(()=>{const a=__g3,root=document.querySelector('#orbEditorList [data-orb-id="A"]'),phase=root.querySelector('[id$="-phase-offset"]');root.open=true;phase.closest('details').open=true;const action=document.querySelector('#visualizerInventory [data-orb-id="A"][data-action="edit"]')||document.querySelector('[data-action="edit"][data-orb-id="A"]');action.focus();window.__action=action;const vol=document.getElementById('rngVol');vol.value='.5';vol.dispatchEvent(new Event('input',{bubbles:true}));const b=a.state.bands;for(const [id,energy]of[['L',.9],['R',.1],['C',.5]])b.channels[id].energies01.fill(energy);const frame=a.updateAnalysisFrame(a.createAnalysisFrame(),{ready:true,bands:{}},b),selected=a.selectOrbAnalysis(a.runtime.settings.orbs[0],frame);return{focus:document.activeElement===action,connected:action.isConnected,phase:Number(phase.value),phaseCanonical:a.preferences.orbs[0].startAngleRad,phaseStep:phase.step,targets:[...a.preferences.orbs[0].bandIds],energy:selected.energyOverride01,dominant:selected.selectedDominantBandIndex};});
  assert.ok(result.focus&&result.connected);near(result.phase,.123456);assert.equal(result.phaseCanonical,.123456);assert.equal(result.phaseStep,'any');assert.deepEqual(result.targets,[0,255]);near(result.energy,.1);assert.equal(result.dominant,0);return result;
 });
 await check('AUD-009 native bank-count refresh retains focused range, targets, exact draft and numeric values',async()=>{
  await apply({bands:{count:3},orbs:[{id:'A',bandIds:[0,255],motion:{angularSpeedRadPerSec:.123456},trace:{numLines:15.5}}]});
  await p.evaluate(()=>{getComputedStyle(document.getElementById('visualizersPanel')).display==='none' && document.getElementById('btnOpenVisualizers').click();const root=document.querySelector('#orbEditorList [data-orb-id="A"]');root.open=true;root.querySelectorAll('details').forEach(d=>d.open=true);const c=root.querySelector('[id$="-angular-speed"]');c.focus();window.__bankFocus=c;const draft=root.querySelector('[id$="-bands"]');draft.value='invalid exact';draft.dispatchEvent(new Event('change',{bubbles:true}));});
  const payload=await share();payload.prefs.bands.count=32;await apply(payload.prefs);
  const row=await p.evaluate(()=>{const a=__g3,root=document.querySelector('#orbEditorList [data-orb-id="A"]');return{same:document.activeElement===__bankFocus,connected:__bankFocus.isConnected,speed:a.preferences.orbs[0].motion.angularSpeedRadPerSec,lines:a.preferences.orbs[0].trace.numLines,targets:a.preferences.orbs[0].bandIds,count:a.runtime.settings.bands.count,length:a.state.bands.channels.R.energies01.length,draft:root.querySelector('[id$="-bands"]').value}});
  assert.ok(row.same&&row.connected);assert.equal(row.speed,.123456);assert.equal(row.lines,16);assert.deepEqual(row.targets,[0,255]);assert.equal(row.count,32);assert.equal(row.length,32);assert.equal(row.draft,'invalid exact');return row;
 });
 await check('AUD-009 native pointer editing commits actual range value to only its Orb',async()=>{
  await apply({orbs:[{id:'A',motion:{angularSpeedRadPerSec:.123456}},{id:'B',motion:{angularSpeedRadPerSec:.234567}}]});
  const c=p.locator('#orbEditorList [data-orb-id="A"] [id$="-angular-speed"]');await c.evaluate(c=>{getComputedStyle(document.getElementById('visualizersPanel')).display==='none' && document.getElementById('btnOpenVisualizers').click();c.closest('details').open=true;document.querySelector('#orbEditorList [data-orb-id="A"]').open=true});await c.scrollIntoViewIfNeeded();const box=await c.boundingBox();await p.mouse.click(box.x+box.width*.61,box.y+box.height/2);
  const row=await c.evaluate(c=>({native:Number(c.value),canonical:__g3.preferences.orbs[0].motion.angularSpeedRadPerSec,other:__g3.preferences.orbs[1].motion.angularSpeedRadPerSec,focused:document.activeElement===c}));assert.equal(row.native,row.canonical);assert.notEqual(row.canonical,.123456);assert.equal(row.other,.234567);assert.ok(row.focused);return row;
 });
 await check('AUD-009 native all Bulk continuous fields display uniform imported precision',async()=>{
  const orb={motion:{angularSpeedRadPerSec:.123456},response:{minRadiusFrac:.123456,maxRadiusFrac:.654321,waveformRadialDisplaceFrac:.123456},particles:{emitPerSecond:15.5,sizeMinPx:1.23456,sizeMaxPx:6.123456,sizeToMinSec:2.34567,ttlSec:180.123456,minPlacementDistancePx:.123456}};
  await apply({orbs:[{...orb,id:'A'},{...orb,id:'B'}]});
  const rows=await p.evaluate(()=>{const a=__g3,fields=[['rngOmega','motion','angularSpeedRadPerSec'],['rngMinRad','response','minRadiusFrac'],['rngMaxRad','response','maxRadiusFrac'],['rngWfDisp','response','waveformRadialDisplaceFrac'],['rngEmit','particles','emitPerSecond'],['rngSizeMin','particles','sizeMinPx'],['rngSizeMax','particles','sizeMaxPx'],['rngSizeToMin','particles','sizeToMinSec'],['rngTTL','particles','ttlSec'],['rngMinPlacementDistance','particles','minPlacementDistancePx']];return fields.map(([id,g,f])=>{const c=document.getElementById(id);return{id,canonical:a.preferences.orbs[0][g][f],native:Number(c.value),output:c.parentElement.querySelector('.val').textContent,step:c.step}})});for(const row of rows){near(row.native,row.canonical);assert.equal(parseFloat(row.output),row.canonical);assert.equal(row.step,'any')}return rows;
 });
 await check('AUD-009 uninstrumented portable preset share/reload reflects native controls',async()=>{
  await p.goto(`http://127.0.0.1:${server.address().port}/plain`);await apply({orbs:[{id:'A',motion:{angularSpeedRadPerSec:.123456},trace:{numLines:15.5}}]});
  const payload=await share();assert.equal(payload.prefs.orbs[0].motion.angularSpeedRadPerSec,.123456);assert.equal(payload.prefs.orbs[0].trace.numLines,16);await p.reload();
  const row=await p.evaluate(()=>{const root=document.querySelector('#orbEditorList [data-orb-id="A"]');return{speed:Number(root.querySelector('[id$="-angular-speed"]').value),lines:Number(root.querySelector('[id$="-line-count"]').value),instrumented:!!window.__g3}});assert.equal(row.speed,.123456);assert.equal(row.lines,16);assert.equal(row.instrumented,false);return row;
 });
 await p.goto(`http://127.0.0.1:${server.address().port}`);
 }

 if(!baseline) for(const count of [3,4,32,256]) await check(`AUD-008 native built geometry/energy count ${count}`,async()=>{
  const data=await p.evaluate(count=>{
   const a=__g3,results=[];
   for(const floor of [Number.MIN_VALUE,1e-307,1e-200,20,22500-1e-10,22500]) {
    const preset={schema:10,prefs:{bands:{count,floorHz:floor,ceilingHz:22500,distributionMode:'log'}}};
    history.replaceState(null,'','#p='+btoa(JSON.stringify(preset)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''));document.getElementById('btnApplyUrl').click();
    a.BandBankController.onAudioContextKnown(48000);a.BandBankController.rebuildNow();
    const b=a.state.bands,edges=b.lowHz.slice(1);for(const [id,db] of [['L',-90],['R',-50],['C',-10]])a.BandBank.computeEnergiesFromAnalyser({analyser:{minDecibels:-100,maxDecibels:0},freqDb:new Float32Array(4096).fill(db)},48000,b.channels[id].energies01);
    results.push({floor,canonical:a.preferences.bands.floorHz,edges,energies:Object.fromEntries(['L','R','C'].map(id=>[id,[...b.channels[id].energies01]])),high:[...b.highHz]});
   }return results;
  },count);
  for(const row of data){assert.equal(row.canonical,row.floor);assert.equal(row.edges[0],row.floor);assert.equal(row.edges.at(-1),22500);
   row.edges.forEach((edge,i)=>{assert.ok(Number.isFinite(edge)&&edge>=row.floor&&edge<=22500);if(i)assert.ok(edge>=row.edges[i-1]);if(i&&i<row.edges.length-1&&row.floor<1e-100)assert.ok(edge<22500)});
   for(const [id,expected] of [['L',.1],['R',.5],['C',.9]])row.energies[id].forEach((energy,i)=>assert.ok(Math.abs(energy-(row.high[i]<= (i?row.edges[i-1]:0)?0:expected))<1e-12));
  }return data.map(row=>({floor:row.floor,firstEdges:row.edges.slice(0,4),midpoint:row.edges[Math.floor(row.edges.length/2)],zeroBands:row.energies.C.filter(e=>e===0).length}));
 });

 }finally{evidence.errors=errors;await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync(opt('--output')||'/tmp/g3-native.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify({cases:evidence.cases.length,failed:evidence.cases.filter(c=>!c.passed),errors}));if(errors.length||evidence.cases.some(c=>!c.passed))process.exitCode=1}
}
main().catch(e=>{console.error(e);process.exitCode=1});
