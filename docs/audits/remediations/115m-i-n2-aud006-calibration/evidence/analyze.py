"""Rebuild compact datasets/statistics/sensitivity from saved native ledgers.
No capture/media allocation. Python 3 standard library only. Run from any cwd.
"""
from pathlib import Path
import json, csv, math, statistics, hashlib
base=Path(__file__).resolve().parent.parent
e=base/'evidence'

def load(name): return json.loads((e/name).read_text())
def quantile(values,p):
    x=sorted(values)
    if not x:return None
    pos=(len(x)-1)*p; lo=math.floor(pos); hi=math.ceil(pos)
    return x[lo]+(x[hi]-x[lo])*(pos-lo)
def dist(values):
    return dict(n=len(values),min=min(values) if values else None,median=statistics.median(values) if values else None,p95=quantile(values,.95),max=max(values) if values else None)
def histogram(values):
    result={}
    for v in values:
        key=f'{v:.1f}';result[key]=result.get(key,0)+1
    return result

def row(id,stage,native,state,previous,extras):
    ev=native['events']; data=[x for x in ev if x['type']=='dataavailable']; nonempty=[x for x in data if x['bytes']>0]
    gaps=[b['ms']-a['ms'] for a,b in zip([{'ms':native['startMs']}]+data,data)]
    terminal=next((x['ms'] for x in ev if x['type']=='stop'),None)
    elapsed=state['elapsedMs']; size=state['lastExportByteSize']; total=sum(x['bytes'] for x in data)
    after=[x for x in data if native['stopMs'] is not None and x['ms']>=native['stopMs']]
    r=dict(id=id,stage=stage,application_phase=state['phase'],native_start_ms=native['startMs'],native_stop_ms=native['stopMs'],native_terminal_ms=terminal,browser='151.0.7922.173',width=960,height=640,dpr=1,requested_fps=30,scene='default',mode='see scenario',selected_mime=native['requested']['mimeType'],initial_mime=native['mime'] if 'mime' in native else native['initialMime'],final_mime=native['finalMime'],elapsed_ms=elapsed,encoded_bytes=total,average_mbit_s=total*.008/elapsed,bytes_per_second=total*1000/elapsed,data_events=len(data),nonempty_chunks=len(nonempty),largest_chunk_bytes=max((x['bytes'] for x in data),default=0),final_event_bytes=data[-1]['bytes'] if data else None,last_nonempty_bytes=nonempty[-1]['bytes'] if nonempty else None,post_stop_bytes=sum(x['bytes'] for x in after),max_event_gap_ms=max(gaps,default=0),stop_to_terminal_ms=terminal-native['stopMs'] if terminal is not None and native['stopMs'] is not None else None,prior_export_bytes=previous,max_logical_overlap_bytes=previous+total,success=state['phase']=='complete' and total==size,events=data,event_size_distribution=dist([x['bytes'] for x in data]),event_gap_distribution_ms=dist(gaps),replay='not per-trial; N.1 harness replayed last export only',actual_video_codec=None,actual_audio_codec=None,encoded_packet_fps=None,render_fps=None,guard=None)
    r.update(extras);return r
rows=[]
a=load('n1-native-reproduction.json')
for i,x in enumerate(a['cases']):
    name=x['name']; mode='stream' if 'stream' in name or 'repeat' in name else 'mic' if 'mic' in name else 'video-only' if name=='video-only' else 'file'
    rows.append(row(name,'A',x['native'],x['after'],x['beforeExportBytes'],dict(mode=mode,replay=a['replay'] if i==len(a['cases'])-1 else 'not individually replayed')))
