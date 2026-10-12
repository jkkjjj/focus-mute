/* ISOLATED world: only this script may ask the extension to change tab policy. */
(() => {
  let id = null,
    token = "",
    gateReady = false,
    revision = 0,
    request = 0,
    pending = false,
    enabled = true,
    decision = null,
    lastKey = "",
    lastTry = 0,
    diag = null;
  const post = (m) =>
    window.postMessage({ source: "ysf-isolated", ...m }, location.origin);
  const current = () => {
    const u = new URL(location.href);
    const x =
      u.pathname === "/watch"
        ? u.searchParams.get("v")
        : u.pathname.match(/^\/(?:shorts|live|embed)\/([\w-]{11})/)?.[1];
    return /^[\w-]{11}$/.test(x || "") ? x : null;
  };
  const send = async (m) => {
    try {
      return await chrome.runtime.sendMessage(m);
    } catch {
      return {
        allow: false,
        reason: "Extension connection lost; reload this page",
      };
    }
  };
  let host = null,
    label = null;
  function status(reason, allowed = false) {
    if (!document.documentElement) return;
    if (!host) {
      host = document.createElement("div");
      host.id = "youtube-study-focus-status";
      const shadow = host.attachShadow({ mode: "closed" });
      label = document.createElement("div");
      label.style.cssText =
        "position:fixed;bottom:12px;left:12px;z-index:2147483647;max-width:360px;padding:7px 10px;border-radius:7px;color:#fff;font:12px/1.4 system-ui;pointer-events:none;box-shadow:0 1px 8px #0006;";
      shadow.append(label);
      document.documentElement.append(host);
    }
    label.style.background = !enabled
      ? "#555"
      : allowed
        ? "#17643b"
        : "#742929";
    label.textContent = !enabled
      ? "FocusMute: paused"
      : `FocusMute: ${allowed ? "Sound allowed" : "Muted"} · ${reason}`;
  }
  async function begin() {
    id = current();
    token = crypto.randomUUID();
    pending = false;
    decision = null;
    lastKey = "";
    const mine = token;
    status("Checking the current video");
    const r = await send({ kind: "BEGIN", id, token, gateReady });
    if (token !== mine) return;
    if (r.enabled === false) {
      enabled = false;
      post({ kind: "STOP" });
      status("");
      return;
    }
    enabled = true;
    if (id) read();
    else status("No current video; muted");
  }
  function read() {
    if (!enabled || !id || pending) return;
    pending = true;
    lastTry = Date.now();
    post({ kind: "READ", request: ++request });
  }
  window.addEventListener("message", async (e) => {
    if (e.source !== window || e.data?.source !== "ysf-main") return;
    const m = e.data;
    if (m.kind === "READY") {
      gateReady = true;
      revision = m.revision;
      begin();
    }
    if (m.kind === "INVALIDATED") {
      if (m.revision === revision) return;
      revision = m.revision;
      gateReady = true;
      begin();
    }
    if (m.kind === "DIAG") diag = m;
    if (
      m.kind !== "METADATA" ||
      m.request !== request ||
      m.id !== id ||
      current() !== id ||
      m.revision !== revision
    )
      return;
    pending = false;
    if (!m.metadata) {
      status("Waiting for reliable video information");
      return;
    }
    const evidenceKey = JSON.stringify(m.metadata);
    if (evidenceKey === lastKey && decision) return;
    const mine = token,
      rev = revision;
    const r = await send({
      kind: "CLASSIFY",
      id,
      token,
      metadata: m.metadata,
      captionStatus: m.captionStatus,
    });
    if (!enabled || mine !== token || rev !== revision || current() !== id)
      return;
    if (r.enabled === false) {
      enabled = false;
      post({ kind: "STOP" });
      status("");
      return;
    }
    if (r.retry) {
      begin();
      return;
    }
    lastKey = evidenceKey;
    decision = r;
    post({ kind: "DECISION", id, revision, allow: !!r.allow });
    status(r.reason || "Could not classify; muted", !!r.allow);
  });
  chrome.runtime.onMessage.addListener((m, sender, reply) => {
    if (m.kind === "RESET") {
      enabled = true;
      post({ kind: "RESET" });
      reply({ ok: true });
    }
    if (m.kind === "STOP") {
      enabled = false;
      token = crypto.randomUUID();
      pending = false;
      decision = null;
      lastKey = "";
      post({ kind: "STOP" });
      status("");
      reply({ ok: true });
    }
    if (m.kind === "DIAG") {
      post({ kind: "DIAG" });
      reply({ id, gateReady, decision, gate: diag });
    }
  });
  post({ kind: "PING" });
  setTimeout(() => {
    if (!gateReady) {
      begin();
      status("Player control is not ready; muted");
    }
  }, 500);
  setInterval(() => {
    if (!enabled) return;
    if (current() !== id) {
      post({ kind: "RESET" });
      return;
    }
    if (pending && Date.now() - lastTry > 6000) pending = false;
    // Bounded current-video cache: no old title/transcript history is retained.
    if (!decision && Date.now() - lastTry > 1500) read();
    post({ kind: "DIAG" });
  }, 1500);
})();
