import { DEFAULT_RULES } from "./rules.js";
import { classify, validateRules } from "./classifier.js";
import {
  isYouTube,
  isXhs,
  isTarget,
  videoId,
  newState,
  accepts,
} from "./state.js";

const queues = new Map();
function serial(id, fn) {
  const p = (queues.get(id) || Promise.resolve()).catch(() => {}).then(fn);
  queues.set(id, p);
  p.finally(() => {
    if (queues.get(id) === p) queues.delete(id);
  }).catch(() => {});
  return p;
}
const key = (id) => "tab:" + id;
async function read(id) {
  return (await chrome.storage.session.get(key(id)))[key(id)];
}
async function save(id, s) {
  await chrome.storage.session.set({ [key(id)]: s });
}
async function settings() {
  const c = await chrome.storage.local.get(["enabled", "rules"]);
  return { enabled: c.enabled !== false, rules: c.rules || DEFAULT_RULES };
}
async function send(id, message) {
  try {
    return await chrome.tabs.sendMessage(id, message, { frameId: 0 });
  } catch {
    return null;
  }
}
async function badge(id, s) {
  await chrome.action.setBadgeText({ tabId: id, text: s.allow ? "ON" : "M" });
  await chrome.action.setBadgeBackgroundColor({
    tabId: id,
    color: s.allow ? "#237a4a" : "#8a3333",
  });
  await chrome.action.setTitle({ tabId: id, title: "FocusMute: " + s.reason });
}
async function ensure(id, tab) {
  let s = await read(id);
  if (!s) {
    s = newState(tab.url, tab.mutedInfo?.muted || false);
    await save(id, s);
  }
  return s;
}
async function restore(id, s) {
  const t = await chrome.tabs.get(id);
  if (
    t.mutedInfo?.reason === "extension" &&
    t.mutedInfo.extensionId === chrome.runtime.id
  )
    await chrome.tabs.update(id, { muted: s.originalMuted });
  await send(id, { kind: "STOP" });
  await chrome.storage.session.remove(key(id));
  await chrome.action.setBadgeText({ tabId: id, text: "" });
}
async function reset(id, url) {
  const c = await settings();
  if (!c.enabled) return;
  let t;
  try {
    t = await chrome.tabs.get(id);
  } catch {
    return;
  }
  if (!isTarget(url || t.url)) {
    const old = await read(id);
    if (old) await restore(id, old);
    return;
  }
  const old = await ensure(id, t),
    s = newState(url || t.url, old.originalMuted);
  await save(id, s);
  await chrome.tabs.update(id, { muted: true });
  await send(id, { kind: "RESET" });
  await badge(id, s);
}
chrome.webNavigation.onBeforeNavigate.addListener((d) => {
  if (d.frameId === 0 && isTarget(d.url))
    serial(d.tabId, () => reset(d.tabId, d.url)).catch(() => {});
});
chrome.webNavigation.onErrorOccurred.addListener((d) => {
  if (d.frameId !== 0) return;
  serial(d.tabId, async () => {
    const s = await read(d.tabId);
    if (!s) return;
    const tab = await chrome.tabs.get(d.tabId);
    // The requested destination may never become the tab's current document.
    if (isTarget(tab.url) && (await settings()).enabled) {
      await reset(d.tabId, tab.url);
    } else {
      await restore(d.tabId, s);
    }
  }).catch(() => {});
});
chrome.webNavigation.onCommitted.addListener((d) => {
  if (d.frameId === 0 && !isTarget(d.url))
    serial(d.tabId, async () => {
      const s = await read(d.tabId);
      if (s) await restore(d.tabId, s);
    }).catch(() => {});
});
chrome.webNavigation.onHistoryStateUpdated.addListener((d) => {
  if (d.frameId === 0)
    serial(d.tabId, async () => {
      const s = await read(d.tabId);
      if (isXhs(d.url) || s?.id !== videoId(d.url)) await reset(d.tabId, d.url);
    }).catch(() => {});
});
chrome.tabs.onUpdated.addListener((id, change, tab) => {
  serial(id, async () => {
    const c = await settings();
    if (!c.enabled) return;
    if (change.url && isTarget(change.url)) {
      const s = await read(id);
      if (isXhs(change.url) || !s || s.id !== videoId(change.url))
        await reset(id, change.url);
    }
    if (change.mutedInfo && isTarget(tab.url)) {
      const s = await read(id),
        info = change.mutedInfo;
      if (
        s?.allow &&
        !(info.reason === "extension" && info.extensionId === chrome.runtime.id)
      ) {
        s.originalMuted = info.muted;
        await save(id, s);
      }
    }
    if (change.mutedInfo?.muted === false && isTarget(tab.url)) {
      const s = await ensure(id, tab);
      if (!s.allow) {
        const start = performance.now();
        await chrome.tabs.update(id, { muted: true });
        s.lastRemuteMs = Math.round((performance.now() - start) * 100) / 100;
        await save(id, s);
      }
    }
  }).catch(() => {});
});
chrome.tabs.onRemoved.addListener((id) =>
  chrome.storage.session.remove(key(id)),
);
async function reconcile() {
  const c = await settings(),
    tabs = await chrome.tabs.query({});
  const live = new Set(tabs.map((t) => key(t.id)));
  const stored = await chrome.storage.session.get(null);
  for (const k of Object.keys(stored))
    if (k.startsWith("tab:") && !live.has(k))
      await chrome.storage.session.remove(k);
  for (const t of tabs) {
    await serial(t.id, async () => {
      if (c.enabled && isTarget(t.url)) await reset(t.id, t.url);
      else {
        const s = await read(t.id);
        if (s) await restore(t.id, s);
      }
    });
  }
}
// Install clean defaults once; updates must preserve preferences and pause state.
chrome.runtime.onInstalled.addListener(async () => {
  try {
    const current = await chrome.storage.local.get(["rules", "enabled"]);
    const initial = {};
    if (!current.rules) initial.rules = DEFAULT_RULES;
    if (current.enabled === undefined) initial.enabled = true;
    if (Object.keys(initial).length) await chrome.storage.local.set(initial);
    await reconcile();
  } catch {
    await reconcile().catch(() => {});
  }
});
chrome.runtime.onStartup.addListener(() => reconcile().catch(() => {}));
chrome.runtime.onMessage.addListener((m, sender, reply) => {
  const task = async () => {
    const c = await settings();
    if (sender.tab && isXhs(sender.url)) {
      if (sender.frameId !== 0)
        return { allow: false, error: "Only the top-level page is supported" };
      return serial(sender.tab.id, async () => {
        const c = await settings(),
          id = sender.tab.id,
          t = await chrome.tabs.get(id);
        if (!isXhs(t.url) || m.href !== t.url)
          return { allow: false, reason: "The page has changed" };
        if (!c.enabled) return { enabled: false };
        if (m.kind === "XHS_STATUS") {
          const s = await ensure(id, t);
          s.platform = "xhs";
          s.allow = false;
          s.reason = "Xiaohongshu: all audio muted; posts stay visible";
          await save(id, s);
          await chrome.tabs.update(id, { muted: true });
          await badge(id, s);
          return { enabled: true, allow: false };
        }
        return { allow: false, error: "Unknown Xiaohongshu message" };
      });
    }
    if (sender.tab && isYouTube(sender.url)) {
      if (sender.frameId !== 0 || !isYouTube(sender.url))
        return { error: "Unsupported page" };
      return serial(sender.tab.id, async () => {
        const c = await settings();
        const id = sender.tab.id,
          t = await chrome.tabs.get(id);
        if (!isYouTube(t.url))
          return { allow: false, reason: "The page has changed" };
        if (!c.enabled) return { enabled: false };
        let s = await ensure(id, t);
        if (m.kind === "BEGIN") {
          if (videoId(t.url) !== m.id)
            return { allow: false, reason: "Video is changing" };
          s = {
            ...newState(t.url, s.originalMuted),
            token: m.token,
            gateReady: !!m.gateReady,
          };
          await save(id, s);
          await chrome.tabs.update(id, { muted: true });
          await badge(id, s);
          return { enabled: true, allow: false };
        }
        if (m.kind === "CLASSIFY") {
          if (
            !accepts(s, m) ||
            videoId(t.url) !== m.id ||
            m.metadata?.id !== m.id
          )
            return {
              allow: false,
              reason: "Stale video information ignored",
              retry: true,
            };
          const decision = classify(m.metadata, c.rules);
          // A missing main-world gate must never be allowed to play.
          s.allow = decision.allow && s.gateReady;
          s.reason = s.gateReady
            ? decision.reason
            : "Player control is not ready; muted";
          s.channelId = m.metadata.channelId || "";
          s.captionStatus = m.captionStatus || "Not available";
          s.updatedAt = Date.now();
          await save(id, s);
          // Verify current URL again after asynchronous storage work.
          if (!(await settings()).enabled) return { enabled: false };
          if (videoId((await chrome.tabs.get(id)).url) !== m.id) {
            await reset(id);
            return { allow: false, retry: true };
          }
          await chrome.tabs.update(id, {
            muted: s.allow ? s.originalMuted : true,
          });
          await badge(id, s);
          return { enabled: true, ...s };
        }
        if (m.kind === "STATUS") return { enabled: true, ...s };
        return { error: "Unknown message" };
      });
    }
    // Only extension pages can change persistent configuration or run diagnostics.
    if (!sender.url?.startsWith(chrome.runtime.getURL("")))
      return { error: "Not authorized" };
    if (m.kind === "CONFIG") return c;
    if (m.kind === "STATUS") {
      const t = await chrome.tabs.get(m.tabId);
      return {
        enabled: c.enabled,
        target: isTarget(t.url),
        muted: t.mutedInfo?.muted,
        ...(await read(m.tabId)),
      };
    }
    if (m.kind === "SAVE_RULES") {
      validateRules(m.rules);
      await chrome.storage.local.set({ rulesBackup: c.rules, rules: m.rules });
      await reconcile();
      return { ok: true };
    }
    if (m.kind === "RESTORE_RULES") {
      const b = await chrome.storage.local.get("rulesBackup");
      if (!b.rulesBackup) throw Error("No previous rules to restore");
      validateRules(b.rulesBackup);
      await chrome.storage.local.set({
        rules: b.rulesBackup,
        rulesBackup: c.rules,
      });
      await reconcile();
      return { ok: true };
    }
    if (m.kind === "LIST") {
      const out = [];
      for (const t of await chrome.tabs.query({})) {
        if (isTarget(t.url))
          out.push({
            tabId: t.id,
            id: videoId(t.url),
            muted: t.mutedInfo?.muted,
            ...(await read(t.id)),
            player: await send(t.id, { kind: "DIAG" }),
          });
      }
      return out;
    }
    if (m.kind === "ENABLE") {
      await chrome.storage.local.set({ enabled: !!m.enabled });
      await reconcile();
      return { ok: true };
    }
    if (m.kind === "TEST_REMUTE") {
      const s = await read(m.tabId);
      if (!c.enabled || !s || s.allow)
        throw Error("Only muted restricted tabs can be tested");
      const start = performance.now();
      await chrome.tabs.update(m.tabId, { muted: false });
      for (let i = 0; i < 50; i++) {
        await new Promise((r) => setTimeout(r, 20));
        if ((await chrome.tabs.get(m.tabId)).mutedInfo?.muted)
          return {
            ok: true,
            observedMs: Math.round(performance.now() - start),
            note: "Control latency only; not an acoustic measurement",
          };
      }
      return {
        ok: false,
        error: "Tab did not return to mute within one second",
      };
    }
    return { error: "Unknown message" };
  };
  task().then(reply, (e) =>
    reply({
      allow: false,
      error: e.message,
      reason: "Operation failed; player remains muted",
    }),
  );
  return true;
});
