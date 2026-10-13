"""Semantic mutants run only in disposable copies; sources/tests remain untouched."""
from pathlib import Path
import shutil, subprocess, json, re, hashlib
root=Path(__file__).resolve().parents[5]
scratch=Path('/workspace/work/auralprint-h1-negative-controls');scratch.mkdir(parents=True,exist_ok=True)
ui='src/js/ui/ui.js'
cases=[
 ('tooltip-title',ui,'if (control.title !== title) control.title = title;','control.title = title;','AUD-004 tooltip titles are idempotent','tests/targeted-audit.test.js','unchanged tooltip title writes'),
 ('duplicate-recorder',ui,'    refreshConfigTooltips();\n','    refreshConfigTooltips();\n    refreshRecordingUi();\n','AUD-004 recorder projects once','tests/targeted-audit.test.js','unchanged recorder must not project'),
 ('selector-aria',ui,'if (el && el.getAttribute(key) !== value) el.setAttribute(key, value);','if (el) el.setAttribute(key, value);','AUD-004 idle source selectors','tests/targeted-audit.test.js','unchanged selectors/launcher ARIA writes'),
 ('source-error-stale',ui,'    syncProperty(ui.audioStatus, "textContent", sourceUi.audioStatusText);','    if (ui.audioPanel.dataset.sourceMode !== sourceUi.audioPanelSourceMode) syncProperty(ui.audioStatus, "textContent", sourceUi.audioStatusText);','AUD-004 source errors and permission','tests/targeted-audit.test.js','Microphone permission denied'),
 ('finalization-stale',ui,'if (ui.recordingUiSyncKey === syncKey) return;','if (ui.recordingUiSyncKey) return;','AUD-004 recorder finalization alone','tests/targeted-audit.test.js','finalization busy accessibility must update promptly'),
 ('hidden-reveal-stale','src/js/ui/workspace.js','onPanelShown(ui.visualizersPanel);','/* presentation refresh omitted */','AUD-004 hidden Visualizers reveal','tests/targeted-audit.test.js','reveal must refresh canonical values synchronously'),
 ('focused-inventory','src/js/ui/visualizers-panel.js','    const focused = list.contains(document.activeElement) ? document.activeElement : null;','    list.replaceChildren();\n    const focused = list.contains(document.activeElement) ? document.activeElement : null;','AUD-005: new settings snapshot','tests/visualizers-panel.test.js','exact focused node'),
 ('duplicate-tooltip-listeners',ui,'if (!control || spec.feedbackEventsWired) continue;','if (!control) continue;','AUD-004 tooltip discovery retains listeners','tests/targeted-audit.test.js','surviving controls must not register duplicate tooltip listeners'),
]
protected=[root/f for f in {case[1] for case in cases}|{case[5] for case in cases}]
before={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in protected}
results=[]
for name,file,old,new,pattern,suite,expected in cases:
 copy=scratch/name
 if copy.exists():shutil.rmtree(copy)
 copy.mkdir()
 for folder in ['src','scripts','tests']:shutil.copytree(root/folder,copy/folder)
 for item in ['version','package.json','package-lock.json']:shutil.copy2(root/item,copy/item)
 (copy/'node_modules').symlink_to(root/'node_modules',target_is_directory=True)
 p=copy/file;s=p.read_text();assert s.count(old)==1,(name,s.count(old))
 cmd=['node','--test','--test-reporter=tap','--test-name-pattern='+pattern,suite]
 positive=subprocess.run(cmd,cwd=copy,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
 assert positive.returncode==0,(name,positive.stdout)
 p.write_text(s.replace(old,new))
 run=subprocess.run(cmd,cwd=copy,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
 assertion='AssertionError' in run.stdout
 intended=run.returncode!=0 and assertion and expected in run.stdout
 # Crashes and harness failures do not count as detected behavior.
 results.append({'name':name,'mutation':{'file':file,'before':old,'after':new},'command':cmd,'positiveControlExitCode':positive.returncode,'exitCode':run.returncode,'detected':intended,'assertionFailure':assertion,'expectedEvidence':expected,'failures':re.findall(r'^not ok .+$',run.stdout,re.M),'assertionExcerpt':run.stdout[run.stdout.find('  error:'):run.stdout.find('  stack:')][:1800]})
 if not intended:print(name,run.stdout)
(root/'docs/audits/remediations/115m-i-h-aud004/evidence/negative-controls.json').write_text(json.dumps({'method':'Eight disposable source copies. Original tests retained. Detection requires intended observable assertion, not harness crash.','results':results},indent=2)+'\n')
assert before=={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in protected},'original files changed'
assert all(r['detected'] for r in results),'one or more semantic mutants escaped or crashed'
print('8/8 intended semantic regressions detected')
