// Native UI acceptance: application artifact unchanged; delayed native terminal
// handler only in the finalizing-recovery diagnostic. No fabricated media data.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../../../../..'),out=path.resolve(process.argv[2]);if(fs.existsSync(out))throw Error('fresh report required');
const version=fs.readFileSync(path.join(root,'version'),'utf8').trim(),artifact=fs.readFileSync(path.join(root,'dist',`auralprint_${version.slice(1)}.html`));
const report={version,artifactSha256:crypto.createHash('sha256').update(artifact).digest('hex'),cases:[],errors:[]};
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});try{
 const page=await browser.newPage({viewport:{width:1000,height:800}});page.setDefaultTimeout(15000);page.on('pageerror',e=>report.errors.push(e.message));
 await page.route('http://localhost/**',r=>r.fulfill({body:artifact,contentType:'text/html'}));
 await page.addInitScript(()=>{window.holdNativeTerminal=false;const Native=MediaRecorder;window.MediaRecorder=class extends Native{set onstop(cb){super.onstop=cb?e=>setTimeout(()=>cb(e),holdNativeTerminal?1500:0):null;}get onstop(){return super.onstop;}};});
 await page.goto('http://localhost/');await page.locator('#btnOpenRecord').click();await page.locator('#recordingResources summary').click();
 await page.locator('#selRecordingProfile').selectOption('custom');await page.locator('#recording-durationMs').fill('2000');await page.locator('#btnApplyRecordingResources').click();
 assert.match(await page.locator('#recordingPolicyStorage').innerText(),/Saved locally/);
 const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('auralprint.recording-resources')));assert.equal(stored.custom.durationMs,2000);
 await page.reload();await page.locator('#btnOpenRecord').click();await page.locator('#recordingResources summary').click();assert.equal(await page.locator('#selRecordingProfile').inputValue(),'custom');assert.equal(await page.locator('#recording-durationMs').inputValue(),'2000');
 // Invalid draft has inline accessible feedback, prior valid record remains intact.
 await page.locator('#recording-durationMs').fill('0');await page.locator('#btnApplyRecordingResources').click();assert.equal(await page.locator('#recording-durationMs').getAttribute('aria-invalid'),'true');assert.match(await page.locator('#recordingPolicyError').innerText(),/positive/);
 await page.locator('#recording-durationMs').fill('2000');await page.locator('#btnApplyRecordingResources').click();
 // File fixture: real native audio and video, repeated loop for UI workflow.
 const rate=44100,n=rate*10,wav=Buffer.alloc(44+n*2);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVE',8);wav.write('fmt ',12);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(n*2,40);for(let i=0;i<n;i++)wav.writeInt16LE(10000*Math.sin(2*Math.PI*440*i/rate),44+i*2);
 await page.locator('#fileInput').setInputFiles({name:'ui-native.wav',mimeType:'audio/wav',buffer:wav});await page.waitForFunction(()=>!document.getElementById('btnRecordStart').disabled);
 await page.locator('#btnRecordStart').click();await page.locator('#selRecordingProfile').selectOption('unrestricted');
 assert.match(await page.locator('#recordingPolicyNext').innerText(),/Next Start: unrestricted.*frozen custom/);
 await page.waitForFunction(()=>document.getElementById('recordPanel').dataset.recordingPhase==='complete');assert.match(await page.locator('#recordStatus').innerText(),/automatically.*duration/);
 assert.match(await page.locator('#recordingProgress').innerText(),/Last capture profile: custom/);
 report.cases.push({id:'native-next-session-freeze-duration',status:await page.locator('#recordStatus').innerText(),progress:await page.locator('#recordingProgress').innerText()});
 // Actual terminal delay diagnostic keeps Download+Cancel available while finalizing.
 await page.evaluate(()=>{window.holdNativeTerminal=true;});await page.locator('#btnRecordStart').click();await page.waitForTimeout(1100);await page.locator('#btnRecordStop').click();
 await page.waitForFunction(()=>document.getElementById('recordPanel').dataset.recordingPhase==='finalizing');assert.equal(await page.locator('#btnRecordCancel').isEnabled(),true);assert.equal(await page.locator('#btnRecordDownloadLast').isEnabled(),true);
 const download=page.waitForEvent('download');await page.locator('#btnRecordDownloadLast').click();const d=await download;assert.ok(d.suggestedFilename().endsWith('.webm'));
 await page.locator('#btnHideRecord').click();await page.locator('#btnOpenRecord').click();await page.locator('#btnRecordCancel').focus();await page.keyboard.press('Enter');
 assert.equal(await page.locator('#recordPanel').getAttribute('data-recording-phase'),'cancelled');assert.equal(await page.evaluate(()=>document.activeElement.id),'btnRecordDownloadLast');await page.waitForTimeout(1800);
 assert.equal(await page.locator('#recordPanel').getAttribute('data-recording-phase'),'cancelled');assert.equal(await page.locator('#btnSourceFile').isEnabled(),true);
 report.cases.push({id:'native-finalizing-cancel-hide-reveal-keyboard',priorDownload:d.suggestedFilename(),status:await page.locator('#recordStatus').innerText(),focus:await page.evaluate(()=>document.activeElement.id)});
 // Narrow layout, idempotent refresh, drafts/focus survive active updates.
 await page.setViewportSize({width:390,height:844});await page.locator('#selRecordingProfile').selectOption('custom');await page.locator('#recording-durationMs').focus();await page.locator('#recording-durationMs').fill('2345');
 await page.waitForTimeout(400);assert.equal(await page.locator('#recording-durationMs').inputValue(),'2345');assert.equal(await page.evaluate(()=>document.activeElement.id),'recording-durationMs');
 const layout=await page.evaluate(()=>{const p=document.getElementById('recordPanel'),r=p.getBoundingClientRect();return {left:r.left,right:r.right,innerWidth,scrollWidth:p.scrollWidth,clientWidth:p.clientWidth};});assert.ok(layout.left>=0&&layout.right<=layout.innerWidth+1);assert.ok(layout.scrollWidth<=layout.clientWidth+1);report.cases.push({id:'narrow-settings-focus',layout});
 await page.screenshot({path:path.join(root,'work','narrow-ui.png')});
 await page.locator('#btnResetRecordingResources').click();assert.equal(await page.locator('#selRecordingProfile').inputValue(),'balanced');
 assert.equal(await page.evaluate(()=>location.hash),'');
 await page.evaluate(()=>localStorage.setItem('auralprint.recording-resources','{"version":999}'));await page.reload();await page.locator('#btnOpenRecord').click();await page.locator('#recordingResources summary').click();assert.equal(await page.locator('#selRecordingProfile').inputValue(),'balanced');assert.match(await page.locator('#recordingPolicyStorage').innerText(),/invalid|unsupported/);
 report.cases.push({id:'corrupt-storage-truthful-fallback',message:await page.locator('#recordingPolicyStorage').innerText()});
 // Denied storage writes remain session-only and do not change Unrestricted.
 await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new DOMException('denied','SecurityError');};});await page.locator('#selRecordingProfile').selectOption('unrestricted');assert.match(await page.locator('#recordingPolicyStorage').innerText(),/session only/);assert.match(await page.locator('#recordingPolicyNext').innerText(),/unrestricted/);
 report.cases.push({id:'denied-save-retains-unrestricted',message:await page.locator('#recordingPolicyStorage').innerText()});assert.deepEqual(report.errors,[]);report.passed=true;
 }catch(e){report.failure=e.stack;throw e;}finally{fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
