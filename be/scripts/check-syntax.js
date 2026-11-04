import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

function getJsFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getJsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      results.push(fullPath);
    }
  }
  return results;
}

const filesToCheck = [
  path.join(rootDir, "app.js"),
  path.join(rootDir, "server.js"),
  ...getJsFiles(path.join(rootDir, "src")),
  ...getJsFiles(path.join(rootDir, "scripts")),
].filter((file) => fs.existsSync(file));

const uniqueFiles = Array.from(new Set(filesToCheck));

console.log(`Checking syntax for ${uniqueFiles.length} JavaScript files...`);

let failed = false;
for (const file of uniqueFiles) {
  const relPath = path.relative(rootDir, file);
  try {
    execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
  } catch (error) {
    console.error(`Syntax error in ${relPath}:`);
    if (error.stderr) {
      process.stderr.write(error.stderr);
    }
    failed = true;
  }
}

if (failed) {
  console.error("Syntax check failed.");
  process.exit(1);
} else {
  console.log(`All ${uniqueFiles.length} files passed syntax check.`);
}

