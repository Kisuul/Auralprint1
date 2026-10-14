// Small native calibration and proof restrictive policy remains unconnected.
// Diagnostic-only policy bundle/hooks are added to served memory, never artifacts.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto'),cp=require('node:child_process');
const {chromium}=require('playwright'),esbuild=require('esbuild');
const root=path.resolve(__dirname,'../../../../..'),version=fs.readFileSync(path.join(root,'version'),'utf8').trim();
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
function wav(seconds=1,rate=44100,channels=2){const n=rate*seconds,b=Buffer.alloc(44+n*channels*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(channels,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*channels*2,28);b.writeUInt16LE(channels*2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(b.length-44,40);for(let i=0;i<n;i++)for(let c=0;c<channels;c++)b.writeInt16LE(Math.round(8000*Math.sin(2*Math.PI*(440+c*110)*i/rate)),44+(i*channels+c)*2);return b}
function observations(){window.__counts={fullReads:0,decodes:0};window.__unhandled=[];addEventListener('unhandledrejection',e=>__unhandled.push(String(e.reason)));const read=File.prototype.arrayBuffer;File.prototype.arrayBuffer=function(){__counts.fullReads++;return read.call(this)};const decode=OfflineAudioContext.prototype.decodeAudioData;OfflineAudioContext.prototype.decodeAudioData=function(...args){__counts.decodes++;return decode.call(this,...args)}}
(async()=>{
 const portable=path.join(root,`dist/auralprint_${version.slice(1)}.html`),html=fs.readFileSync(portable,'utf8');
 const helper=await esbuild.build({stdin:{contents:`import {CONFIG} from './src/js/core/config.js';import * as policy from './src/js/audio/waveform-policy.js';import * as metadata from './src/js/audio/waveform-metadata.js';window.__policy={CONFIG,...policy,...metadata};`,resolveDir:root},bundle:true,write:false,format:'iife',platform:'browser',target:'es2020'});
 function observed(text){const marker='  main();\n})();';assert.equal(text.split(marker).length,2);return text.replace('return { init, loadFile, reset, draw };','return { init, loadFile, reset, draw, __peaks:()=>_waveform, __snapshot:waveformCoordinator.snapshot };').replace(marker,'  window.__app={Scrubber,AudioEngine,state,Queue};\n'+marker).replace('</head>',`<script>${helper.outputFiles[0].text}</script></head>`)}
 const server=http.createServer((req,res)=>{let file=req.url==='/portable'?portable:req.url.startsWith('/nested/')?path.join(root,'dist/hosted',req.url.slice(8)):path.join(root,'dist/hosted',req.url==='/'?'index.html':req.url.slice(1));if(!file.startsWith(root)||!fs.existsSync(file)){res.writeHead(404);res.end();return}const ext=path.extname(file);res.setHeader('Content-Type',ext==='.html'?'text/html':ext==='.svg'?'image/svg+xml':ext==='.png'?'image/png':ext==='.webmanifest'?'application/manifest+json':'application/octet-stream');res.end(ext==='.html'?observed(fs.readFileSync(file,'utf8')):fs.readFileSync(file))});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
 const evidence={version,browser:await browser.version(),artifactSha256:digest(fs.readFileSync(portable)),environment:'headless Linux Chromium, localhost. Pure modules exposed via a diagnostic-only bundle. Native media duration, offline decode and production playback use real small files. No production policy activation, native RSS or physical reclamation claim.',ffmpeg:cp.execFileSync('ffmpeg',['-version'],{encoding:'utf8'}).split('\n')[0],cases:[]};
 const fixtures=[{name:'stereo.wav',type:'audio/wav',bytes:wav()},{name:'surround-96k.wav',type:'audio/wav',bytes:wav(1,96000,6)},...['stereo.mp3','stereo.ogg','surround.ogg'].map(name=>({name,type:name.endsWith('mp3')?'audio/mpeg':'audio/ogg',bytes:fs.readFileSync(path.join(root,'work',name))}))];
 async function check(name,fn,url='/portable'){const p=await browser.newPage({viewport:{width:1440,height:1000}});p.setDefaultTimeout(15000);const errors=[],assets=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});p.on('response',r=>{if(r.status()>=400)assets.push(r.url())});try{await p.addInitScript(observations);await p.goto(`http://127.0.0.1:${server.address().port}${url}`);const data=await fn(p);assert.deepEqual(errors,[]);assert.deepEqual(assets,[]);assert.deepEqual(await p.evaluate(()=>__unhandled),[]);evidence.cases.push({name,pass:true,data,pageErrors:errors})}catch(e){evidence.cases.push({name,pass:false,error:e.message,pageErrors:errors});throw e}finally{await p.close()}}
 try{
 for(const f of fixtures)await check('native metadata/estimate/output '+f.name,async p=>{
  const data=await p.evaluate(async({name,type,bytes})=>{
   const api=__policy,policy=api.CONFIG.waveform,file=new File([new Uint8Array(bytes)],name,{type});const el=document.createElement('audio');
   const initialDuration=Number.isFinite(el.duration)?el.duration:null;const initialReadyState=el.readyState;const initial=api.evaluateWaveformPolicy({fileSizeBytes:file.size,durationSeconds:el.duration,durationState:'pending'}),before={...__counts};
   const url=URL.createObjectURL(file);el.preload='metadata';await new Promise((resolve,reject)=>{el.onloadedmetadata=resolve;el.onerror=()=>reject(Error('native media refused'));el.src=url});
   let probeReads=0,probeBytes=0;const slice=file.slice.bind(file);file.slice=(start,end)=>{probeReads++;probeBytes+=end-start;return slice(start,end)};
   const header=await api.probeWaveformMetadata(file,policy);
   const input={fileSizeBytes:file.size,durationSeconds:el.duration,durationState:'available',metadataConfidence:'unknown',headerMetadata:header};
   const decision=api.evaluateWaveformPolicy(input),afterPolicy={...__counts};
   const native=await new OfflineAudioContext(1,1,policy.decodeSampleRateHz).decodeAudioData(await file.arrayBuffer());
   const actual={frames:native.length,channels:native.numberOfChannels,sampleRate:native.sampleRate,pcmBytes:native.length*native.numberOfChannels*Float32Array.BYTES_PER_ELEMENT};
   const record={fileSizeBytes:file.size,durationInitial:initialDuration,initialReadyState,initialDecision:initial,mediaDuration:el.duration,header,decision,probeReads,probeBytes,before,afterPolicy,actual,estimateDifferenceBytes:decision.estimatedPcmBytes-actual.pcmBytes,confidenceRemains:decision.metadata.confidence};
   el.src='';el.load();URL.revokeObjectURL(url);return record;
  },{name:f.name,type:f.type,bytes:[...f.bytes]});
  assert.equal(data.initialDecision.decision,'defer');assert.equal(data.decision.decision,'admit');assert.deepEqual(data.before,data.afterPolicy);assert.equal(data.probeReads,1);assert.ok(data.probeBytes<=65536);
  assert.equal(data.actual.sampleRate,44100);
  if(f.name.endsWith('.wav')){assert.equal(data.header.confidence,'verified');assert.equal(data.decision.metadata.channelCount,f.name.startsWith('surround')?6:2)}
  else{assert.equal(data.header.confidence,'unknown');assert.equal(data.decision.metadata.confidence,'estimated');assert.equal(data.decision.metadata.channelCount,2);if(f.name==='surround.ogg'){assert.equal(data.actual.channels,6);assert.ok(data.estimateDifferenceBytes<0)}}
  return {...data,fixtureSha256:digest(f.bytes)};
 });
 for(const [name,url] of [['portable','/portable'],['hosted-root','/'],['hosted-nested','/nested/index.html']])await check('unconnected policy preserves automatic waveform '+name,async p=>{
  const buffer=wav(4);const before=await p.evaluate(()=>({counts:{...__counts},occupancy:__app.Scrubber.__snapshot()}));
  const refusal=await p.evaluate(size=>__policy.evaluateWaveformPolicy({fileSizeBytes:size,durationSeconds:4,channelCount:2,metadataConfidence:'verified',durationState:'available'},{...__policy.CONFIG.waveform,maxEncodedBytes:1}),buffer.length);assert.equal(refusal.reason,'encoded-budget');
  assert.deepEqual(await p.evaluate(()=>({counts:{...__counts},occupancy:__app.Scrubber.__snapshot()})),before);
  await p.locator('#fileInput').setInputFiles({name:'still-automatic.wav',mimeType:'audio/wav',buffer});await p.waitForFunction(()=>__app.state.audio.isPlaying&&__app.Scrubber.__peaks()?.length===512);
  return {refusal,production:await p.evaluate(()=>({counts:__counts,playing:__app.state.audio.isPlaying,loaded:__app.state.audio.isLoaded,peaks:__app.Scrubber.__peaks().length})),policyIntegrated:false};
 },url);
 }finally{await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync(process.argv[2]||path.join(root,'work/policy-native.json'),JSON.stringify(evidence,null,2)+'\n')}
 console.log(JSON.stringify({cases:evidence.cases.length,passed:evidence.cases.filter(c=>c.pass).length,browser:evidence.browser}));
})().catch(e=>{console.error(e);process.exitCode=1});
