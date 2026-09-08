// scripts/gen-fingerprints.mjs — regenera fingerprints.json (manifest SHA-256).
// Uso:  node scripts/gen-fingerprints.mjs
// Exclui pastas de dependência/cache e arquivos sensíveis (nunca versionados).
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const EXCLUDE = new Set([
  ".git", "node_modules", ".wrangler", ".arena", "__pycache__",
  "fingerprints.json", ".env", ".env.example", "crawler/out", "crawler/db", ".gitignore",
  "serve.py", ".DS_Store", "*.log",
]);
const SKIP_EXT = [".bak", ".log", ".tmp"];

function walk(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const rel = p.replace(ROOT + "/", "");
    if (EXCLUDE.has(e) || EXCLUDE.has(rel) || SKIP_EXT.some((s) => e.endsWith(s))) continue;
    let s;
    try { s = statSync(p); } catch { continue; }
    if (s.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

const files = walk(ROOT).sort();
const out = {};
for (const f of files) {
  out[f.replace(ROOT + "/", "")] = createHash("sha256").update(readFileSync(f)).digest("hex");
}
writeFileSync(join(ROOT, "fingerprints.json"), JSON.stringify(out, null, 2));
console.log(`✅ fingerprints.json: ${Object.keys(out).length} arquivos`);
