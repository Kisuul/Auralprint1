"""Permanent decision/UI integration mutations plus unchanged I.2A/B controls.
Temporary source copies live outside normal Node discovery. A harness crash is
not accepted as a detected mutation.
"""
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
root=Path(__file__).resolve().parents[5]
output=Path(sys.argv[1]) if len(sys.argv)>1 else root/'work/i2c-negative.json'
controls=[
 ('encoded-read-bypass','hard encoded refusal','encoded admission must precede full read','waveform-admission.js',[
  ('    // Size/policy gates run BEFORE', '    intent.file.arrayBuffer();\n    // Size/policy gates run BEFORE')]),
 ('pcm-admission-bypass','hard PCM refusal under ask','hard PCM refusal must precede full read','waveform-admission.js',[
  ('function evaluate(intent) { return evaluateWaveformPolicy(input(intent), policy); }', 'function evaluate(intent) { const r=evaluateWaveformPolicy(input(intent), policy); return r.reason === "pcm-budget" ? {...r,decision:"admit"} : r; }')]),
 ('repeated-probe','pending duration waits once','metadata refresh must not repeat probe work','waveform-admission.js',[
  ('if (!intent.probed)', 'if (true)'),('(intent.probed && decision.decision !== "admit")', '(false && intent.probed && decision.decision !== "admit")')]),
 ('wrong-source-manual','wrong-source manual action','manual generation must reject wrong-source identity','waveform-admission.js',[
  ('current === intent && intent.isCurrent()', 'current === intent')]),
 ('stale-duration-activation','delayed duration and old media','stale duration must not activate old File','waveform-admission.js',[
  ('current.media?.removeEventListener?.(type, current.listener);','void type;'),
  ('current.file = current.media = null;', '/* mutant retains old source */'),
  ('      if (!valid(intent)) return;\n      if (event.type', '      current = intent;\n      if (event.type')]),
 ('premature-probe-release','coordinator prepare retains occupancy','reset must retain unsettled prepare occupancy','waveform-coordinator.js',[
  ('function reset() {\n    generation++;', 'function reset() {\n    active = null;\n    generation++;')]),
]
results=[]
with tempfile.TemporaryDirectory(prefix='auralprint-i2c-mutations-') as temp:
 for name,pattern,message,module,edits in controls:
  target=Path(temp)/name;shutil.copytree(root/'src',target/'src');shutil.copytree(root/'tests',target/'tests');(target/'package.json').write_text('{"type":"module"}\n')
  cmd=['node','--test','--test-isolation=none','--test-name-pattern='+pattern,'tests/waveform-admission.test.js']
  positive=subprocess.run(cmd,cwd=target,capture_output=True,text=True,timeout=15)
  filename=target/'src/js/audio'/module;source=filename.read_text()
  for old,new in edits:
   assert source.count(old)==1,(name,old,source.count(old));source=source.replace(old,new)
  filename.write_text(source)
  negative=subprocess.run(cmd,cwd=target,capture_output=True,text=True,timeout=15);text=negative.stdout+negative.stderr
  passed=positive.returncode==0 and negative.returncode!=0 and message in text and 'ERR_ASSERTION' in text and 'cancelledByParent' not in text
  row={'name':name,'pass':passed,'positiveExit':positive.returncode,'mutantExit':negative.returncode,'expectedAssertion':message,'mutation':edits,'mutantOutput':text};results.append(row)
  if not passed:print(json.dumps(row,indent=2))
output.parent.mkdir(parents=True,exist_ok=True)
output.write_text(json.dumps({'originalSourceModified':False,'passed':sum(c['pass'] for c in results),'cases':results},indent=2)+'\n')
assert all(c['pass'] for c in results),'I.2C semantic mutation failed'
# Preserve and execute the accepted controls. I.2A's extractor now imports CONFIG,
# so its temporary fixture needs the source dependencies too. Assertions and all
# seven original mutations are unchanged; only copying dependencies is adapted.
original=root/'docs/audits/remediations/115m-i-i-aud007/implementation/negative-controls.py'
source=original.read_text()
old="for filename in ['waveform-coordinator.js', 'waveform-extractor.js']:\n  shutil.copy2(root/'src/js/audio'/filename, target/'src/js/audio'/filename)"
assert source.count(old)==1
source=source.replace(old,"shutil.copytree(root/'src', target/'src', dirs_exist_ok=True)")
sys.argv=[str(original),str(output.with_name('i2a-negative-controls.json'))]
exec(compile(source,str(original),'exec'),{'__file__':str(original),'__name__':'__main__'})
subprocess.run([sys.executable,str(root/'docs/audits/remediations/115m-i-i-aud007/policy-implementation/negative-controls.py'),str(output.with_name('i2b-negative-controls.json'))],check=True)
print(json.dumps({'I2C':len(controls),'I2A':7,'I2B':7,'allPassed':True}))
