"""Isolated semantic policy mutations; fixtures stay outside Node discovery."""
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
root=Path(__file__).resolve().parents[5]
output=Path(sys.argv[1]) if len(sys.argv)>1 else root/'work/policy-negative.json'
controls=[
 ('read-before-encoded','encoded equality admits','encoded gate must precede any full read','waveform-policy.js',
  [('  if (input.fileSizeBytes > policy.maxEncodedBytes)', '  input.file?.arrayBuffer();\n  if (input.fileSizeBytes > policy.maxEncodedBytes)')]),
 ('omit-pcm','PCM equality admits','PCM ceiling must be enforced before native work','waveform-policy.js',
  [('if (estimatedPcmBytes > policy.maxEstimatedDecodedPcmBytes)', 'if (false && estimatedPcmBytes > policy.maxEstimatedDecodedPcmBytes)')]),
 ('manual-hard-bypass','manual bypasses convenience only','manual request must respect PCM ceiling','waveform-policy.js',
  [('if (estimatedPcmBytes > policy.maxEstimatedDecodedPcmBytes)', 'if (requestKind !== "manual" && estimatedPcmBytes > policy.maxEstimatedDecodedPcmBytes)')]),
 ('false-verified','unknown channels use explicit','channel assumption must remain estimated','waveform-metadata.js',
  [('    assumption = "configured-channel-fallback";\n    metadataConfidence = "estimated";', '    assumption = "configured-channel-fallback";\n    metadataConfidence = "verified";')]),
 ('duration-gate','profile is a PCM workload','nine-minute mono fits eight-minute stereo workload','waveform-policy.js',
  [('requestKind === "automatic" && estimatedPcmBytes > profile.pcmBytes', 'requestKind === "automatic" && metadata.durationSeconds > profile.approximateMinutes * 60')]),
 ('ignore-overrides','valid source hard-ceiling overrides','source overrides must supersede factory ceilings','waveform-policy.js',
  [('function evaluateWaveformPolicy(input, policy = CONFIG.waveform) {', 'function evaluateWaveformPolicy(input, policy = CONFIG.waveform) {\n  policy = CONFIG.waveform;')]),
 ('nan-admit','invalid available duration NaN','invalid numeric duration must never admit','waveform-policy.js',
  [('if (metadata.confidence === "invalid") return refuse(', 'if (metadata.confidence === "invalid" && !Number.isNaN(input.durationSeconds)) return refuse(')]),
]
results=[]
with tempfile.TemporaryDirectory(prefix='auralprint-i2b-mutations-') as temp:
 work=Path(temp)
 for name,pattern,message,module,edits in controls:
  target=work/name;shutil.copytree(root/'src',target/'src');(target/'tests/helpers').mkdir(parents=True)
  (target/'package.json').write_text('{"type":"module"}\n')
  shutil.copy2(root/'tests/waveform-policy.test.js',target/'tests/waveform-policy.test.js');shutil.copy2(root/'tests/helpers/waveform-wav.js',target/'tests/helpers/waveform-wav.js')
  cmd=['node','--test','--test-isolation=none','--test-name-pattern='+pattern,'tests/waveform-policy.test.js']
  positive=subprocess.run(cmd,cwd=target,capture_output=True,text=True,timeout=15)
  source=(target/'src/js/audio'/module).read_text()
  for old,new in edits:
   assert source.count(old)==1,(name,old,source.count(old));source=source.replace(old,new)
  (target/'src/js/audio'/module).write_text(source)
  negative=subprocess.run(cmd,cwd=target,capture_output=True,text=True,timeout=15);text=negative.stdout+negative.stderr
  passed=positive.returncode==0 and negative.returncode!=0 and message in text and 'ERR_ASSERTION' in text
  row={'name':name,'pass':passed,'positiveExit':positive.returncode,'mutantExit':negative.returncode,'expectedAssertion':message,'mutation':edits,'mutantOutput':text};results.append(row)
  if not passed:print(json.dumps(row,indent=2))
output.parent.mkdir(parents=True,exist_ok=True);output.write_text(json.dumps({'originalSourceModified':False,'passed':sum(c['pass'] for c in results),'cases':results},indent=2)+'\n')
assert all(c['pass'] for c in results),'semantic mutation control failed'
print(json.dumps({'passed':len(results)}))
