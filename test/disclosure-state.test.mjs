import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../client/disclosure-state.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = { exports: {} };
new Function("exports", "module", js)(module.exports, module);
const { recallDisclosure, rememberDisclosure, shouldRestoreOpenDisclosure } = module.exports;

test("a tool detail keeps its explicit open or closed state after its tab remounts", () => {
  const key = "agent-a:tool:call-1";

  assert.deepEqual(recallDisclosure(key, false), { open: false, restored: false });
  rememberDisclosure(key, true);
  assert.deepEqual(recallDisclosure(key, false), { open: true, restored: true });
  rememberDisclosure(key, false);
  assert.deepEqual(recallDisclosure(key, true), { open: false, restored: true });
});

test("only a disclosure restored open suppresses its initial entrance", () => {
  const key = "agent-b:tool:call-2";

  rememberDisclosure(key, false);
  assert.equal(shouldRestoreOpenDisclosure(recallDisclosure(key, true)), false);
  rememberDisclosure(key, true);
  assert.equal(shouldRestoreOpenDisclosure(recallDisclosure(key, false)), true);
});
