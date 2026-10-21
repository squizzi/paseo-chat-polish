import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../client/streaming-markdown.tsx", import.meta.url), "utf8");

function loadTypeScriptModule(path) {
  const moduleSource = readFileSync(new URL(path, import.meta.url), "utf8");
  const js = ts.transpileModule(moduleSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function("exports", "module", js)(module.exports, module);
  return module.exports;
}

test("streaming markdown uses Chat Polish's style contract", () => {
  assert.match(source, /chatMarkdownTypography/);
  assert.doesNotMatch(source, /const contentSize = 15;/);
  assert.match(source, /testID="assistant-message"/);
  assert.match(source, /className: "enrm-text"/);
  assert.match(source, /paseoMarkdownTag/);
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
    uiFont: "Reader",
    monoFont: "Code, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    contentSize: 15,
    codeSize: 12,
    proseLineHeight: 24,
    codeLineHeight: 18,
    blockGap: 14,
    paddingVertical: 4,
  });
});

test("streaming image placeholders start at their configured thumbnail size", () => {
  const { streamingImageFrameSize } = loadTypeScriptModule("../client/streaming-image-layout.ts");

  assert.deepEqual(streamingImageFrameSize("web", "small"), { width: 200, height: 128, minHeight: 128 });
  assert.deepEqual(streamingImageFrameSize("web", "large"), { width: 320, height: 200, minHeight: 200 });
  assert.equal(streamingImageFrameSize("web", "native"), undefined);
  assert.equal(streamingImageFrameSize("ios", "small"), undefined);
});
