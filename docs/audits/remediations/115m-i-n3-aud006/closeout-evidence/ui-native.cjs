// N.3F optional acceptance: external Playwright/Chromium/ffprobe/ffmpeg.
// Native media is real. Only terminal-handler delivery is delayed in Cancel case.
// Usage: node ui-native.cjs fresh-report.json scratch-media-dir
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../../../../..'),out=path.resolve(process.argv[2]),scratch=path.resolve(process.argv[3]);
assert.ok(!fs.existsSync(out),'fresh report required');fs.mkdirSync(scratch,{recursive:true});
const version=fs.readFileSync(path.join(root,'version'),'utf8').trim(),artifact=fs.readFileSync(path.join(root,'dist',`auralprint_${version.slice(1)}.html`));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const report={version,artifactSha256:sha(artifact),cases:[],errors:[],instrumentation:'Unmodified built HTML; seeded application storage; native recorder Stop counter; anchor observation; only finalizing Cancel delays real terminal handler. No fabricated data.'};
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});try{
 const page=await browser.newPage({viewport:{width:1100,height:900},acceptDownloads:true});page.setDefaultTimeout(15000);page.on('pageerror',e=>report.errors.push(e.message));
 await page.route('http://localhost/**',r=>r.fulfill({body:artifact,contentType:'text/html'}));
 await page.addInitScript(()=>{
  const key='auralprint.recording-resources';if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({version:1,profile:'custom',custom:{softBytes:130000001,aggregateBytes:270000007,durationMs:300001,maxChunks:1199,warningFraction:.8}}));
  window.nativeRecorders=[];window.holdTerminal=false;const Native=MediaRecorder;
  window.MediaRecorder=class extends Native{constructor(...a){super(...a);this.stopCalls=0;nativeRecorders.push(this);}stop(){this.stopCalls++;return super.stop();}set onstop(cb){super.onstop=cb?e=>setTimeout(()=>cb(e),holdTerminal?3000:0):null;}get onstop(){return super.onstop;}};
  const click=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(this.download)window.lastNativeDownload={url:this.href,name:this.download};return click.call(this);};
 });
 const open=async()=>{await page.locator('#btnOpenRecord').click();await page.locator('#recordingResources summary').click();};
 const stored=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('auralprint.recording-resources')));
 const apply=()=>page.locator('#btnApplyRecordingResources').click();
 const phase=value=>page.waitForFunction(v=>document.getElementById('recordPanel').dataset.recordingPhase===v,value);
 await page.goto('http://localhost/');await open();
 assert.equal(await page.locator('#recording-softBytes').inputValue(),'130.000001');assert.equal(await page.locator('#recording-durationMs').inputValue(),'300001/60000');
 assert.match(await page.locator('label[for="recording-softBytes"]').innerText(),/MB/);assert.match(await page.locator('label[for="recording-durationMs"]').innerText(),/minutes/);
 await page.locator('#recording-maxChunks').fill('1201');await apply();let value=await stored();assert.equal(value.custom.durationMs,300001);assert.equal(value.custom.softBytes,130000001);assert.equal(value.custom.aggregateBytes,270000007);assert.equal(value.custom.maxChunks,1201);
 await page.reload();await open();assert.equal(await page.locator('#recording-durationMs').inputValue(),'300001/60000');
 report.cases.push({id:'arbitrary-canonical-one-field-lossless-reload',stored:await stored()});
 await page.locator('#recording-softBytes').fill('9007199254.740992');await apply();assert.equal(await page.locator('#recording-softBytes').getAttribute('aria-invalid'),'true');assert.equal((await stored()).custom.softBytes,130000001);
 await page.locator('#recording-softBytes').fill('0.0000001');await apply();assert.match(await page.locator('#recordingPolicyError').innerText(),/whole bytes/);
 await page.locator('#recording-softBytes').fill('130.000001');await page.locator('#recording-durationMs').fill('1/60000');await apply();assert.equal((await stored()).custom.durationMs,1);
 await page.locator('#recording-durationMs').fill('120');await apply();assert.equal((await stored()).custom.durationMs,7200000);assert.match(await page.locator('#recordingPolicySummary').innerText(),/operate independently/);
 report.cases.push({id:'decimal-fraction-overflow-validation-two-hours',stored:await stored()});
 await page.locator('#recording-durationMs-enabled').uncheck();await apply();await page.reload();await open();value=await stored();assert.equal(value.custom.durationMs,null);assert.equal(value.custom.softBytes,130000001);assert.equal(value.custom.maxChunks,1201);
 for(const profile of ['balanced','unrestricted','custom']){await page.locator('#selRecordingProfile').selectOption(profile);if(profile==='balanced')assert.match(await page.locator('#recordingPolicySummary').innerText(),/5 minutes.*130 MB.*270 MB.*10 MB.*1,200 chunks.*80%/);if(profile==='unrestricted')assert.match(await page.locator('#recordingPolicySummary').innerText(),/limits are Off.*crash may lose/);}
 assert.equal(await page.locator('#recording-durationMs-enabled').isChecked(),false);report.cases.push({id:'independent-off-and-profile-switching',stored:await stored()});
 await page.locator('#recording-durationMs-enabled').check();await page.locator('#recording-durationMs').fill('0.05');await apply();
 const rate=44100,n=rate*30,wav=Buffer.alloc(44+n*4);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVE',8);wav.write('fmt ',12);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(2,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*4,28);wav.writeUInt16LE(4,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(n*4,40);for(let i=0;i<n;i++){wav.writeInt16LE(10000*Math.sin(2*Math.PI*440*i/rate),44+i*4);wav.writeInt16LE(10000*Math.sin(2*Math.PI*880*i/rate),46+i*4);}
 await page.locator('#fileInput').setInputFiles({name:'n3f-stereo.wav',mimeType:'audio/wav',buffer:wav});await page.waitForFunction(()=>!document.getElementById('btnRecordStart').disabled);
 await page.locator('#btnRecordStart').click();await phase('recording');await page.locator('#recording-durationMs').fill('120');await apply();assert.equal((await stored()).custom.durationMs,7200000);
 await phase('complete');assert.match(await page.locator('#recordStatus').innerText(),/automatically.*duration/);assert.equal(await page.evaluate(()=>nativeRecorders.at(-1).stopCalls),1);
 const download=page.waitForEvent('download');await page.locator('#btnRecordDownloadLast').click();const d=await download,file=path.join(scratch,d.suggestedFilename());await d.saveAs(file);const data=fs.readFileSync(file);assert.ok(data.length>0);
 const probe=JSON.parse(cp.execFileSync('ffprobe',['-v','error','-show_streams','-of','json',file],{encoding:'utf8'}));assert.ok(probe.streams.some(s=>s.codec_type==='audio'));assert.ok(probe.streams.some(s=>s.codec_type==='video'));cp.execFileSync('ffmpeg',['-v','error','-i',file,'-t','2','-f','null','-']);
 const prior=await page.evaluate(()=>lastNativeDownload);
 const replay=await page.evaluate(async url=>{const v=document.createElement('video');v.muted=true;v.src=url;document.body.append(v);await v.play();await new Promise(r=>setTimeout(r,400));const t=v.currentTime;v.pause();v.remove();return t;},prior.url);assert.ok(replay>0);
 report.cases.push({id:'native-minute-duration-frozen-next-start-download',bytes:data.length,sha256:sha(data),streams:probe.streams.map(s=>({type:s.codec_type,codec:s.codec_name})),replayTime:replay,progress:await page.locator('#recordingProgress').innerText(),stopCalls:1});
 for(const key of ['softBytes','aggregateBytes','durationMs'])await page.locator(`#recording-${key}-enabled`).uncheck();await page.locator('#recording-maxChunks').fill('1');await apply();
 await page.locator('#btnRecordStart').click();await phase('error');assert.match(await page.locator('#recordStatus').innerText(),/Previous export preserved/);assert.equal(await page.evaluate(()=>nativeRecorders.at(-1).stopCalls),1);
 const preserved=async()=>page.evaluate(async url=>{const b=await(await fetch(url)).arrayBuffer();return {bytes:b.byteLength,hash:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b))).map(v=>v.toString(16).padStart(2,'0')).join('')};},prior.url);
 assert.deepEqual(await preserved(),{bytes:data.length,hash:sha(data)});assert.equal(await page.locator('#btnRecordDownloadLast').isEnabled(),true);report.cases.push({id:'native-hard-admission-failure-preserves-export',prior:await preserved(),stopCalls:1});
 await page.locator('#recording-maxChunks').fill('1200');await apply();await page.evaluate(()=>{holdTerminal=true;});await page.locator('#btnRecordStart').click();await page.waitForTimeout(1100);await page.locator('#btnRecordStop').click();await phase('finalizing');
 const priorDownload=page.waitForEvent('download');await page.locator('#btnRecordDownloadLast').focus();await page.keyboard.press('Enter');await priorDownload;
 await page.locator('#btnHideRecord').click();await page.locator('#btnOpenRecord').click();await page.locator('#btnRecordCancel').focus();await page.keyboard.press('Enter');await phase('cancelled');await page.waitForTimeout(3200);await phase('cancelled');
 assert.equal(await page.locator('#btnSourceFile').isEnabled(),true);assert.deepEqual(await preserved(),{bytes:data.length,hash:sha(data)});assert.equal(await page.evaluate(()=>nativeRecorders.at(-1).stopCalls),1);report.cases.push({id:'native-keyboard-download-cancel-hide-reveal',prior:await preserved(),stopCalls:1});
 await page.setViewportSize({width:390,height:844});await page.locator('#recording-durationMs-enabled').check();await page.locator('#recording-durationMs').fill('120');await apply();
 const layout=await page.evaluate(()=>{const p=document.getElementById('recordPanel'),r=p.getBoundingClientRect();return {left:r.left,right:r.right,innerWidth,scrollWidth:p.scrollWidth,clientWidth:p.clientWidth};});assert.ok(layout.left>=0&&layout.right<=layout.innerWidth+1&&layout.scrollWidth<=layout.clientWidth+1);await page.screenshot({path:path.join(scratch,'narrow-settings.png')});
 await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new DOMException('denied','SecurityError');};});await page.locator('#selRecordingProfile').selectOption('unrestricted');assert.match(await page.locator('#recordingPolicyStorage').innerText(),/session only.*saving failed/);assert.equal(await page.locator('#selRecordingProfile').inputValue(),'unrestricted');assert.equal(await page.evaluate(()=>location.hash),'');
 report.cases.push({id:'narrow-layout-and-session-only-unrestricted',layout,message:await page.locator('#recordingPolicyStorage').innerText()});assert.deepEqual(report.errors,[]);report.passed=true;
 }catch(e){report.failure=e.stack;throw e;}finally{fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
