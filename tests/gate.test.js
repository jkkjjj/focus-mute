import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
function fixture(playerResponse = null) {
  const listeners = {};
  let actual = false;
  let url = "https://www.youtube.com/watch?v=abcdefghijk";
  class Media {
    play() {
      return Promise.resolve();
    }
    load() {}
  }
  Object.defineProperty(Media.prototype, "muted", {
    configurable: true,
    get() {
      return actual;
    },
    set(v) {
      actual = !!v;
    },
  });
  Object.defineProperty(Media.prototype, "src", {
    configurable: true,
    get() {
      return "";
    },
    set(v) {},
  });
  Object.defineProperty(Media.prototype, "srcObject", {
    configurable: true,
    get() {
      return null;
    },
    set(v) {},
  });
  const video = new Media();
  const messages = [];
  const c = {
    HTMLMediaElement: Media,
    URL,
    console,
    location: {
      get href() {
        return url;
      },
    },
    history: { pushState() {}, replaceState() {} },
    document: {
      querySelectorAll: (s) =>
        s === "video,audio"
          ? [video]
          : playerResponse && s.includes(".html5-video-player")
            ? [{ getPlayerResponse: () => playerResponse }]
            : [],
      querySelector: () => null,
      documentElement: {},
      addEventListener: (n, f) => {
        (listeners[n] ??= []).push(f);
      },
    },
    MutationObserver: class {
      observe() {}
    },
    setInterval: () => 0,
    clearInterval() {},
    setTimeout: () => 0,
    fetch() {
      throw Error("unexpected fetch");
    },
  };
  c.window = c;
  c.addEventListener = (n, f) => {
    (listeners[n] ??= []).push(f);
  };
  c.postMessage = (m) => messages.push(m);
  c.performance = { now: () => 0 };
  vm.runInNewContext(
    fs.readFileSync(new URL("../extension/gate.js", import.meta.url), "utf8"),
    c,
  );
  const message = (data) => {
    for (const f of listeners.message || [])
      f({ source: c, ...{ data: { source: "ysf-isolated", ...data } } });
  };
  // vm window identity differs outside the VM: deliver within the same context.
  const context = vm.createContext(c);
  const send = (data) => {
    c.__message = { source: "ysf-isolated", ...data };
    vm.runInContext(
      "(globalThis.__listeners||[]).forEach(f=>f({source:window,data:__message}))",
      context,
    );
  };
  c.__listeners = listeners.message;
  return {
    video,
    send,
    raw: () => actual,
    messages,
    navigate(id) {
      url = "https://www.youtube.com/watch?v=" + id;
    },
    context,
  };
}
test("gate defaults muted and intercepts ordinary manual unmute synchronously", () => {
  const f = fixture();
  f.video.play();
  assert.equal(f.raw(), true);
  f.video.muted = false;
  assert.equal(f.raw(), true);
});
test("permission belongs to one video; URL changes revoke it before play", () => {
  const f = fixture();
  f.send({ kind: "DECISION", id: "abcdefghijk", allow: true });
  assert.equal(f.raw(), false);
  f.navigate("12345678901");
  f.video.play();
  assert.equal(f.raw(), true);
  f.send({ kind: "DECISION", id: "abcdefghijk", allow: true });
  assert.equal(f.raw(), true);
});
test("stop restores desired user mute state", () => {
  const f = fixture();
  f.video.muted = false;
  f.send({ kind: "STOP" });
  assert.equal(f.raw(), false);
  f.video.muted = true;
  assert.equal(f.raw(), true);
});
test("reads matching metadata from a Shorts HTML5 player without a movie_player ID", () => {
  const f = fixture({
    videoDetails: {
      videoId: "abcdefghijk",
      title: "Python tutorial",
      author: "Instructor",
      channelId: "UCteacher",
      shortDescription: "Programming exercises",
    },
  });
  f.send({ kind: "READ", request: 1 });
  const r = f.messages.find((m) => m.kind === "METADATA");
  assert.equal(r.metadata?.id, "abcdefghijk");
});
test("an allowed current video does not release a different preloaded player in the same page", () => {
  const f = fixture();
  f.video.closest = () => ({
    getVideoData: () => ({ video_id: "12345678901" }),
  });
  f.send({ kind: "DECISION", id: "abcdefghijk", allow: true });
  assert.equal(f.raw(), true);
});
