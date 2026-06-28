/**
 * protobuf schema for the notate wire format, built programmatically with
 * protobufjs reflection so there is no codegen / protoc build step.
 *
 * Field numbers mirror notate's `SerializationModels.kt` exactly. notate uses
 * Kotlin `kotlinx.serialization` protobuf, which emits standard protobuf wire
 * format: repeated scalar arrays are packed, enums are their int ordinal, and a
 * top-level `List<T>` (used for index.bin) is encoded as a repeated field #1.
 */
import protobuf from 'protobufjs';

const { Type, Field } = protobuf;

function repeatedScalar(name: string, id: number, type: string): protobuf.Field {
  // Match kotlinx: packed encoding for primitive arrays. `packed` is a derived
  // getter, so it must be supplied via field options. protobufjs accepts both
  // packed and unpacked when *decoding* regardless of this flag.
  return new Field(name, id, type, 'repeated', undefined, { packed: true });
}

export const StrokeData = new Type('StrokeData')
  .add(repeatedScalar('pointsPacked', 2, 'float'))
  .add(repeatedScalar('timestampsPacked', 3, 'int64'))
  .add(new Field('color', 4, 'int32'))
  .add(new Field('width', 5, 'float'))
  .add(new Field('style', 6, 'int32'))
  .add(new Field('strokeOrder', 7, 'int64'))
  .add(new Field('zIndex', 8, 'float'));

export const CanvasImageData = new Type('CanvasImageData')
  .add(new Field('uri', 1, 'string'))
  .add(new Field('x', 2, 'float'))
  .add(new Field('y', 3, 'float'))
  .add(new Field('width', 4, 'float'))
  .add(new Field('height', 5, 'float'))
  .add(new Field('zIndex', 6, 'float'))
  .add(new Field('order', 7, 'int64'))
  .add(new Field('rotation', 8, 'float'))
  .add(new Field('opacity', 9, 'float'));

export const TextItemData = new Type('TextItemData')
  .add(new Field('text', 1, 'string'))
  .add(new Field('x', 2, 'float'))
  .add(new Field('y', 3, 'float'))
  .add(new Field('width', 4, 'float'))
  .add(new Field('height', 5, 'float'))
  .add(new Field('fontSize', 6, 'float'))
  .add(new Field('color', 7, 'int32'))
  .add(new Field('zIndex', 8, 'float'))
  .add(new Field('order', 9, 'int64'))
  .add(new Field('rotation', 10, 'float'))
  .add(new Field('opacity', 11, 'float'))
  .add(new Field('alignment', 12, 'int32'))
  .add(new Field('backgroundColor', 13, 'int32'));

export const LinkItemData = new Type('LinkItemData')
  .add(new Field('label', 1, 'string'))
  .add(new Field('target', 2, 'string'))
  .add(new Field('x', 3, 'float'))
  .add(new Field('y', 4, 'float'))
  .add(new Field('width', 5, 'float'))
  .add(new Field('height', 6, 'float'))
  .add(new Field('zIndex', 7, 'float'))
  .add(new Field('order', 8, 'int64'))
  .add(new Field('color', 9, 'int32'))
  .add(new Field('rotation', 10, 'float'))
  .add(new Field('type', 11, 'int32'))
  .add(new Field('fontSize', 12, 'float'));

export const RegionProto = new Type('RegionProto')
  .add(new Field('idX', 1, 'int32'))
  .add(new Field('idY', 2, 'int32'))
  .add(new Field('strokes', 3, 'StrokeData', 'repeated'))
  .add(new Field('images', 4, 'CanvasImageData', 'repeated'))
  .add(new Field('texts', 5, 'TextItemData', 'repeated'))
  .add(new Field('links', 6, 'LinkItemData', 'repeated'));

export const RegionBoundsProto = new Type('RegionBoundsProto')
  .add(new Field('idX', 1, 'int32'))
  .add(new Field('idY', 2, 'int32'))
  .add(new Field('left', 3, 'float'))
  .add(new Field('top', 4, 'float'))
  .add(new Field('right', 5, 'float'))
  .add(new Field('bottom', 6, 'float'));

/**
 * Wrapper for `index.bin`. notate writes `ProtoBuf.encodeToByteArray(
 * ListSerializer(RegionBoundsProto.serializer()), list)`, which kotlinx encodes
 * as a repeated field with tag number 1 — exactly this message shape.
 */
export const RegionIndex = new Type('RegionIndex').add(
  new Field('regions', 1, 'RegionBoundsProto', 'repeated'),
);

/**
 * Minimal `CanvasData` (manifest.bin). We only declare the scalar fields we
 * round-trip. Unknown fields present in real files (thumbnail, backgroundStyle,
 * toolbarItems, tags) are skipped on decode and omitted on encode — notate
 * fills them from Kotlin defaults when reading our output.
 */
export const CanvasData = new Type('CanvasData')
  .add(new Field('version', 2, 'int32'))
  .add(new Field('offsetX', 4, 'float'))
  .add(new Field('offsetY', 5, 'float'))
  .add(new Field('zoomLevel', 6, 'float'))
  .add(new Field('canvasType', 7, 'int32'))
  .add(new Field('pageWidth', 8, 'float'))
  .add(new Field('pageHeight', 9, 'float'))
  .add(new Field('regionSize', 15, 'float'))
  .add(new Field('nextStrokeOrder', 16, 'int64'))
  .add(new Field('uuid', 17, 'string'));

// Resolve cross-type references (RegionProto -> StrokeData, etc.). A throwaway
// Root wires up the type registry so nested message fields resolve.
const root = new protobuf.Root();
root.add(StrokeData);
root.add(CanvasImageData);
root.add(TextItemData);
root.add(LinkItemData);
root.add(RegionProto);
root.add(RegionBoundsProto);
root.add(RegionIndex);
root.add(CanvasData);
root.resolveAll();

/** Decode options: convert 64-bit ints to JS numbers, fill repeated as []. */
export const DECODE_OPTS: protobuf.IConversionOptions = {
  longs: Number,
  defaults: true,
  arrays: true,
};
