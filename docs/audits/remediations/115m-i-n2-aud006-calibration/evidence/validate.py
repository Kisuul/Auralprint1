"""Sequential required checks; full logs stay under work/, compact excerpts here."""
from pathlib import Path
import json, subprocess, time, hashlib, os, sys
base=Path(__file__).resolve().parent.parent
root=base.parents[3]
assert (root/'package.json').exists(), root
scratch=root/'work/n2/validation';scratch.mkdir(parents=True,exist_ok=True)
source_e=base/'evidence'
e=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else root/'work/n2-replay/validation'
e.mkdir(parents=True,exist_ok=True)
checks=[
 ['npm','ci'],
 ['node','--test','tests/recording-export.test.js','tests/rc19-recorder-disposal.test.js','tests/targeted-audit.test.js','tests/transport-ownership.test.js','tests/live-source-ownership.test.js','tests/input-source-manager.test.js','tests/file-activation-ownership.test.js','tests/queue-entry-ownership.test.js','tests/stream-graph.test.js'],
 ['npm','test'],['npm','run','build'],['python','scripts/verify_distribution.py'],
 ['node',str(source_e/'unmodified-control.cjs'),str(e/'unmodified-control.json'),str(root/'work/n2/control-media')],
 ['node','scripts/validate-recording-export.cjs'],
 ['node','scripts/validate-finalizing-eof.cjs'],
 ['node','scripts/validate-recorder-disposal.cjs'],
 ['node','scripts/validate-live-source-ownership.cjs'],
 ['node','scripts/validate-transport-ownership.cjs'],
 ['git','diff','--check'],
]
env=os.environ.copy()
for key,name in [('RC06','rc06'),('RC05','rc05'),('RC19','rc19'),('RC03','rc03'),('RC04','rc04')]:
 env[key+'_CHROMIUM_PATH']='/usr/bin/chromium';env[key+'_REPORT']=str(e/(name+'.json'))
results=[]
for i,cmd in enumerate(checks):
 t=time.monotonic();p=subprocess.run(cmd,cwd=root,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
 log=p.stdout.decode(errors='replace');(scratch/f'{i:02d}.log').write_text(log)
 result=dict(command=cmd,exit_code=p.returncode,elapsed_seconds=round(time.monotonic()-t,3),full_log_sha256=hashlib.sha256(p.stdout).hexdigest(),summary=log.splitlines()[-14:])
 results.append(result);(e/'checks.json').write_text(json.dumps(results,indent=2)+'\n')
 print(json.dumps(dict(command=cmd,exit_code=p.returncode,elapsed_seconds=result['elapsed_seconds'])),flush=True)
 if p.returncode:raise SystemExit(p.returncode)
