import type { Prefs } from "../shared/timeline";

export const CHAT_MARKDOWN_LINE_HEIGHT = 1.6;
export const CHAT_MARKDOWN_CODE_LINE_HEIGHT = 1.5;

/** CSS fallback when Settings → Appearance leaves the code font empty. */
export const CHAT_MONO_FALLBACK = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";

/** Shared visual metrics for Paseo-rendered and live-streaming Markdown. */
export const CHAT_MARKDOWN_VISUAL = {
  headingSizes: {
    standard: [24, 20, 16, 16, 16, 16],
    compact: [18, 15, 12, 12, 12, 12],
  },
  headingLineHeight: 1.3,
  headingUnderlinePadding: 6,
  blockRadius: 8,
  inlineRadius: 4,
  inlinePadding: { horizontal: 5, vertical: 2 },
  quote: { border: 2, indent: 14, plainIndent: 20, cardHorizontal: 14, cardVertical: 10 },
  table: { horizontal: 14, vertical: 9, compactVertical: 7 },
  codePaddingVertical: 12,
  ruleWidth: 48,
  listMarkerMargin: { left: 4, right: 10 },
} as const;

export const CHAT_IMAGE_FRAMES = {
  small: { width: 200, height: 128 },
  large: { width: 320, height: 200 },
} as const;

export const CHAT_MARKDOWN_DENSITY = {
  compact: { itemGap: 2, padding: 2, listGap: 3 },
  normal: { itemGap: 6, padding: 4, listGap: 6 },
  spacious: { itemGap: 12, padding: 6, listGap: 10 },
} as const;

/** Plugin row margins; Paseo's own rows read the same values as CSS variables. */
export const CHAT_ROW_TIGHT = {
  compact: { marginTop: 0, marginBottom: -12 },
  normal: { marginTop: 2, marginBottom: -8 },
  spacious: { marginTop: 5, marginBottom: -3 },
} as const;

/** Faded thought/tool strength; Paseo's own rows read the same values as CSS variables. */
export const CHAT_ROW_QUIET = {
  dim: 0.3,
  faded: 0.45,
  soft: 0.65,
  full: 1,
} as const;

export interface ChatMarkdownAppearance {
  uiFont?: string;
  monoFont?: string;
  contentSize: number;
  codeSize: number;
}

/** Typography and rhythm shared by Chat Polish's native and streaming Markdown paths. */
export function chatMarkdownTypography(
  appearance: ChatMarkdownAppearance,
  density: Prefs["density"],
) {
  const spacing = CHAT_MARKDOWN_DENSITY[density];
  return {
    uiFont: appearance.uiFont,
    monoFont: appearance.monoFont
      ? `${appearance.monoFont}, ${CHAT_MONO_FALLBACK}`
      : CHAT_MONO_FALLBACK,
    contentSize: appearance.contentSize,
    codeSize: appearance.codeSize,
    proseLineHeight: Math.round(appearance.contentSize * CHAT_MARKDOWN_LINE_HEIGHT),
    codeLineHeight: Math.round(appearance.codeSize * CHAT_MARKDOWN_CODE_LINE_HEIGHT),
    blockGap: spacing.itemGap + 2 * spacing.padding,
    paddingVertical: spacing.padding,
  };
}
