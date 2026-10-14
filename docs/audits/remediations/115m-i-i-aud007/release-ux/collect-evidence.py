"""Collect observed successful checks; never invent expected acceptance values."""
import hashlib
import json
import re
from pathlib import Path
import shutil
import subprocess
root=Path(__file__).resolve().parents[5]
work=root/'work'
dest=Path(__file__).resolve().parent/'evidence'
hash_bytes=lambda b:hashlib.sha256(b).hexdigest()
def compact(value):
 if isinstance(value,str) and len(value)>800:return {'characters':len(value),'sha256':hash_bytes(value.encode())}
 if isinstance(value,list) and len(value)>40:return {'items':len(value),'sha256':hash_bytes(json.dumps(value,sort_keys=True).encode()),'first':compact(value[0]),'last':compact(value[-1])}
 if isinstance(value,list):return [compact(v) for v in value]
 if isinstance(value,dict):return {k:compact(v) for k,v in value.items()}
 return value
artifact=root/'dist/auralprint_0.1.15m.i.k.html'
artifact_hash=hash_bytes(artifact.read_bytes())
native={}
for name in ['i2c','i2a','i2b','f','g','g1','g2','g3','h']:
 raw=(work/f'{name}-native.json').read_bytes();data=json.loads(raw)
 observed=data.get('artifactSha256',data.get('htmlSha256'))
 assert observed==artifact_hash,(name,observed,artifact_hash)
 cases=data['cases'];assert all(c.get('pass',c.get('passed',False)) for c in cases),name
 native[name]={'cases':len(cases),'passed':len(cases),'artifactSha256':observed,'rawEvidenceSha256':hash_bytes(raw),'details':compact(data)}
(dest/'native.json').write_text(json.dumps(native['i2c'],indent=2)+'\n')
(dest/'protected-native.json').write_text(json.dumps({k:v for k,v in native.items() if k!='i2c'},indent=2)+'\n')
for name in ['npm-ci.log','npm-test.log','build.log','focused-waveform.log','diff-check.log','negative-controls.log','i2c-negative-controls.json','i2a-negative-controls.json','i2b-negative-controls.json','narrow-waveform.png','narrow-waveform-options.png']:
 shutil.copy2(work/name,dest/name)
shutil.copy2(work/'distribution.log',dest/'distribution.json')
changed=subprocess.check_output(['git','diff','--name-only','56f8f8e805d0a10ba7df7f155d153c7d25e00f9d'],cwd=root,text=True).splitlines()
paths=sorted(set(changed)|{str(p.relative_to(root)) for p in (root/'src').rglob('*') if p.is_file() and p.name in ['application-preferences.js','waveform-admission.js','waveform-options.js']})
source={p:hash_bytes((root/p).read_bytes()) for p in paths if p.startswith(('src/','tests/'))}
def number(log,label):
 match=re.search(r'ℹ '+label+r' (\d+)',(work/log).read_text());assert match,(log,label);return int(match.group(1))
full={k:number('npm-test.log',v) for k,v in [('total','tests'),('passed','pass'),('failed','fail'),('skipped','skipped')]}
assert full['failed']==0
validation={'startingAcceptedMain':'56f8f8e805d0a10ba7df7f155d153c7d25e00f9d','developmentVersion':'v0.1.15m.i.k','schema':10,'commandsInOrder':['npm ci','npm test','npm run build','python scripts/verify_distribution.py','git diff --check'],'observedFullSuite':{**full,'skipReason':'Existing opt-in AP_MILLION_STRESS not enabled'},'focusedWaveformAssertions':number('focused-waveform.log','pass'),'newPermanentTests':full['total']-891,'negativeControls':{'I2C':6,'I2A':7,'I2B':7,'positiveAndIntendedNegativePass':True},'native':{k:{f:v[f] for f in ['cases','passed','artifactSha256','rawEvidenceSha256']} for k,v in native.items()},'sourceDigests':source,'limitations':native['i2c']['details'].get('limitations',[]),'ci':'Exact final-head Ubuntu/Windows status is checked after publishing; PR handoff is authoritative to avoid embedding a self-referential future SHA.'}
(dest.parent/'validation.json').write_text(json.dumps(validation,indent=2)+'\n')
print(json.dumps({'artifactSha256':artifact_hash,'native':{k:v['passed'] for k,v in native.items()}}))