for filename in ['native-stage-b-initial.json','native-stage-c.json']:
    report=load(filename)
    if not report.get('finishedAt'):raise SystemExit(f'Run incomplete: {filename}')
    for x in report['cases']:
        s=x['scenario']; streams=x.get('ffprobe',{}).get('streams',[]);video=next((v for v in streams if v.get('codec_type')=='video'),{});audio=next((v for v in streams if v.get('codec_type')=='audio'),{})
        times=x['render']['times']; costs=x['render']['costs'];gaps=[b-a for a,b in zip(times,times[1:])]
        packet_count=int(video['nb_read_packets']) if 'nb_read_packets' in video else None
        # One packet/frame is observed container structure, not a universal codec guarantee.
        extra=dict(width=s['width'],height=s['height'],requested_fps=s['fps'],scene=s['scene'],mode=s['mode'] if s['audio'] else 'video-only',success=bool(x.get('success')),guard=x.get('guard'),replay=x.get('replay','guard-aborted: not replayed'),actual_video_codec=video.get('codec_name'),actual_audio_codec=audio.get('codec_name'),encoded_video_packets=packet_count,encoded_packet_fps=packet_count*1000/x['elapsedMs'] if packet_count is not None else None,render_fps=len(times)*1000/x['elapsedMs'],render_gap_distribution_ms=dist(gaps),render_cost_distribution_ms=dist(costs),render_gap_histogram_0_1ms=histogram(gaps),render_cost_histogram_0_1ms=histogram(costs),rss_distribution_bytes=dist([h['rssBytes'] for h in x['hostSamples']]),cgroup_distribution_bytes=dist([h['cgroupBytes'] for h in x['hostSamples']]),download=x.get('download'),data_source=filename)
        rows.append(row(x['id'],s['id'][0],x['native'],x['state'],x['overlap']['P'],extra))
        if x.get('replacement'):
            b=x['replacement']; rows.append(row(x['id']+'-replacement','D',b['native'],b['state'],x['replacementActive']['P'],dict(width=s['width'],height=s['height'],requested_fps=s['fps'],scene=s['scene'],mode=s['mode'] if s['audio'] else 'video-only',replay='replacement not replayed; URL ledger and fetch checks',active_overlap=x['replacementActive'],revocations=b['revocations'],failed_replacement=x['failedReplacement'])))
old=json.loads((base.parent/'115m-i-n-aud006/evidence/native.json').read_text())
comparison=[]
for x,y in zip(old['cases'],a['cases']):
    assert x['name']==y['name']
    comparison.append(dict(id=y['name'],original_bytes=x['after']['lastExportByteSize'],reproduced_bytes=y['after']['lastExportByteSize'],change_percent=100*(y['after']['lastExportByteSize']/x['after']['lastExportByteSize']-1),original_events=[v for v in x['native']['events'] if v['type']=='dataavailable'],reproduced_events=[v for v in y['native']['events'] if v['type']=='dataavailable']))
(e/'n1-comparison.json').write_text(json.dumps(comparison,indent=2)+'\n')
observed=[r for r in rows if r['success'] and r['stage']!='D']
stats={'definition':'type-7 linearly interpolated sample quantiles; descriptive only; pooled trials are unequal workloads, not IID predictions','all_successful_trial_average_mbit_s':dist([r['average_mbit_s'] for r in observed]),'by_stage':{},'by_codec':{}}
for stage in ['A','B','C']:
    group=[r for r in observed if r['stage']==stage];stats['by_stage'][stage]={'average_mbit_s':dist([r['average_mbit_s'] for r in group]),'event_bytes':dist([v['bytes'] for r in group for v in r['events']]),'event_gap_ms':dist([b['ms']-a['ms'] for r in group for a,b in zip([{'ms':r['native_start_ms']}]+r['events'],r['events'])]),'final_event_bytes':dist([r['final_event_bytes'] for r in group]),'post_stop_bytes':dist([r['post_stop_bytes'] for r in group]),'stop_to_terminal_ms':dist([r['stop_to_terminal_ms'] for r in group])}
for codec in sorted({r['final_mime'] for r in observed}):
    group=[r for r in observed if r['final_mime']==codec];stats['by_codec'][codec]={'average_mbit_s':dist([r['average_mbit_s'] for r in group]),'bytes_per_second':dist([r['bytes_per_second'] for r in group]),'n':len(group)}
