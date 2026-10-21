import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../client/message-entry-motion.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = { exports: {} };
new Function("exports", "module", js)(module.exports, module);
const { shouldQueueMessageEntrance } = module.exports;

const liveEntry = {
  hasPreviousChatState: true,
  wasRunning: false,
  running: true,
  isUserMessage: false,
  suppressHydrationMotion: false,
  isNew: true,
  allow: true,
  atBottom: true,
};

test("queues a newly arriving live row even before it becomes visible", () => {
  assert.equal(shouldQueueMessageEntrance(liveEntry), true);
});

test("does not queue the first population of rehydrated history", () => {
  assert.equal(shouldQueueMessageEntrance({ ...liveEntry, suppressHydrationMotion: true }), false);
});

test("does not turn passive assistant history into entry motion", () => {
  assert.equal(shouldQueueMessageEntrance({ ...liveEntry, running: false }), false);
});

test("allows a local user row without waiting for the Working indicator", () => {
  assert.equal(shouldQueueMessageEntrance({ ...liveEntry, running: false, isUserMessage: true }), true);
});
