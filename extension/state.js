export function isYouTube(url) {
  try {
    return (
      new URL(url).protocol === "https:" &&
      ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(
        new URL(url).hostname,
      )
    );
  } catch {
    return false;
  }
}
export function isXhs(url) {
  try {
    const u = new URL(url);
    return (
      u.protocol === "https:" &&
      ["www.xiaohongshu.com", "xiaohongshu.com"].includes(u.hostname)
    );
  } catch {
    return false;
  }
}
export const isTarget = (url) => isYouTube(url) || isXhs(url);
export function videoId(url) {
  if (!isYouTube(url)) return null;
  const u = new URL(url),
    id =
      u.pathname === "/watch"
        ? u.searchParams.get("v")
        : u.pathname.match(
            /^\/(?:shorts|live|embed)\/([\w-]{11})(?:\/|$)/,
          )?.[1];
  return /^[\w-]{11}$/.test(id || "") ? id : null;
}
export function newState(url, originalMuted = false) {
  return {
    id: videoId(url),
    token: null,
    allow: false,
    reason: "Checking the current video",
    originalMuted,
    gateReady: false,
    updatedAt: Date.now(),
  };
}
export function accepts(state, msg) {
  return (
    !!state && state.id === msg.id && state.token === msg.token && !!msg.id
  );
}
