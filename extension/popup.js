const $ = (id) => document.getElementById(id);
let enabled = true;
async function send(message) {
  const response = await chrome.runtime.sendMessage(message);
  if (response?.error) throw new Error(response.error);
  return response;
}
async function refresh() {
  const config = await send({ kind: "CONFIG" });
  enabled = config.enabled;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const state = tab ? await send({ kind: "STATUS", tabId: tab.id }) : {};
  $("status").textContent = !enabled
    ? "FocusMute is paused"
    : !state.target
      ? "Outside FocusMute"
      : state.allow
        ? "Sound allowed"
        : "Audio muted";
  $("reason").textContent = !enabled
    ? "Normal playback is restored."
    : !state.target
      ? "Only YouTube and Xiaohongshu are covered."
      : state.reason ||
        "Checking this page. Reload it if you just installed FocusMute.";
  $("toggle").textContent = enabled ? "Pause FocusMute" : "Resume FocusMute";
  $("toggle").disabled = false;
}
$("toggle").addEventListener("click", async () => {
  $("toggle").disabled = true;
  try {
    await send({ kind: "ENABLE", enabled: !enabled });
    await refresh();
  } catch (error) {
    $("reason").textContent = error.message;
    $("toggle").disabled = false;
  }
});
$("settings").addEventListener("click", () => chrome.runtime.openOptionsPage());
refresh().catch((error) => {
  $("status").textContent = "Could not connect";
  $("reason").textContent = error.message;
});
