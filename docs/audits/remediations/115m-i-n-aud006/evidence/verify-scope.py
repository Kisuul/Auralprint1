"""Read-only scope assertion. Run after staging intended package files.
python evidence/verify-scope.py <fresh-report.json>
No checkout or source writes; report is the only output file.
"""
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[5]
BASE = 'a85ed8d7cf0d670a30b5763e8576d955f7c2d285'
PREFIX = 'docs/audits/remediations/115m-i-n-aud006/'

def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT, text=True).strip()

changed = git('diff', '--name-only', BASE).splitlines()
assert changed, 'Stage package files first so new files participate in scope check'
assert all(p.startswith(PREFIX) for p in changed), changed
assert git('show', f'{BASE}:version') == (ROOT/'version').read_text().strip() == 'v0.1.15m.i.m'
baseline_paths = git('ls-tree', '-r', '--name-only', BASE).splitlines()
protected = baseline_paths
# Diff already covers index AND worktree; independently compare protected bytes.
checked = 0
for p in protected:
    before = subprocess.check_output(['git', 'show', f'{BASE}:{p}'], cwd=ROOT)
    assert (ROOT/p).read_bytes() == before, p
    checked += 1
untracked = git('ls-files', '--others', '--exclude-standard').splitlines()
assert all(p.startswith((PREFIX, 'work/')) for p in untracked), untracked
report = {
    'baseline': BASE, 'version': 'v0.1.15m.i.m', 'schema': 10,
    'changed_paths': changed, 'outside_package_changes': [],
    'protected_paths_compared_byte_for_byte': checked,
    'protected_selection': 'every tracked file at accepted baseline',
    'untracked_outside_package': [p for p in untracked if not p.startswith(PREFIX)],
    'generated_distributions_tracked': git('ls-files', 'dist/').splitlines(),
    'passed': True,
}
assert not report['generated_distributions_tracked']
Path(sys.argv[1]).write_text(json.dumps(report, indent=2)+'\n')
print(json.dumps({'passed': True, 'protected_paths_compared': checked, 'changed_paths': len(changed)}))
