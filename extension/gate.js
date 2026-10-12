/* MAIN world: synchronous media gate; no extension APIs, no persistent storage. */
(() => {
  "use strict";
  const marker = "ysf-main",
    incoming = "ysf-isolated";
  const proto = HTMLMediaElement.prototype,
    muted = Object.getOwnPropertyDescriptor(proto, "muted");
  const originalPlay = proto.play,
    originalLoad = proto.load;
  let enabled = true,
    allow = false,
    allowedId = null,
    revision = 0;
  const desired = new WeakMap();
  function id() {
    try {
      const u = new URL(location.href);
      return u.pathname === "/watch"
        ? u.searchParams.get("v")
        : u.pathname.match(/^\/(?:shorts|live|embed)\/([\w-]{11})/)?.[1] ||
            null;
    } catch {
      return null;
    }
  }
  const emit = (data) =>
    window.postMessage({ source: marker, ...data }, location.origin || "*");
  const media = () => Array.from(document.querySelectorAll("video,audio"));
  const blocked = (v) => {
    if (!enabled) return false;
    if (!allow || allowedId !== id() || !!document.querySelector(".ad-showing"))
      return true;
    try {
      const actual = v
        ?.closest?.(".html5-video-player")
        ?.getVideoData?.()?.video_id;
      if (actual && actual !== id()) return true;
    } catch {
      return true;
    }
    return false;
  };
  function remember(v) {
    if (!desired.has(v)) desired.set(v, muted.get.call(v));
  }
  function enforce(v) {
    if (blocked(v)) {
      remember(v);
      muted.set.call(v, true);
    } else if (desired.has(v)) {
      muted.set.call(v, desired.get(v));
      desired.delete(v);
    }
  }
  function all() {
    for (const v of media()) enforce(v);
  }
  function invalidate() {
    if (!enabled) return;
    allow = false;
    allowedId = null;
    revision++;
    all();
    emit({ kind: "INVALIDATED", id: id(), revision });
  }
  function restore() {
    for (const v of media())
      if (desired.has(v)) {
        muted.set.call(v, desired.get(v));
        desired.delete(v);
      }
  }
  Object.defineProperty(proto, "muted", {
    ...muted,
    set(value) {
      if (!enabled) return muted.set.call(this, value);
      remember(this);
      desired.set(this, !!value);
      muted.set.call(this, blocked(this) ? true : value);
    },
  });
  proto.play = function (...args) {
    enforce(this);
    return originalPlay.apply(this, args);
  };
  proto.load = function (...args) {
    invalidate();
    enforce(this);
    return originalLoad.apply(this, args);
  };
  for (const property of ["src", "srcObject"]) {
    const descriptor = Object.getOwnPropertyDescriptor(proto, property);
    if (descriptor?.set && descriptor.configurable)
      Object.defineProperty(proto, property, {
        ...descriptor,
        set(value) {
          invalidate();
          enforce(this);
          return descriptor.set.call(this, value);
        },
      });
  }
  for (const method of ["pushState", "replaceState"]) {
    const original = history[method];
    history[method] = function (...args) {
      const before = id();
      const result = original.apply(this, args);
      if (id() !== before) invalidate();
      return result;
    };
  }
  for (const event of ["yt-navigate-start", "yt-navigate-finish", "popstate"])
    window.addEventListener(event, invalidate, true);
  for (const event of [
    "play",
    "playing",
    "volumechange",
    "loadstart",
    "loadedmetadata",
  ])
    document.addEventListener(
      event,
      (e) => {
        if (e.target instanceof HTMLMediaElement) enforce(e.target);
      },
      true,
    );
  const observer = new MutationObserver(() => all());
  observer.observe(document, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["src", "class"],
  });
  // Backstop only; event handlers and property interception are the primary gate.
  setInterval(all, 250);
  async function metadata(request) {
    const current = id();
    let response = null;
    const players = [
      ...document.querySelectorAll(
        ".html5-video-player,#movie_player,#shorts-player",
      ),
    ];
    for (const player of players) {
      try {
        const r = player.getPlayerResponse?.();
        if (r?.videoDetails?.videoId === current) {
          response = r;
          break;
        }
      } catch {}
    }
    if (
      !response &&
      window.ytInitialPlayerResponse?.videoDetails?.videoId === current
    )
      response = window.ytInitialPlayerResponse;
    const details = response?.videoDetails;
    if (!details || details.videoId !== current) {
      emit({
        kind: "METADATA",
        request,
        id: current,
        metadata: null,
        revision,
      });
      return;
    }
    const data = {
      id: current,
      title: String(details.title || "").slice(0, 1000),
      channel: String(details.author || "").slice(0, 500),
      channelId: details.channelId || "",
      description: String(details.shortDescription || "").slice(0, 16000),
      category: response.microformat?.playerMicroformatRenderer?.category || "",
      transcript: "",
    };
    const tracks =
      response.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    const track =
      tracks.find((t) => /^(en|zh)/.test(t.languageCode)) || tracks[0];
    let captionStatus = track
      ? "Captions unavailable"
      : "No captions available";
    const rev = revision;
    if (track?.baseUrl) {
      try {
        const url = new URL(track.baseUrl);
        if (
          url.protocol === "https:" &&
          ["www.youtube.com", "youtube.com", "m.youtube.com"].includes(
            url.hostname,
          ) &&
          url.pathname === "/api/timedtext"
        ) {
          url.searchParams.set("fmt", "json3");
          const control = new AbortController(),
            timer = setTimeout(() => control.abort(), 2500);
          try {
            const response = await fetch(url.href, {
              credentials: "same-origin",
              signal: control.signal,
            });
            if (response.ok) {
              const text = await response.text();
              if (text.length < 2_000_000) {
                const json = JSON.parse(text);
                data.transcript = (json.events || [])
                  .flatMap((e) => (e.segs || []).map((s) => s.utf8 || ""))
                  .join(" ")
                  .slice(0, 24000);
                if (data.transcript.trim())
                  captionStatus = "Current video captions loaded";
              }
            }
          } finally {
            clearTimeout(timer);
          }
        }
      } catch {}
    }
    if (id() === current && revision === rev)
      emit({
        kind: "METADATA",
        request,
        id: current,
        metadata: data,
        captionStatus,
        revision,
      });
  }
  window.addEventListener("message", (e) => {
    if (e.source !== window || e.data?.source !== incoming) return;
    const m = e.data;
    if (m.kind === "PING") {
      emit({ kind: "READY", id: id(), revision });
      return;
    }
    if (m.kind === "STOP") {
      enabled = false;
      allow = false;
      restore();
      return;
    }
    if (m.kind === "RESET") {
      enabled = true;
      invalidate();
      return;
    }
    if (m.kind === "DECISION") {
      if (
        m.id !== id() ||
        (m.revision !== undefined && m.revision !== revision)
      )
        return;
      enabled = true;
      allow = !!m.allow;
      allowedId = m.id;
      if (allow) restore();
      all();
      return;
    }
    if (m.kind === "READ")
      metadata(m.request).catch(() =>
        emit({
          kind: "METADATA",
          request: m.request,
          metadata: null,
          id: id(),
          revision,
        }),
      );
    if (m.kind === "DIAG")
      emit({
        kind: "DIAG",
        id: id(),
        revision,
        blocked: blocked(),
        media: media().map((v) => ({
          muted: muted.get.call(v),
          paused: v.paused,
          volume: v.volume,
          readyState: v.readyState,
        })),
      });
  });
  all();
  emit({ kind: "READY", id: id(), revision });
})();
