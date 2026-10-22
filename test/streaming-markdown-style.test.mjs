import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../client/streaming-markdown.tsx", import.meta.url), "utf8");

function loadTypeScriptModule(path) {
  const moduleSource = readFileSync(new URL(path, import.meta.url), "utf8");
  const js = ts.transpileModule(moduleSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  const require = (id) => {
    if (id === "./chat-markdown-style") return loadTypeScriptModule("../client/chat-markdown-style.ts");
    throw new Error(`Unexpected test dependency: ${id}`);
  };
  new Function("exports", "module", "require", js)(module.exports, module, require);
  return module.exports;
}

test("streaming markdown uses Chat Polish's style contract", () => {
  assert.match(source, /chatMarkdownTypography/);
  assert.doesNotMatch(source, /const contentSize = 15;/);
  assert.match(source, /fontFamily: typography\.uiFont/);
  assert.match(source, /testID="assistant-message"/);
  assert.match(source, /className: "enrm-text"/);
  assert.match(source, /paseoMarkdownTag/);
});

test("streaming Markdown code keeps the configured mono font", () => {
  const highlighted = source.slice(
    source.indexOf("function HighlightedStreamingCode"),
    source.indexOf("function createRenderRules"),
  );
  const rules = source.slice(
    source.indexOf("function createRenderRules"),
    source.indexOf("function markdownListSpacing"),
  );

  assert.match(source, /dataSet: \{ pmono: "" \}/);
  assert.match(highlighted, /\.\.\.MONO_TEXT_PROPS/);
  assert.match(rules, /code_inline[\s\S]*\.\.\.MONO_TEXT_PROPS/);
});

test("streaming assistant replacement stays web-only and shares its renderer schema", () => {
  const entry = readFileSync(new URL("../index.client.tsx", import.meta.url), "utf8");

  assert.match(entry, /Platform\.OS === "web" \? \[/);
  assert.match(entry, /schema: streamingAssistantSchema/);
  assert.doesNotMatch(entry, /schema: z\.object\(\{ text:/);
});

test("private Markdown renderer imports stay behind one typed adapter", () => {
  const adapter = readFileSync(new URL("../client/markdown-renderer-adapter.ts", import.meta.url), "utf8");
  const parser = readFileSync(new URL("../client/streaming-markdown-parser.ts", import.meta.url), "utf8");

  assert.match(adapter, /react-native-markdown-display\/src\/lib\/AstRenderer/);
  assert.match(source, /createMarkdownAstRenderer/);
  assert.doesNotMatch(source, /react-native-markdown-display\/src\/lib/);
  assert.doesNotMatch(parser, /\bany\b/);
  assert.doesNotMatch(adapter, /\bany\b/);
});

test("only newly streamed inline images animate when loading completes", () => {
  const image = source.slice(
    source.indexOf("function StreamingMarkdownImage"),
    source.indexOf("const LANGUAGE_ALIASES"),
  );

  assert.match(source, /fade\.source\.lastIndexOf\(source\)/);
  assert.match(image, /const \[animateArrival\] = useState\(\(\) => isNewStreamImage\(fade, source\)\)/);
  assert.match(image, /status === "loaded" && animateArrival \? IMAGE_ARRIVAL_PROPS/);
  assert.match(image, /onLoad=\{\(\) => setLoadState\(\{ source, status: "loaded" \}\)\}/);
});

test("a live assistant snapshot fades when its tab first opens", () => {
  const fade = source.slice(
    source.indexOf("export function StreamWordFade"),
    source.indexOf("export function StreamFadeText"),
  );

  assert.doesNotMatch(fade, /committed: text/,
    "committing the first live snapshot makes a newly opened sub-task tab pop in fully rendered");
  assert.match(fade, /animateInitial/,
    "the live item must distinguish its first mount from later tab remounts");
});

test("image-only rows carry live phase into one-shot arrival identity", () => {
  const entry = readFileSync(new URL("../index.client.tsx", import.meta.url), "utf8");
  const views = readFileSync(new URL("../client/views.tsx", import.meta.url), "utf8");
  const thumbnail = views.slice(
    views.indexOf("function Thumbnail"),
    views.indexOf("type KeyTarget"),
  );

  assert.match(entry, /transform: \(\{ item, phase \}\)/);
  assert.match(entry, /one\("images", \{ \.\.\.data, phase \}\)/);
  assert.match(views, /imageArrivals\.claim\(arrivalKey, live && prefs\.motion\)/);
  assert.match(views, /timestamp\.getTime\(\)/);
  assert.match(thumbnail, /onLoad=.*setLoaded/,
    "the actual thumbnail image load must trigger its arrival");
  assert.match(thumbnail, /loaded && animateArrival \? IMAGE_ARRIVAL_PROPS/,
    "the arrival animation must wait until the thumbnail is decoded");
});

test("thinking panels apply the shared tail fade to paced streaming text", () => {
  const views = readFileSync(new URL("../client/views.tsx", import.meta.url), "utf8");
  const thought = views.slice(
    views.indexOf("export function ThoughtItem"),
    views.indexOf("export function PlanItem"),
  );

  assert.match(thought, /StreamWordFade/);
  assert.match(thought, /enabled=\{motion && streaming\}/);
  assert.match(thought, /<StreamFadeText content=\{para\}/);
});

test("timeline renderers do not call the declaration-only revealed-text hook", () => {
  const views = readFileSync(new URL("../client/views.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(views, /\buseRevealedText\b/);
});

test("completed merged tool runs expose their logical summary arrival", () => {
  const views = readFileSync(new URL("../client/views.tsx", import.meta.url), "utf8");
  const merged = views.slice(
    views.indexOf("export function MergedSteps"),
    views.indexOf("export function ThoughtItem"),
  );

  assert.match(views, /cpRunSummary/);
  assert.match(merged, /\.\.\.\(!live \? RUN_SUMMARY : \{\}\)/);
});

test("the shared contract follows host typography and Chat Polish density", () => {
  const contractSource = readFileSync(new URL("../client/chat-markdown-style.ts", import.meta.url), "utf8");
  const js = ts.transpileModule(contractSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function("exports", "module", js)(module.exports, module);
  const typography = module.exports.chatMarkdownTypography({
    uiFont: "Reader",
    monoFont: "Code",
    contentSize: 15,
    codeSize: 12,
  }, "normal");

  assert.deepEqual(typography, {
    uiFont: "Reader, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    monoFont: "Code, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    contentSize: 15,
    codeSize: 12,
    proseLineHeight: 24,
    codeLineHeight: 18,
    blockGap: 14,
    paddingVertical: 4,
  });

  const defaults = module.exports.chatMarkdownTypography({
    contentSize: 15,
    codeSize: 12,
  }, "normal");
  assert.equal(defaults.uiFont, "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif");
});

test("completed and streaming Markdown share visual metrics", () => {
  const contract = readFileSync(new URL("../client/chat-markdown-style.ts", import.meta.url), "utf8");
  const web = readFileSync(new URL("../client/web.ts", import.meta.url), "utf8");
  const views = readFileSync(new URL("../client/views.tsx", import.meta.url), "utf8");

  assert.match(contract, /CHAT_MARKDOWN_VISUAL/);
  assert.match(contract, /CHAT_IMAGE_FRAMES/);
  assert.match(contract, /CHAT_ROW_TIGHT/);
  assert.match(contract, /CHAT_ROW_QUIET/);
  assert.match(source, /CHAT_MARKDOWN_VISUAL/);
  assert.match(web, /CHAT_MARKDOWN_VISUAL/);
  assert.match(web, /CHAT_IMAGE_FRAMES/);
  assert.match(web, /CHAT_ROW_TIGHT/);
  assert.match(web, /CHAT_ROW_QUIET/);
  assert.match(views, /CHAT_IMAGE_FRAMES/);
  assert.match(views, /CHAT_ROW_TIGHT/);
  assert.match(views, /CHAT_ROW_QUIET/);
  assert.doesNotMatch(web, /const hexAlpha =/);
  assert.doesNotMatch(web, /const darker =/);
  assert.doesNotMatch(views, /const TIGHT = /);
  assert.doesNotMatch(views, /const QUIET = /);
});

test("sunken surfaces and hex alpha live in one module", () => {
  const { alpha, sunken } = loadTypeScriptModule("../client/color.ts");

  assert.equal(sunken("#23272e"), "#1e2228");
  assert.equal(alpha("#23272e", 0.6), "#23272e99");
  assert.equal(alpha("#abc", 1), "#aabbccff");
  assert.equal(sunken("rgb(35, 39, 46)"), "rgb(35, 39, 46)");
});

test("streaming image placeholders start at their configured thumbnail size", () => {
  const { createImageArrivalRegistry, streamingImageFrameSize } = loadTypeScriptModule("../client/streaming-image-layout.ts");

  assert.deepEqual(streamingImageFrameSize("web", "small"), { width: 200, height: 128, minHeight: 128 });
  assert.deepEqual(streamingImageFrameSize("web", "large"), { width: 320, height: 200, minHeight: 200 });
  assert.equal(streamingImageFrameSize("web", "native"), undefined);
  assert.equal(streamingImageFrameSize("ios", "small"), undefined);

  const arrivals = createImageArrivalRegistry();
  assert.equal(arrivals.claim("agent:turn:image", true), true);
  assert.equal(arrivals.claim("agent:turn:image", true), false, "a tab remount must not replay the same image arrival");
  assert.equal(arrivals.claim("agent:history:image", false), false, "rehydrated images start settled");
});

test("streaming Markdown preserves inherited block styles, list roles, and code fence languages for handoff parity", () => {
  const highlighted = source.slice(
    source.indexOf("function HighlightedStreamingCode"),
    source.indexOf("function createRenderRules"),
  );
  const rules = source.slice(
    source.indexOf("function createRenderRules"),
    source.indexOf("function markdownListSpacing"),
  );
  const styles = source.slice(
    source.indexOf("function createMarkdownStyles"),
    source.indexOf("const blockParser"),
  );

  assert.match(rules, /style=\{\[styles\.text, inherited\]\}/,
    "inherited heading, quote, strikethrough, and table styles must override base prose text style");
  assert.match(rules, /\.\.\.MARKDOWN_ROLE\("bullet_list"\)/);
  assert.match(rules, /\.\.\.MARKDOWN_ROLE\("ordered_list"\)/);
  assert.match(rules, /\.\.\.MARKDOWN_ROLE\("list_item"\)/);
  assert.match(highlighted, /paseoMarkdownLanguage: rawLanguage/,
    "fenced code blocks must expose their language attribute so the header strip does not pop in on completion");
  assert.match(styles, /td: \{ \.\.\.ui,/,
    "table body cells use the UI font in both streaming and completed renderers");
  assert.match(styles, /rowGap: typography\.blockGap/,
    "adjacent top-level blocks inside a single Markdown section keep blockGap spacing");
});

test("streaming assistant holds handoff until the final token fade completes", () => {
  const entry = readFileSync(new URL("../index.client.tsx", import.meta.url), "utf8");

  assert.match(entry, /STREAM_FADE_DURATION_MS/);
  assert.match(entry, /addStreamingTransformers/);
  assert.match(entry, /hold\.timer \?\?= setTimeout/);
});
