"""Independent cross-check of native ledgers, downloaded bytes and timestamps."""
from pathlib import Path
import json,sys
base=Path(__file__).resolve().parent
report=json.loads((base/'native-final.json').read_text());assert report['passed']
rows=[]
for case in report['cases']:
 if 'download'not in case:continue
 events=[e for e in case['native']['events']if e['type']=='dataavailable' and e['bytes']>0]
 state=case['state'];download=case['download'];assert sum(e['bytes']for e in events)==state['deliveredBytes']==state['admittedBytes']==download['bytes']==state['finalExportBytes']
 assert len(events)==state['chunkCount'];assert state['retainedChunkCount']==0
 assert case['native']['stops']==1;assert not [e for e in case['native']['events']if e['type']=='error']
 assert abs(case['containerDuration']-state['elapsedMs']/1000)<2
 assert any(s['type']=='audio'for s in case['streams']);assert any(s['type']=='video'for s in case['streams'])
 assert case['replay']['time']>0
 row=dict(id=case['id'],bytes=download['bytes'],elapsedMs=state['elapsedMs'],containerDuration=case['containerDuration'],chunks=len(events),stopReason=state['stopReason'],streams=case['streams'],sha256=download['sha256'])
 if case['id']=='factory-300000ms':
  assert state['stopReason']=='duration-stop'and state['sessionPolicy']['profile']=='balanced'and state['elapsedMs']>=300000 and not case['guard']
  row.update(maxSummedRssBytes=max(s['rssBytes']for s in case['samples']),maxCgroupBytes=max(s['cgroupBytes']for s in case['samples']))
 rows.append(row)
assert len(rows)==4
out=Path(sys.argv[1]);assert not out.exists();out.write_text(json.dumps(dict(passed=True,artifactSha256=report['artifactSha256'],rows=rows),indent=2)+'\n');print(json.dumps(rows,indent=2))
