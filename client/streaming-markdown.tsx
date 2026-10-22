import type { PluginTheme } from "@getpaseo/plugin";
import { openExternalUrl, type PluginTimelineItemProps } from "@getpaseo/plugin/client";
import {
  darkHighlightColors,
  highlightCode,
  lightHighlightColors,
  type HighlightStyle,
} from "@getpaseo/highlight";
import MarkdownIt from "markdown-it";
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from "react";
import {
  ActivityIndicator, Image, Platform, Pressable, Text, View,
  type TextStyle, type ViewStyle,
} from "react-native";
import { z } from "zod";
import { usePrefs } from "./prefs";
import { CHAT_MARKDOWN_DENSITY, CHAT_MARKDOWN_VISUAL, chatMarkdownTypography } from "./chat-markdown-style";
import {
  getMarkdownListMarker,
  isInlineCodeLink,
  type MarkdownParserLike,
} from "./markdown-compat";
import {
  createMarkdownAstRenderer,
  renderStableMarkdown,
  type MarkdownAstNode,
  type MarkdownRenderRules,
  type MarkdownStyleMap,
} from "./markdown-renderer-adapter";
import { enableStreamingMarkdown } from "./streaming-markdown-parser";
import { readHostAppearance } from "./web";
import type { Prefs } from "../shared/timeline";
import {
  createStreamArrivalRegistry,
  initialFadeState,
  nextFadeState,
  settleFadeState,
  STREAM_FADE_DURATION_MS,
  type StreamFadeChunk,
  type StreamFadeState,
} from "./streaming-token-motion";
import { IMAGE_ARRIVAL_PROPS, streamingImageFrameSize, type StreamingImageMode } from "./streaming-image-layout";

type ASTNode = MarkdownAstNode;
type RenderRules = MarkdownRenderRules;

const STREAM_TOKEN_PROPS = {
  dataSet: { cpStreamToken: "true" },
} as object;

// Paseo's root UI-font rule has ID specificity. Mark mono text so the host
// excludes it from that rule, matching completed Markdown and plugin rows.
const MONO_TEXT_PROPS = {
  dataSet: { pmono: "" },
} as object;

const MARKDOWN_TAG: Readonly<Record<string, string>> = {
  heading1: "h1", heading2: "h2", heading3: "h3", heading4: "h4", heading5: "h5", heading6: "h6",
  paragraph: "p", strong: "strong", em: "em", s: "s", blockquote: "blockquote",
  bullet_list: "ul", ordered_list: "ol", list_item: "li", code_inline: "code",
  code_block: "pre", fence: "pre", table: "table", thead: "thead", tbody: "tbody",
  th: "th", tr: "tr", td: "td", link: "a", blocklink: "a", image: "img", hr: "hr",
};

const MARKDOWN_ROLE = (role: string) => ({
  dataSet: { chatPolishMarkdownRole: role, paseoMarkdownTag: MARKDOWN_TAG[role] ?? role },
}) as object;

export const streamingAssistantSchema = z.object({ text: z.string() });
type StreamingAssistantData = z.output<typeof streamingAssistantSchema>;
interface StreamFadeValue {
  source: string;
  committedLength: number;
  chunks: StreamFadeChunk[];
  cursor: { current: number };
}

const StreamFadeContext = createContext<StreamFadeValue | null>(null);
const streamArrivals = createStreamArrivalRegistry();

