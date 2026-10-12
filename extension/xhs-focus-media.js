// MAIN document_start: all XHS media muted, independent of content classification.
(() => {
  "use strict";
  if (globalThis.__xhsFocusMedia) return;
  globalThis.__xhsFocusMedia = true;
  const p = HTMLMediaElement.prototype,
    original = new WeakMap();
  const muted = Object.getOwnPropertyDescriptor(p, "muted"),
    nativePlay = p.play;
  const defaultMuted = Object.getOwnPropertyDescriptor(p, "defaultMuted");
  const off = () =>
    document.documentElement?.getAttribute("data-xf-off") === "yes";
  function remember(v) {
    if (!original.has(v))
      original.set(v, {
        muted: muted.get.call(v),
        defaultMuted: defaultMuted?.get.call(v),
      });
  }
  function enforce(v) {
    try {
      if (off()) {
        const old = original.get(v);
        if (old) {
          original.delete(v);
          muted.set.call(v, old.muted);
          if (defaultMuted?.set) defaultMuted.set.call(v, old.defaultMuted);
        }
        return;
      }
      remember(v);
      if (!muted.get.call(v)) muted.set.call(v, true);
      if (defaultMuted?.set && !defaultMuted.get.call(v))
        defaultMuted.set.call(v, true);
    } catch {}
  }
  function all() {
    for (const v of document.querySelectorAll("video,audio")) enforce(v);
  }
  Object.defineProperty(p, "muted", {
    ...muted,
    set(value) {
      if (off()) {
        // Restore before applying a new user choice, even if the observer
        // has not handled the Pause attribute change yet.
        enforce(this);
        muted.set.call(this, !!value);
      } else {
        remember(this);
        original.get(this).muted = !!value;
        muted.set.call(this, true);
      }
    },
  });
  if (defaultMuted?.configurable && defaultMuted.set)
    Object.defineProperty(p, "defaultMuted", {
      ...defaultMuted,
      set(value) {
        if (off()) {
          enforce(this);
          defaultMuted.set.call(this, !!value);
        } else {
          remember(this);
          original.get(this).defaultMuted = !!value;
          defaultMuted.set.call(this, true);
        }
      },
    });
  p.play = function (...args) {
    enforce(this);
    return nativePlay.apply(this, args);
  };
  const nativeLoad = p.load;
  p.load = function (...args) {
    enforce(this);
    return nativeLoad.apply(this, args);
  };
  for (const key of ["src", "srcObject"]) {
    const d = Object.getOwnPropertyDescriptor(p, key);
    if (d?.set && d.configurable)
      Object.defineProperty(p, key, {
        ...d,
        set(value) {
          enforce(this);
          return d.set.call(this, value);
        },
      });
  }
  for (const method of ["pushState", "replaceState"]) {
    const fn = history[method];
    history[method] = function (...args) {
      const before = location.href;
      const r = fn.apply(this, args);
      all();
      if (before !== location.href)
        window.postMessage(
          { source: "xhs-focus-media", kind: "ROUTE" },
          location.origin,
        );
      return r;
    };
  }
  for (const event of ["popstate", "pageshow"])
    window.addEventListener(event, all, true);
  for (const name of [
    "play",
    "playing",
    "volumechange",
    "loadstart",
    "loadedmetadata",
    "emptied",
  ])
    document.addEventListener(
      name,
      (e) => {
        if (e.target instanceof HTMLMediaElement) enforce(e.target);
      },
      true,
    );
  new MutationObserver(all).observe(document, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["src", "autoplay", "muted", "data-xf-off"],
  });
  setInterval(all, 1000);
  all();
})();
