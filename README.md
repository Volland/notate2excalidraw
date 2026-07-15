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
packages/notate-ui/           # shared React renderer: Excalidraw glue, dialogs, actions hook
apps/desktop/                 # Electron app (macOS / Windows / Linux)
apps/mobile/                  # Capacitor app (Android) — same renderer in a WebView
```

The desktop and mobile apps share all rendering and conversion logic via
`@notate/ui`; only the shell differs (native menu + dialogs on desktop, an
on-screen toolbar + file picker / share sheet on Android).

## Develop

```bash
npm install          # install all workspaces
npm test             # run codec + converter unit tests
npm run build        # build the two library packages (codec + converter)
npm run dev          # launch the Electron app (electron-vite dev)
```

A ready-to-open sample note lives at [`samples/hello.notate`](samples/hello.notate)
(File → Open it once the app is running).

## Package installers (desktop)

```bash
npm run dist:mac     # -> apps/desktop/release/*.dmg  (x64 + arm64)
npm run dist:win     # -> NSIS installer
npm run dist:linux   # -> AppImage
```

## Android (Capacitor)

Requires the Android SDK (platform 34, build-tools 34) and a JDK 17.

```bash
cd apps/mobile
npm run build              # build web assets into dist/
npx cap sync android       # copy assets + plugins into the native project
npm run cap:open           # open in Android Studio (Run ▶ to a device/emulator)

# …or build a debug APK from the CLI:
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
cd android && ./gradlew assembleDebug
# APK -> apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

`npm run android:apk` (in `apps/mobile`) chains build → sync → assembleDebug.

### Signed release installer

A release keystore + signing config is wired up in `apps/mobile/android`
(`keystore.properties` + `app/build.gradle`; both the keystore and properties are
git-ignored — replace them with your own for a real release):

```bash
cd apps/mobile
npm run build && npx cap sync android
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
cd android && ./gradlew assembleRelease
# Signed installer -> apps/mobile/android/app/build/outputs/apk/release/app-release.apk
adb install -r app/build/outputs/apk/release/app-release.apk
```

To generate your own keystore:

```bash
keytool -genkeypair -v -keystore apps/mobile/android/app/notate-release.keystore \
  -alias notate -keyalg RSA -keysize 2048 -validity 10000
```

For a Play Store upload bundle, use `./gradlew bundleRelease` (produces an `.aab`).

On Android: **Open** uses the system file picker, **Save / Export** writes to the
app's Documents folder and opens a share sheet so you can place the file anywhere.

## Status & limitations

- The codec is validated by round-trip unit tests. **Validation against a genuine
  device-exported `.notate` file is still recommended** — the one thing that needs a
  real sample is confirming Kotlin's protobuf packed-array encoding matches byte-for-byte
  (the decoder already accepts both packed and unpacked repeated fields).
- Background pattern (dots/grid/lines), tags and toolbar layout are not round-tripped;
  the manifest is written minimally and notate fills the rest from defaults.
- Mermaid shapes become hand-drawn-looking strokes by design (notate has no vector
  primitives). For a crisp diagram instead, export to Excalidraw/PNG/SVG.
