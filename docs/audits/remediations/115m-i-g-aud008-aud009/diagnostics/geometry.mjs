// Opt-in canonical import → resolve → shared BandBank geometry/energy observation.
import { sanitizePreset } from '../../../../../src/js/presets/preset-codec.js';
import { replacePreferences, resolveSettings } from '../../../../../src/js/core/preferences.js';
import { BandBank } from '../../../../../src/js/audio/band-bank.js';
import { state } from '../../../../../src/js/core/state.js';
const cases = [];
for (const floorHz of [Number.MIN_VALUE, 1e-307, 1e-200, 20, 22500]) {
  replacePreferences(sanitizePreset({schema:10,prefs:{bands:{floorHz,ceilingHz:22500,count:256,distributionMode:'log'}}})); resolveSettings(); BandBank.rebuild(22500,48000);
  for (const [channel,db] of [['L',-90],['R',-50],['C',-10]]) BandBank.computeEnergiesFromAnalyser({analyser:{minDecibels:-100,maxDecibels:0},freqDb:new Float32Array(4096).fill(db)},48000,state.bands.channels[channel].energies01);
  cases.push({floorHz, ratioOverflows:!Number.isFinite(22500/floorHz), firstEdges:state.bands.lowHz.slice(0,6), interiorMidpoint:state.bands.lowHz[128], lastEdges:state.bands.lowHz.slice(-4), zeroEnergyBands:state.bands.energies01.filter(x=>x===0).length, channelMeans:Object.fromEntries(['L','R','C'].map(id=>[id,state.bands.channels[id].energies01.reduce((a,b)=>a+b,0)/256]))});
}
console.log(JSON.stringify({schema:10,cases},null,2));
