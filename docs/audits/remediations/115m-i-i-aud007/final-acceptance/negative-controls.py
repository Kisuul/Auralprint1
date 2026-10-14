"""Independent semantic mutations against actual final production modules.
All work is disposable and outside default Node test discovery. Original source
is never modified. Each positive must pass before the installed mutant fails the
named semantic assertion; cancellation/harness crashes are not acceptance.
"""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
root=Path(__file__).resolve().parents[5]
output=Path(sys.argv[1]) if len(sys.argv)>1 else root/'work/i2d-negative.json'
controls=[
 ('reset-frees-native','waveform-hostile-acceptance.test.js','an unsettled decoder','settings/manual storm cannot release native occupancy','audio/waveform-coordinator.js',[
  ('function reset() {\n    generation++;','function reset() {\n    active = null;\n    generation++;')]),
 ('parallel-read','waveform-hostile-acceptance.test.js','cross-stage occupancy under decode','replacement must not start any optional operation before settlement','audio/waveform-coordinator.js',[
  ('if (active) {','if (false && active) {')]),
 ('retain-first-pending','waveform-coordinator.test.js','reading A reserves','only newest pending generation may be retained','audio/waveform-coordinator.js',[
  ('const requestGeneration = ++generation;\n    discardPending();','const requestGeneration = ++generation;'),('pending = job;','pending ??= job;')]),
 ('omit-post-read-admission','waveform-hostile-acceptance.test.js','post-read admission','post-read profile revocation must prevent native decoding','audio/waveform-extractor.js',[
  ('if (!isCurrent() || !canDecode())','if (!isCurrent())')]),
 ('manual-hard-bypass','waveform-policy.test.js','manual bypasses convenience only','manual request must respect PCM ceiling','audio/waveform-policy.js',[
  ('if (input.fileSizeBytes > policy.maxEncodedBytes)','if (input.requestKind !== "manual" && input.fileSizeBytes > policy.maxEncodedBytes)'),
  ('if (estimatedPcmBytes > policy.maxEstimatedDecodedPcmBytes)','if (requestKind !== "manual" && estimatedPcmBytes > policy.maxEstimatedDecodedPcmBytes)')]),
 ('stale-duration','waveform-admission.test.js','delayed duration and old media','stale duration must not activate old File','audio/waveform-admission.js',[
  ('current.media?.removeEventListener?.(type, current.listener);','void type;'),('current.file = current.media = null;','/* mutant retains old intent */'),
  ('      if (!valid(intent)) return;\n      if (event.type','      current = intent;\n      if (event.type')]),
 ('repeat-prefix','waveform-admission.test.js','pending duration waits once','metadata refresh must not repeat probe work','audio/waveform-admission.js',[
  ('if (!intent.probed)','if (true)'),('(intent.probed && decision.decision !== "admit")','(false && intent.probed && decision.decision !== "admit")')]),
 ('false-verified','waveform-policy.test.js','unknown channels use explicit','channel assumption must remain estimated','audio/waveform-metadata.js',[
  ('assumption = "configured-channel-fallback";\n    metadataConfidence = "estimated";','assumption = "configured-channel-fallback";\n    metadataConfidence = "verified";')]),
 ('unconditional-status-write','waveform-controls.test.js','unchanged UI status','1001 !== 1','ui/waveform-options.js',[
  ('if(statusEl.textContent!==text)statusEl.textContent=text;','statusEl.textContent=text;')]),
 ('stale-success','waveform-coordinator.test.js','coordinator rejects stale extractor success','coordinator must reject stale success independent of extractor','audio/waveform-coordinator.js',[
  ('if (isCurrent(job) && peaks)','if (peaks)')]),
 ('stale-rejection','waveform-coordinator.test.js','obsolete decode rejection','stale rejection must not overwrite current status','audio/waveform-coordinator.js',[
  ('if (isCurrent(job)) onUpdate("unavailable", null);','onUpdate("unavailable", null);')]),
 ('revert-newest-reentrancy-fence','waveform-hostile-acceptance.test.js','reentrant File selection','newer reentrant selection must win','audio/waveform-admission.js',[
  ('if (requestRevision !== revision) return Promise.resolve();','/* mutant ignores newer reentrant intent */')]),
 ('drop-reentrant-policy-reconciliation','waveform-hostile-acceptance.test.js','profile edit during offer','reentrant profile edit must re-evaluate current File','audio/waveform-admission.js',[
  ('if (valid(intent) && intent.refreshPending)','if (false && valid(intent) && intent.refreshPending)')]),
]
results=[]
with tempfile.TemporaryDirectory(prefix='auralprint-i2d-independent-') as temp:
 for name,suite,pattern,message,module,edits in controls:
  target=Path(temp)/name;shutil.copytree(root/'src',target/'src');shutil.copytree(root/'tests',target/'tests');(target/'package.json').write_text('{"type":"module"}\n')
  command=['node','--test','--test-isolation=none','--test-name-pattern='+pattern,'tests/'+suite]
  positive=subprocess.run(command,cwd=target,capture_output=True,text=True,timeout=15)
  filename=target/'src/js'/module;original=filename.read_text();mutated=original
  for old,new in edits:
   assert mutated.count(old)==1,(name,old,mutated.count(old));mutated=mutated.replace(old,new)
  filename.write_text(mutated);assert filename.read_text()!=original
  negative=subprocess.run(command,cwd=target,capture_output=True,text=True,timeout=15);text=negative.stdout+negative.stderr
  passed=positive.returncode==0 and negative.returncode!=0 and 'ERR_ASSERTION' in text and message in text and 'cancelledByParent' not in text
  row={'name':name,'pass':passed,'positiveExit':positive.returncode,'mutantExit':negative.returncode,'expectedAssertion':message,'suite':suite,'pattern':pattern,'mutation':edits,'originalSha256':hashlib.sha256(original.encode()).hexdigest(),'mutantSha256':hashlib.sha256(mutated.encode()).hexdigest(),'mutantOutput':text};results.append(row)
  if not passed:print(json.dumps(row,indent=2))
output.parent.mkdir(parents=True,exist_ok=True);output.write_text(json.dumps({'originalSourceModified':False,'passed':sum(c['pass'] for c in results),'cases':results},indent=2)+'\n')
assert all(c['pass'] for c in results),'independent negative control did not fail its intended assertion'
print(json.dumps({'passed':len(results),'harnessCrashesCounted':0}))
