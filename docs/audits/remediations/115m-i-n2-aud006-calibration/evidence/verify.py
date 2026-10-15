"""Independent evidence consistency and protected-baseline verification.
Run after build from any cwd; output report path must be fresh.
"""
from pathlib import Path
import json, hashlib, subprocess, tempfile, sys, csv
base=Path(__file__).resolve().parent.parent;root=base.parents[3];e=base/'evidence'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
manifest=json.loads((e/'baseline.json').read_text())['trackedSha256']
changed=[p for p,h in manifest.items() if not (root/p).is_file() or sha(root/p)!=h]
assert not changed,changed
newpaths=subprocess.check_output(['git','diff','--name-only','889b0b4267c473db6bfa7b1afda6cfeed77565ee'],cwd=root,text=True).splitlines()
prefix=str(base.relative_to(root))+'/'
assert all(p.startswith(prefix) for p in newpaths),newpaths
files=subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard',str(base.relative_to(root))],cwd=root,text=True).splitlines()
assert all(Path(p).suffix in ['.md','.json','.csv','.py','.cjs','.mjs']for p in files)
for p in files:
 if p.endswith('.json'):json.loads((root/p).read_text())
rows=json.loads((base/'measurements.json').read_text())['rows']
assert len(rows)==21
for r in rows:
 assert sum(v['bytes']for v in r['events'])==r['encoded_bytes']
 assert sum(v['bytes']>0 for v in r['events'])==r['nonempty_chunks']
 assert r['max_logical_overlap_bytes']==r['prior_export_bytes']+r['encoded_bytes']
 if r['stage'] in ['B','C']:assert r['prior_export_bytes']==0
assert len(list(csv.DictReader((base/'measurements.csv').open())))==len(rows)
c=json.loads((e/'candidate.json').read_text());assert c['H']==2*c['S']+c['R'];assert c['approved'] is False
raw=json.loads((e/'native-stage-c.json').read_text());assert sha(e/'native.cjs')==raw['harnessSha256']
artifact=root/'dist/auralprint_0.1.15m.i.m.html'
assert sha(artifact)==raw['artifactSha256']==json.loads((e/'unmodified-control.json').read_text())['artifactSha256']
repro_files=['measurements.csv','measurements.json']+['evidence/'+p for p in ['n1-comparison.json','statistics.json','candidate.json','policy-replay.json','sensitivity.json']]
with tempfile.TemporaryDirectory(prefix='evidence-verify-',dir=root/'work')as scratch:
 out=Path(scratch)
 subprocess.run(['python',str(e/'analyze.py'),str(e),str(out)],cwd=root,check=True,stdout=subprocess.DEVNULL)
 for p in repro_files:assert sha(base/p)==sha(out/p),p
 subprocess.run(['node',str(e/'policy-model.mjs'),str(out/'policy-model.json')],cwd=root,check=True,stdout=subprocess.DEVNULL)
 assert sha(e/'policy-model.json')==sha(out/'policy-model.json')
subprocess.run(['git','diff','--check','889b0b4267c473db6bfa7b1afda6cfeed77565ee'],cwd=root,check=True)
report=dict(passed=True,baseline_files_checked=len(manifest),baseline_changed_files=changed,changed_paths_within_package=True,no_captured_media_in_package=True,json_documents_valid=True,normalized_native_ledgers_checked=len(rows),candidate_arithmetic_checked=True,executed_stage_c_source_hash_matches=True,unmodified_artifact_hash_matches=True,analysis_reproduced_byte_for_byte=repro_files,prospective_policy_model_reproduced_byte_for_byte=True,whitespace_check_exit_code=0,files_sha256={p:sha(root/p) for p in files if not p.endswith('/validation.json') and not p.endswith('/integrity.json')})
if len(sys.argv)>1:
 target=Path(sys.argv[1]);assert not target.exists(),'refusing to overwrite report';target.write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items()if k!='files_sha256'},indent=2))
