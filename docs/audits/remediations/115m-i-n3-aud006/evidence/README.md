# Evidence index and reproduction

Run from repository root. Node 24 / Python 3.12 are the standard checks. Optional
native diagnostics use externally provisioned Playwright, `/usr/bin/chromium`,
ffprobe and ffmpeg; no runtime/test dependency is added to package.json.
Always choose fresh reports and work/ media directories. Do not overwrite the
historical N.1/N.2 packages or their default output paths.

```sh
npm ci
npm test
npm run build
python scripts/verify_distribution.py
git diff --check
node --test tests/recording-policy.test.js tests/recorder-governor.test.js tests/recording-resources-ui.test.js
python docs/audits/remediations/115m-i-n3-aud006/evidence/mutations.py
node docs/audits/remediations/115m-i-n3-aud006/evidence/native.cjs work/native-fresh.json work/media-fresh
node docs/audits/remediations/115m-i-n3-aud006/evidence/ui-native.cjs work/ui-fresh.json
python docs/audits/remediations/115m-i-n3-aud006/evidence/audio-check.py work/media-fresh work/audio-fresh.json
python docs/audits/remediations/115m-i-n3-aud006/evidence/verify.py work/integrity-fresh.json
```

Mutation runner changes one production source at a time and restores it in finally.
Run it alone relative to other source-based regressions; logs go to work/. The
permanent tests inspect pending retention in a temporary import copy without
exposing private state in the application API. Public policy injection is an
explicit init seam used only in the isolated native capacity diagnostic.

`native-precleanup.json` and its exact harness source preserve the first successful
five-minute/native run before final acquisition-cleanup hardening. `native.json`
adds timestamp/duration checks after that cleanup correction. `native-final.json`
is the final public-operation-fence runtime artifact. Their hashes distinguish
these checkpoints. `ui-native*.json` and `unmodified-control*.json` likewise retain
successful iterations; the final/current reports match the final distribution.
Actual media lives only under work/, is never committed, and is referenced by hash.

The unmodified controls use the unchanged accepted N.2
`evidence/unmodified-control.cjs` with fresh N.3 report/media arguments. RC-03,
RC-04, RC-05, RC-06 and RC-19 use unchanged scripts in scripts/ with explicit
`RCxx_CHROMIUM_PATH=/usr/bin/chromium` and `RCxx_REPORT` in this package. Their
JSON records the case outcomes. `cancel-eof.cjs` adds native Cancel settlement at
an actually ended File while terminal callback is deliberately delayed.

`baseline.json` protects historical audits/remediations, fixtures and branding.
`integrity.json` checks their hashes, scope, final artifact and implementation/
evidence hashes. `environment.json` records the host's observed limits.
`checks.json` and `validation.json` summarize commands and review disposition;
CI evidence and the draft PR link the exact handoff head. None is release approval.
