# Build 115 Frame Contracts

This document defines the **data contracts** used between Auralprint’s analysis layer and its presentation layers.  By standardising these structures, visualisers and inspectors can be written against stable, high‑level interfaces instead of pulling data directly from Web Audio or the band bank.  These contracts reduce coupling and make the system more testable.

## AnalysisFrame

`AnalysisFrame` represents the raw analyser state for one animation tick.  It is produced by the analyser core and consumed by the band bank and (optionally) by certain visualisers that require channel‑level information.

| Field             | Type                        | Description                                                               |
|-------------------|-----------------------------|---------------------------------------------------------------------------|
| `timestamp`       | number                      | High‑resolution time stamp (milliseconds since start of session).         |
| `sampleRate`      | number                      | Sample rate of the current audio context.                                 |
| `fftSize`         | number                      | FFT size used for this frame.                                             |
| `channels`        | array of ChannelData        | Per‑channel analysis results (see below).                                 |
| `rms`             | array of number             | Root‑mean‑square value per channel.                                       |
| `peak`            | array of number             | Peak amplitude per channel.                                               |
| `globalMax`       | number                      | Maximum absolute sample value across all channels (used for normalisation).|

### ChannelData

Each entry in the `channels` array is an object with:

- `magnitudes` – a `Float32Array` of length `fftSize / 2` containing magnitudes for each bin.
- `phase` – a `Float32Array` of the same length containing phase angles (optional for most visualisers).

Visualisers should not assume stereo; they should iterate channels instead.  Mono signals will yield a single entry.

## BandFrame

`BandFrame` enriches an `AnalysisFrame` with psychoacoustic band information.  It is produced by the band bank from an `AnalysisFrame` and band settings.  Visualisers and inspectors that care about band energies consume this structure.

| Field               | Type               | Description                                                             |
|---------------------|--------------------|-------------------------------------------------------------------------|
| `analysis`          | AnalysisFrame      | The raw frame that was used to compute the bands.                       |
| `bands`             | array of BandInfo  | Ordered list of band definitions and current energies (see below).      |
| `dominantBandIndex` | number             | Index of the band with the highest energy, or `-1` if undefined.        |
| `dominantBand`      | BandInfo \| null   | Convenience copy of the dominant band object, or `null`.                |
| `distribution`      | string             | Name of the current distribution mode (`linear`, `log`, `mel`, etc.).    |
| `rms`               | array of number    | RMS values reused from the underlying `AnalysisFrame`.                  |
| `maxEnergy`         | number             | The largest band energy value in this frame.                             |
| `minEnergy`         | number             | The smallest band energy value in this frame.                            |

### BandInfo

Each `BandInfo` object has:

- `index` – integer index in the bands array.
- `name` – human‑friendly band name (e.g. “Sub‑Bass”, “Midrange”).  Names come from the distribution mode’s band naming policy.
- `startHz`, `endHz` – frequency bounds for the band.
- `binStart`, `binEnd` – indexes into the FFT bin array.
- `energy` – normalised energy in this band (0 to 1 range, based on `maxEnergy`).
- `peak` – absolute peak energy in this band (optional).  Useful for future features like per‑band thresholding.

## Usage guidelines

1. **Immutability** – `AnalysisFrame` and `BandFrame` are treated as immutable once created.  Visualisers must never mutate them; they should treat them as read‑only snapshots.
2. **No hidden references** – Do not store references to Web Audio nodes inside these structures.  All consumers should be able to operate on plain data.
3. **Graceful degradation** – Visualisers must handle the absence of optional fields gracefully (e.g. if `phase` or `peak` is `undefined`).
4. **Serialization** – These contracts are not intended for long‑term storage; presets will serialise user settings rather than frame data.  Frames exist only at runtime.

By standardising on these contracts, Build 115 opens the door to pluggable visualisers and inspectors that require no knowledge of how the analyser works internally.
