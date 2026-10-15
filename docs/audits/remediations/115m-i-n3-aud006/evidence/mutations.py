from pathlib import Path
import subprocess,json,time
root=Path.cwd();engine=root/'src/js/recording/recorder-engine.js';policy=root/'src/js/recording/recording-policy.js'
mutations=[
 ('S-equality',engine,'d.admittedBytes >= p.effectiveSoftBytes','d.admittedBytes > p.effectiveSoftBytes'),
 ('H-equality',engine,'aggregate > p.aggregateBytes','aggregate >= p.aggregateBytes'),
 ('C-equality',engine,'nextCount > p.maxChunks','nextCount >= p.maxChunks'),
 ('omit-P',engine,'checkedAdd(p.previousExportBytes, nextBytes)','checkedAdd(0, nextBytes)'),
 ('retain-rejected',engine,'d.rejectedBytes = checkedAdd(d.rejectedBytes, size);','runtime.pendingChunks.push(data); d.rejectedBytes = checkedAdd(d.rejectedBytes, size);'),
 ('ignore-duration',engine,'p.durationMs !== null && readElapsedMs() >= p.durationMs','false'),
 ('no-data-token',engine,'if (token !== runtime.sessionToken) return;\n    try {','if (false) return;\n    try {'),
 ('cleanup-success',engine,'if (!releaseActiveSession()) {','if ((releaseActiveSession(), false)) {'),
 ('cancel-disposes',engine,'return abortCapture("capture-cancelled", "Current unsaved capture cancelled and discarded.", true);','return dispose();'),
 ('unrestricted-hidden-T',policy,'reserveBytes: null, maxChunks: null, durationMs: null','reserveBytes: null, maxChunks: null, durationMs: definition.factory.durationMs'),
 ('reserve-omitted',policy,'h - previousExportBytes <= r','h - previousExportBytes <= 0'),
]
results=[]
for name,file,before,after in mutations:
 original=file.read_text();assert original.count(before)==1,(name,original.count(before))
 try:
  file.write_text(original.replace(before,after));t=time.time()
  run=subprocess.run(['node','--test','tests/recorder-governor.test.js','tests/recording-policy.test.js'],cwd=root,capture_output=True,text=True,timeout=30)
  text=run.stdout+run.stderr
  # Require actual failed assertions, not syntax/import/harness failure.
  killed=run.returncode!=0 and ('AssertionError' in text) and 'ERR_MODULE_NOT_FOUND' not in text and 'SyntaxError' not in text
  (root/'work'/f'mutation-{name}.log').write_text(text)
  results.append(dict(name=name,killed=killed,returncode=run.returncode,seconds=round(time.time()-t,3),assertion_failure='AssertionError' in text))
 finally:file.write_text(original)
report=dict(passed=all(r['killed']for r in results),results=results)
(root/'docs/audits/remediations/115m-i-n3-aud006/evidence/mutations.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
