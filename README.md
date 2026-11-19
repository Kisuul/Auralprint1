# Auralprint

Auralprint plays and analyzes audio, drives visualizers from the analysis, and records the result.

## Using Auralprint

Open the [official site](https://auralprint.idiw.net/) or use the [Release 5 portable HTML](docs/Canon/0.1.16/auralprint_0.1.16.html). For the portable edition, select **Download raw file** on GitHub, then open the downloaded file in your browser.

In **Audio**, select **File**, then **Load audio** and choose an audio file. [Release 5 notes](docs/Canon/changelog.md#v115--v116-release-5--build-116) and the [acceptance record](ROADMAP.md#build-116-simulation-world-camera-and-projection) cover Build 116 (`v0.1.16`).

<a id="current-capabilities"></a>
<a id="queue-and-trace-in-build-116"></a>

### Playback and Queue

Add several files with **Load audio** or drop them onto the canvas. Open **Queue** to play or remove individual files or clear the list. **Shuffle** reorders three or more entries once and keeps the current track selected.

With a seekable file loaded, focus **Playback position**. The arrow keys seek by 5 seconds, or 30 seconds with **Shift**. **Home** and **End** go to the start and end.

Use **Audio → Waveforms** to select a stereo-equivalent workload profile of about 4, 8, or 15 minutes. Waveform generation has separate limits for file size and estimated decoded audio. Playback and seeking work without a waveform.

Select **Mic** or **Stream** for live input and grant capture permission in the browser. **Stream** requires a shared audio track. The app rejects video-only capture. Browser and codec support varies. See the [reported source coverage](ROADMAP.md#build-115-release-acceptance-and-qualifications).

**Settings → Source Behavior → Clear File Queue when switching sources** is off by default. When enabled, it clears the queue after a successful switch from File to Mic or Stream. Failed, cancelled, or superseded requests and intervening Queue changes preserve the files. Shared Scenes include this setting.

<a id="camera-in-build-116"></a>

### Move the Camera

In **Camera**, select **Enable camera mode**. Drag to pan or use the mouse wheel to zoom at the pointer. On a touchscreen, use one finger to pan or two fingers to pan, pinch, and rotate. Lift either finger to continue panning.

With the canvas focused, hold **W/A/S/D** to move or **Q/E** to turn. Hold **Shift** to boost. Press **C** to reset to the factory view or **F** to fit the world and composition once, preserving rotation.

In **Settings → Simulation World**, set the reference dimensions for Orbs and the Ring. Particle spacing uses world units.

Camera movement changes your live view. Select **Save Current View as Scene View** to store that view in the Scene. Select **Restore Scene View** to return to it. See the [Camera controls and saved-view contract](docs/development/build-116.md#116d-authored-scene-camera).

<a id="sharing-in-build-116"></a>

### Share a Scene

Select **Settings → Presets → Copy Share Link**. The link includes only Scene settings and the saved Scene view. If clipboard access fails, copy the complete URL from the address bar.

Build 116 writes schema 16. It uses native DEFLATE for compressed links (`#z=`) and falls back to uncompressed links (`#p=`) when compression is unavailable or fails. A browser needs native DEFLATE decompression to open a compressed link. If decompression is unavailable, the app keeps the current Scene and shows a message.

Build 116 reads supported schemas 2–13. Schemas 14 and 15 are reserved and rejected. Earlier public builds cannot open schema 16. Link length depends on Scene contents. Sharing services may impose a length limit. See the [preset format and browser checks](docs/development/build-116.md#116e-compact-presets).

### Adjust analysis and visualizers

**Analysis** shows the band count and effective frequency ceiling. The band count defaults to 256 and is read-only in the panel.

Use **Visualizers** to edit Orbs and the Spectral Ring. Each Orb can follow the left, right, or combined channel and can target selected bands. The Ring uses the combined channel. **Bulk Edit** applies changes to all Orbs. **Settings** controls shared colors and particle limits.

In an individual or Bulk **Trace** editor, set **Fade Length** to **0 / Off** for a continuous stroke. Set it to **1–20** to fade up to that many of the oldest drawable segments toward the Scene background.

With the canvas focused, press **H** to hide or restore panels. Press **Space** to pause visual motion and particle emission. Analysis and particle aging continue. Press **R** to restore designed phases and clear trails.

### Record and export

Open **Record**. Set **Preferred Format**, **Target FPS**, and **Include Audio**. Select **Start Recording**, then **Stop Recording** to finish. When the export is ready, select **Download Latest Export**. **Cancel Current Capture** preserves the last successful export.

Under **Recording Resources**, the default **Balanced** profile sets encoded-data limits and a five-minute automatic Stop target. **Custom** lets you turn limits off individually. **Unrestricted** disables the app's size, chunk, and duration limits. Browser and device limits still apply. Recording resource preferences are saved on this device when browser storage is available. Scene presets exclude them.

<a id="developer-and-agent-bootstrap"></a>

## Developer bootstrap

Requires **Node 24** and **Python 3.12**. Run these commands in order from the repository root. Tests temporarily rename build directories, so wait for them to finish before building.

```sh
npm ci
npm test
npm run build
python scripts/verify_distribution.py
```

On Ubuntu, install Playwright's pinned Chromium headless shell and its dependencies before running the browser checks.

```sh
npx playwright install --with-deps chromium --only-shell
npm run test:browser
npm run test:browser:editing
npm run test:browser:presets
```

The Queue and Trace check reads two historical commits. If your checkout lacks them, as in a fresh shallow clone, fetch them before running the check. See the [fetch step in CI](.github/workflows/ci.yml#L51-L55).

```sh
git fetch --no-tags --depth=1 origin 33b696a94439d17e86ef26c04a416cbc430754d3 2b53501fe09a9a87688c02487f7e5849f866a51d
```

```sh
node scripts/validate-116-candidate.cjs
node scripts/validate-116-accessibility.cjs
```

The [CI workflow](.github/workflows/ci.yml) runs tests and packaging verification on Ubuntu and Windows. The Chromium checks run over local HTTP on Ubuntu. See the [release coverage limits](ROADMAP.md#build-116-simulation-world-camera-and-projection).

### Build outputs

This checkout uses the Release 5 application and includes the [later hosted packaging changes](https://github.com/cosmicdance-4-2-0/Auralprint1/pull/106).

- **Portable.** `dist/auralprint_0.1.16.html` embeds JavaScript, CSS, and the favicon. The filename comes from [version](version). The archived Release 5 HTML is linked above.
- **Hosted.** `dist/hosted/` contains the complete package for the official site root. The build uses [hosted-site.json](src/assets/branding/hosted-site.json) for the canonical URL, manifest launch URL and scope, and social preview metadata. Assets ship with the package. The hosted edition has no service worker or offline cache.

`npm run watch` watches JavaScript, CSS, the HTML template, `version`, and branding assets. For future releases, replace the version-specific preview image and update `image` and `image_alt` in the branding configuration. The build generates the page metadata.

See [AGENTS.md](AGENTS.md) for architecture and change rules, [ROADMAP.md](ROADMAP.md) for planned work, and the [Build 115](docs/development/build-115.md) and [Build 116](docs/development/build-116.md) worklogs for engineering history.

<a id="build-115--v0115-visualizer-architecture--orb-overhaul-v1"></a>
<a id="build-113--v0113-release-3--shipped---canonical-recording--capture"></a>

## Canonical release history

| Public release | Build / version | Accepted artifact | Changes |
| --- | --- | --- | --- |
| 1 | 110 / `v0.1.10` | [HTML](docs/Canon/0.1.10/index.html) | Legacy baseline |
| 2 | 111 / `v0.1.11` | [HTML](docs/Canon/0.1.11/index.html) | [Changelog](docs/Canon/changelog.md#v110--v111) |
| 3 | 113 / `v0.1.13` | [HTML](docs/Canon/0.1.13/auralprint_0.1.13.html) | [Changelog](docs/Canon/changelog.md#v112--v113) |
| 4 | 115 / `v0.1.15` | [HTML](docs/Canon/0.1.15/auralprint_0.1.15.html) | [Changelog](docs/Canon/changelog.md#v114--v115-release-4--build-115) |
| 5 (current) | 116 / `v0.1.16` | [HTML](docs/Canon/0.1.16/auralprint_0.1.16.html) | [Changelog](docs/Canon/changelog.md#v115--v116-release-5--build-116) |

Builds [112](docs/Canon/changelog.md#v111--v112) and [114](docs/Canon/changelog.md#v113--v114) were internal. Release 4 includes the Build 114 Mic and Stream work. See the [public Release 4 comparison](docs/development/build-115-release-delta.md).

For `v0.1.xx`, the build number is `100 + xx`. Letter suffixes identify development revisions. A public release may skip internal builds. Shipped artifacts and published preset contracts are immutable. See the [schema rules](AGENTS.md#21-schema-discipline).
