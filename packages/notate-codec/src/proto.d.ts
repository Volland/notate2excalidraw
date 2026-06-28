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
export declare const StrokeData: protobuf.Type;
export declare const CanvasImageData: protobuf.Type;
export declare const TextItemData: protobuf.Type;
export declare const LinkItemData: protobuf.Type;
export declare const RegionProto: protobuf.Type;
export declare const RegionBoundsProto: protobuf.Type;
/**
 * Wrapper for `index.bin`. notate writes `ProtoBuf.encodeToByteArray(
 * ListSerializer(RegionBoundsProto.serializer()), list)`, which kotlinx encodes
 * as a repeated field with tag number 1 — exactly this message shape.
 */
export declare const RegionIndex: protobuf.Type;
/**
 * Minimal `CanvasData` (manifest.bin). We only declare the scalar fields we
 * round-trip. Unknown fields present in real files (thumbnail, backgroundStyle,
 * toolbarItems, tags) are skipped on decode and omitted on encode — notate
 * fills them from Kotlin defaults when reading our output.
 */
export declare const CanvasData: protobuf.Type;
/** Decode options: convert 64-bit ints to JS numbers, fill repeated as []. */
export declare const DECODE_OPTS: protobuf.IConversionOptions;
