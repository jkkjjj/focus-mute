import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { extensionFiles } from "./files.mjs";

const root = new URL("../extension/", import.meta.url);
const read = (file) => fs.readFileSync(new URL(file, root), "utf8");
const manifest = JSON.parse(read("manifest.json"));
const pkg = JSON.parse(
  fs.readFileSync(new URL("../package.json", import.meta.url)),
);
assert.equal(manifest.version, pkg.version);
assert.equal(manifest.manifest_version, 3);
assert.deepEqual(manifest.permissions, ["storage", "webNavigation"]);
assert.deepEqual(
  manifest.host_permissions.toSorted(),
  [
    "https://www.youtube.com/*",
    "https://youtube.com/*",
    "https://m.youtube.com/*",
    "https://www.xiaohongshu.com/*",
    "https://xiaohongshu.com/*",
  ].toSorted(),
);
assert.equal(manifest.declarative_net_request, undefined);
const xhs = manifest.content_scripts.filter((c) =>
  c.matches[0].includes("xiaohongshu"),
);
assert.deepEqual(
  xhs.flatMap((c) => c.js),
  ["xhs-focus-media.js", "xhs-content.js"],
);
assert.ok(
  xhs.every((c) => !c.css),
  "XHS must not inject content-filtering CSS",
);
for (const file of extensionFiles) {
  assert.ok(fs.statSync(new URL(file, root)).isFile(), file);
  if (file.endsWith(".js"))
    execFileSync(process.execPath, [
      "--check",
      fileURLToPath(new URL(file, root)),
    ]);
}
const references = [
  manifest.background.service_worker,
  manifest.action.default_popup,
  manifest.options_page,
  ...Object.values(manifest.icons),
  ...manifest.content_scripts.flatMap((c) => [...c.js, ...(c.css || [])]),
];
for (const file of references)
  assert.ok(
    extensionFiles.includes(file),
    `Missing package reference: ${file}`,
  );
for (const file of ["popup.html", "options.html"]) {
  for (const match of read(file).matchAll(/(?:src|href)="([^"]+)"/g)) {
    assert.ok(
      extensionFiles.includes(match[1]),
      `Missing UI asset: ${match[1]}`,
    );
  }
}
for (const file of extensionFiles.filter((f) => f.endsWith(".js"))) {
  for (const match of read(file).matchAll(/from ['"]\.\/([^'"]+)['"]/g)) {
    assert.ok(extensionFiles.includes(match[1]), `Missing module: ${match[1]}`);
  }
  assert.ok(
    !/migrated-config|seamless|\/Users\/|\/Volumes\//i.test(read(file)),
    `Private source reference: ${file}`,
  );
}
console.log(
  "Manifest, permissions, asset references, version and JavaScript syntax passed.",
);
