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
 await p.goto(`http://127.0.0.1:${server.address().port}`);await p.evaluate(()=>document.getElementById('btnOpenVisualizers').click());
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
