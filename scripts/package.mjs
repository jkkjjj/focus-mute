import "./check.mjs";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { extensionFiles } from "./files.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const { version } = JSON.parse(
  fs.readFileSync(new URL("../package.json", import.meta.url)),
);
const name = `focus-mute-${version}.zip`;
const files = extensionFiles.map((file) => [`extension/${file}`, file]);
files.push(
  ["LICENSE", "LICENSE"],
  ["docs/install.md", "INSTALL.md"],
  ["PRIVACY.md", "PRIVACY.md"],
);
// Python's standard-library ZIP writer is portable and requires no npm packages.
execFileSync(
  process.env.PYTHON || (process.platform === "win32" ? "python" : "python3"),
  [fileURLToPath(new URL("./package.py", import.meta.url)), root, name],
  { input: JSON.stringify(files), stdio: ["pipe", "inherit", "inherit"] },
);
const archive = fs.readFileSync(new URL(`../dist/${name}`, import.meta.url));
const digest = createHash("sha256").update(archive).digest("hex");
fs.writeFileSync(
  new URL(`../dist/${name}.sha256`, import.meta.url),
  `${digest}  ${name}\n`,
);
console.log(
  `Created dist/${name} (${archive.length.toLocaleString()} bytes) and SHA-256 checksum.`,
);
