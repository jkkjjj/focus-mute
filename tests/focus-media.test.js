import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
function fixture() {
  const attrs = new Map(),
    root = {
      sig: "old",
      isConnected: true,
      matches: () => false,
      closest: () => null,
      getAttribute: (k) => attrs.get(k),
      setAttribute: (k, v) => attrs.set(k, v),
      removeAttribute: (k) => attrs.delete(k),
      querySelectorAll: () => [v],
    };
  class M {
    constructor() {
      this._muted = false;
      this._defaultMuted = false;
      this._src = "a.mp4";
      this.isConnected = true;
      this.paused = true;
    }
    closest() {
      return root;
    }
    play() {
      this.paused = false;
      this.playCalled = true;
      return Promise.resolve();
    }
    pause() {
      this.paused = true;
    }
    load() {}
    setAttribute(k, v) {
      this["_" + k] = v;
    }
    getAttribute(k) {
      return this["_" + k];
    }
  }
  for (const k of ["muted", "defaultMuted", "src", "srcObject", "volume"])
    Object.defineProperty(M.prototype, k, {
      configurable: true,
      get() {
        return this["_" + k];
      },
      set(v) {
        this["_" + k] = v;
      },
    });
  const v = new M(),
    listeners = {},
    c = {
      HTMLMediaElement: M,
      HTMLSourceElement: class {},
      Element: M,
      URL,
      Promise,
      DOMException,
      console,
      location: {
        href: "https://www.xiaohongshu.com/explore",
        origin: "https://www.xiaohongshu.com",
      },
      document: {
        documentElement: { getAttribute: () => null, setAttribute() {} },
        querySelectorAll: (s) => (s === "video,audio" ? [v] : [root]),
        addEventListener: (n, f) => (listeners[n] = f),
      },
      history: {
        pushState() {
          c.location.href += "new";
        },
        replaceState() {},
      },
      MutationObserver: class {
        constructor(f) {
          c.mutate = f;
        }
        observe() {}
      },
      setInterval() {},
      XhsFocusDOM: {
        CARDS: ".note-item",
        DETAILS: ".note-container",
        read: (e) => ({ signature: e.sig, contentSignature: e.sig }),
        detailRoute: () => false,
        unsupportedRoute: () => false,
      },
    };
  c.window = c;
  c.addEventListener = (n, f) => (listeners[n] = f);
  c.postMessage = () => {};
  const file = new URL("../extension/xhs-focus-media.js", import.meta.url);
  assert.ok(fs.existsSync(file));
  vm.runInNewContext(fs.readFileSync(file, "utf8"), c);
  return {
    v,
    root,
    c,
    listeners,
    allow() {
      attrs.set("data-xf-allow", "yes");
      c.mutate([
        { type: "attributes", attributeName: "data-xf-allow", target: root },
      ]);
    },
  };
}

test("all media play normally while muted including learning", async () => {
  const f = fixture();
  await f.v.play();
  assert.equal(f.v.paused, false);
  assert.equal(f.v.muted, true);
  f.allow();
  f.v.muted = false;
  await f.v.play();
  assert.equal(f.v.paused, false);
  assert.equal(f.v.muted, true);
});
test("source and route preserve mute without pause", async () => {
  const f = fixture();
  await f.v.play();
  f.v.src = "b.mp4";
  f.c.history.pushState({}, "", "/explore/new");
  f.v.muted = false;
  await f.v.play();
  assert.equal(f.v.muted, true);
  assert.equal(f.v.paused, false);
});
test("STOP restores original media mute when controller is off", async () => {
  const f = fixture();
  await f.v.play();
  assert.equal(f.v.muted, true);
  f.c.document.documentElement.getAttribute = () => "yes";
  f.c.mutate([]);
  assert.equal(f.v.muted, false);
  assert.equal(f.v.paused, false);
});

test("Pause preserves mute requests made while FocusMute was active", () => {
  const f = fixture();
  f.v.muted = true;
  f.v.defaultMuted = true;
  f.c.document.documentElement.getAttribute = () => "yes";
  f.c.mutate([]);
  assert.equal(f.v.muted, true);
  assert.equal(f.v.defaultMuted, true);
});
test("a user mute immediately after Pause survives delayed observer restoration", () => {
  const f = fixture();
  f.c.document.documentElement.getAttribute = () => "yes";
  f.v.muted = true;
  f.c.mutate([]);
  assert.equal(f.v.muted, true);
});
