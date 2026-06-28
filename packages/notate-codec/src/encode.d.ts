import { type NotateDoc } from './model.js';
/** Serialize a {@link NotateDoc} to ZIP bytes readable by the notate app. */
export declare function writeNotate(doc: NotateDoc): Uint8Array;
