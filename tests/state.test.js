import test from "node:test";
import assert from "node:assert/strict";
import { videoId, isYouTube, newState, accepts } from "../extension/state.js";
test("exact host boundaries and watch/shorts/live video identity", () => {
  assert.equal(
    isYouTube("https://www.youtube.com.evil.test/watch?v=abcdefghijk"),
    false,
  );
  for (const p of [
    "/watch?v=abcdefghijk",
    "/shorts/abcdefghijk",
    "/live/abcdefghijk",
  ])
    assert.equal(videoId("https://www.youtube.com" + p), "abcdefghijk");
  assert.equal(videoId("https://example.com/watch?v=abcdefghijk"), null);
});
test("states are independent and stale decisions cannot allow another video", () => {
  let a = newState("https://www.youtube.com/watch?v=abcdefghijk", false),
    b = newState("https://www.youtube.com/shorts/12345678901", true);
  a.token = "document-a";
  a.allow = true;
  assert.equal(b.allow, false);
  assert.equal(b.originalMuted, true);
  assert.equal(accepts(a, { token: "old", id: a.id }), false);
  assert.equal(accepts(a, { token: a.token, id: b.id }), false);
  assert.equal(accepts(a, { token: a.token, id: a.id }), true);
});
