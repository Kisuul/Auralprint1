// Independent native observations on the actual built application. Test-only
// metadata and delivery substitution is explicit; no production file is edited.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../../../../..'),version=fs.readFileSync(path.join(root,'version'),'utf8').trim();
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
const artifact=path.join(root,`dist/auralprint_${version.slice(1)}.html`),baseline=path.join(root,'dist/auralprint_0.1.15m.i.k.html');
const mp3=fs.readFileSync(path.join(root,'work/stereo.mp3'));
function instrument(html) {
 const marker='  main();\n})();';
 for(const text of [marker,'return { init, loadFile, reset, draw };','const duration = intent.media?.duration;'])assert.equal(html.split(text).length,2,text);
 return html.replace('const duration = intent.media?.duration;','const duration = window.__testDuration ?? intent.media?.duration;')
 .replace('return { init, loadFile, reset, draw };','return { init, loadFile, reset, draw, __peaks:()=>_waveform, __snapshot:waveformAdmission.snapshot };')
 .replace(marker,'  window.__app={UI,state,AudioEngine,Queue,Scrubber,applicationPreferences,analysisFrame};\n'+marker);
}
function observe() {
 window.__audit={prefix:[],read:[],decode:[],releases:[],holdRead:false,unhandled:[],listeners:new WeakMap()};
 addEventListener('unhandledrejection',e=>__audit.unhandled.push(String(e.reason)));
 const slice=File.prototype.slice,read=File.prototype.arrayBuffer,decode=OfflineAudioContext.prototype.decodeAudioData;
 File.prototype.slice=function(a,b){__audit.prefix.push({name:this.name,start:a,end:b});return slice.call(this,a,b)};
 File.prototype.arrayBuffer=function(){const row={name:this.name,nativeCompleted:false,deliveryHeld:false};__audit.read.push(row);return read.call(this).then(bytes=>{row.nativeCompleted=true;if(__audit.holdRead){row.deliveryHeld=true;return new Promise(resolve=>__audit.releases.push(()=>{row.deliveryHeld=false;resolve(bytes)}))}return bytes})};
 OfflineAudioContext.prototype.decodeAudioData=function(bytes){const row={inputBytes:bytes.byteLength};__audit.decode.push(row);return decode.call(this,bytes).then(pcm=>{Object.assign(row,{frames:pcm.length,channels:pcm.numberOfChannels,rate:pcm.sampleRate});return pcm})};
 const add=EventTarget.prototype.addEventListener,remove=EventTarget.prototype.removeEventListener;
 EventTarget.prototype.addEventListener=function(type,fn,...rest){let map=__audit.listeners.get(this);if(!map)__audit.listeners.set(this,map=new Map());let set=map.get(type);if(!set)map.set(type,set=new Set());set.add(fn);return add.call(this,type,fn,...rest)};
 EventTarget.prototype.removeEventListener=function(type,fn,...rest){__audit.listeners.get(this)?.get(type)?.delete(fn);return remove.call(this,type,fn,...rest)};
}
(async()=>{
 const raw=fs.readFileSync(artifact),evidence={version,browser:null,artifactSha256:digest(raw),environment:'Linux headless Chromium / localhost. Small actual MP3. __testDuration substitutes only admission metadata (540s); native media duration/playback and decoder PCM stay real. Held native read result delivery records actual completion separately. No native memory/thread/reclamation claim.',fixture:{bytes:mp3.length,sha256:digest(mp3)},cases:[],baselineControls:[]};
 const server=http.createServer((req,res)=>{const file=req.url==='/baseline'?baseline:artifact;res.setHeader('Content-Type','text/html');res.end(instrument(fs.readFileSync(file,'utf8')))});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});evidence.browser=await browser.version();
 async function check(name,fn,{url='/portable',viewport={width:1280,height:800},control=false}={}) {
  const p=await browser.newPage({viewport,hasTouch:viewport.width<600});p.setDefaultTimeout(15000);const errors=[],assets=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});p.on('requestfailed',r=>assets.push({url:r.url(),failure:r.failure()?.errorText}));
  try {await p.addInitScript(observe);await p.goto(`http://127.0.0.1:${server.address().port}${url}`);const data=await fn(p);assert.deepEqual(errors,[]);assert.deepEqual(assets,[]);assert.deepEqual(await p.evaluate(()=>__audit.unhandled),[]);(control?evidence.baselineControls:evidence.cases).push({name,pass:true,data,pageErrors:errors});}
  catch(e){(control?evidence.baselineControls:evidence.cases).push({name,pass:false,error:e.message,pageErrors:errors});throw e;}
  finally {await p.close();}
 }
 const settle=p=>p.waitForFunction(()=>!__app.Scrubber.__snapshot().occupied);
 const ready=p=>p.waitForFunction(()=>__app.Scrubber.__peaks()?.length===512&&!__app.Scrubber.__snapshot().occupied);
 const offer=p=>p.waitForFunction(()=>!document.getElementById('btnGenerateWaveform').hidden&&!__app.Scrubber.__snapshot().occupied);
 const summary=p=>p.evaluate(()=>({prefix:__audit.prefix,reads:__audit.read,decodes:__audit.decode,ownership:__app.Scrubber.__snapshot(),status:document.getElementById('waveformStatus').textContent,filename:__app.state.audio.filename,playing:__app.state.audio.isPlaying,settings:__app.applicationPreferences.runtime.settings,peakCount:__app.Scrubber.__peaks()?.length??0}));
 async function load(p,names=['fixture.mp3']){await p.locator('#fileInput').setInputFiles(names.map(name=>({name,mimeType:'audio/mpeg',buffer:mp3})));await p.waitForFunction(name=>__app.state.audio.filename===name&&__app.state.audio.isPlaying,names[0])}
 async function uiSelection(p,value){await p.locator('#btnWaveformOptions').click();await p.locator('#selWaveformProfile').selectOption(value);await p.keyboard.press('Escape')}
 async function installOfferObserver(p){await p.evaluate(()=>{window.__testDuration=540;window.__offerObserved=false;const observer=new MutationObserver(()=>{if(!/Above the automatic workload/.test(document.getElementById('waveformStatus').textContent))return;observer.disconnect();__offerObserved=true;const select=document.getElementById('selWaveformProfile');select.value='15m';select.dispatchEvent(new Event('change',{bubbles:true}));});observer.observe(document.getElementById('waveformStatus'),{childList:true,subtree:true,characterData:true});})}
 try {
  if(fs.existsSync(baseline))await check('accepted baseline DOM-observer control exposes lost 15m selection',async p=>{
   assert.equal(digest(fs.readFileSync(baseline)),'0b39d811ca8c7bb2a017f6d71743f7b02d5b86faf939f4c126f1cdfce6f2c375');
   await installOfferObserver(p);await load(p);await settle(p);await p.waitForFunction(()=>window.__offerObserved);await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const data=await summary(p);assert.equal(data.settings.selectedProfileId,'15m');assert.equal(data.reads.length,0,'baseline control must reproduce lost selection, not claim acceptance');
   return {...data,artifactSha256:digest(fs.readFileSync(baseline)),role:'Known-defect reproduction on accepted baseline, not passing production acceptance.'};
  },{url:'/baseline',control:true});
  await check('DOM-observer preference edit during offer now generates once through production UI',async p=>{
   await installOfferObserver(p);await load(p);await ready(p);assert.equal(await p.evaluate(()=>__offerObserved),true);const data=await summary(p);assert.equal(data.settings.selectedProfileId,'15m');assert.equal(data.prefix.length,1);assert.equal(data.reads.length,1);assert.equal(data.decodes.length,1);return data;
  });
  await check('profile revocation during held read preserves native gate, seek, and later manual action',async p=>{
   await uiSelection(p,'15m');await p.evaluate(()=>{__testDuration=540;__audit.holdRead=true});await load(p);await p.waitForFunction(()=>__audit.releases.length===1);await uiSelection(p,'4m');
   const blocked=await summary(p);assert.equal(blocked.decodes.length,0);assert.equal(blocked.ownership.occupied,true);
   await p.evaluate(()=>{__audit.holdRead=false;__audit.releases.splice(0).forEach(f=>f())});await offer(p);assert.equal((await summary(p)).decodes.length,0);
   const box=await p.locator('#scrubberCanvas').boundingBox();await p.locator('#scrubberCanvas').click({position:{x:box.width*.5,y:10}});
   const sought=await p.evaluate(()=>({time:__app.AudioEngine.getMediaEl().currentTime,duration:__app.AudioEngine.getMediaEl().duration,playing:__app.state.audio.isPlaying}));assert.ok(Math.abs(sought.time-sought.duration*.5)<.3);assert.equal(sought.playing,true);
   await p.locator('#btnGenerateWaveform').click();await ready(p);const data=await summary(p);assert.equal(data.prefix.length,1);assert.equal(data.reads.length,2);assert.equal(data.decodes.length,1);return {blocked,sought,settled:data};
  });
  await check('same File object in two Queue entries cannot borrow prior manual grant',async p=>{
   await p.evaluate(()=>__testDuration=540);await load(p);await offer(p);await p.locator('#btnGenerateWaveform').click();await ready(p);
   await p.evaluate(()=>{const original=__app.Queue.currentEntry();__app.Queue.add(original.file);window.__sameFile=original.file;__app.UI.refreshAllUiText(__app.analysisFrame)});
   await p.locator('#btnNext').click();await p.waitForFunction(()=>__app.Queue.currentIndex===1);await offer(p);assert.equal(await p.evaluate(()=>__app.Queue.currentEntry().file===__sameFile),true);
   const before=await summary(p);assert.equal(before.reads.length,1);await p.locator('#btnGenerateWaveform').click();await ready(p);const after=await summary(p);assert.equal(after.reads.length,2);assert.equal(after.decodes.length,2);return {sameFileObject:true,before,after};
  });
  await check('synchronous focus-triggered Queue successor keeps source identity and manual targeting',async p=>{
   await p.evaluate(()=>__testDuration=540);await load(p,['A.mp3','B.mp3','C.mp3']);await offer(p);await p.locator('#btnGenerateWaveform').focus();
   await p.evaluate(()=>{document.getElementById('btnWaveformOptions').addEventListener('focus',()=>document.getElementById('btnNext').click(),{once:true});document.getElementById('btnNext').click()});
   await p.waitForFunction(()=>__app.state.audio.filename==='C.mp3'&&__app.state.audio.isPlaying);await offer(p);assert.equal((await summary(p)).reads.length,0);await p.locator('#btnGenerateWaveform').click();await ready(p);const data=await summary(p);assert.deepEqual(data.reads.map(r=>r.name),['C.mp3']);return data;
  });
  for(const viewport of [{width:800,height:650},{width:390,height:844}])await check(`reinitialization, hidden Audio, focus and stable DOM at ${viewport.width}px`,async p=>{
   await p.evaluate(()=>__testDuration=540);await load(p);await offer(p);
   const listeners=await p.evaluate(()=>{
    const count=()=>Object.fromEntries(['scrubberCanvas','selWaveformProfile','selWaveformBehavior','btnGenerateWaveform','btnWaveformOptions'].map(id=>[id,[...(__audit.listeners.get(document.getElementById(id))?.values()??[])].reduce((sum,s)=>sum+s.size,0)]));
    const before=count();for(let i=0;i<30;i++)__app.Scrubber.init(document.getElementById('scrubberCanvas'));return {before,after:count()};
   });assert.deepEqual(listeners.before,listeners.after);
   await p.locator('#btnHideAudio').click();await p.locator('#btnOpenAudio').click();
   if(viewport.width<600)await p.locator('#btnWaveformOptions').tap();else await p.locator('#btnWaveformOptions').click();
   const bounds=await p.locator('#waveformOptions').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=viewport.width&&bounds.y>=0);
   await p.locator('#selWaveformProfile').focus();await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>document.activeElement.id),'btnWaveformOptions');
   await p.locator('#btnPlay').click();await p.waitForFunction(()=>!__app.state.audio.isPlaying);
   const writes=await p.evaluate(()=>{__app.Scrubber.draw();const observer=new MutationObserver(()=>{});for(const id of ['scrubberTime','waveformStatus','waveformAnnouncement'])observer.observe(document.getElementById(id),{childList:true,subtree:true,characterData:true,attributes:true});for(let i=0;i<2000;i++)__app.Scrubber.draw();const mutations=observer.takeRecords().length;observer.disconnect();return mutations});assert.equal(writes,0);
   return {listeners,bounds,iterations:2000,mutations:writes,summary:await summary(p)};
  },{viewport});
 } finally {await browser.close();await new Promise(resolve=>server.close(resolve));fs.writeFileSync(process.argv[2]||path.join(root,'work/i2d-native.json'),JSON.stringify(evidence,null,2)+'\n');}
 console.log(JSON.stringify({nativeCases:evidence.cases.length,passed:evidence.cases.filter(c=>c.pass).length,baselineDefectControls:evidence.baselineControls.length,artifactSha256:evidence.artifactSha256,browser:evidence.browser}));
})().catch(error=>{console.error(error);process.exitCode=1});
