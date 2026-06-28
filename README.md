# Notate ⇄ Excalidraw

A cross-platform desktop app (macOS / Windows / Linux) to **view, convert and edit**
[`notate`](https://github.com/alexdremov/notate) handwriting notes — the e-ink note
format from Onyx Boox devices — using [Excalidraw](https://excalidraw.com) as the
editing surface.

## Features

- **View `.notate` files** anywhere (not just on an Onyx device). Double-click a
  `.notate` file or use **File → Open**.
- **Edit** strokes, text and images and **save back to `.notate`** (works on macOS
  and everywhere else).
- **Convert notate → Excalidraw** (`File → Export → Excalidraw`), plus PNG and SVG.
- **Convert Mermaid → notate** (`File → Import Mermaid`): Mermaid diagrams are added
  as Excalidraw shapes; saving as `.notate` rasterizes shapes into pen strokes so the
  result is a native, editable notate note.

## How it works

Excalidraw is the hub. A framework-free codec reads/writes the notate on-disk format,
and a converter maps between the notate model and Excalidraw scenes:

```
.notate (ZIP+protobuf) ──readNotate──▶ NotateDoc ──notateToScene──▶ Excalidraw
        ▲                                  ▲                              │
        └──writeNotate── NotateDoc ◀──sceneToNotate── Excalidraw ◀────────┘
                                              ▲
   mermaid text ──@excalidraw/mermaid-to-excalidraw──▶ shapes ──rasterize──┘
```

### The notate format (reverse-engineered)

A `.notate` file is a **ZIP** archive containing:

| Entry | Content |
|---|---|
| `manifest.bin` | protobuf `CanvasData` (version, viewport, region size, uuid, …) |
| `index.bin` | protobuf list of per-region bounding boxes |
| `r_<X>_<Y>.bin` | protobuf `RegionProto` per 4096-unit region (strokes/images/text/links) |
| `images/*`, `assets/*` | embedded blobs |
| `thumbnails/*` | per-region PNG thumbnails (optional) |

Strokes store packed `[x, y, pressure, size, tiltX, tiltY]` floats; colors are Android
ARGB ints. See `packages/notate-codec/src/proto.ts` for the exact field numbers (mirrored
from notate's `SerializationModels.kt`).

> notate has no native vector shapes — only pen strokes, text and images. That's why
> Mermaid/Excalidraw rectangles, ellipses and arrows are **rasterized into stroke
> polylines** when converting *to* notate.

## Repository layout

```
packages/notate-codec/        # .notate ZIP+protobuf read/write (framework-free)
packages/notate-excalidraw/   # notate <-> Excalidraw mapping + mermaid + rasterizer
apps/desktop/                 # Electron + React + @excalidraw/excalidraw app
```

## Develop

```bash
npm install          # install all workspaces
npm test             # run codec + converter unit tests
npm run build        # build the two library packages (codec + converter)
npm run dev          # launch the Electron app (electron-vite dev)
```

A ready-to-open sample note lives at [`samples/hello.notate`](samples/hello.notate)
(File → Open it once the app is running).

## Package installers

```bash
npm run dist:mac     # -> apps/desktop/release/*.dmg  (x64 + arm64)
npm run dist:win     # -> NSIS installer
npm run dist:linux   # -> AppImage
```

## Status & limitations

- The codec is validated by round-trip unit tests. **Validation against a genuine
  device-exported `.notate` file is still recommended** — the one thing that needs a
  real sample is confirming Kotlin's protobuf packed-array encoding matches byte-for-byte
  (the decoder already accepts both packed and unpacked repeated fields).
- Background pattern (dots/grid/lines), tags and toolbar layout are not round-tripped;
  the manifest is written minimally and notate fills the rest from defaults.
- Mermaid shapes become hand-drawn-looking strokes by design (notate has no vector
  primitives). For a crisp diagram instead, export to Excalidraw/PNG/SVG.
