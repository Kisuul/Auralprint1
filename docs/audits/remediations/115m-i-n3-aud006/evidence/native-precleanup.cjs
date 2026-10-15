// Optional acceptance diagnostics: external Playwright, Chromium, ffprobe/ffmpeg.
// Usage: node native.cjs fresh-report.json scratch-directory
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../../../../..'),out=path.resolve(process.argv[2]),scratch=path.resolve(process.argv[3]);
if(fs.existsSync(out))throw Error('Refusing to overwrite evidence');fs.mkdirSync(scratch,{recursive:true});
const version=fs.readFileSync(path.join(root,'version'),'utf8').trim();
const artifact=fs.readFileSync(path.join(root,'dist',`auralprint_${version.slice(1)}.html`),'utf8');
const marker='  main();';assert.equal(artifact.split(marker).length,2);
const html=artifact.replace(marker,'  window.n3App={state,RecorderEngine,AudioEngine,InputSourceManager,UI,CONFIG,recordingPolicySettings,resolveRecordingPolicy,defaultSelection};\n'+marker);
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const report={version,head:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),started:new Date().toISOString(),artifactSha256:hash(artifact),harnessSha256:hash(fs.readFileSync(__filename)),cases:[],guards:{rssBytes:2*2**30,cgroupBytes:6*2**30,deliveredBytes:150000000},instrumentation:'In-memory application symbol exposure; native MediaRecorder observation; synthetic permissions. Only capacity diagnostic injects short policy via explicit init seam. Factory policy unchanged. No forced OOM.'};
const save=()=>fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
function memory(){const current=Number(fs.readFileSync('/sys/fs/cgroup/memory.current','utf8'));const rows=cp.execFileSync('ps',['-eo','pid=,ppid=,rss='],{encoding:'utf8'}).trim().split('\n').map(l=>l.trim().split(/\s+/).map(Number));const ids=new Set([process.pid]);for(let i=0;i<10;i++)for(const [p,parent]of rows)if(ids.has(parent))ids.add(p);return {cgroupBytes:current,rssBytes:rows.filter(r=>ids.has(r[0])).reduce((a,r)=>a+r[2]*1024,0)};}
function wav(){const rate=44100,n=rate*8,b=Buffer.alloc(44+n*4);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVE',8);b.write('fmt ',12);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(2,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*4,28);b.writeUInt16LE(4,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n*4,40);for(let i=0;i<n;i++){b.writeInt16LE(10000*Math.sin(2*Math.PI*440*i/rate),44+i*4);b.writeInt16LE(10000*Math.sin(2*Math.PI*880*i/rate),46+i*4);}return b;}
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});report.browser=await browser.version();save();
 try {
  const page=await browser.newPage({viewport:{width:960,height:640},acceptDownloads:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://localhost/**',r=>r.fulfill({body:html,contentType:'text/html'}));
  await page.addInitScript(()=>{
    window.n3={recorders:[],fixtures:[],revoked:[]};const Native=MediaRecorder;
    window.MediaRecorder=class extends Native {
      constructor(...args){super(...args);const log={requested:args[1],mime:this.mimeType,events:[],stops:0,tracks:args[0].getTracks()};this.log=log;n3.recorders.push(log);for(const name of ['dataavailable','stop','error'])this.addEventListener(name,e=>log.events.push({type:name,bytes:e.data?.size||0,at:performance.now(),mime:e.data?.type}));}
      stop(){this.log.stops++;return super.stop();}
    };
    const revoke=URL.revokeObjectURL.bind(URL);URL.revokeObjectURL=u=>{n3.revoked.push({url:u,current:window.n3App?.state.recording.lastExportUrl});return revoke(u);};
    async function source(kind){const ctx=new AudioContext();await ctx.resume();const dest=ctx.createMediaStreamDestination(),merger=ctx.createChannelMerger(2);const oscs=[440,880].map((hz,i)=>{const o=ctx.createOscillator();o.frequency.value=hz;o.connect(merger,0,i);o.start();return o;});merger.connect(dest);const stream=dest.stream;if(kind==='stream'){const c=document.createElement('canvas');c.width=c.height=32;stream.addTrack(c.captureStream(1).getVideoTracks()[0]);}n3.fixtures.push({ctx,oscs,stream});return stream;}
    Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:()=>source('mic')});Object.defineProperty(navigator.mediaDevices,'getDisplayMedia',{configurable:true,value:()=>source('stream')});
  });
  await page.goto('http://localhost/');await page.locator('#btnOpenRecord').click();
  const phase=()=>page.evaluate(()=>n3App.state.recording.phase);
  const start=()=>page.evaluate(()=>n3App.RecorderEngine.start());
  const terminal=()=>page.waitForFunction(()=>!['recording','finalizing','starting'].includes(n3App.state.recording.phase),{},{timeout:15000});
  async function download(id){
    const state=await page.evaluate(()=>({...n3App.state.recording}));assert.equal(state.phase,'complete');
    const pending=page.waitForEvent('download');await page.locator('#btnRecordDownloadLast').click();const d=await pending;
    const file=path.join(scratch,id+path.extname(d.suggestedFilename()));await d.saveAs(file);const bytes=fs.statSync(file).size;assert.equal(bytes,state.lastExportByteSize);assert.equal(bytes,state.admittedBytes);
    const probe=JSON.parse(cp.execFileSync('ffprobe',['-v','error','-show_format','-show_streams','-of','json',file],{encoding:'utf8'}));
    cp.execFileSync('ffmpeg',['-v','error','-i',file,'-t','2','-f','null','-'],{stdio:'pipe'});
    const replay=await page.evaluate(async()=>{const v=document.createElement('video');v.src=n3App.state.recording.lastExportUrl;v.muted=true;document.body.append(v);await v.play();await new Promise(r=>setTimeout(r,400));const result={time:v.currentTime,width:v.videoWidth,height:v.videoHeight,duration:Number.isFinite(v.duration)?v.duration:null};v.pause();v.remove();return result;});assert.ok(replay.time>0&&replay.width>0);
    const native=await page.evaluate(()=>{const p=n3.recorders.at(-1);return {...p,tracks:p.tracks.map(t=>({kind:t.kind,readyState:t.readyState}))};});assert.equal(native.stops,1);
    return {state,download:{filename:d.suggestedFilename(),bytes,sha256:hash(fs.readFileSync(file))},streams:probe.streams.map(s=>({codec:s.codec_name,type:s.codec_type,width:s.width,height:s.height,duration:s.duration,channels:s.channels})),format:probe.format,replay,native};
  }
  // File manual control uses real UI Start/Stop and actual native data.
  const chooser=page.waitForEvent('filechooser');await page.locator('#btnLoad').click();await(await chooser).setFiles({name:'stereo.wav',mimeType:'audio/wav',buffer:wav()});
  await page.waitForFunction(()=>n3App.state.audio.isLoaded);await page.evaluate(()=>{n3App.AudioEngine.getMediaEl().loop=true;});
  await page.locator('#btnRecordStart').click();await page.waitForTimeout(1600);await page.locator('#btnRecordStop').click();await terminal();
  const manual=await download('manual-file');manual.id='manual-file-webm';manual.playbackSurvived=await page.evaluate(()=>!n3App.AudioEngine.getMediaEl().paused);report.cases.push(manual);save();
  const old=manual.state.lastExportUrl;
  // Actual native hard-admission failure, prior export fetchable, source remains live.
  await page.evaluate(()=>{const a=n3App;a.recordingPolicySettings.set({profile:'custom',custom:{...a.defaultSelection().custom,softBytes:null,aggregateBytes:null,maxChunks:1,durationMs:null}});});
  await start();await terminal();const failed=await page.evaluate(async(old)=>({state:{...n3App.state.recording},priorBytes:(await(await fetch(old)).blob()).size,revoked:n3.revoked.some(e=>e.url===old),playback:!n3App.AudioEngine.getMediaEl().paused}),old);
  assert.equal(failed.state.lastCode,'admission-rejected');assert.equal(failed.priorBytes,manual.download.bytes);assert.equal(failed.revoked,false);assert.equal(failed.playback,true);report.cases.push({id:'native-hard-failure-preserves-download',...failed});save();
  // Isolated short capacity injection through the explicit test seam; no large allocations.
  await page.evaluate(()=>{const a=n3App;a.RecorderEngine.init({stateRef:a.state.recording,getRenderTap:()=>({canvas:document.getElementById('c')}),getAudioTap:()=>a.AudioEngine.getRecorderTap(),getPolicy:()=>a.resolveRecordingPolicy({profile:'custom',custom:{softBytes:1000,aggregateBytes:10000000,maxChunks:100,durationMs:30000,warningFraction:.8}})});});
  await start();await terminal();const capacity=await download('native-capacity');capacity.id='native-short-capacity';assert.equal(capacity.state.stopReason,'capacity-stop');report.cases.push(capacity);save();
  // Restore production policy getter; Cancel UI and ownership for synthetic Mic/Stream.
  await page.evaluate(()=>{const a=n3App;a.recordingPolicySettings.reset();a.RecorderEngine.init({stateRef:a.state.recording,getRenderTap:()=>({canvas:document.getElementById('c')}),getAudioTap:()=>a.AudioEngine.getRecorderTap()});});
  for(const mode of ['mic','stream']){
    await page.evaluate(async mode=>{const a=n3App;const result=mode==='mic'?await a.InputSourceManager.activateMic():await a.InputSourceManager.activateStream();if(!result.ok)throw Error(JSON.stringify(result));},mode);
    await start();await page.waitForTimeout(1300);await page.locator('#btnRecordCancel').focus();await page.keyboard.press('Enter');
    assert.equal(await phase(),'cancelled');const ownership=await page.evaluate(()=>({state:{...n3App.state.recording},upstream:n3.fixtures.at(-1).stream.getTracks().map(t=>({kind:t.kind,state:t.readyState})),sourceActive:n3App.state.source.sessionActive,focus:document.activeElement.id,priorDownload:!document.getElementById('btnRecordDownloadLast').disabled,primaryUnlocked:!document.getElementById('btnSourceFile').disabled}));
    assert.ok(ownership.upstream.every(t=>t.state==='live'));assert.equal(ownership.primaryUnlocked,true);assert.equal(ownership.priorDownload,true);report.cases.push({id:`native-cancel-${mode}`,...ownership});save();
  }
  // MP4 support is negotiated; generic container is not assumed H.264/AAC.
  const mp4=await page.evaluate(()=>n3App.state.recording.availableMimeTypes.find(t=>t.startsWith('video/mp4'))||null);
  if(mp4){await page.evaluate(m=>n3App.RecorderEngine.selectMimeType(m),mp4);await start();await page.waitForTimeout(1600);await page.evaluate(()=>n3App.RecorderEngine.stop());await terminal();const value=await download('stream-mp4');value.id='native-stream-mp4';report.cases.push(value);save();}
  else report.cases.push({id:'native-stream-mp4',unavailable:true});
  // Factory five-minute completion, guarded 960x640/default scene, synthetic Stream.
  await page.evaluate(()=>{n3App.recordingPolicySettings.reset();n3App.RecorderEngine.selectMimeType('video/webm;codecs=vp9,opus');});
  assert.equal((await start()).ok,true);const samples=[];let guard=null,loops=0;
  while(['recording','finalizing'].includes(await phase())){
    await page.waitForTimeout(1000);const m=memory();m.elapsed=await page.evaluate(()=>n3App.state.recording.elapsedMs);samples.push(m);
    const data=await page.evaluate(()=>n3App.state.recording.deliveredBytes);
    if(m.rssBytes>report.guards.rssBytes||m.cgroupBytes>report.guards.cgroupBytes||data>report.guards.deliveredBytes||++loops>330){guard='diagnostic-resource-or-time-guard';await page.evaluate(()=>n3App.RecorderEngine.cancel());break;}
    if(loops%30===0)console.log('Factory trial elapsed ms:',m.elapsed);
  }
  const factory={id:'factory-300000ms',guard,samples};if(!guard){Object.assign(factory,await download('factory-five-minutes'));assert.equal(factory.state.stopReason,'duration-stop');assert.ok(factory.state.elapsedMs>=300000);}
  report.cases.push(factory);report.errors=errors;report.finished=new Date().toISOString();report.passed=!guard&&errors.length===0;save();assert.equal(report.passed,true);console.log('Native acceptance passed');
 }catch(e){report.failure=e.stack;save();throw e;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
