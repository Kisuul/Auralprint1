"""Collect actual successful observations; preserve initial failing evidence."""
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
root=Path(__file__).resolve().parents[5];work=root/'work';dest=Path(__file__).resolve().parent/'evidence'
sha=lambda b:hashlib.sha256(b).hexdigest()
def compact(value):
 if isinstance(value,str) and len(value)>800:return {'characters':len(value),'sha256':sha(value.encode())}
 if isinstance(value,list) and len(value)>32:return {'items':len(value),'sha256':sha(json.dumps(value,sort_keys=True).encode()),'first':compact(value[0]),'last':compact(value[-1])}
 if isinstance(value,list):return [compact(v) for v in value]
 if isinstance(value,dict):return {k:compact(v) for k,v in value.items()}
 return value
artifact=root/'dist/auralprint_0.1.15m.i.l.html';artifact_hash=sha(artifact.read_bytes())
native={}
for name in ['i2d','i2c','i2a','i2b','f','g','g1','g2','g3','h']:
 raw=(work/f'{name}-native.json').read_bytes();data=json.loads(raw);observed=data.get('artifactSha256',data.get('htmlSha256'))
 assert observed==artifact_hash,(name,observed,artifact_hash)
 assert all(c.get('pass',c.get('passed',False)) for c in data['cases']),name
 native[name]={'cases':len(data['cases']),'passed':len(data['cases']),'artifactSha256':observed,'rawEvidenceSha256':sha(raw),'details':compact(data)}
(dest/'native.json').write_text(json.dumps(native['i2d'],indent=2)+'\n')
(dest/'protected-native.json').write_text(json.dumps({k:v for k,v in native.items() if k!='i2d'},indent=2)+'\n')
for name in ['npm-ci.log','npm-test.log','build.log','protected-focused.log','corrected-focused.log','accepted-focused-baseline.log','diff-check.log','i2d-negative.json','i2d-negative.log','i2c-negative-controls.json','i2a-negative-controls.json','i2b-negative-controls.json','accepted-negative.log','calibration.json']:
 shutil.copy2(work/name,dest/name)
shutil.copy2(work/'distribution.log',dest/'distribution.json')
scope=subprocess.check_output(['python',str(dest.parent/'scope-check.py')],cwd=root,text=True);(dest/'scope.json').write_text(scope)
def count(log,label):
 match=re.search(r'ℹ '+label+r' (\d+)',(work/log).read_text());assert match,(log,label);return int(match.group(1))
full={k:count('npm-test.log',v) for k,v in [('total','tests'),('passed','pass'),('failed','fail'),('skipped','skipped')]};assert full['failed']==0
source_paths=['src/js/audio/waveform-admission.js','src/js/audio/waveform-coordinator.js','src/js/audio/waveform-extractor.js','src/js/audio/waveform-policy.js','src/js/audio/waveform-metadata.js','src/js/audio/scrubber.js','src/js/core/application-preferences.js','src/js/ui/waveform-options.js','src/js/core/config.js','src/js/core/constants.js','src/js/ui/ui.js','tests/waveform-hostile-acceptance.test.js','tests/targeted-audit.test.js','tests/rc20_packaging.py','version']
controls={}
for name,filename in [('I2D','i2d-negative.json'),('I2C','i2c-negative-controls.json'),('I2A','i2a-negative-controls.json'),('I2B','i2b-negative-controls.json')]:
 data=json.loads((work/filename).read_text());assert all(c['pass'] for c in data['cases']);controls[name]=len(data['cases'])
validation={'acceptedBaseline':'45cbf558afa8b437e39af6e006b22d0db9d703c0','baselinePR54Merged':True,'baselineVersion':'v0.1.15m.i.k','reviewVersion':'v0.1.15m.i.l','schema':10,'correctionCommit':'d3bc9b7','initialIndependentSuite':{'total':11,'passed':8,'intendedFailures':3,'findings':2},'commandsInOrder':['npm ci','npm test','npm run build','python scripts/verify_distribution.py','git diff --check'],'observedFullSuite':{**full,'skip':'Existing opt-in AP_MILLION_STRESS not enabled'},'protectedFocusedAssertions':count('protected-focused.log','pass'),'independentPermanentTests':11,'independentIntegerOracleCombinations':432,'negativeControls':controls,'native':{k:{field:v[field] for field in ['cases','passed','artifactSha256','rawEvidenceSha256']} for k,v in native.items()},'baselineNativeControl':'A separately labeled original k-artifact DOM-observer reproduction is not counted as final native acceptance.','sourceDigests':{p:sha((root/p).read_bytes()) for p in source_paths},'humanEvidence':'Owner-reported Chrome/Opera/Edge/Firefox direct local-file and Python-hosted functional acceptance; no exact codec/hash or complete browser/mode/case matrix inferred.','remainingPortabilityGap':'Managed Chromium blocks file:// before execution. Network-disabled offline operation was not explicitly supplied by owner. This alone is not an AUD-007 blocker; applicable Build 115N portability gates remain.','nativeMemoryClaim':'No native scratch/RSS/reclamation or universal process-memory bound established.','exactHeadCI':'Verify Ubuntu and Windows after final push; final draft PR #55 records run/head/job results to avoid a self-referential tracked future SHA.','recommendation':'PASS — closure recommended for human review after demonstrated corrections; not closure approved or 115N acceptance.'}
(dest.parent/'validation.json').write_text(json.dumps(validation,indent=2)+'\n')
print(json.dumps({'fullSuite':full,'protectedFocused':validation['protectedFocusedAssertions'],'negativeControls':controls,'native':{k:v['passed'] for k,v in native.items()},'artifactSha256':artifact_hash}))