# Candidate derivation: sustained standard tier across tested codecs, 300s horizon,
# 25% bitrate headroom, then round up in decimal 10 MB UI increments.
standard=[r for r in observed if r['width']==1280 and r['stage'] in ['B','C']]
rate=max(r['bytes_per_second'] for r in standard);S=math.ceil(rate*300*1.25/10_000_000)*10_000_000
M=max(r['largest_chunk_bytes'] for r in observed);F=max(r['post_stop_bytes'] for r in observed)
R=math.ceil(3*(M+F)/5_000_000)*5_000_000
long=[r for r in observed if r['stage']=='C']
if not long:raise SystemExit('No completed long evidence: do not derive provisional defaults automatically')
C=math.ceil((4*max(r['nonempty_chunks'] for r in long)+2)/100)*100
candidate=dict(S=S,H=2*S+R,R=R,C=C,T_ms=300000,measured_standard_max_bytes_s=rate,observed_largest_event_bytes=M,observed_max_post_stop_bytes=F,scope='provisional desktop interactive baseline/standard; no hardware safety certification',approved=False)
policies=[]
for r in rows:
    P=r['prior_export_bytes'];effective=min(S,2*S+R-P-R);D=0;n=0;trigger=None;rejected=None
    if P>=2*S:rejected='start-headroom'
    else:
        for v in r['events']:
            if not v['bytes']:continue
            if P+D+v['bytes']>2*S+R or n+1>C:rejected='whole-event-admission';break
            D+=v['bytes'];n+=1
            if trigger is None and D>=effective:trigger='capacity-stop'
        if trigger is None and r['elapsed_ms']>=300000:trigger='duration-stop'
    policies.append(dict(id=r['id'],P=P,whole_recorded_ledger_admitted=rejected is None,admitted_bytes=D,count=n,effective_soft_bytes=effective,prospective_trigger=trigger or 'manual-before-limit',rejection=rejected,limitation='Replays actual delivered integer ledger; cannot predict event schedule/output after a different earlier Stop. No media exported by policy model.'))
sensitivity=[]
# Boundary before a crossing; reserve must cover crossing overshoot AND final tail.
for sf in [.75,1,1.5]:
    for reserve_multiple in [1,2,3,4]:
        rr=math.ceil(reserve_multiple*(M+F));ss=math.ceil(S*sf);hh=2*ss+rr
        for tail_multiple in [1,2,4,8,16]:
            p=ss;d=ss-1+M;tail=math.ceil(F*tail_multiple);total=p+d+tail
            sensitivity.append(dict(soft_factor=sf,S=ss,H=hh,R=rr,P=p,crossing_event=M,tail_multiple=tail_multiple,tail_bytes=tail,aggregate=total,admitted=total<=hh,input_class='invented boundary/tail multiplier using observed M/F; not native events'))
factory_tail=[dict(tail_multiple=k,tail_bytes=math.ceil(F*k),P=S,crossing_overshoot=M-1,aggregate=2*S-1+M+math.ceil(F*k),admitted=2*S-1+M+math.ceil(F*k)<=2*S+R,input_class='invented stress') for k in [1,2,4,8,16]]
delay=[]
for sec in [1,5,15,30,60]:
    backlog=math.ceil(rate*sec);total=2*S-1+M+backlog
    delay.append(dict(delay_seconds=sec,invented_tail_bytes=backlog,admitted=total<=2*S+R,assumption='observed maximum standard trial average held stationary; invented stress, not bitrate maximum'))
count_sensitivity=[dict(C=limit,trial_id=r['id'],observed_nonempty_chunks=r['nonempty_chunks'],fits=r['nonempty_chunks']<=limit) for limit in [300,600,C,2400] for r in rows]
duration_sensitivity=[dict(T_seconds=t,trial_id=r['id'],observed_elapsed_seconds=r['elapsed_ms']/1000,earlier_stop_requested=r['elapsed_ms']>t*1000,limitation='Timer checks may be delayed; changed final native output unknown') for t in [60,300,600,900] for r in rows]
for name,obj in [('statistics.json',stats),('candidate.json',candidate),('policy-replay.json',policies),('sensitivity.json',dict(boundary_tail=sensitivity,factory_tail=factory_tail,delayed_delivery=delay,chunk_count=count_sensitivity,duration=duration_sensitivity))]: (e/name).write_text(json.dumps(obj,indent=2)+'\n')
(base/'measurements.json').write_text(json.dumps(dict(semantics='Native observations; logical encoded payload, not physical memory. Stage D replacements are auxiliary; guard-aborted row retained and excluded from supported statistics.',rows=rows),indent=2)+'\n')
columns=[k for k,v in rows[0].items() if not isinstance(v,(dict,list)) and k not in ['replay']]+['actual_video_codec','actual_audio_codec','encoded_packet_fps','render_fps','guard']
columns=list(dict.fromkeys(columns))
with (base/'measurements.csv').open('w',newline='') as f:
    w=csv.DictWriter(f,fieldnames=columns,extrasaction='ignore');w.writeheader();w.writerows([{k:r.get(k) for k in columns} for r in rows])
print(json.dumps(dict(rows=len(rows),statistics=stats['all_successful_trial_average_mbit_s'],candidate=candidate),indent=2))
