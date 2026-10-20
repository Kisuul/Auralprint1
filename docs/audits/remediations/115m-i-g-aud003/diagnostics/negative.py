"""G.2 semantic controls in disposable copies; accepted files are never edited."""
import json
from pathlib import Path
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[5]
runtime = Path('src/js/render/visualizer-runtime.js')
picker = Path('src/js/ui/orb-band-picker.js')
codec = Path('src/js/presets/preset-codec.js')
sources = {file: (ROOT / file).read_text() for file in [runtime, picker, codec]}

def replace(file, old, new):
    assert sources[file].count(old) == 1, old
    return sources[file].replace(old, new)

controls = [
    ('missing_targets_in_divisor', runtime, replace(runtime, 'clamp(sum / count, 0, 1)', 'clamp(sum / bandIds.length, 0, 1)'), 'visualizer-runtime', 'mixed targets analyze only active'),
    ('inactive_dominant', runtime, replace(runtime, '  return {\n    band: sourceBand,\n    energyOverride01: count', '  if (selectedDominantBandIndex === null) selectedDominantBandIndex = bandIds.find(Number.isInteger) ?? null;\n  return {\n    band: sourceBand,\n    energyOverride01: count'), 'visualizer-runtime', 'selected dominant excludes inactive'),
    ('all_inactive_becomes_full_spectrum', runtime, replace(runtime, 'energyOverride01: count ? clamp(sum / count, 0, 1) : 0', 'energyOverride01: count ? clamp(sum / count, 0, 1) : null'), 'visualizer-runtime', 'mixed targets analyze only active'),
    ('preset_prunes_authored_inactive', codec, replace(codec, '  return next;', '  for (const orb of next.orbs) orb.bandIds = orb.bandIds.filter(index => index < next.bands.count);\n  return next;'), 'band-count-coverage', 'original schema-10 count-3 scene persists inactive'),
    ('picker_ordinary_choices_ignore_count', picker, replace(picker, '    activeCount = getActiveCount();', '    activeCount = BAND_NAMES.length;'), 'orb-band-picker', 'picker choices, searches and numeric limits'),
    ('checkbox_drops_inactive_targets', picker, replace(picker, 'const next = new Set(selected);', 'const next = new Set(selected.filter(index => index < activeCount));'), 'orb-band-picker', 'active checkbox edits preserve inactive'),
    ('runtime_does_not_reactivate', runtime, replace(runtime, 'Math.min(energies.length, BAND_NAMES.length,', 'Math.min(energies.length, 3, BAND_NAMES.length,'), 'band-count-coverage', '3 → 32 → 3 retains and reactivates'),
    ('left_right_use_combined_c', runtime, replace(runtime, 'const energies = sourceBand && sourceBand.bandEnergies01;', 'const energies = analysisFrame?.channels?.C?.bandEnergies01;'), 'visualizer-runtime', 'mixed targets analyze only active'),
]
reporter = '''export default async function* (events) {
  for await (const event of events) if (event.type === 'test:fail') {
    const e = event.data.details.error;
    yield JSON.stringify({name:event.data.name,code:e.cause?.code || e.code,
      message:(e.cause?.message || e.message).slice(0,1000)}) + '\\n';
  }
}'''
results = []
for name, file, mutated, suite, expected in controls:
    with tempfile.TemporaryDirectory(prefix='aud003-control-') as folder:
        copy = Path(folder)
        shutil.copytree(ROOT / 'src', copy / 'src')
        shutil.copytree(ROOT / 'tests', copy / 'tests')
        (copy / 'package.json').write_text('{"type":"module"}')
        (copy / 'reporter.mjs').write_text(reporter)
        (copy / file).write_text(mutated)
        command = ['node', '--test', '--test-name-pattern=' + expected, '--test-reporter=./reporter.mjs', 'tests/' + suite + '.test.js']
        run = subprocess.run(command, cwd=copy, capture_output=True, text=True, timeout=60)
        failures = [json.loads(line) for line in run.stdout.splitlines() if line.startswith('{')]
        meaningful = [f for f in failures if expected in f['name'] and f['code'] == 'ERR_ASSERTION']
        assert run.returncode != 0 and meaningful, (name, run.stdout[:1500], run.stderr[:1000])
        assert not any('SyntaxError' in f['message'] or 'TypeError' in f['message'] for f in failures), name
        results.append({'control': name, 'detected': True, 'exitCode': run.returncode, 'relevantFailures': meaningful})
output = ROOT / 'docs/audits/remediations/115m-i-g-aud003/evidence/negative-controls.json'
output.write_text(json.dumps({'controls': results, 'detected': len(results), 'harnessFailures': 0}, indent=2) + '\n')
print(f'{len(results)}/{len(controls)} semantic controls detected')
