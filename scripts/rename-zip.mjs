import { existsSync } from "node:fs";
// Rename the packaged zip to a fixed name: halo-theme-cosolar.zip
import { readdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";

const distDir = join(process.cwd(), "dist");
const targetName = "halo-theme-cosolar.zip";

if (!existsSync(distDir)) {
  console.error("dist directory not found");
  process.exit(1);
}

const files = await readdir(distDir);
const zipFiles = files.filter((f) => f.endsWith(".zip"));

if (zipFiles.length === 0) {
  console.error("No zip file found in dist/");
  process.exit(1);
}

// Remove any existing target file first
const targetPath = join(distDir, targetName);
if (existsSync(targetPath)) {
  await rm(targetPath);
}

// Rename the first zip found
const sourcePath = join(distDir, zipFiles[0]);
await rename(sourcePath, targetPath);

console.log(`✅ Renamed: ${zipFiles[0]} -> ${targetName}`);
console.log(`   Path: ${targetPath}`);
