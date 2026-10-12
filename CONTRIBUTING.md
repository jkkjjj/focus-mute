# Contributing

Small, reproducible fixes and clearer classification rules are welcome. Open an issue with the Chrome/extension version, the expected behavior, the actual result and public sample metadata. Do not include cookies, tokens, private URLs or raw browsing diagnostics.

## Local workflow

Use Node.js 22+; packaging additionally uses Python 3's standard library (`python3` on macOS/Linux, `python` on Windows, or the `PYTHON` environment variable). There are no npm dependencies to install.

```sh
npm test
npm run check
npm run package
```

Load `extension/` in Chrome. After editing the worker, manifest or content scripts, reload the extension and the site tabs. Artwork is already checked in. Optional regeneration uses `python3 scripts/artwork.py` with Pillow installed; font availability can change rendering.

## Project map

| Path                                             | Responsibility                                                         |
| ------------------------------------------------ | ---------------------------------------------------------------------- |
| `extension/background.js`                        | Per-tab state, navigation, tab muting and settings                     |
| `extension/gate.js`, `content.js`                | YouTube media gate and isolated controller                             |
| `extension/classifier.js`, `rules.js`            | Local YouTube policy                                                   |
| `extension/xhs-focus-media.js`, `xhs-content.js` | Xiaohongshu mute-only behavior                                         |
| `extension/popup.*`, `options.*`                 | Controls and settings                                                  |
| `tests/`                                         | Deterministic Node tests using browser/media fixtures                  |
| `scripts/`                                       | Validation, explicit package allowlist and reproducible ZIP generation |

Keep permissions narrow and data local. Unknown YouTube results remain muted. Explicit blocks outrank allow rules. Never carry an allow decision to another video. Xiaohongshu must never gain content filtering or a learning-content audio exception as an incidental change.

## Manual browser acceptance

Automated fixtures do not prove Chrome integration or current website compatibility. Before a public release, use a clean Chrome profile and record the version and results:

1. Load the extension with site access enabled; reload both supported sites.
2. Open a teaching video with supporting metadata. It begins muted, then permits sound. A deliberately user-muted player should remain muted.
3. Open a music/entertainment video. It stays muted. Try player and tab unmute; controls should reapply the restriction.
4. Navigate between those videos using page links, browser Back/Forward and direct URLs; repeat on Shorts. No stale decision should allow the next video.
5. Browse Xiaohongshu feed and detail views. Scroll to newly inserted posts and switch videos. Everything stays visible, media plays silently, and no filtering overlay appears.
6. Pause, navigate and reload. Normal playback controls should work. Resume; restrictions should return. Repeat after restarting Chrome.
7. Save a custom rule, undo it, and reload the extension. Preferences should persist. Try malformed JSON and an invalid regex; show an error without losing the last valid rules.
8. Confirm unrelated websites retain their prior mute state when leaving a controlled site.

The page-level gate is not a security boundary against hostile page scripts. FocusMute is an opt-in focus aid, not parental control software.
