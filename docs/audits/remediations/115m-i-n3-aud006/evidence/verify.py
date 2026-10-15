"""Read-only protected history and implementation/evidence integrity report.
Run from repository root with fresh destination JSON. Distribution must be built.
"""
import sys,json,hashlib,subprocess
from pathlib import Path
root=Path.cwd();base=root/'docs/audits/remediations/115m-i-n3-aud006';out=Path(sys.argv[1]);assert not out.exists()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
manifest=json.loads((base/'evidence/baseline.json').read_text())['protected']
changed=[p for p,h in manifest.items()if not (root/p).exists()or sha(root/p)!=h];assert not changed,changed
assert (root/'version').read_text().strip()=='v0.1.15m.i.n'
assert 'const PRESET_SCHEMA_VERSION = 10;' in (root/'src/js/core/constants.js').read_text()
subprocess.run(['git','merge-base','--is-ancestor','3e6a01bc5453307d0b4d64db844d9dc0ce0518cf','302173917ed9b337a9d1df9a3f93d083248fe51f'],check=True)
assert not subprocess.check_output(['git','ls-files','--','dist/','.build/','build/','node_modules/'],text=True).strip()
changedPaths=subprocess.check_output(['git','diff','302173917ed9b337a9d1df9a3f93d083248fe51f','--name-only'],text=True).splitlines()
for prefix in ['src/js/audio/','src/js/render/','src/js/presets/','src/js/main.js','tests/fixtures/','src/assets/branding/']:
 assert not any(p.startswith(prefix)for p in changedPaths),(prefix,changedPaths)
subprocess.run(['git','diff','--check'],check=True)
files=subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard','src/','tests/','scripts/','package.json','package-lock.json','version'],text=True).splitlines()
implementation={p:sha(root/p)for p in files}
evidence={str(p.relative_to(base)):sha(p)for p in sorted((base/'evidence').iterdir())if p.is_file() and p!=out}
for name,source in [('native-precleanup.json','native-precleanup.cjs'),('native.json','native.cjs'),('native-final.json','native.cjs')]:
 p=base/'evidence'/name
 if p.exists():
  r=json.loads(p.read_text());assert r.get('passed'),(name,r.get('failure'))
  assert r['harnessSha256']==sha(base/'evidence'/source),name
artifact=root/'dist/auralprint_0.1.15m.i.n.html';r=json.loads((base/'evidence/native-final.json').read_text());assert sha(artifact)==r['artifactSha256']
for name in ['ui-native-final.json','unmodified-control-current.json']:
 r=json.loads((base/'evidence'/name).read_text());assert r['passed'];assert r['artifactSha256']==sha(artifact)
report=dict(passed=True,baseline='302173917ed9b337a9d1df9a3f93d083248fe51f',protected_files_checked=len(manifest),protected_changes=changed,version='v0.1.15m.i.n',schema=10,distributionSha256=sha(artifact),implementation_files_sha256=implementation,evidence_sha256=evidence)
out.write_text(json.dumps(report,indent=2)+'\n');print('Protected historical/fixture/branding files verified:',len(manifest))
