import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
test("STOP invalidates pending classification and ignores its late allow reply", async () => {
  const listeners = {},
    posted = [];
  let runtimeListener, release;
  const node = () => ({
    style: {},
    append() {},
    attachShadow() {
      return node();
    },
  });
  const context = {
    URL,
    crypto: { randomUUID },
    location: {
      href: "https://www.youtube.com/watch?v=abcdefghijk",
      origin: "https://www.youtube.com",
    },
    document: { documentElement: node(), createElement: node },
    setTimeout() {},
    setInterval() {},
    chrome: {
      runtime: {
        onMessage: {
          addListener(f) {
            runtimeListener = f;
          },
        },
        sendMessage: async (m) =>
          m.kind === "CLASSIFY"
            ? new Promise((r) => (release = r))
            : { enabled: true },
      },
    },
  };
  context.window = context;
  context.addEventListener = (e, f) => (listeners[e] = f);
  context.postMessage = (m) => posted.push(m);
  const c = vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(
      new URL("../extension/content.js", import.meta.url),
      "utf8",
    ),
    c,
  );
  const event = async (m) => {
    context.data = { source: "ysf-main", ...m };
    await vm.runInContext("undefined", c);
    context.handler = listeners.message;
    await vm.runInContext("handler({source:window,data})", c);
  };
  await event({ kind: "READY", id: "abcdefghijk", revision: 0 });
  await new Promise((r) => setTimeout(r, 0));
  const read = posted.find((x) => x.kind === "READ");
  assert.ok(read);
  const pending = event({
    kind: "METADATA",
    request: read.request,
    id: "abcdefghijk",
    revision: 0,
    metadata: { id: "abcdefghijk", title: "Python tutorial" },
  });
  await new Promise((r) => setTimeout(r, 0));
  runtimeListener({ kind: "STOP" }, {}, () => {});
  release({ enabled: true, allow: true, reason: "study" });
  await pending;
  assert.equal(
    posted.some((x) => x.kind === "DECISION" && x.allow),
    false,
  );
});
