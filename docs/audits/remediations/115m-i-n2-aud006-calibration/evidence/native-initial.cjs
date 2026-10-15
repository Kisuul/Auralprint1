// Optional diagnostic only; externally provisioned Playwright/Chromium/ffprobe.
// node native.cjs <fresh-report.json> <scratch-media-directory>
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),cp=require('node:child_process');
const {chromium}=require(process.env.AUD006_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../../../../..'),out=path.resolve(process.argv[2]||''),scratch=path.resolve(process.argv[3]||'');
if(!process.argv[2]||!process.argv[3])throw Error('report and controlled scratch directory required');
if(fs.existsSync(out))throw Error('refusing to overwrite evidence');
fs.mkdirSync(scratch,{recursive:true});
const version=fs.readFileSync(path.join(root,'version'),'utf8').trim(),artifact=fs.readFileSync(path.join(root,'dist',`auralprint_${version.slice(1)}.html`),'utf8');
const marker='  main();';assert.equal(artifact.split(marker).length,2);
const html=artifact.replace(marker,'  window.n2App={state,RecorderEngine,AudioEngine,InputSourceManager,UI,CONFIG,runtime,resolveSettings,VisualizerRuntime};\n'+marker);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const guards={deliveredBytes:96*2**20,aggregateBytes:192*2**20,chunks:2000,rssBytes:1.5*2**30,cgroupBytes:6*2**30,minHostAvailableBytes:512*2**20};
const scenarios=[
 {id:'B-baseline-video',width:960,height:640,fps:30,scene:'default',mode:'file',audio:false,mime:'video/webm;codecs=vp9,opus',seconds:30},
 {id:'B-standard-file',width:1280,height:720,fps:30,scene:'16-orbs',mode:'file',audio:true,mime:'video/webm;codecs=vp9,opus',seconds:45},
 {id:'B-standard-stream-vp8',width:1280,height:720,fps:30,scene:'16-orbs',mode:'stream',audio:true,mime:'video/webm;codecs=vp8,opus',seconds:30},
 {id:'B-high-mic',width:1920,height:1080,fps:30,scene:'16-orbs',mode:'mic',audio:true,mime:'video/webm;codecs=vp9,opus',seconds:30},
 {id:'B-expert-stream',width:1920,height:1080,fps:60,scene:'heavy-32-orbs',mode:'stream',audio:true,mime:'video/webm;codecs=vp9,opus',seconds:30},
 {id:'B-standard-stream-mp4',width:1280,height:720,fps:30,scene:'16-orbs',mode:'stream',audio:true,mime:'video/mp4',seconds:30},
 {id:'B-high-video-vp8',width:1920,height:1080,fps:30,scene:'16-orbs',mode:'file',audio:false,mime:'video/webm;codecs=vp8,opus',seconds:30},
 {id:'C-standard-5min',width:1280,height:720,fps:30,scene:'16-orbs',mode:'stream',audio:true,mime:'video/webm;codecs=vp9,opus',seconds:300},
 {id:'C-baseline-15min',width:960,height:640,fps:30,scene:'default',mode:'stream',audio:true,mime:'video/webm;codecs=vp9,opus',seconds:900,conditional:true},
];
function host(){
 const rows=cp.execFileSync('ps',['-eo','pid=,ppid=,rss='],{encoding:'utf8'}).trim().split('\n').map(x=>x.trim().split(/\s+/).map(Number));
 const ids=new Set([process.pid]);for(let i=0;i<10;i++){let changed=false;for(const [pid,ppid]of rows)if(ids.has(ppid)&&!ids.has(pid)){ids.add(pid);changed=true;}if(!changed)break;}
 const rssBytes=rows.filter(x=>ids.has(x[0])).reduce((s,x)=>s+x[2]*1024,0);
 const cgroupBytes=Number(fs.readFileSync('/sys/fs/cgroup/memory.current','utf8'));
 const minfo=fs.readFileSync('/proc/meminfo','utf8');return{at:new Date().toISOString(),rssBytes,cgroupBytes,hostAvailableBytes:Number(minfo.match(/^MemAvailable:\s+(\d+)/m)[1])*1024};
}
function wav(){const rate=44100,n=rate*8,b=Buffer.alloc(44+n*4);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVE',8);b.write('fmt ',12);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(2,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*4,28);b.writeUInt16LE(4,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n*4,40);for(let i=0;i<n;i++){b.writeInt16LE(Math.round(10000*Math.sin(2*Math.PI*440*i/rate)),44+i*4);b.writeInt16LE(Math.round(10000*Math.sin(2*Math.PI*880*i/rate)),46+i*4);}return b;}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.AUD006_CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
 const report={baseline:'889b0b4267c473db6bfa7b1afda6cfeed77565ee',version,browser:await browser.version(),startedAt:new Date().toISOString(),artifactSha256:sha(artifact),guards,scenarios,cases:[],omitted:[],instrumentation:'In-memory symbol exposure; native recorder observation; URL ledger; synthetic mediaDevices; render wrapper measures existing method, no replacement rendering; File media.loop=true fixture setup.'};
 const save=()=>fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');save();
 try{
 for(const s of scenarios){
  if(s.conditional){const prev=report.cases.find(x=>x.id==='C-standard-5min');if(!prev?.success||prev.bytes>32*2**20||Math.max(...prev.hostSamples.map(x=>x.rssBytes))>1.2*2**30||prev.errors.length){report.omitted.push({id:s.id,reason:'five-minute prerequisite failed'});save();continue;}}
  // Fresh page per workload avoids accumulated scene/export contamination.
  const page=await browser.newPage({viewport:{width:s.width,height:s.height},deviceScaleFactor:1,acceptDownloads:true});page.setDefaultTimeout(15000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://localhost/**',r=>r.fulfill({contentType:'text/html',body:html}));
  await page.addInitScript(({guards})=>{
   const n={recorders:[],created:[],revoked:[],fixtures:[],guard:null};window.n2=n;
   const Native=MediaRecorder;
   window.MediaRecorder=class extends Native{
    constructor(...a){super(...a);const self=this;this.p={requested:a[1],initialMime:this.mimeType,events:[],tracks:a[0].getTracks(),startMs:null,stopMs:null,stopCalls:0,delivered:0,count:0};Object.defineProperty(this.p,'finalMime',{enumerable:true,get:()=>self.mimeType});n.recorders.push(this.p);
     for(const type of ['dataavailable','stop','error'])this.addEventListener(type,e=>{const p=this.p;p.events.push({type,ms:performance.now(),bytes:e.data?.size||0,mime:e.data?.type||null,error:e.error?.message||null});if(type==='dataavailable'&&e.data.size){p.delivered+=e.data.size;p.count++;if(p.delivered>guards.deliveredBytes||p.count>guards.chunks||p.delivered+(window.n2App?.state.recording.lastExportByteSize||0)>guards.aggregateBytes){n.guard='delivered-resource-guard';queueMicrotask(()=>{if(n2App.state.recording.phase==='recording')n2App.RecorderEngine.stop();});}}});
    }
    start(slice){this.p.startMs=performance.now();this.p.timeslice=slice;return super.start(slice);}
    stop(){this.p.stopMs=performance.now();this.p.stopCalls++;return super.stop();}
   };
   const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);
   URL.createObjectURL=b=>{const url=create(b);n.created.push({url,bytes:b.size,type:b.type,at:performance.now()});return url;};
   URL.revokeObjectURL=url=>{n.revoked.push({url,at:performance.now(),currentExport:window.n2App?.state.recording.lastExportUrl});return revoke(url);};
   async function make(kind){const ctx=new AudioContext();await ctx.resume();const dest=ctx.createMediaStreamDestination(),merger=ctx.createChannelMerger(2),oscs=[440,880].map((f,i)=>{const o=ctx.createOscillator();o.frequency.value=f;o.connect(merger,0,i);o.start();return o;});merger.connect(dest);const stream=dest.stream;let timer;if(kind==='stream'){const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');timer=setInterval(()=>{g.fillStyle='red';g.fillRect(0,0,64,64);},50);stream.addTrack(c.captureStream(10).getVideoTracks()[0]);}const f={ctx,oscs,stream,timer};n.fixtures.push(f);return stream;}
   Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:()=>make('mic'),configurable:true});Object.defineProperty(navigator.mediaDevices,'getDisplayMedia',{value:()=>make('stream'),configurable:true});
  },{guards});
  await page.goto('http://localhost/');
  await page.evaluate(()=>{
   const a=n2App,original=a.VisualizerRuntime.render;n2.render={times:[],costs:[]};a.VisualizerRuntime.render=function(...args){const t=performance.now();const value=original.apply(this,args);n2.render.times.push(t);n2.render.costs.push(performance.now()-t);return value;};
  });
  if(s.scene!=='default')await page.evaluate(scene=>{
   const a=n2App,settings=structuredClone(a.runtime.settings),template=settings.orbs[0],count=scene==='heavy-32-orbs'?32:16;settings.orbs=Array.from({length:count},(_,i)=>{const o=structuredClone(template);o.id=`calibration-${i}`;o.startAngleRad=i*Math.PI*2/count;o.motion.angularSpeedRadPerSec=.4+(i%4)*.15;if(scene==='heavy-32-orbs'){o.particles.emitPerSecond=1000;o.particles.ttlSec=30;o.particles.minPlacementDistancePx=0;o.trace.numLines=100;}return o;});location.hash='#p='+btoa(JSON.stringify({schema:10,prefs:settings})).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  },s.scene);
  if(s.scene!=='default')await page.waitForFunction(count=>n2App.runtime.settings.orbs.length===count,s.scene==='16-orbs'?16:32);
  // Source is activated after scene setup; capture source remains production-owned.
  if(s.mode==='file'){
   const chooser=page.waitForEvent('filechooser');await page.locator('#btnLoad').click();await(await chooser).setFiles({name:'calibration-loop-stereo.wav',mimeType:'audio/wav',buffer:wav()});await page.waitForFunction(()=>n2App.state.audio.isLoaded);await page.evaluate(()=>{n2App.AudioEngine.getMediaEl().loop=true;});
  }else{await page.evaluate(mode=>document.getElementById(mode==='mic'?'btnSourceMic':'btnSourceStream').click(),s.mode);await page.waitForFunction(mode=>n2App.state.source.kind===mode&&n2App.state.source.status==='active',s.mode);}
  const environment=await page.evaluate(()=>({canvas:{width:n2App.state.canvas.width,height:n2App.state.canvas.height},dpr:devicePixelRatio,orbs:n2App.runtime.settings.orbs.length,scene:n2App.runtime.settings.orbs,particleSafety:n2App.runtime.settings.particleSafety,mimes:n2App.state.recording.availableMimeTypes,userAgent:navigator.userAgent,mediaKeys:Object.keys(n2App.state.audio)}));
  assert.equal(environment.orbs,s.scene==='default'?2:s.scene==='16-orbs'?16:32,'scene must actually apply');assert.equal(environment.canvas.width,s.width);assert.equal(environment.canvas.height,s.height);
  if(!environment.mimes.includes(s.mime)){report.omitted.push({id:s.id,reason:'unsupported requested MIME',environment});save();await page.close();continue;}
  await page.evaluate(s=>{n2App.RecorderEngine.setTargetFps(s.fps);n2App.RecorderEngine.setIncludePlaybackAudio(s.audio);n2App.RecorderEngine.selectMimeType(s.mime);},s);
  const hosts=[];
  async function capture(seconds,label){
   await page.evaluate(()=>{n2.render.times=[];n2.render.costs=[];n2App.RecorderEngine.start();});await page.waitForFunction(()=>n2App.state.recording.phase==='recording');
   const until=Date.now()+seconds*1000;while(Date.now()<until){await page.waitForTimeout(Math.min(1000,until-Date.now()));const h=host();hosts.push(h);if(h.rssBytes>guards.rssBytes||h.cgroupBytes>guards.cgroupBytes||h.hostAvailableBytes<guards.minHostAvailableBytes){await page.evaluate(()=>{n2.guard='host-resource-guard';if(n2App.state.recording.phase==='recording')n2App.RecorderEngine.stop();});break;}if(await page.evaluate(()=>!!n2.guard))break;}
   const overlap=await page.evaluate(()=>({P:n2App.state.recording.lastExportByteSize,D:n2.recorders.at(-1).delivered,priorUrl:n2App.state.recording.lastExportUrl}));
   await page.evaluate(()=>{if(n2App.state.recording.phase==='recording')n2App.RecorderEngine.stop();});await page.waitForFunction(()=>['complete','error'].includes(n2App.state.recording.phase));
   const result=await page.evaluate(()=>{const p=n2.recorders.at(-1);return{state:structuredClone(n2App.state.recording),native:{...p,tracks:p.tracks.map(t=>({kind:t.kind,state:t.readyState,settings:t.getSettings()}))},render:n2.render,guard:n2.guard};});
   result.overlap=overlap;result.label=label;return result;
  }
  const main=await capture(s.seconds,s.id);
  const item={...main,id:s.id,scenario:s,environment,bytes:main.state.lastExportByteSize,elapsedMs:main.state.elapsedMs,errors,hostSamples:hosts};report.cases.push(item);save();
  if(item.guard){report.aborted=item.guard;save();break;}
  assert.equal(item.state.phase,'complete');assert.equal(item.bytes,item.native.events.filter(e=>e.type==='dataavailable').reduce((n,e)=>n+e.bytes,0));
  item.replay=await page.evaluate(async()=>{const v=document.createElement('video');v.muted=true;v.src=n2App.state.recording.lastExportUrl;document.body.append(v);try{await new Promise((resolve,reject)=>{v.onloadeddata=resolve;v.onerror=()=>reject(Error('decode error'));});await v.play();await new Promise(r=>setTimeout(r,300));return{currentTime:v.currentTime,width:v.videoWidth,height:v.videoHeight,quality:v.getVideoPlaybackQuality()};}finally{v.pause();v.removeAttribute('src');v.load();v.remove();}});assert.ok(item.replay.currentTime>0);
  // Download through the real UI; compact hashes and stream metadata are retained.
  const download=page.waitForEvent('download');await page.evaluate(()=>n2App.UI.refreshRecordingUi());await page.evaluate(()=>document.getElementById('btnRecordDownloadLast').click());const d=await download;const file=path.join(scratch,s.id+path.extname(d.suggestedFilename()));await d.saveAs(file);const disk=fs.readFileSync(file);item.download={bytes:disk.length,sha256:sha(disk)};assert.equal(disk.length,item.bytes);
  item.ffprobe=JSON.parse(cp.execFileSync('ffprobe',['-v','error','-count_packets','-show_streams','-show_format','-of','json',file],{encoding:'utf8',maxBuffer:2**20}));fs.unlinkSync(file);
  // D: both small and larger prior export, successful replacement + failed acquisition.
  if(['B-baseline-video','C-standard-5min'].includes(s.id)){
   const old=await page.evaluate(()=>({url:n2App.state.recording.lastExportUrl,bytes:n2App.state.recording.lastExportByteSize,revoked:n2.revoked.length}));
   await page.evaluate(()=>{n2.render.times=[];n2.render.costs=[];n2App.RecorderEngine.start();});await page.waitForTimeout(3000);
   item.replacementActive=await page.evaluate(async old=>({same:n2App.state.recording.lastExportUrl===old.url,fetchBytes:(await(await fetch(old.url)).blob()).size,P:old.bytes,D:n2.recorders.at(-1).delivered,revoked:n2.revoked.slice(old.revoked)}),old);assert.equal(item.replacementActive.fetchBytes,old.bytes);assert.deepEqual(item.replacementActive.revoked,[]);
   await page.evaluate(()=>n2App.RecorderEngine.stop());await page.waitForFunction(()=>n2App.state.recording.phase==='complete');
   item.replacement=await page.evaluate(old=>({state:structuredClone(n2App.state.recording),revocations:n2.revoked.slice(old.revoked),native:{...n2.recorders.at(-1),tracks:[]}}),old);assert.deepEqual(item.replacement.revocations.map(x=>x.url),[old.url]);assert.equal(item.replacement.revocations[0].currentExport,item.replacement.state.lastExportUrl);
   const current=await page.evaluate(()=>({url:n2App.state.recording.lastExportUrl,bytes:n2App.state.recording.lastExportByteSize,revoked:n2.revoked.length}));
   await page.evaluate(()=>{n2.originalCapture=n2App.state.canvas.captureStream;n2App.state.canvas.captureStream=()=>{throw Error('controlled acquisition failure');};n2App.RecorderEngine.start();});
   item.failedReplacement=await page.evaluate(async current=>({state:structuredClone(n2App.state.recording),fetchBytes:(await(await fetch(current.url)).blob()).size,revocations:n2.revoked.slice(current.revoked)}),current);assert.equal(item.failedReplacement.state.phase,'error');assert.equal(item.failedReplacement.fetchBytes,current.bytes);assert.deepEqual(item.failedReplacement.revocations,[]);
  }
  item.sourceAfter=await page.evaluate(()=>({kind:n2App.state.source.kind,active:n2App.state.source.sessionActive,tracks:n2.fixtures.at(-1)?.stream.getTracks().map(t=>({kind:t.kind,state:t.readyState}))}));
  item.success=true;save();console.log(JSON.stringify({id:s.id,bytes:item.bytes,elapsedMs:item.elapsedMs,renderFrames:item.render.times.length,codec:item.ffprobe.streams.map(x=>x.codec_name)}));
  await page.evaluate(async()=>{n2App.RecorderEngine.dispose();for(const f of n2.fixtures){if(f.timer)clearInterval(f.timer);for(const o of f.oscs)o.stop();await f.ctx.close();}});await page.close();
 }
 report.finishedAt=new Date().toISOString();report.passed=!report.aborted&&report.cases.every(x=>x.success);save();
 }catch(e){report.failure=e.stack;save();throw e;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
