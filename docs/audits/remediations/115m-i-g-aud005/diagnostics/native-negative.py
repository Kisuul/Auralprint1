"""Remove only the reorder focus guard from disposable built HTML."""
import json
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[5]
RECORD = ROOT / 'docs/audits/remediations/115m-i-g-aud005'
version = (ROOT / 'version').read_text().strip()
html = (ROOT / f'dist/auralprint_{version[1:]}.html').read_text()
line = 'if (focused && list.contains(focused) && document.activeElement !== focused) focused.focus();'
assert html.count(line) == 1
with tempfile.TemporaryDirectory(prefix='aud005-native-control-') as folder:
    altered, output = Path(folder) / 'control.html', Path(folder) / 'results.json'
    altered.write_text(html.replace(line, ''))
    result = subprocess.run(['node', str(RECORD / 'diagnostics/native.cjs'), '--html', str(altered), '--output', str(output)], cwd=ROOT, timeout=90)
    evidence = json.loads(output.read_text())
    failed = [c for c in evidence['cases'] if not c['passed']]
    primary = [c for c in failed if 'native focused Orb reorder' in c['name']]
    assert result.returncode == 1 and len(primary) == 3
    assert len(failed) == 6 and all('native focused Orb reorder' in c['name'] or 'summary-only' in c['name'] for c in failed)
    assert all(c['after']['sameNode'] and c['after']['connected'] and c['after']['active']['tag'] == 'BODY' for c in primary)
    compact = {'control': 'native reorder without focus restoration', 'detected': True,
        'browser': evidence['browser'], 'alteredHtmlSha256': evidence['htmlSha256'],
        'summary': evidence['summary'], 'relevantFailures': primary,
        'dependentFailures': [c['name'] for c in failed if c not in primary], 'harnessFailures': 0}
    (RECORD / 'evidence/native-reorder-control.json').write_text(json.dumps(compact, indent=2) + '\n')
print('Native reorder negative detected for Edit, Duplicate and Remove')
