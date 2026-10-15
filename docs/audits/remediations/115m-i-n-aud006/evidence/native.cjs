// Optional real-application probe. Build first. Externally provided Playwright.
// node native.cjs <fresh-report.json> <scratch-download-directory>
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {chromium}=require(process.env.AUD006_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../../../../..');
const version=fs.readFileSync(path.join(root,'version'),'utf8').trim();
const artifact=fs.readFileSync(path.join(root,'dist',`auralprint_${version.slice(1)}.html`),'utf8');
const marker='  main();';
assert.equal(artifact.split(marker).length,2);
// Expose existing symbols only in an in-memory HTML copy. No production edits.
const html=artifact.replace(marker,'  window.aud006App = {state, RecorderEngine, AudioEngine, InputSourceManager, UI, CONFIG};\n'+marker);
if (!process.argv[2] || !process.argv[3]) throw new Error('Usage: node native.cjs <fresh-report.json> <scratch-download-directory>');
const output=path.resolve(process.argv[2]);
const downloads=path.resolve(process.argv[3]); fs.mkdirSync(downloads,{recursive:true});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function wav(seconds=8){const rate=44100,n=rate*seconds,b=Buffer.alloc(44+n*4);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVE',8);b.write('fmt ',12);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(2,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*4,28);b.writeUInt16LE(4,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n*4,40);for(let i=0;i<n;i++){b.writeInt16LE(Math.round(10000*Math.sin(2*Math.PI*440*i/rate)),44+i*4);b.writeInt16LE(Math.round(10000*Math.sin(2*Math.PI*880*i/rate)),46+i*4);}return b;}
(async()=>{
const browser=await chromium.launch({executablePath:process.env.AUD006_CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
const report={version,browser:await browser.version(),artifactSha256:sha(artifact),instrumentation:'In-memory symbol exposure; native MediaRecorder subclass observers; synthetic mediaDevices acquisition, actual production source manager/audio/render/UI.',cases:[],memory:{measurement:'CDP Performance.getMetrics JSHeapUsedSize and JSHeapTotalSize for whole page at checkpoints',limitations:'Not recorder attribution, Blob backing/native/GPU/encoder/process memory, GC timing, or device safety.'}};
try {
 const page=await browser.newPage({viewport:{width:960,height:640},deviceScaleFactor:1,acceptDownloads:true});page.setDefaultTimeout(12000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://localhost/**',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.addInitScript(()=>{
   const n={recorders:[],created:[],revoked:[],fixtures:[]};window.aud006=n;
   const Native=MediaRecorder;
   window.MediaRecorder=class extends Native {
    constructor(...args){super(...args);this.probe={requested:args[1],mime:this.mimeType,startMs:null,stopMs:null,stopCalls:0,events:[],tracks:args[0].getTracks()};const recorder=this;Object.defineProperty(this.probe,'finalMime',{enumerable:true,get:()=>recorder.mimeType});n.recorders.push(this.probe);
     for(const type of ['dataavailable','stop','error'])this.addEventListener(type,e=>this.probe.events.push({type,ms:performance.now(),bytes:e.data?.size||0,mime:e.data?.type||null,error:e.error?.message||null}));}
    start(slice){this.probe.startMs=performance.now();this.probe.timeslice=slice;return super.start(slice);}
    stop(){this.probe.stopMs=performance.now();this.probe.stopCalls++;return super.stop();}
   };
   const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);
   URL.createObjectURL=b=>{const u=create(b);n.created.push({url:u,bytes:b.size,type:b.type});return u;};
   URL.revokeObjectURL=u=>{n.revoked.push(u);return revoke(u);};
   const make=async(kind)=>{const ctx=new AudioContext();await ctx.resume();const dest=ctx.createMediaStreamDestination(),merger=ctx.createChannelMerger(2),oscs=[440,880].map((f,i)=>{const o=ctx.createOscillator();o.frequency.value=f;o.connect(merger,0,i);o.start();return o;});merger.connect(dest);const stream=dest.stream;
    let fixtureCanvas,timer;if(kind==='stream'){fixtureCanvas=document.createElement('canvas');fixtureCanvas.width=64;fixtureCanvas.height=64;const c=fixtureCanvas.getContext('2d');timer=setInterval(()=>{c.fillStyle='red';c.fillRect(0,0,64,64);},50);stream.addTrack(fixtureCanvas.captureStream(10).getVideoTracks()[0]);}
    const f={kind,ctx,oscs,stream,timer,stops:0};for(const t of stream.getTracks()){const stop=t.stop.bind(t);t.stop=()=>{f.stops++;return stop();};}n.fixtures.push(f);return stream;};
   Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:()=>make('mic'),configurable:true});
   Object.defineProperty(navigator.mediaDevices,'getDisplayMedia',{value:()=>make('stream'),configurable:true});
 });
 await page.goto('http://localhost/');
 const cdp=await page.context().newCDPSession(page);await cdp.send('Performance.enable');
 const heap=async()=>Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.filter(x=>['JSHeapUsedSize','JSHeapTotalSize'].includes(x.name)).map(x=>[x.name,x.value]));
 const click=id=>page.evaluate(id=>document.getElementById(id).click(),id);
 const phase=p=>page.waitForFunction(p=>window.aud006App.state.recording.phase===p,p);
 const state=()=>page.evaluate(()=>structuredClone(window.aud006App.state.recording));
 const chooser=page.waitForEvent('filechooser');await page.locator('#btnLoad').click();await(await chooser).setFiles({name:'capacity-stereo-8s.wav',mimeType:'audio/wav',buffer:wav()});await page.waitForFunction(()=>!document.getElementById('btnRecordStart').disabled);
 report.environment=await page.evaluate(()=>({userAgent:navigator.userAgent,canvas:{width:document.getElementById('c').width,height:document.getElementById('c').height},dpr:devicePixelRatio,fps:aud006App.state.recording.targetFps,configuredMimes:aud006App.CONFIG.recording.preferredMimeTypes,supportedMimes:aud006App.state.recording.availableMimeTypes}));
 async function record(name,seconds,{audio=true,mime=null,switchAttempt=false}={}){
  const before=await state(),memoryBefore=await heap();
  await page.evaluate(({audio,mime})=>{const a=aud006App;a.RecorderEngine.setIncludePlaybackAudio(audio);if(mime)a.RecorderEngine.selectMimeType(mime);a.UI.refreshRecordingUi();},{audio,mime});
  await click('btnRecordStart');await phase('recording');
  const retained=await page.evaluate(async previous=>({same:aud006App.state.recording.lastExportUrl===previous,previousFetchable:previous?(await(await fetch(previous)).blob()).size:null}),before.lastExportUrl);
  let sourceSwitch;
  if(switchAttempt)sourceSwitch=await page.evaluate(()=>{const kind=aud006App.state.source.kind,button=document.getElementById('btnSourceMic');const disabled=button.disabled;button.click();return{before:kind,after:aud006App.state.source.kind,disabled};});
  await page.waitForTimeout(seconds*1000);
  const active=await state(),memoryActive=await heap();await click('btnRecordStop');
  await page.waitForFunction(()=>['complete','error'].includes(aud006App.state.recording.phase));
  const after=await state();
  const native=await page.evaluate(()=>{const p=aud006.recorders.at(-1);return{...p,tracks:p.tracks.map(t=>({kind:t.kind,state:t.readyState,settings:t.getSettings()}))};});
  const outcome={name,requestedSeconds:seconds,beforeExportBytes:before.lastExportByteSize,retained,sourceSwitch,active,after,native,memoryBefore,memoryActive,memoryAfter:await heap()};
  report.cases.push(outcome);fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
  assert.equal(after.phase,'complete',`${name} failed: ${after.lastCode}`);assert.ok(after.lastExportByteSize>0);assert.equal(retained.same,true);assert.equal(native.stopCalls,1);
  assert.equal(native.events.filter(e=>e.type==='dataavailable').reduce((n,e)=>n+e.bytes,0),after.lastExportByteSize);
  console.log(JSON.stringify({name,bytes:after.lastExportByteSize,chunks:after.chunkCount,elapsedMs:after.elapsedMs,mime:native.mime}));
 }
 await record('video-only',3,{audio:false});
 await record('file-audio',5,{switchAttempt:true});
 const prior=await state();await page.evaluate(()=>{const c=document.getElementById('c');aud006.capture=c.captureStream;c.captureStream=()=>{throw new Error('controlled acquisition failure');};});
 await click('btnRecordStart');await phase('error');const failure=await state();assert.equal(failure.lastExportUrl,prior.lastExportUrl);
 report.failedReplacement={before:prior,after:failure,previousBytes:await page.evaluate(async()=> (await(await fetch(aud006App.state.recording.lastExportUrl)).blob()).size)};
 await page.evaluate(()=>{document.getElementById('c').captureStream=aud006.capture;});
 // Source switch is supported after Stop. Synthetic acquisition replaces permission only.
 await click('btnSourceMic');await page.waitForFunction(()=>aud006App.state.source.kind==='mic'&&aud006App.state.source.status==='active');
 await record('synthetic-mic',3);
 report.micAfterStop=await page.evaluate(()=>({source:aud006App.state.source.kind,active:aud006App.state.source.sessionActive,tracks:aud006.fixtures.at(-1).stream.getTracks().map(t=>t.readyState),stopCalls:aud006.fixtures.at(-1).stops}));
 await click('btnSourceStream');await page.waitForFunction(()=>aud006App.state.source.kind==='stream'&&aud006App.state.source.status==='active');
 report.micAfterSourceSwitch=await page.evaluate(()=>({tracks:aud006.fixtures[0].stream.getTracks().map(t=>t.readyState),stopCalls:aud006.fixtures[0].stops}));
 for(const mime of report.environment.supportedMimes)await record(`stream-codec-${mime}`,3,{mime});
 await record('stream-longer-safe-60s',60,{mime:report.environment.supportedMimes[0]});
 for(let i=1;i<=3;i++)await record(`repeat-${i}`,2);
 report.streamAfterStop=await page.evaluate(()=>({source:aud006App.state.source.kind,active:aud006App.state.source.sessionActive,tracks:aud006.fixtures.at(-1).stream.getTracks().map(t=>({kind:t.kind,state:t.readyState})),stopCalls:aud006.fixtures.at(-1).stops}));
 const downloaded=page.waitForEvent('download');await click('btnRecordDownloadLast');const d=await downloaded;
 const downloadPath=path.join(downloads,d.suggestedFilename());await d.saveAs(downloadPath);const disk=fs.readFileSync(downloadPath);
 report.download={filename:d.suggestedFilename(),bytes:disk.length,sha256:sha(disk)};
 report.replay=await page.evaluate(async()=>{const v=document.createElement('video');v.muted=true;v.src=aud006App.state.recording.lastExportUrl;document.body.append(v);try{await new Promise((resolve,reject)=>{v.onloadeddata=resolve;v.onerror=()=>reject(new Error('native export replay decode failure'));});await v.play();await new Promise(r=>setTimeout(r,500));return{width:v.videoWidth,height:v.videoHeight,currentTime:v.currentTime,paused:v.paused,readyState:v.readyState};}finally{v.pause();v.removeAttribute('src');v.load();v.remove();}});
 assert.ok(report.replay.currentTime>0);assert.equal(report.download.bytes,(await state()).lastExportByteSize);
 report.ownership=await page.evaluate(()=>{const videoUrls=aud006.created.filter(x=>x.type.startsWith('video/'));return{successfulExports:videoUrls.length,revokedExports:videoUrls.filter(x=>aud006.revoked.includes(x.url)).length,liveExports:videoUrls.filter(x=>!aud006.revoked.includes(x.url)).length};});assert.equal(report.ownership.liveExports,1);
 await click('btnSourceFile');await page.waitForFunction(()=>!aud006App.state.source.sessionActive && aud006.fixtures.at(-1).stream.getTracks().every(t=>t.readyState==='ended'));
 report.streamAfterSourceSwitch=await page.evaluate(()=>({tracks:aud006.fixtures.at(-1).stream.getTracks().map(t=>t.readyState),stopCalls:aud006.fixtures.at(-1).stops}));
 await page.evaluate(async()=>{aud006App.RecorderEngine.dispose();for(const f of aud006.fixtures){if(f.timer)clearInterval(f.timer);for(const o of f.oscs)o.stop();await f.ctx.close();}});
 report.errors=errors;assert.deepEqual(errors,[]);report.passed=true;
 fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
} catch(e){report.failure=e.stack;fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');throw e;}
finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
