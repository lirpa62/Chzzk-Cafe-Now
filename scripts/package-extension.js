const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const path = require("node:path");

const rootDirectory = path.join(__dirname, "..");
const distDirectory = path.join(rootDirectory, "dist");
const packageJson = require(path.join(rootDirectory, "package.json"));
const manifest = require(path.join(rootDirectory, "manifest.json"));
const target = process.argv[2] || "chrome";

if (!["chrome", "firefox"].includes(target)) {
  throw new Error(`Unknown package target: ${target}`);
}

if (packageJson.version !== manifest.version) {
  throw new Error(
    `Version mismatch: package.json ${packageJson.version}, manifest.json ${manifest.version}`,
  );
}

const archiveName =
  target === "chrome"
    ? `${packageJson.name}-${packageJson.version}.zip`
    : `${packageJson.name}-firefox-${packageJson.version}.zip`;
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

function getFirefoxManifest() {
  return {
    ...manifest,
    background: {
      scripts: [manifest.background.service_worker],
    },
    browser_specific_settings: {
      gecko: {
        id: "@chzzk-cafe-now.lirpa",
        strict_min_version: "121.0",
        data_collection_permissions: {
          required: ["none"],
        },
      },
    },
  };
}

if (target === "chrome") {
  execFileSync("zip", ["-r", archivePath, ...files, "-x", "*.DS_Store"], {
    cwd: rootDirectory,
    stdio: "inherit",
  });
} else {
  const packageDirectory = path.join(distDirectory, `${packageJson.name}-firefox`);
  fs.rmSync(packageDirectory, { force: true, recursive: true });
  fs.mkdirSync(packageDirectory, { recursive: true });

  files
    .filter((file) => file !== "manifest.json")
    .forEach((file) => {
      const sourcePath = path.join(rootDirectory, file);
      const targetPath = path.join(packageDirectory, file);
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.cpSync(sourcePath, targetPath, { recursive: true });
    });

  fs.writeFileSync(
    path.join(packageDirectory, "manifest.json"),
    `${JSON.stringify(getFirefoxManifest(), null, 2)}\n`,
  );

  execFileSync(
    "zip",
    [
      "-r",
      archivePath,
      "manifest.json",
      "README.md",
      "src",
      "assets/icon-16.png",
      "assets/icon-48.png",
      "assets/icon-128.png",
      "-x",
      "*.DS_Store",
    ],
    {
      cwd: packageDirectory,
      stdio: "inherit",
    },
  );
}

console.log(`Created ${path.relative(rootDirectory, archivePath)}`);
