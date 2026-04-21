# Build 115 Workspace Shell

This document specifies the user‑interface shell for **Build 115**.  The workspace shell is the skeleton that holds together panels, the bottom launcher bar and the central render surface.  Its job is to provide an intuitive, uncluttered environment where users can control the analyser, banking, scene composition, audio sources, recording and presets without ever losing sight of the visuals.

## Panel taxonomy

Build 115 introduces a new set of panels, each with a clear purpose:

| Panel           | Responsibilities                                                         |
|-----------------|----------------------------------------------------------------------------|
| **Audio Source** | Load files, manage the queue, select Mic/Stream input, control playback, mute and volume.  Live source status and transport controls live here. |
| **Analysis**     | Controls for the analyser core: FFT size, smoothing, RMS gain and any other knobs that affect how raw audio is analysed. |
| **Banking**      | Controls for band distribution (linear, log, mel, Bark, ERB), number of bands, floor/ceiling and dominant‑band behaviour.  Colour policy and band lore also live here.  The full live band table is hidden by default; users can reveal it via an “inspect bands” toggle. |
| **Scene**        | Compose the visual scene.  This panel lists active visualisers, allows enabling/disabling them, ordering them, selecting a visualiser to edit its settings, and (in the future) adjusting placement.  The panel name emphasises that users are building a scene from multiple visualisers. |
| **Recording**    | Start and stop recording sessions, set FPS and audio inclusion, view elapsed time and download captured sessions.  Recording state is independent of the current source/scene. |
| **Workspace / Presets** | Import, export and share presets.  Configure system‑wide settings that do not belong elsewhere, such as default canvas size or theme. |
| **Status / Log** | A console for runtime events: permission results, source switching, recording lifecycle, migration warnings and errors.  Users can clear or hide the log when it is not needed. |

## Bottom launcher bar

Instead of scattering launcher buttons across the screen, Build 115 introduces a single launcher bar docked to the bottom edge of the viewport.  Key behaviours:

- **Collapsed state** – The bar can collapse into a minimal strip showing only a chevron.  This state maximises screen real estate for the render surface.  Clicking the chevron expands the bar.
- **Icons** – Each panel has a corresponding icon in the bar.  Clicking an icon toggles that panel’s visibility.  An active panel’s icon appears highlighted.
- **Badges and pulses** – Icons can display state indicators, such as a red dot for new log entries or a pulsing circle when recording is active.  These cues keep users informed without requiring panels to be open.
- **Ordering** – The default order is: Audio Source, Analysis, Banking, Scene, Recording, Workspace/Presets and Status/Log.  This order reflects the typical workflow from input to output.

## Panel behaviour

Panels overlay the render surface rather than shifting it.  Each panel may be resized or moved only if future milestones add that capability; Build 115 focuses on placement and visibility.

- **Open/close** – Clicking an icon toggles the panel.  Only one instance of each panel exists.  Panels maintain their internal scroll position and state while hidden.
- **Multiple panels** – Multiple panels can be open simultaneously.  Users can compare settings across panels.  The panel management state is stored in `panel-state.js` and is runtime‑only.
- **Default state** – When the application loads without a preset, Audio Source is open by default.  Analysis and Banking are also visible to encourage exploration.  Scene, Recording, Workspace/Presets and Status/Log start collapsed.
- **Responsive layout** – On narrow screens, panels may dock in a side drawer or stack vertically.  The bottom launcher bar remains accessible.

## Status/Log console

The Status/Log panel doubles as a debug console and a user‑facing event feed.  It prints:

- Permission successes and failures (e.g. microphone allowed or denied)
- Source switching events and any errors encountered
- Recording start/stop notifications and export results
- Migration notices when older presets are loaded and migrated to newer schemas
- Warnings or errors emitted by visualisers or inspectors

By centralising runtime messages in one panel, Build 115 eliminates the need to rely on browser developer tools for feedback.  The log persists only for the current session and is not included in presets.

## Future expansion

Build 115 lays the foundation for camera and view transforms but does not expose them.  The **Scene** panel will later gain controls for moving and resizing visualisers, and Build 116 will introduce a **Camera** panel or sub‑panel for pan/zoom/rotate.  Hooks for these features will be added in the code but kept hidden in the UI until their milestone arrives.
