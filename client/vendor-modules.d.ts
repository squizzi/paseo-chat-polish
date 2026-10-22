declare module "markdown-it" {
  export interface MarkdownToken {
    type: string;
    tag: string;
    content: string;
    children?: MarkdownToken[] | null;
    attrs?: [string, unknown][] | null;
    info?: unknown;
    meta?: unknown;
    block?: boolean;
    markup?: string;
    nesting: number;
    level: number;
    map?: [number, number] | null;
  }

  export interface MarkdownDelimiter {
    end: number;
    marker: number;
    open: boolean;
    close: boolean;
    token: number;
  }

  export interface MarkdownInlineState {
    src: string;
    pos: number;
    posMax: number;
    pending: string;
    level: number;
    env: Record<PropertyKey, unknown>;
    tokens: MarkdownToken[];
    delimiters: MarkdownDelimiter[];
    md: MarkdownIt;
    push(type: string, tag: string, nesting: number): MarkdownToken;
    pushPending(): void;
    scanDelims(start: number, canSplitWord: boolean): { can_close: boolean };
  }

  export interface MarkdownCoreState {
    tokens: MarkdownToken[];
    env: Record<PropertyKey, unknown>;
    md: MarkdownIt;
  }

  interface CoreRuler {
    at(name: string, rule: (state: MarkdownCoreState) => void): void;
    after(afterName: string, ruleName: string, rule: (state: MarkdownCoreState) => void): void;
    disable(name: string): void;
  }

  interface InlineRuler {
    before(beforeName: string, ruleName: string, rule: (state: MarkdownInlineState, silent: boolean) => boolean): void;
    after(afterName: string, ruleName: string, rule: (state: MarkdownInlineState, silent: boolean) => boolean): void;
  }

  export default class MarkdownIt {
    constructor(options?: { html?: boolean; linkify?: boolean; typographer?: boolean });
    core: { ruler: CoreRuler };
    inline: {
      ruler: InlineRuler;
      ruler2: { after(afterName: string, ruleName: string, rule: (state: MarkdownInlineState) => boolean): void };
      parse(source: string, md: MarkdownIt, env: Record<PropertyKey, unknown>, outTokens: MarkdownToken[]): void;
      tokenize(state: MarkdownInlineState): void;
    };
    helpers: { parseLinkLabel(state: MarkdownInlineState, start: number, disableNested: boolean): number };
    linkify: { match(value: string): Array<{ index: number; lastIndex: number; url: string }> | null };
    validateLink(url: string): boolean;
    parse(source: string, env: Record<PropertyKey, unknown>): MarkdownToken[];
  }
}

declare module "react-native-markdown-display/src/lib/AstRenderer" {
  import type { ReactNode } from "react";

  type PrivateRenderRule = (...args: never[]) => ReactNode;
  export default class AstRenderer {
    constructor(
      renderRules: Record<string, PrivateRenderRule | undefined>,
      style: Record<string, unknown>,
      onLinkPress: (url: string) => boolean,
      maxTopLevelChildren: number | null,
      topLevelMaxExceededItem: ReactNode,
      allowedImageHandlers: string[],
      defaultImageHandler: string | null,
      debugPrintTree: boolean,
    );
    renderNode(node: unknown, parentNodes: unknown[], isRoot?: boolean): ReactNode;
  }
}

declare module "react-native-markdown-display/src/lib/util/cleanupTokens" {
  export const cleanupTokens: (tokens: unknown[]) => unknown[];
}

declare module "react-native-markdown-display/src/lib/util/getTokenTypeByToken" {
  const getTokenTypeByToken: (token: { type?: string; tag?: string }) => string;
  export default getTokenTypeByToken;
}

declare module "react-native-markdown-display/src/lib/util/groupTextTokens" {
  const groupTextTokens: (tokens: unknown[]) => unknown[];
  export default groupTextTokens;
}

declare module "react-native-markdown-display/src/lib/util/omitListItemParagraph" {
  const omitListItemParagraph: (tokens: unknown[]) => unknown[];
  export default omitListItemParagraph;
}

declare module "react-native-markdown-display/src/lib/util/stringToTokens" {
  export const stringToTokens: (source: string, markdownIt: unknown) => unknown[];
}

declare module "react-native-markdown-display/src/lib/util/removeTextStyleProps" {
  const removeTextStyleProps: (style: Record<string, unknown>) => Record<string, unknown>;
  export default removeTextStyleProps;
}
