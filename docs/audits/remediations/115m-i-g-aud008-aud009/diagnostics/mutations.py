"""Opt-in disposable semantic mutants; production and accepted evidence untouched."""
import json, pathlib, re, shutil, subprocess, tempfile
root = pathlib.Path(__file__).resolve().parents[5]
out = pathlib.Path(__file__).resolve().parents[1] / 'evidence' / 'mutations-aud008.json'
mutants = [
 ('unsafe ratio', 'src/js/audio/band-bank.js', 'const log0 = Math.log(f0), log1 = Math.log(f1);', 'const log0 = Math.log(f0), log1 = Math.log(f1), ratio = Math.pow(f1 / f0, 1 / n);', 'Math.exp(log0 + (log1 - log0) * (i / n))', 'f0 * Math.pow(ratio, i)'),
 ('wrong endpoint', 'src/js/audio/band-bank.js', 'edges[n] = f1;', 'edges[n] = f1 * .99;'),
 ('reversed interior', 'src/js/audio/band-bank.js', 'Math.exp(log0 + (log1 - log0) * (i / n))', 'Math.exp(log0 + (log1 - log0) * (1 - i / n))'),
 ('broken Nyquist cap', 'src/js/audio/band-bank-controller.js', 'Math.min(bandConfig.configCeilingHz, nyquistHz)', 'bandConfig.configCeilingHz'),
 ('changed default spacing', 'src/js/audio/band-bank.js', 'Math.exp(log0 + (log1 - log0) * (i / n))', 'Math.exp(log0 + (log1 - log0) * Math.pow(i / n, 1.01))'),
]
results=[]
for entry in mutants:
 with tempfile.TemporaryDirectory(prefix='auralprint-g3-mutant-') as tmp:
  copy=pathlib.Path(tmp)
  for folder in ['src','tests']: shutil.copytree(root/folder,copy/folder)
  shutil.copy(root/'package.json',copy/'package.json')
  name,file,*edits=entry; target=copy/file; source=target.read_text()
  for old,new in zip(edits[::2],edits[1::2]):
   assert old in source, (name,old); source=source.replace(old,new)
  target.write_text(source)
  run=subprocess.run(['node','--test','--test-isolation=none','tests/band-bank.test.js'],cwd=copy,capture_output=True,text=True)
  output=run.stdout+run.stderr
  failures=list(dict.fromkeys(re.findall(r'✖ (AUD-008:[^\n]+)',output)))
  detected=run.returncode!=0 and 'ERR_ASSERTION' in output and bool(failures) and 'SyntaxError' not in output
  results.append(dict(mutation=name,detected=detected,exitCode=run.returncode,behavioralFailures=failures))
print(json.dumps(results,indent=2));out.write_text(json.dumps(results,indent=2)+'\n')
assert all(result['detected'] for result in results)
