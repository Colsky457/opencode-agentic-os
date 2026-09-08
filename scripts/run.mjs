// Config-driven launcher: `node scripts/run.mjs [dev|build|start]`
// Reads host/port from os.config.json (falls back to 127.0.0.1:3000).
import { spawnSync, spawn } from "child_process";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function load() {
  try {
    return JSON.parse(readFileSync(path.join(root, "os.config.json"), "utf8"));
  } catch {
    return {};
  }
}

const cfg = load();
const host = process.env.OS_HOST || cfg.server?.host || "127.0.0.1";
const port = process.env.OS_PORT || cfg.server?.port || 3000;
const mode = process.argv[2] || "dev";

const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");

if (mode === "build") {
  const r = spawnSync(process.execPath, [nextBin, "build", "--webpack"], { stdio: "inherit", cwd: root });
  process.exit(r.status ?? 1);
}

const args = mode === "start" ? ["start", "-p", String(port), "-H", host] : ["dev", "--webpack", "-p", String(port), "-H", host];
console.log(`◈ AgenticOS ${mode} → http://${host}:${port}`);
const child = spawn(process.execPath, [nextBin, ...args], { stdio: "inherit", cwd: root });
child.on("exit", (code) => process.exit(code ?? 0));
