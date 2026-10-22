import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const views = readFileSync(new URL("../client/views.tsx", import.meta.url), "utf8");

function component(name, nextName) {
  return views.slice(views.indexOf(`function ${name}`), views.indexOf(`function ${nextName}`));
}

test("task lists use the same reversible disclosure motion as tool details", () => {
  const taskChange = component("TaskChangeRow", "TodoLine");
  const tasks = views.slice(views.indexOf("export function TodoItem"), views.indexOf("export function NoticeItem"));

  assert.match(taskChange, /<Expand open=\{open\}/);
  assert.match(tasks, /<Expand open=\{open\}/);
});
