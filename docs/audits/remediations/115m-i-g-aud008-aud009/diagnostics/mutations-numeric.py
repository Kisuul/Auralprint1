"""Isolated AUD-009 Node consumers plus actual Chromium native mutants."""
import json, pathlib, re, shutil, subprocess, tempfile
root=pathlib.Path(__file__).resolve().parents[5]
directory=pathlib.Path(__file__).resolve().parents[1]
mutants=[
 ('silent continuous rounding','src/js/core/preferences.js','angularSpeedRadPerSec: nestedNumber("motion", "angularSpeedRadPerSec", CONFIG.limits.motion.angularSpeedRadPerSec),','angularSpeedRadPerSec: Math.round(nestedNumber("motion", "angularSpeedRadPerSec", CONFIG.limits.motion.angularSpeedRadPerSec) * 100) / 100,'),
 ('inconsistent integral floor','src/js/core/preferences.js','Math.ceil(nestedNumber("trace", "numLines", CONFIG.limits.trace.numLines))','Math.floor(nestedNumber("trace", "numLines", CONFIG.limits.trace.numLines))'),
 ('fractional count retained','src/js/core/preferences.js','Math.ceil(nestedNumber("trace", "numLines", CONFIG.limits.trace.numLines))','nestedNumber("trace", "numLines", CONFIG.limits.trace.numLines)'),
 ('renderer count disagrees','src/js/render/renderer.js','Math.ceil(trace.numLines) + 1','Math.ceil(trace.numLines) + 2'),
 ('Bulk unrelated overwrite','src/js/ui/orb-editor.js','for (const orb of orbs) orb[group][field] = value;','for (const orb of orbs) { orb[group][field] = value; orb.motion.angularSpeedRadPerSec = .12; }'),
]
results=[]
for name,file,old,new in mutants:
 with tempfile.TemporaryDirectory(prefix='auralprint-g3-numeric-') as tmp:
  copy=pathlib.Path(tmp)
  for folder in ['src','tests']:shutil.copytree(root/folder,copy/folder)
  shutil.copy(root/'package.json',copy/'package.json')
  target=copy/file;source=target.read_text();assert old in source,(name,old);target.write_text(source.replace(old,new))
  run=subprocess.run(['node','--test','--test-isolation=none','--test-name-pattern','AUD-009','tests/orb-numeric-contract.test.js','tests/orb-editor.test.js'],cwd=copy,capture_output=True,text=True)
  output=run.stdout+run.stderr
  failures=list(dict.fromkeys(re.findall(r'✖ (AUD-009:[^\n]+)',output)))
  detected=run.returncode!=0 and 'ERR_ASSERTION' in output and failures and 'SyntaxError' not in output and 'ReferenceError' not in output and 'TypeError' not in output
  results.append(dict(mutation=name,kind='Node behavioral',detected=bool(detected),exitCode=run.returncode,behavioralFailures=failures))
html=(root/'dist/auralprint_0.1.15m.i.g.html').read_text()
for name,old,new,expected in [
 ('coarse native step','control.step = limit === CONFIG.limits.trace.numLines ? "1" : "any";','control.step = String(limit.step);','original imported speed and trace'),
 ('focus lost during refresh','if (currentNode !== controller.root) ui.orbEditorList.insertBefore(controller.root, currentNode || null);','ui.orbEditorList.appendChild(controller.root);','stable editor focus'),
]:
 with tempfile.TemporaryDirectory(prefix='auralprint-g3-native-mutant-') as tmp:
  tmp=pathlib.Path(tmp);assert old in html,name;(tmp/'mutant.html').write_text(html.replace(old,new));
  run=subprocess.run(['node',str(directory/'diagnostics/native.cjs'),'--html',str(tmp/'mutant.html'),'--output',str(tmp/'result.json')],cwd=root,capture_output=True,text=True)
  evidence=json.loads((tmp/'result.json').read_text());failures=[c for c in evidence['cases'] if not c['passed']]
  detected=not evidence['errors'] and any(expected in c['name'] and ('assert' in c['failure'] or '!=' in c['failure'] or 'Expected values' in c['failure']) for c in failures)
  results.append(dict(mutation=name,kind='native Chromium behavioral',detected=detected,exitCode=run.returncode,behavioralFailures=[{'name':c['name'],'failure':c['failure']} for c in failures]))
print(json.dumps(results,indent=2));(directory/'evidence/mutations-aud009.json').write_text(json.dumps(results,indent=2)+'\n')
assert all(r['detected'] for r in results)
