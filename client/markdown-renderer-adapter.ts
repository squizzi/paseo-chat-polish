import type { ReactNode } from "react";
import { StyleSheet, type TextStyle, type ViewStyle } from "react-native";
import type MarkdownIt from "markdown-it";
import AstRenderer from "react-native-markdown-display/src/lib/AstRenderer";
import removeTextStyleProps from "react-native-markdown-display/src/lib/util/removeTextStyleProps";
import { cleanupTokens } from "react-native-markdown-display/src/lib/util/cleanupTokens";
import getTokenTypeByToken from "react-native-markdown-display/src/lib/util/getTokenTypeByToken";
import groupTextTokens from "react-native-markdown-display/src/lib/util/groupTextTokens";
import omitListItemParagraph from "react-native-markdown-display/src/lib/util/omitListItemParagraph";
import { stringToTokens } from "react-native-markdown-display/src/lib/util/stringToTokens";

/**
 * The one adapter for react-native-markdown-display's private renderer modules.
 * Everything outside this file works against these stable, narrow structures.
 */
export interface MarkdownAstNode {
  type: string;
  sourceType: string;
  sourceInfo: unknown;
  sourceMeta: unknown;
  block: boolean | undefined;
  markup: string;
  key: string;
  content: string;
  tokenIndex: number;
  index: number;
  attributes: Record<string, unknown>;
  children: MarkdownAstNode[];
}

interface MarkdownToken {
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
}

export type MarkdownStyleMap = Record<string, TextStyle & ViewStyle>;
export type MarkdownRenderRule = (...args: never[]) => ReactNode;
export type MarkdownRenderRules = Record<string, MarkdownRenderRule | undefined>;

export interface MarkdownAstRenderer {
  renderNode(node: MarkdownAstNode, parentNodes: MarkdownAstNode[], isRoot?: boolean): ReactNode;
}

export function createMarkdownAstRenderer({
  rules,
  styles,
  onLinkPress,
  imageHandlers,
}: {
  rules: MarkdownRenderRules;
  styles: MarkdownStyleMap;
  onLinkPress(url: string): boolean;
  imageHandlers: string[];
}): MarkdownAstRenderer {
  const resolved: Record<string, TextStyle & ViewStyle> = {};
  for (const [key, value] of Object.entries(styles)) resolved[key] = StyleSheet.flatten(value);
  for (const [key, value] of Object.entries(resolved)) {
    resolved["_VIEW_SAFE_" + key] = removeTextStyleProps(value as unknown as Record<string, unknown>) as TextStyle & ViewStyle;
  }
  const registered = StyleSheet.create(resolved);
  return new AstRenderer(
    rules,
    registered,
    onLinkPress,
    null,
    null,
    imageHandlers,
    null,
    false,
  ) as MarkdownAstRenderer;
}

function createNode(token: MarkdownToken, tokenIndex: number, parentKey: string): MarkdownAstNode {
  const type = getTokenTypeByToken(token);
  const keyPath = parentKey ? `${parentKey}.${tokenIndex}` : String(tokenIndex);
  return {
    type,
    sourceType: token.type,
    sourceInfo: token.info,
    sourceMeta: token.meta,
    block: token.block,
    markup: token.markup ?? "",
    key: `rnmr_${keyPath}_${type}`,
    content: token.content,
    tokenIndex,
    index: 0,
    attributes: Object.fromEntries(token.attrs ?? []),
    children: tokensToStableAst(token.children, keyPath),
  };
}

function tokensToStableAst(
  tokens: MarkdownToken[] | null | undefined,
  parentKey = "",
): MarkdownAstNode[] {
  if (!tokens?.length) return [];
  const stack: MarkdownAstNode[][] = [];
  let children: MarkdownAstNode[] = [];
  for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex += 1) {
    const token = tokens[tokenIndex];
    const node = createNode(token, tokenIndex, parentKey);
    if (node.type === "text" && node.children.length === 0 && node.content === "") continue;
    node.index = children.length;
    if (token.nesting === 1) {
      children.push(node);
      stack.push(children);
      children = node.children;
    } else if (token.nesting === -1) {
      children = stack.pop() ?? children;
    } else {
      children.push(node);
    }
  }
  return children;
}

/** Render through RNMD while retaining Paseo core's deterministic AST keys. */
export function renderStableMarkdown(
  source: string,
  renderer: MarkdownAstRenderer,
  markdownIt: MarkdownIt,
): ReactNode {
  let tokens = stringToTokens(source, markdownIt) as MarkdownToken[];
  tokens = cleanupTokens(tokens) as MarkdownToken[];
  tokens = groupTextTokens(tokens) as MarkdownToken[];
  tokens = omitListItemParagraph(tokens) as MarkdownToken[];
  const root: MarkdownAstNode = {
    type: "body",
    sourceType: "body",
    sourceInfo: undefined,
    sourceMeta: undefined,
    block: true,
    markup: "",
    key: "rnmr_root",
    content: "",
    tokenIndex: 0,
    index: 0,
    attributes: {},
    children: tokensToStableAst(tokens),
  };
  return renderer.renderNode(root, [], true);
}