export function StreamWordFade({
  text, enabled, animateInitial = false, children,
}: {
  text: string; enabled: boolean; animateInitial?: boolean; children: ReactNode;
}) {
  const fading = enabled && Platform.OS === "web";
  const [state, setState] = useState<StreamFadeState>(() =>
    initialFadeState(text, fading, animateInitial, Date.now()),
  );
  const next = nextFadeState(state, text, fading, Date.now());
  if (next !== state) setState(next);
  const oldest = next.chunks[0];
  useEffect(() => {
    if (!oldest) return;
    const timer = setTimeout(
      () => setState((current) => settleFadeState(current, Date.now())),
      Math.max(0, oldest.startedAtMs + STREAM_FADE_DURATION_MS - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [oldest?.start, oldest?.startedAtMs]);

  const cursor = useRef(0);
  cursor.current = 0;
  const value = useMemo(
    () => ({ source: text, committedLength: next.committed.length, chunks: next.chunks, cursor }),
    [next.chunks, next.committed.length, text],
  );
  return <StreamFadeContext.Provider value={value}>{children}</StreamFadeContext.Provider>;
}

export function StreamFadeText({ content }: { content: string }): ReactNode {
  const fade = useContext(StreamFadeContext);
  if (!fade || fade.chunks.length === 0 || content.length === 0) return content;
  const found = fade.source.indexOf(content, fade.cursor.current);
  const sourceStart = found < 0 ? fade.cursor.current : found;
  fade.cursor.current = sourceStart + content.length;
  const sourceEnd = sourceStart + content.length;
  const pieces: { start: number; end: number; fade: boolean }[] = [];
  let cursor = sourceStart;
  const push = (end: number, shouldFade: boolean) => {
    if (end <= cursor) return;
    pieces.push({ start: cursor, end, fade: shouldFade });
    cursor = end;
  };
  push(Math.min(fade.committedLength, sourceEnd), false);
  for (const chunk of fade.chunks) {
    const chunkEnd = chunk.start + chunk.text.length;
    if (chunkEnd <= cursor || chunk.start >= sourceEnd) continue;
    push(Math.min(chunk.start, sourceEnd), false);
    push(Math.min(chunkEnd, sourceEnd), true);
  }
  push(sourceEnd, false);
  return pieces.map((piece) => {
    const value = content.slice(piece.start - sourceStart, piece.end - sourceStart);
    return piece.fade
      ? <Text key={"fade:" + piece.start} {...STREAM_TOKEN_PROPS}>{value}</Text>
      : value;
  });
}

function isNewStreamImage(fade: StreamFadeValue | null, source: string) {
  if (!fade?.chunks.length) return false;
  const sourceIndex = fade.source.lastIndexOf(source);
  return sourceIndex >= 0 && fade.chunks.some((chunk) => sourceIndex >= chunk.start && sourceIndex < chunk.start + chunk.text.length);
}

function StreamingMarkdownImage({
  source, alt, style, hasLeadingContent, theme, imageMode,
}: {
  source: string; alt: string; style: ViewStyle; hasLeadingContent: boolean; theme: PluginTheme; imageMode: StreamingImageMode;
}) {
  const [measurement, setMeasurement] = useState<{ source: string; aspectRatio: number } | null>(null);
  const [loadState, setLoadState] = useState<{ source: string; status: "loading" | "loaded" | "failed" }>(() => ({
    source,
    status: "loading",
  }));
  const fade = useContext(StreamFadeContext);
  const [animateArrival] = useState(() => isNewStreamImage(fade, source));
  const aspectRatio = measurement?.source === source ? measurement.aspectRatio : null;
  const status = loadState.source === source ? loadState.status : "loading";
  const fixedFrame = streamingImageFrameSize(Platform.OS, imageMode);
  const frameStyle = [style, fixedFrame, { marginTop: hasLeadingContent ? 16 : 0, marginBottom: 0 }];
  const measuredSizeStyle: ViewStyle = status === "failed"
    ? { height: 160 }
    : { aspectRatio: aspectRatio ?? 3 / 2 };
  const imageBoxStyle: ViewStyle = fixedFrame
    ? { width: "100%", height: "100%" }
    : measuredSizeStyle;
  useEffect(() => {
    let cancelled = false;
    Image.getSize(source, (width, height) => {
      if (!cancelled && width > 0 && height > 0) {
        setMeasurement({ source, aspectRatio: width / height });
      }
    }, () => undefined);
    return () => { cancelled = true; };
  }, [source]);

  if (status === "failed") {
    return (
      <View
        style={[
          frameStyle,
          fixedFrame ? null : measuredSizeStyle,
          { alignItems: "center", justifyContent: "center", paddingHorizontal: 16, paddingVertical: 24 },
        ]}
        {...(fade?.chunks.length ? STREAM_TOKEN_PROPS : {})}
      >
        <Text style={{ color: theme.colors.foregroundMuted, fontSize: 14, textAlign: "center" }}>
          Unable to load image.
        </Text>
      </View>
    );
  }

  return (
    <View
      style={frameStyle}
      {...(fade?.chunks.length ? STREAM_TOKEN_PROPS : {})}
      {...(status === "loaded" && animateArrival ? IMAGE_ARRIVAL_PROPS : {})}
    >
      <View style={[{ width: "100%", overflow: "hidden", position: "relative" }, imageBoxStyle]}>
        <Image
          source={{ uri: source }}
          style={{ width: "100%", height: "100%" }}
          resizeMode="contain"
          accessible={Boolean(alt)}
          accessibilityLabel={alt || undefined}
          onLoadStart={() => setLoadState({ source, status: "loading" })}
          onLoad={() => setLoadState({ source, status: "loaded" })}
          onError={() => setLoadState({ source, status: "failed" })}
        />
        {status === "loading" ? (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ActivityIndicator
              size="small"
              color={theme.colors.foregroundMuted}
              accessibilityLabel="Loading image"
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const LANGUAGE_ALIASES: Readonly<Record<string, string>> = {
  typescript: "ts", javascript: "js", python: "py", rust: "rs", golang: "go",
  "c++": "cpp", csharp: "cs", "c#": "cs", objc: "m", "objective-c": "m",
  markdown: "md", elixir: "ex",
};

function fenceExtension(info: unknown): string {
  if (typeof info !== "string") return "txt";
  const language = info.trim().split(/\s+/)[0]?.toLowerCase().replace(/^\./, "");
  return language ? LANGUAGE_ALIASES[language] ?? language : "txt";
}

function HighlightedStreamingCode({
  node, type, inherited, styles, theme,
}: {
  node: ASTNode;
  type: "code_block" | "fence";
  inherited: TextStyle;
  styles: MarkdownStyleMap;
  theme: PluginTheme;
}) {
  const code = node.content.replace(/\n$/, "");
  const rawLanguage = type === "fence" && typeof node.sourceInfo === "string"
    ? node.sourceInfo.trim().split(/\s+/)[0] ?? ""
    : "";
  const extension = type === "fence" ? fenceExtension(node.sourceInfo) : "txt";
  const lines = useMemo(() => highlightCode(code, `stream.${extension}`), [code, extension]);
  const palette = (colorLuminance(theme.colors.surface0) ?? 0) > 0.5
    ? lightHighlightColors
    : darkHighlightColors;
  const { fontFamily, fontSize, color, ...boxStyle } = styles[type];
  const textStyle: TextStyle = {
    fontFamily,
    fontSize,
    lineHeight: typeof fontSize === "number" ? Math.round(fontSize * 1.45) : undefined,
    color,
  };
  const roleProps = rawLanguage
    ? ({ dataSet: { chatPolishMarkdownRole: type, paseoMarkdownTag: MARKDOWN_TAG[type] ?? type, paseoMarkdownLanguage: rawLanguage } } as object)
    : MARKDOWN_ROLE(type);
  return (
    <View key={node.key} {...roleProps} style={[boxStyle, { position: "relative" }]}>
      <Text {...MONO_TEXT_PROPS} style={[inherited, textStyle]}>
        {lines.flatMap((line, lineIndex) => {
          const pieces: ReactNode[] = [];
          if (lineIndex > 0) {
            pieces.push(<Text key={`line:${lineIndex}`}><StreamFadeText content={"\n"} /></Text>);
          }
          let column = 0;
          for (const token of line) {
            const start = column;
            column += token.text.length;
            pieces.push(
              <Text key={`${lineIndex}:${start}`} style={token.style ? { color: palette[token.style as HighlightStyle] } : undefined}>
                <StreamFadeText content={token.text} />
              </Text>,
            );
          }
          return pieces;
        })}
      </Text>
    </View>
  );
}

function createRenderRules(theme: PluginTheme, markdownParser: MarkdownParserLike, preferences: Prefs): RenderRules {
  const container = (type: string) => (node: ASTNode, children: ReactNode[], _parents: ASTNode[], styles: MarkdownStyleMap) => (
    <View key={node.key} style={styles["_VIEW_SAFE_" + type]} {...MARKDOWN_ROLE(type)}>{children}</View>
  );
  const span = (type: string) => (node: ASTNode, children: ReactNode[], _parents: ASTNode[], styles: MarkdownStyleMap) => (
    <Text key={node.key} style={styles[type]} {...MARKDOWN_ROLE(type)}>{children}</Text>
  );
  const code = (type: string) => (node: ASTNode, _children: ReactNode[], parents: ASTNode[], styles: MarkdownStyleMap, inherited: TextStyle = {}) => {
    const content = node.content.replace(/\n$/, "");
    const usesLinkColor = type === "code_inline" && isInlineCodeLink(content, parents, markdownParser);
    return (
      <Text key={node.key} {...MARKDOWN_ROLE(type)} {...MONO_TEXT_PROPS} style={[inherited, styles[type], usesLinkColor ? { color: styles.link.color } : null]}>
        <StreamFadeText content={content} />
      </Text>
    );
  };
  const highlighted = (type: "code_block" | "fence") => (
    node: ASTNode, _children: ReactNode[], _parents: ASTNode[], styles: MarkdownStyleMap, inherited: TextStyle = {},
  ) => (
    <HighlightedStreamingCode node={node} type={type} inherited={inherited} styles={styles} theme={theme} />
  );
  return {
    unknown: () => null,
    body: container("body"),
    heading1: container("heading1"), heading2: container("heading2"),
    heading3: container("heading3"), heading4: container("heading4"),
    heading5: container("heading5"), heading6: container("heading6"),
    hr: (node: ASTNode, _children: ReactNode[], _parents: ASTNode[], styles: MarkdownStyleMap) => preferences.richText.rule === "b"
      ? <Text key={node.key} style={{ color: theme.colors.foregroundMuted, fontSize: 12, letterSpacing: 3, textAlign: "center" }}>• • •</Text>
      : <View key={node.key} style={styles._VIEW_SAFE_hr} {...MARKDOWN_ROLE("hr")} />,
    strong: span("strong"), em: span("em"), s: span("s"),
    blockquote: container("blockquote"),
    bullet_list: (node: ASTNode, children: ReactNode[], parents: ASTNode[], styles: MarkdownStyleMap) => (
      <View key={node.key} {...MARKDOWN_ROLE("bullet_list")} style={[styles._VIEW_SAFE_bullet_list, markdownListSpacing(node, parents, preferences)]}>{children}</View>
    ),
    ordered_list: (node: ASTNode, children: ReactNode[], parents: ASTNode[], styles: MarkdownStyleMap) => (
      <View key={node.key} {...MARKDOWN_ROLE("ordered_list")} style={[styles._VIEW_SAFE_ordered_list, markdownListSpacing(node, parents, preferences)]}>{children}</View>
    ),
    list_item: (node: ASTNode, children: ReactNode[], parents: ASTNode[], styles: MarkdownStyleMap) => {
      const { isOrdered, marker } = getMarkdownListMarker(node, parents);
      const displayMarker = preferences.richText.list === "c"
        ? "·"
        : preferences.richText.list === "b"
          ? isOrdered ? marker.replace(/\.$/, ")") : "–"
          : marker;
      return (
        <View key={node.key} {...MARKDOWN_ROLE("list_item")} style={styles._VIEW_SAFE_list_item}>
          <Text
            style={isOrdered ? styles.ordered_list_icon : styles.bullet_list_icon}
            {...({ dataSet: { paseoMarkdownListMarker: "" } } as object)}
          >
            {displayMarker}
          </Text>
          <View style={isOrdered ? styles._VIEW_SAFE_ordered_list_content : styles._VIEW_SAFE_bullet_list_content}>
            {children}
          </View>
        </View>
      );
    },
    code_inline: code("code_inline"),
    code_block: highlighted("code_block"),
    fence: highlighted("fence"),
    table: container("table"), thead: container("thead"), tbody: container("tbody"),
    th: container("th"), tr: container("tr"), td: container("td"),
    link: (node: ASTNode, children: ReactNode[], _parents: ASTNode[], styles: MarkdownStyleMap, onLinkPress: (url: string) => boolean) => (
      <Text key={node.key} style={styles.link} accessibilityRole="link" onPress={() => onLinkPress(String(node.attributes.href ?? ""))}>
        {children}
      </Text>
    ),
    blocklink: (node: ASTNode, children: ReactNode[], _parents: ASTNode[], styles: MarkdownStyleMap, onLinkPress: (url: string) => boolean) => (
      <Pressable key={node.key} style={styles._VIEW_SAFE_blocklink} onPress={() => onLinkPress(String(node.attributes.href ?? ""))}>
        {children}
      </Pressable>
    ),
    image: (node: ASTNode, _children: ReactNode[], _parents: ASTNode[], styles: MarkdownStyleMap, allowed: string[]) => {
      const source = String(node.attributes.src ?? "");
      if (!allowed.some((handler) => source.toLowerCase().startsWith(handler))) return null;
      const alt = String(node.attributes.alt ?? "");
      const paragraph = _parents.find((parent) => parent.type === "paragraph");
      const imageIndex = paragraph?.children?.findIndex((child) => child.key === node.key) ?? -1;
      return (
        <StreamingMarkdownImage
          key={node.key}
          source={source}
          alt={alt}
          style={styles._VIEW_SAFE_image}
          hasLeadingContent={imageIndex > 0}
          theme={theme}
          imageMode={preferences.images}
        />
      );
    },
    text: (node: ASTNode, _children: ReactNode[], _parents: ASTNode[], styles: MarkdownStyleMap, inherited: TextStyle = {}) => (
      <Text key={node.key} {...MARKDOWN_ROLE("text")} style={[styles.text, inherited]}><StreamFadeText content={node.content} /></Text>
    ),
    textgroup: span("textgroup"), paragraph: container("paragraph"),
    hardbreak: (node: ASTNode, _children: ReactNode[], _parents: ASTNode[], styles: MarkdownStyleMap) => <Text key={node.key} style={styles.hardbreak}>{"\n"}</Text>,
    softbreak: (node: ASTNode, _children: ReactNode[], _parents: ASTNode[], styles: MarkdownStyleMap) => <Text key={node.key} style={styles.softbreak}>{"\n"}</Text>,
    pre: container("pre"), inline: span("inline"), span: span("span"),
  };
}

function markdownListSpacing(_node: ASTNode, parents: ASTNode[], preferences: Prefs): ViewStyle {
  if (parents.some((parent) => parent.type === "list_item")) {
    return { marginTop: CHAT_MARKDOWN_DENSITY[preferences.density].listGap, marginBottom: 0 };
  }
  return { marginTop: 0, marginBottom: 0 };
}

const CORE_ACCENT_BRIGHT: Readonly<Record<string, string>> = {
  "#e4e4e7": "#fafafa", "#3b6fcf": "#7eaaeb", "#d97757": "#e89a7f", "#89b4fa": "#b4d0fc",
};

function colorLuminance(color: string): number | null {
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(color);
  if (!match) return null;
  const channels = match.slice(1).map((value) => {
    const channel = Number.parseInt(value, 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function coreLinkColor(theme: PluginTheme): string {
  const accent = theme.colors.accent.toLowerCase();
  if (accent === "#20744a") {
    const luminance = colorLuminance(theme.colors.surface0);
    return luminance !== null && luminance > 0.5 ? "#239956" : "#7ccba0";
  }
  return CORE_ACCENT_BRIGHT[accent] ?? theme.colors.accent;
}

function createMarkdownStyles(
  theme: PluginTheme,
  typography: ReturnType<typeof chatMarkdownTypography>,
  preferences: Prefs,
): MarkdownStyleMap {
  const c = theme.colors;
  const ui = typography.uiFont ? { fontFamily: typography.uiFont } : {};
  const mono = { fontFamily: typography.monoFont };
  const heading = (level: 1 | 2 | 3 | 4 | 5 | 6): TextStyle => {
    const compact = preferences.richText.heading === "b";
    const sizes = compact ? CHAT_MARKDOWN_VISUAL.headingSizes.compact : CHAT_MARKDOWN_VISUAL.headingSizes.standard;
    const size = sizes[level - 1]!;
    return {
      ...ui,
      color: level === 3 && compact ? c.foregroundMuted : c.foreground,
      fontSize: size,
      lineHeight: Math.round(size * CHAT_MARKDOWN_VISUAL.headingLineHeight),
      fontWeight: "600",
      marginTop: 0,
      marginBottom: 0,
      ...(level === 1 && compact ? { borderBottomWidth: 1, borderBottomColor: c.border, paddingBottom: CHAT_MARKDOWN_VISUAL.headingUnderlinePadding } : {}),
      ...(level === 3 && compact ? { textTransform: "uppercase", letterSpacing: 0.7 } : {}),
      ...(level < 3 && preferences.richText.heading === "c" ? { borderLeftWidth: 3, borderLeftColor: c.accent, paddingLeft: 10 } : {}),
    };
  };
  const quote = preferences.richText.quote;
  const quoteStyle: TextStyle & ViewStyle = quote === "b"
    ? { backgroundColor: c.surface1, borderRadius: CHAT_MARKDOWN_VISUAL.blockRadius, paddingHorizontal: CHAT_MARKDOWN_VISUAL.quote.cardHorizontal, paddingVertical: CHAT_MARKDOWN_VISUAL.quote.cardVertical }
    : { borderLeftWidth: quote === "a" ? CHAT_MARKDOWN_VISUAL.quote.border : 0, borderLeftColor: c.accent, paddingLeft: quote === "a" ? CHAT_MARKDOWN_VISUAL.quote.indent : CHAT_MARKDOWN_VISUAL.quote.plainIndent, paddingVertical: quote === "a" ? 2 : 0 };
  const inline = preferences.richText.inline;
  const codeBlock = preferences.richText.code;
  const table = preferences.richText.table;
  const codeBox: TextStyle & ViewStyle = {
    ...mono,
    backgroundColor: codeBlock === "c" ? "transparent" : c.surface0,
    color: c.foreground,
    paddingHorizontal: CHAT_MARKDOWN_VISUAL.table.horizontal,
    paddingVertical: CHAT_MARKDOWN_VISUAL.codePaddingVertical,
    borderRadius: CHAT_MARKDOWN_VISUAL.blockRadius,
    borderWidth: codeBlock === "b" ? 0 : 1,
    borderColor: c.border,
    fontSize: typography.codeSize,
    lineHeight: typography.codeLineHeight,
  };
  return {
    body: { ...ui, color: c.foreground, fontSize: typography.contentSize, lineHeight: typography.proseLineHeight, rowGap: typography.blockGap, flexShrink: 1, minWidth: 0, width: "100%" },
    text: { ...ui, color: c.foreground, fontSize: typography.contentSize, lineHeight: typography.proseLineHeight, flexShrink: 1, minWidth: 0 },
    textgroup: { ...ui, color: c.foreground, fontSize: typography.contentSize, lineHeight: typography.proseLineHeight },
    paragraph: { marginTop: 0, marginBottom: 0, flexWrap: "wrap", flexDirection: "row", alignItems: "flex-start", flexShrink: 1, minWidth: 0, width: "100%" },
    heading1: heading(1), heading2: heading(2), heading3: heading(3),
    heading4: heading(4), heading5: heading(5), heading6: heading(6),
    strong: { fontWeight: "600" }, em: { fontStyle: "italic" },
    s: { textDecorationLine: "line-through", color: c.foregroundMuted },
    link: { color: coreLinkColor(theme), textDecorationLine: "none", flexShrink: 1, minWidth: 0 },
    blocklink: { color: coreLinkColor(theme), textDecorationLine: "none" },
    code_inline: { ...mono, backgroundColor: inline === "a" ? c.surface2 : "transparent", color: inline === "b" ? c.statusWarning : c.foreground, paddingHorizontal: inline === "b" ? 1 : CHAT_MARKDOWN_VISUAL.inlinePadding.horizontal, paddingVertical: inline === "b" ? 0 : CHAT_MARKDOWN_VISUAL.inlinePadding.vertical, borderRadius: CHAT_MARKDOWN_VISUAL.inlineRadius, borderWidth: inline === "c" ? 1 : 0, borderColor: c.border, fontSize: typography.codeSize, lineHeight: typography.codeLineHeight },
    code_block: codeBox, fence: codeBox,
    pre: { marginVertical: 0 },
    table: { borderWidth: table === "a" || table === "d" ? 1 : 0, borderColor: c.border, borderRadius: table === "c" ? 0 : CHAT_MARKDOWN_VISUAL.blockRadius, marginVertical: 0 },
    thead: { backgroundColor: table === "a" || table === "d" ? c.surface1 : "transparent" }, tbody: {},
    th: { paddingHorizontal: table === "c" ? 0 : CHAT_MARKDOWN_VISUAL.table.horizontal, paddingVertical: table === "c" ? CHAT_MARKDOWN_VISUAL.table.compactVertical : CHAT_MARKDOWN_VISUAL.table.vertical, borderBottomWidth: table === "b" ? 0 : 1, borderColor: c.border, fontWeight: "600", color: c.foregroundMuted, fontSize: 12, textAlign: "left" },
    tr: { borderBottomWidth: table === "b" ? 0 : 1, borderColor: c.border, flexDirection: "row" },
    td: { ...ui, paddingHorizontal: table === "c" ? 0 : CHAT_MARKDOWN_VISUAL.table.horizontal, paddingVertical: table === "c" ? CHAT_MARKDOWN_VISUAL.table.compactVertical : CHAT_MARKDOWN_VISUAL.table.vertical, borderRightWidth: table === "d" ? 1 : 0, borderColor: c.border, color: c.foreground, fontSize: typography.contentSize - 1, lineHeight: Math.round((typography.contentSize - 1) * 1.45), flex: 1 },
    bullet_list: { paddingLeft: 0, width: "100%" }, ordered_list: { paddingLeft: 0, width: "100%" },
    list_item: { marginBottom: CHAT_MARKDOWN_DENSITY[preferences.density].listGap, flexDirection: "row", alignItems: "flex-start", flexShrink: 1 },
    bullet_list_icon: { ...ui, color: c.foregroundMuted, marginLeft: CHAT_MARKDOWN_VISUAL.listMarkerMargin.left, marginRight: CHAT_MARKDOWN_VISUAL.listMarkerMargin.right, fontSize: typography.contentSize, lineHeight: typography.proseLineHeight },
    ordered_list_icon: { ...mono, color: c.foregroundMuted, marginLeft: CHAT_MARKDOWN_VISUAL.listMarkerMargin.left, marginRight: CHAT_MARKDOWN_VISUAL.listMarkerMargin.right, fontSize: typography.codeSize + 1, lineHeight: typography.proseLineHeight, minWidth: 12 },
    bullet_list_content: { flex: 1, flexShrink: 1 }, ordered_list_content: { flex: 1, flexShrink: 1 },
    blockquote: { ...quoteStyle, color: quote === "b" ? c.foreground : c.foregroundMuted, rowGap: typography.blockGap, marginVertical: 0 },
    hr: { backgroundColor: c.border, height: preferences.richText.rule === "b" ? 0 : 1, width: preferences.richText.rule === "c" ? CHAT_MARKDOWN_VISUAL.ruleWidth : "100%", marginVertical: 8 },
    image: { width: "100%", minHeight: 160, marginHorizontal: -4 },
    hardbreak: { ...ui, fontSize: typography.contentSize, lineHeight: typography.proseLineHeight }, softbreak: { ...ui, fontSize: typography.contentSize, lineHeight: typography.proseLineHeight },
  };
}

const blockParser = new MarkdownIt();
blockParser.core.ruler.disable("inline");

function isDefinitionBlock(block: string): boolean {
  const env: { references?: Record<string, unknown> } = {};
  const tokens = blockParser.parse(block, env);
  return tokens.length === 0 && Object.keys(env.references ?? {}).length > 0;
}

function splitMarkdownBlocks(text: string): string[] {
  if (!text) return [];
  const lines = text.split("\n");
  const structural = new Set<number>();
  for (const token of blockParser.parse(text, {})) {
    if (token.level !== 0 || !token.map) continue;
    for (let index = token.map[0]; index < token.map[1] - 1; index += 1) {
      if (!lines[index]?.trim()) structural.add(index);
    }
  }
  const blocks: string[] = [];
  let current: string[] = [];
  let separated = false;
  for (const [index, line] of lines.entries()) {
    if (!line.trim() && structural.has(index)) { current.push(line); continue; }
    if (!line.trim()) { if (current.length) separated = true; continue; }
    if (separated) { blocks.push(current.join("\n")); current = []; separated = false; }
    current.push(line);
  }
  if (current.length) blocks.push(current.join("\n"));
  const folded: string[] = [];
  let leading: string[] = [];
  for (const block of blocks) {
    if (isDefinitionBlock(block)) {
      if (folded.length) folded[folded.length - 1] += "\n\n" + block;
      else leading.push(block);
    } else {
      folded.push([...leading, block].join("\n\n"));
      leading = [];
    }
  }
  if (leading.length) folded.push(leading.join("\n\n"));
  return folded;
}

const IMAGE_HANDLERS = ["data:image/", "https://", "http://", "file://"];

function MarkdownRenderer({
  children,
  style,
  markdownit,
  theme,
  onLinkPress,
  preferences,
}: {
  children: string;
  style: MarkdownStyleMap;
  markdownit: MarkdownIt;
  theme: PluginTheme;
  onLinkPress: (url: string) => boolean;
  preferences: Prefs;
}) {
  const rules = useMemo(() => createRenderRules(theme, markdownit, preferences), [markdownit, preferences, theme]);
  const renderer = useMemo(
    () => createMarkdownAstRenderer({
      rules,
      styles: style,
      onLinkPress,
      imageHandlers: IMAGE_HANDLERS,
    }),
    [onLinkPress, rules, style],
  );
  return renderStableMarkdown(children, renderer, markdownit);
}

function StreamingMarkdown({
  source, theme, preferences, typography,
}: {
  source: string;
  theme: PluginTheme;
  preferences: Prefs;
  typography: ReturnType<typeof chatMarkdownTypography>;
}) {
  const styles = useMemo(
    () => createMarkdownStyles(theme, typography, preferences),
    [preferences, theme, typography],
  );
  const parser = useMemo(() => {
    const instance = new MarkdownIt({ html: false, linkify: true, typographer: false });
    const validateLink = instance.validateLink.bind(instance);
    instance.validateLink = (url: string) =>
      url.trim().toLowerCase().startsWith("file://") || validateLink(url);
    enableStreamingMarkdown(instance);
    return instance;
  }, []);
  const blocks = useMemo(() => {
    let cursor = 0;
    return splitMarkdownBlocks(source).map((block) => {
      const foundOffset = source.indexOf(block, cursor);
      const offset = foundOffset >= 0 ? foundOffset : cursor;
      cursor = offset + block.length;
      return { block, offset };
    });
  }, [source]);
  const openLink = useCallback((url: string) => {
    if (/^https?:\/\//i.test(url)) void openExternalUrl(url);
    return false;
  }, []);
  return <View {...({ className: "enrm-text" } as object)}>{blocks.map(({ block, offset }, index) => (
    <View key={"block:" + offset} style={index < blocks.length - 1 ? { marginBottom: typography.blockGap } : undefined}>
      <MarkdownRenderer
        style={styles}
        markdownit={parser}
        theme={theme}
        onLinkPress={openLink}
        preferences={preferences}
      >{block}</MarkdownRenderer>
    </View>
  ))}</View>;
}

// Paseo 0.11.x requires the registered component itself to be a function.
export function StreamingAssistant({ item, theme, agentId, timestamp }: PluginTimelineItemProps<StreamingAssistantData>) {
  const preferences = usePrefs();
  const source = item.data.text;
  const arrivalKey = `${agentId}:${timestamp.getTime()}`;
  const prefixKey = source.length >= 32 ? `${agentId}:p:${source.slice(0, 32)}` : null;
  const [animateInitial] = useState(() => {
    const claimed = streamArrivals.claim(arrivalKey, preferences.motion);
    if (!prefixKey) return claimed;
    return streamArrivals.claim(prefixKey, preferences.motion) && claimed;
  });
  // Paseo advances the source timestamp as chunks append. Remember every
  // snapshot so reopening a still-live tab cannot replay its first fade.
  streamArrivals.remember(arrivalKey);
  if (prefixKey) streamArrivals.remember(prefixKey);
  const appearance = readHostAppearance();
  const typography = useMemo(
    () => chatMarkdownTypography(appearance, preferences.density),
    [appearance.codeSize, appearance.contentSize, appearance.monoFont, appearance.uiFont, preferences.density],
  );
  return (
    <View
      style={{ paddingVertical: typography.paddingVertical }}
      testID="assistant-message"
      {...({ dataSet: { cpStreamingAssistant: "true" } } as object)}
    >
      <StreamWordFade text={source} enabled={preferences.motion} animateInitial={animateInitial}>
        <StreamingMarkdown source={source} theme={theme} preferences={preferences} typography={typography} />
      </StreamWordFade>
    </View>
  );
}
