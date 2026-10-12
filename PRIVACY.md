# Privacy

FocusMute has no account system, analytics, telemetry, advertising SDK or remote classifier. It does not send browsing data to the developer.

## What the extension reads

On supported YouTube pages it reads information for the current video: video/channel IDs, title, channel name, description, category and available captions. The classifier uses this information inside the browser. Captions may be fetched from the current video's HTTPS `/api/timedtext` URL on one of the listed YouTube hosts, with same-origin browser credentials. Requests go to YouTube, not a FocusMute server.

On Xiaohongshu it tracks page navigation and controls media playback mute state. It does not analyze post text or filter the feed.

## What stays on your device

- `chrome.storage.local`: enabled/paused preference, YouTube rules and the previous rules saved for undo. This is local storage, not Chrome Sync.
- `chrome.storage.session`: current per-tab classification, identifiers, reason, timestamps and original mute state. It is temporary browser-session state, not a browsing-history archive. Entries are removed when a tab closes or FocusMute releases control.
- Page memory: current video metadata, temporary captions and media-control state. These are not exported automatically or stored as a transcript collection.

The optional diagnostics view displays local information, including video and channel identifiers. Rule export creates a JSON file only when you click Export. Review either before sharing it publicly.

## Your controls

Pause FocusMute from its popup to release control, edit rules in Settings, or uninstall it from `chrome://extensions`. Reload affected site tabs after uninstalling to clear scripts injected into those pages. Chrome removes the extension's stored settings when it is uninstalled; files you explicitly exported remain wherever you saved them.

Websites still make their own normal network requests and have their own privacy policies. This extension does not make YouTube or Xiaohongshu offline or anonymous.
