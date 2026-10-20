"""Synthetic exported-signal checks only, not physical/audio-fidelity acceptance.
Usage: python audio-check.py scratch-media-dir fresh-report.json
"""
import sys,json,subprocess,struct,math,hashlib
from pathlib import Path
folder,out=map(Path,sys.argv[1:3]);assert not out.exists()
rows=[]
for file in sorted(folder.iterdir()):
 if file.suffix not in ['.webm','.mp4']:continue
 raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(file),'-t','2','-map','0:a:0','-f','f32le','-ac','2','-ar','48000','pipe:1'])
 samples=[v[0] for v in struct.iter_unpack('<f',raw)];assert samples and all(math.isfinite(v)for v in samples)
 channels=[samples[i::2]for i in range(2)];metrics=[]
 for channel in channels:
  count=len(channel);rms=math.sqrt(sum(v*v for v in channel)/count)
  tones={str(hz):2*abs(sum(v*complex(math.cos(2*math.pi*hz*i/48000),math.sin(2*math.pi*hz*i/48000))for i,v in enumerate(channel)))/count for hz in [440,880]}
  assert rms>.001,(file,rms)
  metrics.append(dict(samples=count,rms=rms,tone_amplitudes=tones))
 # Fixtures deliberately put 440 Hz left and 880 Hz right. Verify channel-specific
 # signal, allowing lossy-codec leakage and ordinary start timestamp padding.
 assert metrics[0]['tone_amplitudes']['440']>metrics[0]['tone_amplitudes']['880']*5,(file,metrics)
 assert metrics[1]['tone_amplitudes']['880']>metrics[1]['tone_amplitudes']['440']*5,(file,metrics)
 rows.append(dict(file=file.name,sha256=hashlib.sha256(file.read_bytes()).hexdigest(),channels=metrics,passed=True))
assert rows
out.write_text(json.dumps(dict(passed=True,kind='decoded synthetic stereo signal; not perceptual/external-player fidelity',files=rows),indent=2)+'\n')
print('Decoded stereo signal checks passed:',len(rows),'exports')
