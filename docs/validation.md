# Validation — 0.1.0

Prepared on 2026-10-11.

- `npm test`: 35 tests passed on Node.js 24.
- `npm run package`: manifest, scoped permissions, asset/module references, matching versions and JavaScript syntax passed. All 21 ZIP entries were read back and compared with source bytes; CRC verification passed. A SHA-256 checksum accompanies the archive.
- Local Markdown links resolved. README artwork was visually inspected for clipping and legibility.
- A separate read-only code review found two issues: canceled navigation could leave unrelated tabs muted, and Xiaohongshu Pause could undo a later player mute request. Both were reproduced with failing tests, fixed, and re-reviewed successfully.

The public package has not yet completed the live Chrome checklist in [CONTRIBUTING.md](../CONTRIBUTING.md). These fixture tests do not establish current website compatibility, actual sound leakage, or real-world classification accuracy. README images are illustrations, not acceptance-test screenshots.

Preparing a local ZIP does not publish a GitHub Release or create a Chrome Web Store listing.
