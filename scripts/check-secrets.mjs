import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const ignored = new Set(["node_modules", ".next", ".git", "out", "build", ".aureli-backups"]);
const allowedFiles = new Set([
  ".env.example",
  "package-lock.json",
  ".github/workflows/ci.yml",
  "prisma.config.ts",
]);
const patterns = [
  { name: "Google API key", regex: /AIza[0-9A-Za-z_-]{30,}/g },
  { name: "OpenAI-style key", regex: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { name: "AWS access key", regex: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g },
  { name: "Private key", regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { name: "Database URL with credentials", regex: /postgres(?:ql)?:\/\/[^\s:"']+:[^\s@"']+@[^\s"']+/g },
];

function fallbackFiles(dir, output = []) {
  for (const name of readdirSync(dir)) {
    if (ignored.has(name)) continue;
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) fallbackFiles(path, output);
    else if (stat.size <= 2_000_000) output.push(relative(root, path));
  }
  return output;
}

let files;
try {
  files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
} catch {
  files = fallbackFiles(root);
}

const findings = [];
for (const file of files) {
  if (allowedFiles.has(file) || file.startsWith("prisma/migrations/")) continue;
  let content;
  try { content = readFileSync(join(root, file), "utf8"); } catch { continue; }
  for (const pattern of patterns) {
    pattern.regex.lastIndex = 0;
    if (pattern.regex.test(content)) findings.push(`${file}: possible ${pattern.name}`);
  }
}

if (findings.length > 0) {
  console.error("Potential committed secrets found:\n" + findings.join("\n"));
  process.exit(1);
}
console.log(`Secret scan passed across ${files.length} tracked/repository files.`);
