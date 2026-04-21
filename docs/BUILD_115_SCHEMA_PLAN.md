# Build 115 Schema Plan And Migration

## Overview

Build 115 reorganizes Auralprint's visual system around a formal `Scene` model
and a unified `Visualizer` framework. To preserve backward compatibility, Build
115 defines Schema 9 and the migration path from Schema 8 and earlier presets.

Schema 9 keeps older presets loadable while aligning persisted visual
configuration with the new architecture vocabulary.

## Schema Versioning

The user-facing app version is separate from the preset schema version. As of
Build 114, the current schema version is 8. Build 115 upgrades the persisted
preset schema to 9.

All presets should include a `schema` field. If a preset omits it, the loader
assumes schema 1 and migrates forward step by step until the current schema.

## Key Changes In Schema 9

1. **`orbs` becomes a visualizer type** - Orb configuration moves under scene
   configuration as a `SceneNode` with `type: "orbs"`.
2. **Band overlay becomes a visualizer type** - Overlay configuration becomes a
   `SceneNode` with `type: "bandOverlay"`.
3. **`scene` becomes a top-level scene object** - Presets persist a `scene`
   object that contains a `nodes` array of `SceneNode` data. This keeps the
   canonical `Scene` concept intact instead of reducing it to a raw array.
4. **Legacy visual fields move under node settings** - Orb and overlay fields
   that previously lived at the preset root move into `scene.nodes[].settings`.
5. **Band configuration remains top-level** - Banking configuration stays
   outside the scene and is shared by visualizers and inspectors.
6. **Persist configuration, not live runtime state** - Presets persist scene
   configuration such as node order, enabled state, bounds, anchor, and
   settings. Runtime-only state such as selected node UI, live visualizer
   instances, and the active `ViewTransform` is not persisted.

## Old Location Of Orb And Overlay Settings

In Schema 8 and earlier, orb and overlay settings lived at the preset root:

```json
{
  "orbs": { "...": "..." },
  "overlay": { "...": "..." }
}
```

## New Location In Schema 9

In Schema 9, those settings move under the top-level `scene` object:

```json
{
  "scene": {
    "nodes": [
      {
        "id": "orbs-1",
        "type": "orbs",
        "enabled": true,
        "zIndex": 0,
        "bounds": { "x": 0.0, "y": 0.0, "w": 1.0, "h": 1.0 },
        "anchor": { "x": 0.5, "y": 0.5 },
        "settings": { "...": "legacy orb settings" }
      },
      {
        "id": "overlay-1",
        "type": "bandOverlay",
        "enabled": true,
        "zIndex": 1,
        "bounds": { "x": 0.0, "y": 0.0, "w": 1.0, "h": 1.0 },
        "anchor": { "x": 0.5, "y": 0.5 },
        "settings": { "...": "legacy overlay settings" }
      }
    ]
  }
}
```

## Migrating From Schema 8 To Schema 9

1. **Copy unchanged fields** - Start from canonical Schema 9 defaults, then
   overlay valid non-visual fields from the incoming preset.
2. **Ensure `scene` exists** - Create a top-level `scene` object with a `nodes`
   array if one is missing.
3. **Migrate orbs** - If the old preset contains `orbs`, create a `SceneNode`
   with `type: "orbs"`, full-surface bounds, centered anchor, `enabled: true`,
   default orb ordering, and the old orb settings moved into `settings`.
4. **Migrate overlay** - If the old preset contains `overlay`, create a
   `SceneNode` with `type: "bandOverlay"`, full-surface bounds, centered
   anchor, `enabled: true`, default overlay ordering, and the old overlay
   settings moved into `settings`.
5. **Ensure a default scene** - If neither `orbs` nor `overlay` existed, create
   the canonical default scene described in the scene model document.
6. **Remove legacy root fields** - Remove the old root-level `orbs` and
   `overlay` fields after they have been migrated.
7. **Set `schema` to 9** - Mark the migrated preset with the new schema value.

### Migrating Earlier Versions

Presets older than Schema 8 should first pass through the existing migration
path into Schema 8, then apply the Schema 9 steps above.

## Non-Goals And Future Work

- **Camera settings** - Schema 9 does not persist `ViewTransform`. Camera data
  is deferred to a future schema once Build 116 defines it.
- **Scene manipulation UX** - Schema 9 persists scene layout data, but the UI
  for interactive node movement and resizing remains a later phase.
- **Third-party visualizers** - Schema 9 does not introduce plugin-defined
  visualizer types.

Schema 9 preserves preset compatibility while aligning persisted visual
configuration with the Build 115 scene model.
