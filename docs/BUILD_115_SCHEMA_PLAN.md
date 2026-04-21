# Build 115 — Schema Plan and Migration

## Overview

Build 115 introduces a major reorganisation of Auralprint’s visual system. The addition of a **scene model** and unified visualizer framework changes how persisted presets store visual configuration. To maintain backward compatibility with earlier versions of Auralprint, this build defines **Schema 9** and migration logic from Schema 8 (and older) to Schema 9. 

Schema 9 is backward compatible: presets saved with earlier versions can still be loaded and will be migrated to the new format at runtime. Schema 9 remains forward compatible with the new visualizer architecture; future builds (e.g. 116) will build on this without breaking it.

## Schema Versioning

The application version displayed to users (e.g. `v0.1.15`) is distinct from the internal **schema version**. Schema version numbers track changes to the persisted preset format. As of Build 114, the current schema version is **8**. Build 115 upgrades the schema to **9**.

All presets should include a `schema` field in their JSON representation. When a preset without a schema is encountered, the loader assumes schema 1 and migrates progressively through each version until the current version. 

## Key Changes in Schema 9

Schema 9 introduces the concept of a **scene** as a top‑level entity containing visualizer nodes. This replaces the previous implicit assumption that the render surface always contained a fixed orb system with optional overlays. Important changes:

1. **`orbs` becomes a visualizer type.** The orb configuration fields previously stored at the root level of the preset are now stored within a `scene` section. Each orb set is represented as a `SceneNode` with the `type` field set to `"orbs"` and a `settings` object containing orb parameters.
2. **Overlay becomes a visualizer type.** The old overlay configuration fields are likewise moved into the `scene`. Overlays become nodes with `type` set to `"bandOverlay"`.
3. **`scene` array.** A new `scene` array is introduced, containing an ordered list of node specifications (`SceneNode` objects). Each node has `type`, `bounds`, `anchor`, and `settings` fields. See the Scene model document for details.
4. **Removed obsolete orb fields.** Fields such as `useStereo`, `phaseResetPolicy`, `mono`, etc. that were previously bound to the orb system become part of the `orbs` visualizer settings. Those fields no longer live at the top level.
5. **Band configuration unchanged.** The band‑bank configuration (band count, ceiling, distribution, color source) remains at the top level but is consumed by both visualizers and the inspector. Banking remains its own top‑level section.
6. **No persistence for runtime scene state.** Scene **nodes** and their settings are persisted. The runtime state of the scene (e.g. which nodes are currently enabled or their z‑ordering) should be persisted because it is user‑authored configuration. Transient state (e.g. whether a node is currently selected) remains runtime‑only.

## Migrating from Schema 8 to Schema 9

### Old Location of Orb and Overlay Settings

In Schema 8 and earlier, orb and overlay settings lived as top‑level keys such as:

```json
{
  "orbs": { ... },
  "overlay": { ... },
  "... other fields ..."
}
```

### New Location in Schema 9

Schema 9 introduces:

```json
{
  "scene": [
    {
      "id": "orbs-1",
      "type": "orbs",
      "bounds": { "x": 0.0, "y": 0.0, "w": 1.0, "h": 1.0 },
      "anchor": { "x": 0.5, "y": 0.5 },
      "settings": { /* orb settings previously in the `orbs` field */ }
    },
    {
      "id": "overlay-1",
      "type": "bandOverlay",
      "bounds": { "x": 0.0, "y": 0.0, "w": 1.0, "h": 1.0 },
      "anchor": { "x": 0.5, "y": 0.5 },
      "settings": { /* overlay settings previously in the `overlay` field */ }
    }
  ],
  "... other fields ..."
}
```

### Migration Algorithm

To migrate a preset from Schema 8 (or earlier) to Schema 9:

1. **Copy unchanged fields.** Start with canonical defaults for Schema 9 and overlay the existing preset fields that are still valid (e.g. `bands`, `colors`, `queue` settings if present).
2. **Create scene array.** Initialize an empty `scene` array.
3. **Migrate orbs.** If the old preset has an `orbs` key:
   * Create a new `SceneNode` with `type` = `"orbs"`, `id` = `"orbs-1"`.
   * Set `bounds` to the full surface `{ x: 0.0, y: 0.0, w: 1.0, h: 1.0 }` and `anchor` to `{ x: 0.5, y: 0.5 }`.
   * Copy all fields from the old `orbs` object into `settings`.
   * Remove the old `orbs` field from the preset.
   * Append the node to the `scene` array.
4. **Migrate overlay.** If the old preset has an `overlay` key:
   * Create a new `SceneNode` with `type` = `"bandOverlay"`, `id` = `"overlay-1"`.
   * Set `bounds` and `anchor` as above.
   * Copy the old overlay settings into `settings`.
   * Remove the old `overlay` field.
   * Append the node to the `scene` array.
5. **Ensure at least one node.** If no `orbs` or `overlay` fields existed, create the default `SceneNode`s as described in the scene model document.
6. **Set `schema` to 9.** After migration, set the `schema` field on the preset to `9`.

### Migrating earlier versions (≤ Schema 7)

Presets from versions earlier than Schema 8 will first be migrated to Schema 8 via existing migration logic (e.g. migrating `bands.logSpacing` to `bands.distributionMode`). After the Schema 8 migration, apply the steps above to reach Schema 9.

## Non‑Goals and Future Work

* **Camera settings.** Schema 9 does not include camera settings. Build 116 will introduce camera controls; any camera settings will be added in a future schema (likely Schema 10). For now, the `view` field of the scene remains runtime‑only.
* **Per‑node position persistence.** Scene node positions (`bounds`, `anchor`) are persisted, but interactive manipulation (dragging/resizing) will be introduced gradually. Build 115 will set up the storage; later builds may add UI for interactive adjustment.
* **Third‑party visualizers.** Schema 9 does not provide a plugin system for third‑party visualizers. Visualizer types remain built‑in. However, the scene model and visualizer registry prepare the codebase for future extensibility.

Schema 9 ensures that presets remain compatible across the Orb overhaul and beyond. Developers should implement migration logic carefully and test with a representative set of old presets.