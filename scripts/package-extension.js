const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const path = require("node:path");

const rootDirectory = path.join(__dirname, "..");
const distDirectory = path.join(rootDirectory, "dist");
const packageJson = require(path.join(rootDirectory, "package.json"));
const manifest = require(path.join(rootDirectory, "manifest.json"));

if (packageJson.version !== manifest.version) {
  throw new Error(
    `Version mismatch: package.json ${packageJson.version}, manifest.json ${manifest.version}`,
  );
}

const archiveName = `${packageJson.name}-${packageJson.version}.zip`;
const archivePath = path.join(distDirectory, archiveName);
const files = [
  "manifest.json",
  "README.md",
  "src",
  "assets/icon-16.png",
  "assets/icon-48.png",
  "assets/icon-128.png",
];

files.forEach((file) => {
  const filePath = path.join(rootDirectory, file);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Package file not found: ${file}`);
  }
});

fs.mkdirSync(distDirectory, { recursive: true });
fs.rmSync(archivePath, { force: true });

execFileSync(
  "zip",
  ["-r", archivePath, ...files, "-x", "*.DS_Store"],
  {
    cwd: rootDirectory,
    stdio: "inherit",
  },
);

console.log(`Created ${path.relative(rootDirectory, archivePath)}`);
