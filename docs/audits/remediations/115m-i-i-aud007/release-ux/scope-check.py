"""Protect accepted evidence and independent production owners."""
import json
from pathlib import Path
import subprocess
root=Path(__file__).resolve().parents[5]
base='56f8f8e805d0a10ba7df7f155d153c7d25e00f9d'
protected=['agents.md','ROADMAP.md','src/js/audio/audio-engine.js','src/js/audio/input-source-manager.js','src/js/audio/queue.js','src/js/audio/analysis-frame.js','src/js/recording','src/js/presets','src/js/core/preferences.js','src/js/core/state.js','src/js/main.js','src/js/render','package.json','package-lock.json','.github']
assert not subprocess.check_output(['git','diff','--name-only',base,'--',*protected],cwd=root,text=True).strip()
prior=subprocess.check_output(['git','ls-tree','-r','--name-only',base,'docs/audits/remediations/115m-i-i-aud007'],cwd=root,text=True).splitlines()
for name in prior:assert (root/name).read_bytes()==subprocess.check_output(['git','show',f'{base}:{name}'],cwd=root),name
assert (root/'version').read_text().strip()=='v0.1.15m.i.k'
print(json.dumps({'pass':True,'base':base,'priorAUD007FilesByteIdentical':len(prior),'protectedOwnersUnchanged':True,'schema':10}))
