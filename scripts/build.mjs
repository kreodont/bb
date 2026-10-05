import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
execFileSync(process.execPath, ["scripts/stage-assets.mjs"], { cwd: root, stdio: "inherit" });
execFileSync("bb", ["plugin", "build", "."], { cwd: root, stdio: "inherit" });
const mapPath = path.join(root, "dist/server.js.map");
const map = JSON.parse(await readFile(mapPath, "utf8"));
map.sources = map.sources.map((source) => source.startsWith("bb-zod-locale-stub:") ? "bb-zod-locale-stub:zod/v4/locales/index.js" : source);
await writeFile(mapPath, JSON.stringify(map));
