# Releasing

## GitHub ZIP

1. Update `version` in `extension/manifest.json` and `package.json`; update the changelog.
2. Run `npm test`, `npm run check` and the manual Chrome checklist in `CONTRIBUTING.md`.
3. Run `npm run package`. The archive has `manifest.json` at its root, an explicit set of extension files, installation instructions, privacy details and the MIT license. It excludes machine-specific files and personal settings.
4. Commit the reviewed source, push it, then create a GitHub Release with a matching `vVERSION` tag. Attach `dist/focus-mute-VERSION.zip` and its `.sha256` file. Mention the Chrome version and the browser scenarios you actually verified; label any untested areas.
5. Download and extract that asset to confirm the install path before announcing it.

CI runs tests and packages an artifact on pushes and pull requests. It does not automatically publish releases or upload to the Chrome Web Store. There is no automatic update service for unpacked installations: users replace files, reload the extension, and reload site tabs.

## Chrome Web Store

The ZIP can be used as the starting upload package. A store listing still requires a developer account, store assets, permission/privacy declarations and Chrome's review. Follow the [official publishing guide](https://developer.chrome.com/docs/webstore/publish). Store approval has not been obtained by building this repository.

Use actual browser screenshots for store screenshots. The README images are labeled illustrations and are not evidence of a successful live-browser test. Once a listing is approved, add its real installation link to both READMEs.
