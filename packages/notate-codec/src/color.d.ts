/**
 * Conversions between notate's Android ARGB color ints (`0xAARRGGBB`) and the
 * CSS hex strings Excalidraw uses.
 */
/** Android ARGB int -> `#rrggbb` (alpha dropped). */
export declare function argbToHex(argb: number): string;
/** Alpha channel of an ARGB int as 0..1 (opaque if alpha byte is 0). */
export declare function argbAlpha(argb: number): number;
/** `#rgb` / `#rrggbb` / `#rrggbbaa` / `transparent` -> Android ARGB int. */
export declare function hexToArgb(hex: string, alpha?: number): number;
