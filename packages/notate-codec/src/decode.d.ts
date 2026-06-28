import { type NotateDoc } from './model.js';
export declare class NotateFormatError extends Error {
}
/** Parse a `.notate` archive into the normalized document model. */
export declare function readNotate(input: Uint8Array | ArrayBuffer): NotateDoc;
