/**
 * Normalized, framework-free representation of a notate document.
 *
 * This is the in-memory model that {@link readNotate} produces and
 * {@link writeNotate} consumes. It is intentionally decoupled from both the
 * on-disk protobuf shapes and from Excalidraw, so the converter package can map
 * to/from it without depending on the wire format.
 *
 * Field semantics mirror notate's Kotlin source (`SerializationModels.kt`).
 * Coordinates are in world units (px). Colors are Android ARGB ints
 * (`0xAARRGGBB`) exactly as stored on disk.
 */
/** notate stroke styles. The numeric value is the on-disk enum ordinal. */
export var StrokeType;
(function (StrokeType) {
    StrokeType[StrokeType["FOUNTAIN"] = 0] = "FOUNTAIN";
    StrokeType[StrokeType["BALLPOINT"] = 1] = "BALLPOINT";
    StrokeType[StrokeType["FINELINER"] = 2] = "FINELINER";
    StrokeType[StrokeType["HIGHLIGHTER"] = 3] = "HIGHLIGHTER";
    StrokeType[StrokeType["BRUSH"] = 4] = "BRUSH";
    StrokeType[StrokeType["CHARCOAL"] = 5] = "CHARCOAL";
    StrokeType[StrokeType["DASH"] = 6] = "DASH";
})(StrokeType || (StrokeType = {}));
/** notate link target kinds. Numeric value is the on-disk enum ordinal. */
export var LinkType;
(function (LinkType) {
    LinkType[LinkType["INTERNAL_NOTE"] = 0] = "INTERNAL_NOTE";
    LinkType[LinkType["EXTERNAL_URL"] = 1] = "EXTERNAL_URL";
    LinkType[LinkType["LOCAL_FILE"] = 2] = "LOCAL_FILE";
})(LinkType || (LinkType = {}));
export const DEFAULT_REGION_SIZE = 4096;
export function defaultMeta() {
    return {
        version: 3,
        offsetX: 0,
        offsetY: 0,
        zoomLevel: 1,
        canvasType: 0,
        pageWidth: 0,
        pageHeight: 0,
        regionSize: DEFAULT_REGION_SIZE,
        nextStrokeOrder: 0,
    };
}
/** Axis-aligned bounds of an item in world units, used to build `index.bin`. */
export function itemBounds(item) {
    if (item.kind === 'stroke') {
        let left = Infinity;
        let top = Infinity;
        let right = -Infinity;
        let bottom = -Infinity;
        for (const p of item.points) {
            if (p.x < left)
                left = p.x;
            if (p.y < top)
                top = p.y;
            if (p.x > right)
                right = p.x;
            if (p.y > bottom)
                bottom = p.y;
        }
        if (!isFinite(left))
            return { left: 0, top: 0, right: 0, bottom: 0 };
        return { left, top, right, bottom };
    }
    return {
        left: item.x,
        top: item.y,
        right: item.x + item.width,
        bottom: item.y + item.height,
    };
}
/** Center of an item, used to assign it to a region bucket. */
export function itemCenter(item) {
    const b = itemBounds(item);
    return { cx: (b.left + b.right) / 2, cy: (b.top + b.bottom) / 2 };
}
//# sourceMappingURL=model.js.map