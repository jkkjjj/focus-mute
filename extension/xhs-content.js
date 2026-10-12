/* ISOLATED world. Muting only: never inspect, remove, or hide posts. */
(() => {
  let enabled = true;
  let revision = 0;
  let lastHref = location.href;

  function apply() {
    const root = document.documentElement;
    const value = enabled ? "no" : "yes";
    if (root && root.getAttribute("data-xf-off") !== value) {
      root.setAttribute("data-xf-off", value);
    }
  }

  async function sync() {
    const mine = ++revision;
    const href = location.href;
    lastHref = href;
    try {
      const result = await chrome.runtime.sendMessage({
        kind: "XHS_STATUS",
        href,
      });
      if (mine !== revision || href !== location.href) return;
      enabled = result.enabled !== false;
      apply();
    } catch {
      // Keep the existing policy until the extension can reconnect.
    }
  }

  chrome.runtime.onMessage.addListener((message, sender, reply) => {
    if (message.kind === "STOP") {
      revision++;
      enabled = false;
      apply();
      reply({ ok: true });
    } else if (message.kind === "RESET") {
      enabled = true;
      apply();
      sync();
      reply({ ok: true });
    } else if (message.kind === "DIAG") {
      reply({ enabled, mode: "mute-only" });
    }
  });

  if (!document.documentElement) {
    const observer = new MutationObserver(() => {
      if (document.documentElement) {
        apply();
        observer.disconnect();
      }
    });
    observer.observe(document, { childList: true, subtree: true });
  }
  setInterval(() => {
    if (location.href !== lastHref) sync();
  }, 1000);
  apply();
  sync();
})();
