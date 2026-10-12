# FocusMute initial public release

Goal: package the existing Chrome extension as a portable, MIT-licensed repository.

Architecture: Manifest V3; page-level media gates plus service-worker tab muting; local YouTube rules. Xiaohongshu only mutes and never filters posts. No build step or runtime dependencies.

Constraints: exclude personal settings, site blocks, browser metadata and local machine helpers. Leave the installed extension untouched. No store listing is available yet.

1. Port and test clean installation, YouTube gating, XHS always-mute, pause/restore and navigation behavior.
2. Add branded popup/settings, icons, zero-dependency packaging and CI.
3. Write English/Chinese installation, policy, privacy and contributor docs with clearly labeled example artwork.
4. Run tests and package checks, inspect artwork, obtain a fresh read-only review and resolve important findings.

Review focus: regressions in mute enforcement, accidental content filtering, private data, misleading install or classification claims.
