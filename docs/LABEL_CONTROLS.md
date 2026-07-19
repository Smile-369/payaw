# Label Controls

PAYAW separates map geometry, semantic names, and visual labels.

- **Roads / Blocks layers** control the underlying geometry.
- **Street labels / Block labels layers** control whether names are drawn.
- The naming editor changes the stored name.
- Label controls change only how that name is displayed.

## Street labels

| Control | Effect |
|---|---|
| Font size | Constant screen-space text size from 4–16 px |
| Opacity | Label transparency |
| Density | Deterministic percentage of eligible roads to label |
| Main / Secondary / Local | Independently include each road class |
| Minimum zoom | Separate visibility threshold for each road class |
| Follow road | Rotates text to the local road direction while keeping it readable |
| Text outline | Adds a dark outline for contrast |

Density uses a stable integer hash of each road ID. A road selected at 50% remains selected after panning, zooming, and reloading the same world.

## Block labels

Block controls include font size, opacity, deterministic density, minimum zoom, and text outline.

## Collision avoidance

When enabled, street labels are placed first in road-class priority order:

1. Main roads
2. Secondary roads
3. Local roads
4. Block labels

Each accepted label reserves an approximate world-space bounding box. Later labels that overlap are skipped. This keeps dense urban maps readable without changing generated roads, blocks, or names.

## Persistence and export

Label preferences use the browser key:

```text
payaw.label-display.v1
```

They apply across generated worlds and are exported under:

```json
{
  "customization": {
    "labelDisplay": {
      "road": {},
      "block": {},
      "avoidCollisions": true
    }
  }
}
```

The Reset button restores the engine defaults without modifying custom road or block names.
