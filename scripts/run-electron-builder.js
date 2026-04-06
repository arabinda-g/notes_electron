const { spawnSync } = require("node:child_process");
const path = require("node:path");

const systemRoot = process.env.SystemRoot || "C:\\Windows";
const system32Path = path.join(systemRoot, "System32");
const cmdPath = path.join(system32Path, "cmd.exe");

const currentPath = process.env.PATH || "";
const hasSystem32InPath = currentPath
  .toLowerCase()
  .split(";")
  .includes(system32Path.toLowerCase());

const env = {
  ...process.env,
  ComSpec: process.env.ComSpec || cmdPath,
  PATH: hasSystem32InPath ? currentPath : `${system32Path};${currentPath}`,
};

const builderCliPath = path.join(
  __dirname,
  "..",
  "node_modules",
  "electron-builder",
  "cli.js"
);

const args = process.argv.slice(2);
const result = spawnSync(process.execPath, [builderCliPath, ...args], {
  env,
  stdio: "inherit",
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
