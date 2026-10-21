import type { Prefs } from "../shared/timeline";

export const CHAT_MARKDOWN_LINE_HEIGHT = 1.6;
export const CHAT_MARKDOWN_CODE_LINE_HEIGHT = 1.5;

export const CHAT_MARKDOWN_DENSITY = {
  compact: { itemGap: 2, padding: 2 },
  normal: { itemGap: 6, padding: 4 },
  spacious: { itemGap: 12, padding: 6 },
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
      ? `${appearance.monoFont}, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`
      : "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    contentSize: appearance.contentSize,
    codeSize: appearance.codeSize,
    proseLineHeight: Math.round(appearance.contentSize * CHAT_MARKDOWN_LINE_HEIGHT),
    codeLineHeight: Math.round(appearance.codeSize * CHAT_MARKDOWN_CODE_LINE_HEIGHT),
    blockGap: spacing.itemGap + 2 * spacing.padding,
    paddingVertical: spacing.padding,
  };
}
