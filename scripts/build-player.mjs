import { spawnSync } from "node:child_process";
import {
  readFileSync,
  writeFileSync,
  renameSync,
  readdirSync,
  statSync,
  existsSync,
  unlinkSync,
} from "node:fs";
import { resolve, relative } from "node:path";
const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "frontend/dist/player/browser");
const marker = resolve(output, "player-manifest.json");
if (existsSync(marker)) unlinkSync(marker);
const run = spawnSync(
  process.execPath,
  [
    resolve(root, "frontend/node_modules/@angular/cli/bin/ng.js"),
    "build",
    "--configuration",
    "player",
  ],
  { cwd: resolve(root, "frontend"), stdio: "inherit" },
);
if (run.status !== 0) process.exit(run.status || 1);
const files = {};
function collect(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = resolve(directory, entry.name);
    if (entry.isSymbolicLink())
      throw Error("Player assets cannot be symbolic links");
    if (entry.isDirectory()) collect(file);
    else if (entry.isFile()) {
      const name = relative(output, file).replaceAll("\\", "/");
      if (
        name === "index.html" ||
        /\.(js|css|png|svg|ico|woff2?|ttf)$/.test(name)
      )
        files[name] = statSync(file).size;
    }
  }
}
collect(output);
if (!files["index.html"]) throw Error("Player index missing");
writeFileSync(marker + ".tmp", JSON.stringify({ files }));
renameSync(marker + ".tmp", marker);
console.log(`Published ${Object.keys(files).length} player assets.`);
