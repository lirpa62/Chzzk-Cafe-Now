const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const path = require("node:path");

const sizes = [16, 48, 128];
const assetsDirectory = path.join(__dirname, "..", "assets");
const sourceIcon = path.join(assetsDirectory, "icon.png");

if (!fs.existsSync(sourceIcon)) {
  throw new Error(`Source icon not found: ${sourceIcon}`);
}

sizes.forEach((size) => {
  const outputIcon = path.join(assetsDirectory, `icon-${size}.png`);

  execFileSync("sips", ["-z", String(size), String(size), sourceIcon, "--out", outputIcon], {
    stdio: "inherit",
  });
});
