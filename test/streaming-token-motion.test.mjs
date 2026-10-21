import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../client/streaming-token-motion.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = { exports: {} };
new Function("exports", "module", js)(module.exports, module);
const { nextFadeState, settleFadeState, STREAM_TOKEN_PREROLL_MS, STREAM_TOKEN_FADE_MS, STREAM_FADE_DURATION_MS } = module.exports;

test("streamed text waits briefly while chat-follow motion gets a head start", () => {
  assert.equal(STREAM_TOKEN_PREROLL_MS, 36);
  assert.equal(STREAM_TOKEN_FADE_MS, 400);
  assert.equal(STREAM_FADE_DURATION_MS, STREAM_TOKEN_PREROLL_MS + STREAM_TOKEN_FADE_MS);
});

test("only the newest streamed tail keeps an active fade window", () => {
  const initial = { committed: "Hello", chunks: [] };
  const first = nextFadeState(initial, "Hello world", true, 100);
  const second = nextFadeState(first, "Hello world!", true, 180);

  assert.equal(second.committed, "Hello world");
  assert.deepEqual(second.chunks, [
    { start: 11, text: "!", startedAtMs: 180 },
  ]);
});

test("settling old text does not restart a newer append", () => {
  const state = {
    committed: "Hello",
    chunks: [
      { start: 5, text: " world", startedAtMs: 100 },
      { start: 11, text: "!", startedAtMs: 350 },
    ],
  };

  assert.deepEqual(settleFadeState(state, 100 + STREAM_FADE_DURATION_MS), {
    committed: "Hello world",
    chunks: [{ start: 11, text: "!", startedAtMs: 350 }],
  });
});

test("disabled motion commits the current text without fade chunks", () => {
  assert.deepEqual(nextFadeState({
    committed: "Hello",
    chunks: [{ start: 5, text: " world", startedAtMs: 100 }],
  }, "Hello world!", false, 150), { committed: "Hello world!", chunks: [] });
});
