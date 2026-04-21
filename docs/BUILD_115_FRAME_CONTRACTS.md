# Build 115 Frame Contracts

This document defines the data contracts used between Auralprint's analysis
layer and its presentation layers. By standardizing these structures,
`Visualizer`s and `Inspector`s can be written against stable interfaces instead
of pulling data directly from Web Audio or banking internals.

## Contract Flow

Build 115 uses this frame flow:

1. `AnalyzerCore` produces `AnalysisFrame`.
2. `BandBank` derives `BandFrame` from `AnalysisFrame`.
3. `Visualizer.update(frame, dt)` receives `BandFrame` and may read the
   underlying `AnalysisFrame` through `frame.analysis`.
4. `Inspector.update(frame)` receives `BandFrame`.

Neither contract reads directly from Web Audio nodes.

Build 115 defines these contracts before a dedicated `frame.js` module exists.
The current runtime still exposes equivalent analysis and band data through
legacy runtime structures.

## AnalysisFrame

`AnalysisFrame` is the immutable per-tick snapshot produced by `AnalyzerCore`.
It represents the raw analyzer state for one animation tick and is consumed by
`BandBank` and, when needed, by advanced visualizers.

| Field       | Type                 | Description |
|-------------|----------------------|-------------|
| `timestamp` | number               | High-resolution timestamp in milliseconds since session start. |
| `sampleRate`| number               | Sample rate of the active audio context. |
| `fftSize`   | number               | FFT size used for this frame. |
| `channels`  | array of ChannelData | Per-channel analysis results. |
| `rms`       | array of number      | Root-mean-square value per channel. |
| `peak`      | array of number      | Peak amplitude per channel. |
| `globalMax` | number               | Maximum absolute sample value across all channels. |

### ChannelData

Each entry in `channels` contains:

- `magnitudes` - `Float32Array` of length `fftSize / 2` containing magnitudes
  for each FFT bin.
- `phase` - `Float32Array` of the same length containing phase angles. This is
  optional for most visualizers.

Visualizers should not assume stereo. They should iterate available channels.
Mono signals yield a single entry.

## BandFrame

`BandFrame` is the immutable band-oriented snapshot produced by `BandBank` from
an `AnalysisFrame` plus current banking settings. Visualizers and Inspectors
consume this structure.

| Field               | Type              | Description |
|---------------------|-------------------|-------------|
| `analysis`          | AnalysisFrame     | The underlying raw frame used to compute the bands. |
| `bands`             | array of BandInfo | Ordered list of band definitions and current energies. |
| `dominantBandIndex` | number            | Index of the band with the highest energy, or `-1` if undefined. |
| `dominantBand`      | BandInfo \| null  | Convenience copy of the dominant band object, or `null`. |
| `distribution`      | string            | Current distribution mode such as `linear`, `log`, `mel`, `bark`, or `erb`. |
| `rms`               | array of number   | RMS values reused from the underlying `AnalysisFrame`. |
| `maxEnergy`         | number            | Largest band energy value in this frame. |
| `minEnergy`         | number            | Smallest band energy value in this frame. |

### BandInfo

Each `BandInfo` object contains:

- `index` - Integer index in the `bands` array.
- `name` - Human-friendly band name such as `Sub-Bass` or `Midrange`.
- `startHz`, `endHz` - Frequency bounds for the band.
- `binStart`, `binEnd` - Indexes into the FFT bin array.
- `energy` - Normalized band energy in the `0..1` range.
- `peak` - Optional peak energy for the band.

## Usage Guidelines

1. **Immutability** - `AnalysisFrame` and `BandFrame` are read-only snapshots.
   Visualizers and Inspectors must never mutate them.
2. **No hidden references** - Do not store Web Audio nodes inside these
   structures. Consumers operate on plain data contracts.
3. **Shared flow** - `Inspector.update(frame)` and `Visualizer.update(frame, dt)`
   both consume `BandFrame`; any analysis-level detail needed by those
   consumers is read through `frame.analysis`.
4. **Graceful degradation** - Consumers must handle optional fields such as
   `phase` or `peak` being absent.
5. **Runtime only** - Frame data is never persisted to presets. Presets store
   configuration, not transient analysis output.

By standardizing on these contracts, Build 115 keeps presentation modules
decoupled from analyzer internals and makes the scene/inspector split explicit.
