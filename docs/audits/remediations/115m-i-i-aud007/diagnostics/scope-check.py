"""Verify this phase contains only new documentation/diagnostics beneath its own directory.
Run after staging or committing, from any cwd. Output is a scope assertion, not runtime acceptance.
"""
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[5]
BASE = '704bf13d3a3dfb76032343226bad7240191ef6c6'
PREFIX = 'docs/audits/remediations/115m-i-i-aud007/'

def git(*args):
    return subprocess.check_output(['git', '-C', str(ROOT), *args], text=True).strip()

changes = [line.split('\t') for line in git('diff', '--name-status', BASE).splitlines()]
assert changes, 'expected a new investigation package'
assert all(row[0] == 'A' and row[1].startswith(PREFIX) for row in changes), changes
assert (ROOT / 'version').read_text().strip() == 'v0.1.15m.i.h'
assert 'const PRESET_SCHEMA_VERSION = 10;' in (ROOT / 'src/js/core/constants.js').read_text()
# git diff against baseline checks all previously tracked paths, including old audits/releases.
assert git('diff', '--name-only', BASE, '--', 'src', 'tests', 'scripts', 'version', 'package.json', 'package-lock.json', 'agents.md') == ''
print(json.dumps({'pass': True, 'baseline': BASE, 'branch': git('branch', '--show-current'),
                  'onlyNewInvestigationFiles': True, 'productionAndPermanentTestsUnchanged': True,
                  'version': 'v0.1.15m.i.h', 'schema': 10, 'files': [r[1] for r in changes]}, indent=2))
