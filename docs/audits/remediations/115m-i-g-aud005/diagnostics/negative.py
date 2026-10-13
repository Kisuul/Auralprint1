"""Semantic controls in disposable copies; never edits accepted production files."""
import json
from pathlib import Path
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[5]
PANEL = Path('src/js/ui/visualizers-panel.js')
source = (ROOT / PANEL).read_text()
original = subprocess.check_output(['git', 'show', '230610bc33ab7e3a4842e53e5be48c9170222739:' + str(PANEL)], cwd=ROOT, text=True)
controls = [
    ('original_replaceChildren', original, 'new settings snapshot'),
    ('id_without_type', source.replace('JSON.stringify([item.type, item.id])', 'item.id'), 'opaque Orb spectral-ring'),
    ('rebuild_summary_row', source.replace('const entry = rows.get(key) || createRow(item);', '''let entry = rows.get(key);
      if (entry && entry.item.summary !== item.summary) { entry.row.remove(); entry = null; }
      entry = entry || createRow(item);'''), 'presentation and runtime visibility'),
    ('blur_reorder', source.replace('if (focused && list.contains(focused) && document.activeElement !== focused) focused.focus();', ''), 'reorder retains'),
    ('no_nearest_fallback', source.replace('if (focus) focusEdit(focus.id); else ui.btnVisualizersAddOrb?.focus();', ''), 'focused removal'),
    ('duplicate_delegation', source.replace('    rows = next;', '    rows = next;\n    list.addEventListener("click", onListClick);'), 'repeated refresh/init'),
]
results = []
# A compact reporter avoids formatting enormous circular DOM assertion objects.
reporter = '''export default async function* (events) {
  for await (const event of events) {
    if (event.type === 'test:fail') {
      const e = event.data.details.error;
      yield JSON.stringify({name:event.data.name,code:e.cause?.code || e.code,
        message:(e.cause?.message || e.message).slice(0,1000)}) + '\\n';
    }
  }
}'''
for name, mutated, expected in controls:
    assert mutated != source, name
    with tempfile.TemporaryDirectory(prefix='aud005-control-') as folder:
        copy = Path(folder)
        shutil.copytree(ROOT / 'src', copy / 'src')
        (copy / 'tests/helpers').mkdir(parents=True)
        shutil.copy(ROOT / 'tests/visualizers-panel.test.js', copy / 'tests')
        shutil.copy(ROOT / 'tests/helpers/ui-dom.js', copy / 'tests/helpers')
        (copy / 'package.json').write_text('{"type":"module"}')
        (copy / 'reporter.mjs').write_text(reporter)
        (copy / PANEL).write_text(mutated)
        run = subprocess.run(['node', '--test', '--test-name-pattern=' + expected, '--test-reporter=./reporter.mjs', 'tests/visualizers-panel.test.js'], cwd=copy, capture_output=True, text=True, timeout=60)
        failures = [json.loads(line) for line in run.stdout.splitlines() if line.startswith('{')]
        matching = [f for f in failures if expected in f['name'] and f['code'] == 'ERR_ASSERTION']
        assert run.returncode != 0 and matching, (name, run.stdout[:2000], run.stderr[:1000])
        assert not any('SyntaxError' in f['message'] or 'TypeError' in f['message'] for f in failures), name
        results.append({'control': name, 'detected': True, 'exitCode': run.returncode, 'relevantAssertions': matching, 'failureCount': len(failures)})
output = ROOT / 'docs/audits/remediations/115m-i-g-aud005/evidence/negative-controls.json'
output.write_text(json.dumps({'controls': results, 'detected': len(results), 'harnessFailures': 0}, indent=2) + '\n')
print(f'{len(results)}/{len(controls)} semantic negative controls detected')
