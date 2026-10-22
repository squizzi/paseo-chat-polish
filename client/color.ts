/** Hex color with alpha; non-hex colors (rgb(), names) are returned unchanged. */
export function alpha(color: string, a: number) {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color);
  if (!m) return color;
  const hex = m[1]!.length === 3 ? [...m[1]!].map((ch) => ch + ch).join("") : m[1]!;
  return `#${hex}${Math.round(a * 255).toString(16).padStart(2, "0")}`;
}

/** The sunken surface behind code blocks: each channel × 0.86 (#23272e → #1e2228). */
export function sunken(color: string) {
  const m = /^#([0-9a-f]{6})$/i.exec(color);
  if (!m) return color;
  const n = parseInt(m[1]!, 16);
  return `#${[16, 8, 0].map((sh) => Math.round(((n >> sh) & 255) * 0.86).toString(16).padStart(2, "0")).join("")}`;
}
