// Arithmetic and bounded synthetic header observations; never allocate the
// represented PCM/audio payload. Decision inputs are not real long-file decodes.
import {writeFileSync,readFileSync} from 'node:fs';
import {CONFIG} from '../../../../../src/js/core/config.js';
import {evaluateWaveformPolicy} from '../../../../../src/js/audio/waveform-policy.js';
import {inspectPcmWavHeader} from '../../../../../src/js/audio/waveform-metadata.js';
import assert from 'node:assert/strict';
const p=CONFIG.waveform;
function wavHeader(seconds,channels=2,rate=44100){
 const data=seconds*rate*channels*2,fileSize=data+44,b=new ArrayBuffer(44),v=new DataView(b);
 const tag=(offset,text)=>[...text].forEach((c,i)=>v.setUint8(offset+i,c.charCodeAt(0)));
 tag(0,'RIFF');v.setUint32(4,fileSize-8,true);tag(8,'WAVE');tag(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,channels,true);v.setUint32(24,rate,true);v.setUint32(28,rate*channels*2,true);v.setUint16(32,channels*2,true);v.setUint16(34,16,true);tag(36,'data');v.setUint32(40,data,true);return {prefix:b,fileSize};
}
const rows=[];
for(const [name,seconds,channels] of [['five-minute mono WAV',300,1],['six-minute stereo WAV',360,2],['nine-minute stereo WAV',540,2]]){
 const f=wavHeader(seconds,channels),header=inspectPcmWavHeader(f.prefix,f.fileSize,p.metadataProbe);assert.equal(header.confidence,'verified');
 for(const profile of ['4m','8m','15m']){
  const decision=evaluateWaveformPolicy({fileSizeBytes:f.fileSize,durationSeconds:seconds,headerMetadata:header,selectedProfileId:profile});
  rows.push({name,synthetic:true,allocatedPrefixBytes:f.prefix.byteLength,declaredEncodedBytes:f.fileSize,seconds,channels,profile,...decision});
 }
}
const compressedSize=readFileSync(new URL('../../../../../work/stereo.mp3',import.meta.url)).byteLength;
for(const seconds of [540,4344])for(const profile of ['4m','8m','15m'])for(const requestKind of ['automatic','manual']){
 rows.push({name:'compressed synthetic duration',synthetic:true,actualSmallFixtureBytes:compressedSize,seconds,profile,requestKind,...evaluateWaveformPolicy({fileSizeBytes:compressedSize,durationSeconds:seconds,durationState:'available',selectedProfileId:profile,requestKind})});
}
assert.equal(rows.find(r=>r.name==='nine-minute stereo WAV'&&r.profile==='15m').reason,'encoded-budget');
assert.equal(rows.find(r=>r.seconds===4344&&r.requestKind==='manual').reason,'pcm-budget');
const boundaries=[];
for(const bytes of [p.maxEncodedBytes,p.maxEncodedBytes+1])boundaries.push({kind:'encoded',bytes,...evaluateWaveformPolicy({fileSizeBytes:bytes,durationSeconds:1,requestKind:'manual'})});
for(const frames of [p.maxEstimatedDecodedPcmBytes/8,p.maxEstimatedDecodedPcmBytes/8+1])boundaries.push({kind:'pcm',frames,...evaluateWaveformPolicy({fileSizeBytes:16,durationSeconds:frames/p.decodeSampleRateHz,requestKind:'manual'})});
assert.deepEqual(boundaries.map(r=>r.decision),['admit','refuse','admit','refuse']);
const invalid=[];
for(const field of ['maxEncodedBytes','maxEstimatedDecodedPcmBytes','decodeSampleRateHz','fallbackEstimatedChannels','metadataProbe.maxBytes'])for(const value of [NaN,Infinity,-1,0,Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER+1]){
 const edited=structuredClone(p);if(field.includes('.'))edited.metadataProbe.maxBytes=value;else edited[field]=value;
 const decision=evaluateWaveformPolicy({fileSizeBytes:16,durationSeconds:60,requestKind:'manual'},edited);
 invalid.push({field,value:String(value),decision:decision.decision,reason:decision.reason});
 // Safe expert-edited maxima/zero hard ceilings follow the accepted contract.
 if(!Number.isSafeInteger(value)||value<0)assert.equal(decision.decision,'refuse');
}
const f=wavHeader(1,6);let truncatedVerified=0;
for(let length=0;length<44;length++)if(inspectPcmWavHeader(f.prefix.slice(0,length),f.fileSize,p.metadataProbe).confidence==='verified')truncatedVerified++;
assert.equal(truncatedVerified,0);
const junk=new ArrayBuffer(65536),view=new DataView(junk);for(const [offset,text] of [[0,'RIFF'],[8,'WAVE']])[...text].forEach((c,i)=>view.setUint8(offset+i,c.charCodeAt(0)));view.setUint32(4,junk.byteLength-8,true);
const exhausted=inspectPcmWavHeader(junk,junk.byteLength,p.metadataProbe);assert.equal(exhausted.detail,'probe-work-exhausted');
const evidence={scope:'Pure actual policy and parser; small synthetic metadata only, no represented long payload/PCM allocation.',sourceConfiguration:p,rows,boundaries,invalidSourceInputs:invalid,parser:{truncatedPrefixes:44,verifiedTruncations:truncatedVerified,chunkWorkExhaustion:exhausted},allocationMaxBytes:junk.byteLength};
writeFileSync(process.argv[2]||new URL('../../../../../work/calibration.json',import.meta.url),JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify({calibrations:rows.length,boundaries:boundaries.length,sourceInputChecks:invalid.length,truncatedPrefixes:44,maxAllocatedFixtureBytes:junk.byteLength}));
