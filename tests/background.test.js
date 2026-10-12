import test from "node:test";
import assert from "node:assert/strict";
const event = () => ({
  listeners: [],
  addListener(f) {
    this.listeners.push(f);
  },
  fire(...args) {
    this.listeners.forEach((f) => f(...args));
  },
});
const clone = (x) => structuredClone(x);
function storage() {
  const data = {};
  return {
    async get(keys) {
      return clone(
        keys === null
          ? data
          : typeof keys === "string"
            ? { [keys]: data[keys] }
            : Object.fromEntries(keys.map((k) => [k, data[k]])),
      );
    },
    async set(o) {
      Object.assign(data, clone(o));
    },
    async remove(k) {
      delete data[k];
    },
  };
}
async function setup() {
  const tabs = new Map([
    [
      1,
      {
        id: 1,
        url: "https://www.youtube.com/watch?v=abcdefghijk",
        mutedInfo: { muted: false, reason: "user" },
      },
    ],
    [
      2,
      {
        id: 2,
        url: "https://www.youtube.com/watch?v=12345678901",
        mutedInfo: { muted: true, reason: "user" },
      },
    ],
  ]);
  globalThis.chrome = {
    storage: { local: storage(), session: storage() },
    runtime: {
      id: "test",
      getURL: (p) => "chrome-extension://test/" + p,
      onMessage: event(),
      onStartup: event(),
      onInstalled: event(),
    },
    webNavigation: {
      onBeforeNavigate: event(),
      onErrorOccurred: event(),
      onHistoryStateUpdated: event(),
      onCommitted: event(),
    },
    action: {
      async setBadgeText() {},
      async setBadgeBackgroundColor() {},
      async setTitle() {},
    },
    tabs: {
      onUpdated: event(),
      onRemoved: event(),
      async get(id) {
        return clone(tabs.get(id));
      },
      async query() {
        return clone([...tabs.values()]);
      },
      async sendMessage() {
        return null;
      },
      async update(id, changes) {
        const t = tabs.get(id);
        if ("muted" in changes && t.mutedInfo.muted !== changes.muted) {
          t.mutedInfo = {
            muted: changes.muted,
            reason: "extension",
            extensionId: "test",
          };
          queueMicrotask(() =>
            chrome.tabs.onUpdated.fire(
              id,
              { mutedInfo: clone(t.mutedInfo) },
              clone(t),
            ),
          );
        }
        return clone(t);
      },
    },
  };
  await import("../extension/background.js?test=" + Math.random());
  const send = (m, id) =>
    new Promise((resolve) =>
      chrome.runtime.onMessage.listeners[0](
        m,
        id
          ? { tab: clone(tabs.get(id)), url: tabs.get(id).url, frameId: 0 }
          : {
              tab: { id: 100 },
              frameId: 0,
              url: "chrome-extension://test/options.html",
            },
        resolve,
      ),
    );
  return { tabs, send };
}
const study = (id) => ({
  id,
  title: "Python tutorial: functions",
  channel: "Instructor",
  channelId: "UCteacher",
  description: "Programming exercises and lessons",
});
test("options opened as a browser tab receives configuration", async () => {
  const { send } = await setup();
  const c = await send({ kind: "CONFIG" });
  assert.equal(c.enabled, true);
  assert.equal(c.rules.version, 1);
});
test("worker classifies independently, rejects stale results, enforces unmute and restores baseline", async () => {
  const { tabs, send } = await setup();
  for (const [id, vid] of [
    [1, "abcdefghijk"],
    [2, "12345678901"],
  ])
    await send(
      { kind: "BEGIN", id: vid, token: "doc" + id, gateReady: true },
      id,
    );
  assert.equal(tabs.get(1).mutedInfo.muted, true);
  assert.equal(
    (
      await send(
        {
          kind: "CLASSIFY",
          id: "abcdefghijk",
          token: "stale",
          metadata: study("abcdefghijk"),
        },
        1,
      )
    ).allow,
    false,
  );
  assert.equal(
    (
      await send(
        {
          kind: "CLASSIFY",
          id: "abcdefghijk",
          token: "doc1",
          metadata: study("abcdefghijk"),
        },
        1,
      )
    ).allow,
    true,
  );
  assert.equal(tabs.get(1).mutedInfo.muted, false);
  assert.equal(tabs.get(2).mutedInfo.muted, true);
  await chrome.tabs.update(2, { muted: false });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(tabs.get(2).mutedInfo.muted, true);
  assert.equal((await send({ kind: "ENABLE", enabled: false })).ok, true);
  assert.equal(tabs.get(1).mutedInfo.muted, false);
  assert.equal(tabs.get(2).mutedInfo.muted, true);
});
test("queued classification rechecks enabled after stop", async () => {
  const { tabs, send } = await setup();
  await send(
    { kind: "BEGIN", id: "abcdefghijk", token: "doc", gateReady: true },
    1,
  );
  let release, entered;
  const wait = new Promise((r) => (release = r)),
    started = new Promise((r) => (entered = r)),
    get = chrome.tabs.get;
  let hold = true;
  chrome.tabs.get = async (id) => {
    if (hold) {
      hold = false;
      entered();
      await wait;
    }
    return get(id);
  };
  const first = send({ kind: "STATUS" }, 1);
  await started;
  const pending = send(
    {
      kind: "CLASSIFY",
      id: "abcdefghijk",
      token: "doc",
      metadata: study("abcdefghijk"),
    },
    1,
  );
  await new Promise((r) => setTimeout(r, 0));
  await chrome.storage.local.set({ enabled: false });
  release();
  await first;
  const result = await pending;
  assert.equal(result.enabled, false);
  assert.notEqual(result.allow, true);
});
test("canceled external navigation does not release mute; committed external navigation does", async () => {
  const { tabs, send } = await setup();
  await send(
    { kind: "BEGIN", id: "abcdefghijk", token: "doc", gateReady: true },
    1,
  );
  chrome.webNavigation.onBeforeNavigate.fire({
    tabId: 1,
    frameId: 0,
    url: "https://example.com/",
  });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(tabs.get(1).mutedInfo.muted, true);
  tabs.get(1).url = "https://example.com/";
  chrome.webNavigation.onCommitted.fire({
    tabId: 1,
    frameId: 0,
    url: "https://example.com/",
  });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(tabs.get(1).mutedInfo.muted, false);
});
test("genuine user mute during allowed playback survives subsequent classification and stop", async () => {
  const { tabs, send } = await setup();
  await send(
    { kind: "BEGIN", id: "abcdefghijk", token: "doc", gateReady: true },
    1,
  );
  await send(
    {
      kind: "CLASSIFY",
      id: "abcdefghijk",
      token: "doc",
      metadata: study("abcdefghijk"),
    },
    1,
  );
  tabs.get(1).mutedInfo = { muted: true, reason: "user" };
  chrome.tabs.onUpdated.fire(
    1,
    { mutedInfo: { muted: true, reason: "user" } },
    clone(tabs.get(1)),
  );
  await new Promise((r) => setTimeout(r, 20));
  await send(
    { kind: "BEGIN", id: "abcdefghijk", token: "doc2", gateReady: true },
    1,
  );
  await send(
    {
      kind: "CLASSIFY",
      id: "abcdefghijk",
      token: "doc2",
      metadata: study("abcdefghijk"),
    },
    1,
  );
  assert.equal(tabs.get(1).mutedInfo.muted, true);
  await send({ kind: "ENABLE", enabled: false });
  assert.equal(tabs.get(1).mutedInfo.muted, true);
});
test("XHS always stays muted, including old learning-classification requests", async () => {
  const { tabs, send } = await setup(),
    href = "https://www.xiaohongshu.com/explore";
  tabs.set(3, {
    id: 3,
    url: href,
    mutedInfo: { muted: false, reason: "user" },
  });
  await send({ kind: "XHS_STATUS", href }, 3);
  assert.equal(tabs.get(3).mutedInfo.muted, true);
  const r = await send(
    {
      kind: "XHS_CLASSIFY",
      href,
      entries: [{ metadata: { title: "Python tutorial" } }],
    },
    3,
  );
  assert.notEqual(r.allow, true);
  await chrome.tabs.update(3, { muted: false });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(tabs.get(3).mutedInfo.muted, true);
  await send({ kind: "ENABLE", enabled: false });
  assert.equal(tabs.get(3).mutedInfo.muted, false);
});
test("fresh install initializes portable defaults without fetching migration files", async () => {
  await setup();
  let fetched = false;
  globalThis.fetch = async () => {
    fetched = true;
    throw Error("No migration file");
  };
  await chrome.runtime.onInstalled.listeners[0]();
  const c = await chrome.storage.local.get(["rules", "enabled"]);
  assert.equal(fetched, false);
  assert.equal(c.enabled, true);
  assert.deepEqual(c.rules.allowVideoIds, []);
});
test("updates preserve disabled state and custom rules", async () => {
  const { send } = await setup();
  const rules = (await send({ kind: "CONFIG" })).rules;
  rules.allowVideoIds = ["abcdefghijk"];
  await chrome.storage.local.set({ enabled: false, rules });
  await chrome.runtime.onInstalled.listeners[0]();
  const c = await send({ kind: "CONFIG" });
  assert.equal(c.enabled, false);
  assert.deepEqual(c.rules.allowVideoIds, ["abcdefghijk"]);
});

test("canceled entry into a supported site restores the unrelated tab", async () => {
  const { tabs } = await setup();
  tabs.get(1).url = "https://example.com/";
  chrome.webNavigation.onBeforeNavigate.fire({
    tabId: 1,
    frameId: 0,
    url: "https://www.youtube.com/watch?v=abcdefghijk",
  });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(tabs.get(1).mutedInfo.muted, true);
  chrome.webNavigation.onErrorOccurred.fire({
    tabId: 1,
    frameId: 0,
    url: "https://www.youtube.com/watch?v=abcdefghijk",
    error: "net::ERR_ABORTED",
  });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(tabs.get(1).mutedInfo.muted, false);
});
test("Pause restores tracked non-target tabs even if navigation never commits", async () => {
  const { tabs, send } = await setup();
  tabs.get(1).url = "https://example.com/";
  chrome.webNavigation.onBeforeNavigate.fire({
    tabId: 1,
    frameId: 0,
    url: "https://www.youtube.com/watch?v=abcdefghijk",
  });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(tabs.get(1).mutedInfo.muted, true);
  await send({ kind: "ENABLE", enabled: false });
  assert.equal(tabs.get(1).mutedInfo.muted, false);
});
