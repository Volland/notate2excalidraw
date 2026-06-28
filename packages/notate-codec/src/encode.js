/** Write a {@link NotateDoc} to a `.notate` file (ZIP + protobuf). */
import { zipSync } from 'fflate';
import { CanvasData, RegionBoundsProto, RegionIndex, RegionProto, } from './proto.js';
import { itemBounds, itemCenter, } from './model.js';
const PACKED_STRIDE = 6;
function regionKey(id) {
    return `${id.x}_${id.y}`;
}
function strokeToProto(s) {
    const n = s.points.length;
    const packed = new Array(n * PACKED_STRIDE);
    const times = new Array(n);
    for (let i = 0; i < n; i++) {
        const p = s.points[i];
        const b = i * PACKED_STRIDE;
        packed[b] = p.x;
        packed[b + 1] = p.y;
        packed[b + 2] = p.pressure;
        packed[b + 3] = p.size;
        packed[b + 4] = p.tiltX;
        packed[b + 5] = p.tiltY;
        times[i] = p.timestamp;
    }
    return {
        pointsPacked: packed,
        timestampsPacked: times,
        color: s.color,
        width: s.width,
        style: s.style,
        strokeOrder: s.strokeOrder,
        zIndex: s.zIndex,
    };
}
function textToProto(t) {
    return {
        text: t.text,
        x: t.x,
        y: t.y,
        width: t.width,
        height: t.height,
        fontSize: t.fontSize,
        color: t.color,
        zIndex: t.zIndex,
        order: t.order,
        rotation: t.rotation,
        opacity: t.opacity,
        alignment: t.alignment,
        backgroundColor: t.backgroundColor,
    };
}
function imageToProto(im) {
    return {
        uri: im.uri,
        x: im.x,
        y: im.y,
        width: im.width,
        height: im.height,
        zIndex: im.zIndex,
        order: im.order,
        rotation: im.rotation,
        opacity: im.opacity,
    };
}
function linkToProto(l) {
    return {
        label: l.label,
        target: l.target,
        x: l.x,
        y: l.y,
        width: l.width,
        height: l.height,
        zIndex: l.zIndex,
        order: l.order,
        color: l.color,
        rotation: l.rotation,
        type: l.type,
        fontSize: l.fontSize,
    };
}
function newBucket(id) {
    return {
        id,
        strokes: [],
        images: [],
        texts: [],
        links: [],
        left: Infinity,
        top: Infinity,
        right: -Infinity,
        bottom: -Infinity,
    };
}
function growBounds(bucket, item) {
    const b = itemBounds(item);
    if (b.left < bucket.left)
        bucket.left = b.left;
    if (b.top < bucket.top)
        bucket.top = b.top;
    if (b.right > bucket.right)
        bucket.right = b.right;
    if (b.bottom > bucket.bottom)
        bucket.bottom = b.bottom;
}
/** Serialize a {@link NotateDoc} to ZIP bytes readable by the notate app. */
export function writeNotate(doc) {
    const regionSize = doc.meta.regionSize || 4096;
    const buckets = new Map();
    const bucketFor = (item) => {
        const { cx, cy } = itemCenter(item);
        const id = {
            x: Math.floor(cx / regionSize),
            y: Math.floor(cy / regionSize),
        };
        const key = regionKey(id);
        let bucket = buckets.get(key);
        if (!bucket) {
            bucket = newBucket(id);
            buckets.set(key, bucket);
        }
        return bucket;
    };
    for (const item of doc.items) {
        const bucket = bucketFor(item);
        growBounds(bucket, item);
        switch (item.kind) {
            case 'stroke':
                bucket.strokes.push(strokeToProto(item));
                break;
            case 'image':
                bucket.images.push(imageToProto(item));
                break;
            case 'text':
                bucket.texts.push(textToProto(item));
                break;
            case 'link':
                bucket.links.push(linkToProto(item));
                break;
        }
    }
    const files = {};
    // Region files + index.
    const indexRegions = [];
    for (const bucket of buckets.values()) {
        const proto = RegionProto.create({
            idX: bucket.id.x,
            idY: bucket.id.y,
            strokes: bucket.strokes,
            images: bucket.images,
            texts: bucket.texts,
            links: bucket.links,
        });
        files[`r_${bucket.id.x}_${bucket.id.y}.bin`] = RegionProto.encode(proto).finish();
        const hasBounds = isFinite(bucket.left);
        indexRegions.push(RegionBoundsProto.toObject(RegionBoundsProto.create({
            idX: bucket.id.x,
            idY: bucket.id.y,
            left: hasBounds ? bucket.left : 0,
            top: hasBounds ? bucket.top : 0,
            right: hasBounds ? bucket.right : 0,
            bottom: hasBounds ? bucket.bottom : 0,
        })));
    }
    files['index.bin'] = RegionIndex.encode(RegionIndex.create({ regions: indexRegions })).finish();
    // Manifest. Ensure a uuid so notate's session resume logic has a stable id.
    const uuid = doc.meta.uuid ?? randomUuid();
    files['manifest.bin'] = CanvasData.encode(CanvasData.create({
        version: doc.meta.version || 3,
        offsetX: doc.meta.offsetX,
        offsetY: doc.meta.offsetY,
        zoomLevel: doc.meta.zoomLevel || 1,
        canvasType: doc.meta.canvasType,
        pageWidth: doc.meta.pageWidth,
        pageHeight: doc.meta.pageHeight,
        regionSize,
        nextStrokeOrder: doc.meta.nextStrokeOrder,
        uuid,
    })).finish();
    // Image / asset blobs.
    for (const [path, bytes] of doc.images) {
        files[path] = bytes;
    }
    return zipSync(files);
}
function randomUuid() {
    // Prefer the platform crypto; fall back to a v4-shaped string.
    const g = globalThis;
    if (g.crypto?.randomUUID)
        return g.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}
//# sourceMappingURL=encode.js.map