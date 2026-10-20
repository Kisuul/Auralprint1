import test from 'node:test';
import assert from 'node:assert/strict';
import {CONFIG} from '../src/js/core/config.js';
import {interpretWaveformMetadata,inspectPcmWavHeader,probeWaveformMetadata} from '../src/js/audio/waveform-metadata.js';
import {evaluateWaveformPolicy} from '../src/js/audio/waveform-policy.js';
import {pcmHeader} from './helpers/waveform-wav.js';
const inspect=f=>inspectPcmWavHeader(f.bytes,f.fileSize,CONFIG.waveform.metadataProbe);
for(const extensible of [false,true])test(`AUD-007 ${extensible?'extensible':'classic'} six-channel PCM header is verified`,()=>{
 const f=pcmHeader({frames:192000,rate:96000,channels:6,extensible});const m=inspect(f);
 assert.equal(m.confidence,'verified');assert.equal(m.channelCount,6);assert.equal(m.durationSeconds,2);assert.equal(m.sourceSampleRateHz,96000);
});
for(const bits of [8,16,24,32])test(`AUD-007 PCM width ${bits} produces credible frame geometry`,()=>{
 const f=pcmHeader({frames:13,channels:2,bits});assert.equal(inspect(f).sourceFrames,13);
});
for(const [name,edit] of [
 ['RIFF size',f=>new DataView(f.bytes).setUint32(4,f.fileSize-9,true)],
 ['chunk size overflow',f=>new DataView(f.bytes).setUint32(16,0xffffffff,true)],
 ['byte rate',f=>new DataView(f.bytes).setUint32(28,1,true)],
 ['block align',f=>new DataView(f.bytes).setUint16(32,1,true)],
 ['channels',f=>new DataView(f.bytes).setUint16(22,0,true)],
 ['sample rate',f=>new DataView(f.bytes).setUint32(24,0,true)],
 ['data frame count',f=>new DataView(f.bytes).setUint32(f.bytes.byteLength-4,1,true)],
])test(`AUD-007 contradictory WAV ${name} cannot fall back to stereo`,()=>{
 const f=pcmHeader({channels:6});edit(f);const m=inspect(f);assert.equal(m.confidence,'invalid');
 const decision=evaluateWaveformPolicy({fileSizeBytes:f.fileSize,durationSeconds:1,headerMetadata:m});assert.equal(decision.decision,'refuse');
});
test('AUD-007 extensible PCM validates GUID, bits and channel mask',()=>{
 const f=pcmHeader({channels:6,extensible:true}),v=new DataView(f.bytes);
 v.setUint32(40,1,true);assert.equal(inspect(f).detail,'channel-mask-conflict');
 v.setUint32(40,63,true);v.setUint16(38,17,true);assert.equal(inspect(f).confidence,'invalid');
 v.setUint16(38,16,true);v.setUint8(44,3);assert.equal(inspect(f).confidence,'unknown');
});
test('AUD-007 unsupported containers and codecs remain explicitly unverified',()=>{
 const f=pcmHeader();new DataView(f.bytes).setUint16(20,3,true);assert.equal(inspect(f).confidence,'unknown');
 const mp3=new Uint8Array([73,68,51,4,0,0,0,0,0,0,0,0]).buffer;assert.equal(inspectPcmWavHeader(mp3,12,CONFIG.waveform.metadataProbe).confidence,'unknown');
 for(const signature of ['RF64','RIFX']){const f=pcmHeader();[...signature].forEach((c,i)=>new DataView(f.bytes).setUint8(i,c.charCodeAt(0)));assert.equal(inspect(f).confidence,'unknown')}
});
test('AUD-007 probe work/prefix exhaustion preserves known multichannel partial estimate',()=>{
 const f=pcmHeader({channels:6});const m=inspectPcmWavHeader(f.bytes,f.fileSize,{maxBytes:65536,maxChunks:1});
 assert.equal(m.confidence,'estimated');assert.equal(m.channelCount,6);assert.equal(m.detail,'probe-work-exhausted');
 const r=evaluateWaveformPolicy({fileSizeBytes:f.fileSize,durationSeconds:1,headerMetadata:m});assert.equal(r.metadata.channelCount,6);assert.equal(r.metadata.assumption,'partial-pcm-header');
 const truncated=inspectPcmWavHeader(f.bytes.slice(0,36),f.fileSize,CONFIG.waveform.metadataProbe);assert.equal(truncated.channelCount,6);
});
test('AUD-007 malformed confidence/dimensions and header contradictions stay invalid',()=>{
 for(const i of [{metadataConfidence:'bogus'},{headerMetadata:{confidence:'bogus'}},{channelCount:-1},{sourceSampleRateHz:Infinity},{metadataConfidence:'verified',channelCount:null}])assert.equal(interpretWaveformMetadata({durationSeconds:1,...i},CONFIG.waveform).confidence,'invalid');
 const header={confidence:'verified',durationSeconds:1,channelCount:6,sourceSampleRateHz:96000};
 assert.equal(interpretWaveformMetadata({durationSeconds:2,headerMetadata:header},CONFIG.waveform).detail,'duration-conflict');
 assert.equal(interpretWaveformMetadata({durationSeconds:1,channelCount:6,sourceSampleRateHz:44100,metadataConfidence:'verified',headerMetadata:header},CONFIG.waveform).detail,'source-rate-conflict');
});
test('AUD-007 output frame rounding is conservative, not source-rate PCM accounting',()=>{
 const m=interpretWaveformMetadata({durationSeconds:13/96000,channelCount:6,sourceSampleRateHz:96000,metadataConfidence:'verified'},CONFIG.waveform);
 assert.equal(m.estimatedOutputFrames,6);assert.equal(m.estimatedPcmBytes,144);
});
test('AUD-007 bounded adapter starts only one prefix read; never full read/decode',async t=>{
 const f=pcmHeader({frames:100000,channels:6});let bytesRead=0,slices=0,fullReads=0,decodes=0;
 const old=globalThis.OfflineAudioContext;globalThis.OfflineAudioContext=class {constructor(){decodes++}};t.after(()=>globalThis.OfflineAudioContext=old);
 const file={size:f.fileSize,arrayBuffer(){fullReads++;throw Error('full read prohibited')},slice(start,end){slices++;bytesRead=end-start;return {async arrayBuffer(){const b=new Uint8Array(bytesRead);b.set(new Uint8Array(f.bytes));return b.buffer}}}};
 const m=await probeWaveformMetadata(file,CONFIG.waveform);assert.equal(m.confidence,'verified');assert.equal(slices,1);assert.equal(bytesRead,65536);assert.equal(fullReads,0);assert.equal(decodes,0);
});
test('AUD-007 oversize or invalid policy refuses probe before even slice',async()=>{
 let calls=0;const file={size:CONFIG.waveform.maxEncodedBytes+1,slice(){calls++;throw Error('not admitted')}};
 assert.equal((await probeWaveformMetadata(file,CONFIG.waveform)).reason,'encoded-budget');assert.equal(calls,0);
 for(const p of [{...CONFIG.waveform,maxEncodedBytes:Infinity},{...CONFIG.waveform,metadataProbe:{maxBytes:0,maxChunks:1}}]){assert.equal((await probeWaveformMetadata({...file,size:44},p)).confidence,'invalid');assert.equal(calls,0)}
});
test('AUD-007 rejected or short probe does not become verified metadata',async()=>{
 const bad={size:44,slice(){return {arrayBuffer:async()=>{throw Error('read failed')}}}};assert.equal((await probeWaveformMetadata(bad,CONFIG.waveform)).confidence,'unknown');
 bad.slice=()=>({arrayBuffer:async()=>new ArrayBuffer(12)});assert.equal((await probeWaveformMetadata(bad,CONFIG.waveform)).confidence,'invalid');
});

test('AUD-007 odd PCM payload padding is outside frame count',()=>{
 const f=pcmHeader({frames:13,channels:1,bits:8});assert.equal(inspect(f).sourceFrames,13);
});
test('AUD-007 unsupported compressed WAV with zero bits is unknown, not malformed PCM',()=>{
 const f=pcmHeader();const v=new DataView(f.bytes);v.setUint16(20,85,true);v.setUint16(34,0,true);assert.equal(inspect(f).confidence,'unknown');
});
