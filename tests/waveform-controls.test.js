import test from "node:test";
import assert from "node:assert/strict";
import { CONFIG } from "../src/js/core/config.js";
import { createApplicationPreferences } from "../src/js/core/application-preferences.js";
import { createWaveformAdmission } from "../src/js/audio/waveform-admission.js";
import { createWaveformControls } from "../src/js/ui/waveform-options.js";

function fixture(t, policy=CONFIG.waveform) {
 const doc={activeElement:null,createElement:()=>el(),getElementById:id=>nodes[id]??null};
 function el(){const e=Object.assign(new EventTarget(),{value:'',hidden:true,title:'',children:[],writes:0,
  setAttribute(k,v){this[k]=v},replaceChildren(...v){this.children=v},focus(){doc.activeElement=this}});let text='';
  Object.defineProperty(e,'textContent',{get:()=>text,set:v=>{e.writes++;text=v}});return e;}
 const ids=['selWaveformProfile','selWaveformBehavior','btnGenerateWaveform','btnGenerateWaveformOptions','waveformStatus','waveformAnnouncement','btnWaveformOptions','waveformOptions','btnCloseWaveformOptions'];
 const nodes=Object.fromEntries(ids.map(id=>[id,el()]));
 let stored=null,reads=0,decodes=0;const preferences=createApplicationPreferences({policy,storage:()=>({getItem:()=>stored,setItem:(k,v)=>stored=v})});
 let controls;const admission=createWaveformAdmission({policy,preferences,extract:async()=>{reads++;decodes++;return new Float32Array([.5])},onUpdate:(s,p,d)=>controls.update(s,d)});
 controls=createWaveformControls({document:doc,policy,preferences,generate:admission.generate});
 t.after(()=>{controls.dispose();admission.dispose()});
 const media=Object.assign(new EventTarget(),{duration:540,readyState:1});
 const file={size:16,slice:(a,b)=>({arrayBuffer:async()=>new ArrayBuffer(b-a)})};
 const change=(id,value)=>{nodes[id].value=value;nodes[id].dispatchEvent(new Event('change'))};
 const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve()};
 return {doc,nodes,preferences,admission,controls,change,flush,load:opts=>admission.loadFile(file,{media,...opts}),get reads(){return reads},get decodes(){return decodes},get stored(){return stored}};
}
test('AUD-007 CONFIG supplies UI profile labels, selections and exactly three behaviors',async t=>{
 const h=fixture(t);assert.equal(h.nodes.selWaveformProfile.value,'8m');assert.equal(h.nodes.selWaveformBehavior.value,'ask');
 assert.deepEqual(h.nodes.selWaveformProfile.children.map(o=>o.textContent),['Approx. 4 minutes','Approx. 8 minutes','Approx. 15 minutes']);
 assert.deepEqual(h.nodes.selWaveformBehavior.children.map(o=>o.textContent),['Ask before generating','Generate automatically if permitted','Skip automatic generation']);
 for(const id of ['4m','8m','15m']){h.change('selWaveformProfile',id);assert.equal(h.preferences.runtime.settings.selectedProfileId,id)}
});
test('AUD-007 edited CONFIG profiles populate UI without copied arithmetic or stock IDs',t=>{
 const policy=structuredClone(CONFIG.waveform);policy.automaticProfiles=[{id:'edited',approximateMinutes:12}];policy.defaultProfileId='edited';
 const h=fixture(t,policy);assert.equal(h.nodes.selWaveformProfile.value,'edited');assert.equal(h.nodes.selWaveformProfile.children[0].textContent,'Approx. 12 minutes');
});
test('AUD-007 decision → visible Generate → coordinator path is single admission',async t=>{
 const h=fixture(t);await h.load();assert.equal(h.nodes.btnGenerateWaveform.hidden,false);assert.match(h.nodes.waveformStatus.textContent,/Above the automatic workload/);
 h.nodes.btnGenerateWaveform.dispatchEvent(new Event('click'));h.nodes.btnGenerateWaveform.dispatchEvent(new Event('click'));await h.flush();
 assert.equal(h.reads,1);assert.equal(h.decodes,1);assert.equal(h.nodes.btnGenerateWaveform.hidden,true);assert.match(h.nodes.waveformStatus.textContent,/ready/);
});
test('AUD-007 changing UI profile to 15m admits nine-minute current track and persists selection',async t=>{
 const h=fixture(t);await h.load();h.change('selWaveformProfile','15m');await h.flush();assert.equal(h.reads,1);assert.equal(JSON.parse(h.stored).selectedProfileId,'15m');
});
test('AUD-007 Skip UI preserves manual action; automatic-if-permitted activates accepted path',async t=>{
 const h=fixture(t);h.change('selWaveformBehavior','skip');await h.load();assert.equal(h.reads,0);assert.equal(h.nodes.btnGenerateWaveformOptions.hidden,false);assert.match(h.nodes.waveformStatus.textContent,/skipped/);
 h.change('selWaveformBehavior','generate-if-permitted');await h.flush();assert.equal(h.reads,1);
});
test('AUD-007 hard resource refusal shows reason and no misleading manual UI',async t=>{
 const policy=structuredClone(CONFIG.waveform);policy.maxEstimatedDecodedPcmBytes=1;
 const h=fixture(t,policy);await h.load();assert.equal(h.nodes.btnGenerateWaveform.hidden,true);assert.equal(h.nodes.btnGenerateWaveformOptions.hidden,true);assert.match(h.nodes.waveformStatus.textContent,/estimated PCM/);assert.equal(h.reads,0);
});
test('AUD-007 wrong-source clicks and Clear cannot schedule old UI actions',async t=>{
 const h=fixture(t);let valid=true;await h.load({isCurrent:()=>valid});valid=false;h.nodes.btnGenerateWaveform.dispatchEvent(new Event('click'));await h.flush();assert.equal(h.reads,0,'UI manual action must reject wrong source');
 h.admission.reset();assert.equal(h.nodes.btnGenerateWaveform.hidden,true);assert.match(h.nodes.waveformStatus.textContent,/Load a File/);
});
test('AUD-007 unchanged UI status does not mutate text, announcement or action state',t=>{
 const h=fixture(t);h.controls.update('waiting',null);const status=h.nodes.waveformStatus.writes,announcement=h.nodes.waveformAnnouncement.writes;
 for(let i=0;i<1000;i++)h.controls.update('waiting',null);
 assert.equal(h.nodes.waveformStatus.writes,status);assert.equal(h.nodes.waveformAnnouncement.writes,announcement);
});
test('AUD-007 fallback nonmodal options keyboard close and disposed listeners remain bounded',t=>{
 const h=fixture(t);h.nodes.btnWaveformOptions.dispatchEvent(new Event('click'));assert.equal(h.nodes.waveformOptions.hidden,false);assert.equal(h.doc.activeElement,h.nodes.selWaveformProfile);
 const e=new Event('keydown');e.key='Escape';h.nodes.waveformOptions.dispatchEvent(e);assert.equal(h.nodes.waveformOptions.hidden,true);assert.equal(h.doc.activeElement,h.nodes.btnWaveformOptions);
 h.controls.dispose();h.change('selWaveformProfile','15m');assert.equal(h.preferences.runtime.settings.selectedProfileId,'8m');
});
