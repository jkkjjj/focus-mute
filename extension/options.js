import { DEFAULT_RULES } from "./rules.js";
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
  $("status").textContent = enabled
    ? "Your focus rules are on"
    : "FocusMute is paused";
  $("toggle").textContent = enabled ? "Pause FocusMute" : "Resume FocusMute";
  $("toggle").disabled = false;
  return config;
}
async function perform(action) {
  try {
    await action();
    await refresh();
    $("result").textContent = "Done.";
  } catch (error) {
    $("result").textContent = "Could not complete: " + error.message;
  }
}
$("toggle").onclick = () =>
  perform(() => send({ kind: "ENABLE", enabled: !enabled }));
$("save").onclick = () =>
  perform(() =>
    send({ kind: "SAVE_RULES", rules: JSON.parse($("rules").value) }),
  );
$("restore").onclick = () =>
  perform(async () => {
    await send({ kind: "RESTORE_RULES" });
    $("rules").value = JSON.stringify(
      (await send({ kind: "CONFIG" })).rules,
      null,
      2,
    );
  });
$("defaults").onclick = () => {
  $("rules").value = JSON.stringify(DEFAULT_RULES, null, 2);
};
$("export").onclick = () => {
  const url = URL.createObjectURL(
    new Blob([$("rules").value], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "focus-mute-rules.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$("refresh").onclick = () =>
  perform(async () => {
    $("tabs").textContent = JSON.stringify(
      await send({ kind: "LIST" }),
      null,
      2,
    );
  });
refresh()
  .then((config) => {
    $("rules").value = JSON.stringify(config.rules, null, 2);
  })
  .catch((error) => {
    $("result").textContent = error.message;
  });
