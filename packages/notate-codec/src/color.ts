/**
 * Conversions between notate's Android ARGB color ints (`0xAARRGGBB`) and the
 * CSS hex strings Excalidraw uses.
 */

/** Android ARGB int -> `#rrggbb` (alpha dropped). */
export function argbToHex(argb: number): string {
  const r = (argb >> 16) & 0xff;
  const g = (argb >> 8) & 0xff;
  const b = argb & 0xff;
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** Alpha channel of an ARGB int as 0..1 (opaque if alpha byte is 0). */
export function argbAlpha(argb: number): number {
  const a = (argb >>> 24) & 0xff;
  // Many notate colors are stored without an explicit alpha (high byte 0),
  // which Android treats as fully transparent only for Color.TRANSPARENT.
  // Treat 0 high byte as opaque unless the whole value is 0.
  if (a === 0) return argb === 0 ? 0 : 1;
  return a / 255;
}

/** `#rgb` / `#rrggbb` / `#rrggbbaa` / `transparent` -> Android ARGB int. */
export function hexToArgb(hex: string, alpha = 1): number {
  if (!hex || hex === 'transparent') return 0;
  let h = hex.replace('#', '').trim();
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  let a = Math.round(clamp01(alpha) * 255);
  if (h.length === 8) {
    a = parseInt(h.slice(6, 8), 16);
    h = h.slice(0, 6);
  }
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  // Use >>> 0 to keep it an unsigned 32-bit pattern, then map to signed int
  // range the way Java/Kotlin stores it.
  return (((a << 24) | (r << 16) | (g << 8) | b) >> 0) | 0;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
