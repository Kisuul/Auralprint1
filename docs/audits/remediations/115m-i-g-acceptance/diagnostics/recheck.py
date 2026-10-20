"""Re-execute immutable phase diagnostics; retain compact G.4 results only.
Mutation drivers run from disposable snapshots so their historical output paths
cannot overwrite accepted evidence. No production/permanent-test mutation occurs.
"""
import hashlib, json, pathlib, shutil, subprocess, tempfile
root=pathlib.Path(__file__).resolve().parents[5]
record=pathlib.Path(__file__).resolve().parents[1]
phase_paths=['115m-i-g-aud005','115m-i-g-aud003','115m-i-g-aud008-aud009']

def run(command,cwd=root,env=None):
 result=subprocess.run(command,cwd=cwd,env=env,capture_output=True,text=True,timeout=180)
 assert result.returncode==0,(command,result.stdout[-3000:],result.stderr[-3000:])
 return result

native=[]
with tempfile.TemporaryDirectory(prefix='auralprint-g4-drivers-') as tmp:
 tmp=pathlib.Path(tmp)
 for phase in phase_paths:
  script=root/'docs/audits/remediations'/phase/'diagnostics/native.cjs'
  output=tmp/(phase+'.json')
  run(['node',str(script),'--output',str(output)])
  result=json.loads(output.read_text());cases=result['cases'];assert all(c['passed'] for c in cases)
  native.append({'suite':phase,'driverSha256':hashlib.sha256(script.read_bytes()).hexdigest(),'htmlSha256':result['htmlSha256'],'browser':result['browser'],'total':len(cases),'passed':len(cases),'cases':[{'name':c['name'],'passed':c['passed']} for c in cases]})
  print('native',phase,len(cases),'passed',flush=True)
 import os
 rc17=root/'scripts/validate-rc17.cjs';output=tmp/'rc17.json';env=os.environ.copy();env['AP_REPORT']=str(output)
 run(['node',str(rc17)],env=env);result=json.loads(output.read_text());assert result['pageErrors']==[]
 native.append({'suite':'RC-17','driverSha256':hashlib.sha256(rc17.read_bytes()).hexdigest(),'browser':result['browser'],'scenarios':len(result['rows']),'pageErrors':result['pageErrors'],'coverage':[{k:v for k,v in row.items() if k in ['dpr','standalone','normalScheduling','verified']} for row in result['rows']]})
 print('native RC-17 scenarios',len(result['rows']),'passed',flush=True)
 # Independent snapshot: original drivers may write only inside this snapshot.
 copy=tmp/'snapshot';copy.mkdir()
 for folder in ['src','tests']:shutil.copytree(root/folder,copy/folder)
 for file in ['package.json','version']:shutil.copy(root/file,copy/file)
 (copy/'.git').symlink_to(root/'.git',target_is_directory=True) # git show baseline is read-only
 (copy/'dist').symlink_to(root/'dist',target_is_directory=True) # read built HTML only
 for phase in phase_paths:shutil.copytree(root/'docs/audits/remediations'/phase,copy/'docs/audits/remediations'/phase)
 mutations=[]
 entries=[(phase_paths[0],'negative.py','negative-controls.json'),(phase_paths[0],'native-negative.py','native-reorder-control.json'),(phase_paths[1],'negative.py','negative-controls.json'),(phase_paths[2],'mutations.py','mutations-aud008.json'),(phase_paths[2],'mutations-numeric.py','mutations-aud009.json')]
 for phase,script_name,output_name in entries:
  script=copy/'docs/audits/remediations'/phase/'diagnostics'/script_name
  run(['python',str(script)],cwd=copy)
  result=json.loads((script.parents[1]/'evidence'/output_name).read_text())
  if isinstance(result,list):controls=result;assert all(c['detected'] for c in controls)
  elif 'controls' in result:controls=result['controls'];assert all(c['detected'] for c in controls)
  else:controls=[result];assert result['detected']
  mutations.append({'suite':phase,'driver':script_name,'driverSha256':hashlib.sha256(script.read_bytes()).hexdigest(),'detected':len(controls),'controls':controls})
  print('mutations',phase,script_name,len(controls),'detected',flush=True)
 (record/'evidence/regression-native.json').write_text(json.dumps({'auditedSha':'18d47e32e40d79d48f48409d0efa1bacce0f53fe','suites':native},indent=2)+'\n')
 (record/'evidence/negative-controls.json').write_text(json.dumps({'auditedSha':'18d47e32e40d79d48f48409d0efa1bacce0f53fe','harnessFailuresCounted':0,'suites':mutations},indent=2)+'\n')
