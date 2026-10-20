"""Verify accepted artifacts/owners and prior evidence are untouched."""
from pathlib import Path
import json
import subprocess
root=Path(__file__).resolve().parents[5]
base='45cbf558afa8b437e39af6e006b22d0db9d703c0'
protected=['agents.md','docs/Canon','src/js/core/config.js','src/js/core/preferences.js','src/js/core/application-preferences.js','src/js/core/state.js','src/js/audio/audio-engine.js','src/js/audio/input-source-manager.js','src/js/audio/queue.js','src/js/audio/analysis-frame.js','src/js/audio/waveform-coordinator.js','src/js/audio/waveform-extractor.js','src/js/audio/waveform-policy.js','src/js/audio/waveform-metadata.js','src/js/audio/scrubber.js','src/js/ui','src/css','src/index.template.html','src/js/presets','src/js/render','src/js/recording','src/js/main.js','scripts','package.json','package-lock.json','.github']
assert not subprocess.check_output(['git','diff','--name-only',base,'--',*protected],cwd=root,text=True).strip()
prior=subprocess.check_output(['git','ls-tree','-r','--name-only',base,'docs/audits/remediations/115m-i-i-aud007'],cwd=root,text=True).splitlines()
for name in prior:assert (root/name).read_bytes()==subprocess.check_output(['git','show',base+':'+name],cwd=root),name
assert (root/'version').read_text().strip()=='v0.1.15m.i.l'
constants=(root/'src/js/core/constants.js').read_text();assert 'const PRESET_SCHEMA_VERSION = 10;' in constants
print(json.dumps({'pass':True,'acceptedBaseline':base,'historicalAUD007FilesByteIdentical':len(prior),'protectedOwnersAndCanonicalArtifactsUnchanged':True,'productionCorrection':'waveform-admission.js internal transition ordering only','schema':10}))
