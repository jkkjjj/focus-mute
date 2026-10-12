import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";

function fixture() {
  const attributes = new Map();
  const pending = [];
  let messageListener, interval;
  const context = {
    location: { href: "https://www.xiaohongshu.com/explore" },
    document: {
      documentElement: {
        getAttribute: (key) => attributes.get(key),
        setAttribute: (key, value) => attributes.set(key, value),
      },
    },
    chrome: {
      runtime: {
        sendMessage: (message) =>
          new Promise((resolve) => pending.push({ message, resolve })),
        onMessage: {
          addListener: (fn) => {
            messageListener = fn;
          },
        },
      },
    },
    setInterval: (fn) => {
      interval = fn;
    },
  };
  vm.runInNewContext(
    fs.readFileSync(
      new URL("../extension/xhs-content.js", import.meta.url),
      "utf8",
    ),
    context,
  );
  return {
    attributes,
    pending,
    context,
    tick: () => interval(),
    send: (kind) => messageListener({ kind }, {}, () => {}),
  };
}
const flush = () => new Promise((resolve) => setImmediate(resolve));

test("late enabled reply cannot undo a pause; resume rechecks policy", async () => {
  const f = fixture();
  assert.equal(f.attributes.get("data-xf-off"), "no");
  f.send("STOP");
  f.pending[0].resolve({ enabled: true });
  await flush();
  assert.equal(f.attributes.get("data-xf-off"), "yes");
  f.send("RESET");
  assert.equal(f.attributes.get("data-xf-off"), "no");
  f.pending[1].resolve({ enabled: true });
  await flush();
  assert.equal(f.attributes.get("data-xf-off"), "no");
});

test("loading while paused releases the media gate without inspecting posts", async () => {
  const f = fixture();
  f.pending[0].resolve({ enabled: false });
  await flush();
  assert.equal(f.attributes.get("data-xf-off"), "yes");
});

test("navigation rejects old replies and queries the new URL", async () => {
  const f = fixture();
  f.context.location.href += "/new-post";
  f.tick();
  assert.equal(f.pending[1].message.href, f.context.location.href);
  f.pending[1].resolve({ enabled: false });
  await flush();
  f.pending[0].resolve({ enabled: true });
  await flush();
  assert.equal(f.attributes.get("data-xf-off"), "yes");
});
