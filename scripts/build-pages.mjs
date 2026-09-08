#!/usr/bin/env node
// ============================================================
//  scripts/build-pages.mjs — GERA O `dist/` (o que vai pro ar)
//  O `wrangler pages deploy .` sobe a pasta raiz INTEIRA (incluindo
//  `.env`, `worker/`, `crawler/`, docs…). Para NÃO publicar segredos
//  nem ferramentas de dev, copiamos para `dist/` SOMENTE o que o app
//  precisa em runtime e publicamos o `dist/`.
// ============================================================

import { cpSync, mkdirSync, rmSync, copyFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT = join(ROOT, "dist");

// Arquivos estáticos (um a um) obrigatórios no runtime do app.
const FILES = [
  "index.html",
  "app.js",
  "data.js",
  "match.js",
  "geo.js",
  "premium.js",
  "profile.js",
  "central.js",
  "pix.js",
  "feedback.js",
  "push.js",
  "termos.js",
  "config.js",
  "concursos.json",
  "styles.css",
  "sw.js",
  "manifest.webmanifest",
  "icon.svg",
  "icon-192.png",
  "icon-512.png",
  "_headers",
];

// Pastas copiadas recursivamente (bibliotecas e Pages Functions).
const DIRS = ["lib", "functions"];

// Limpa o dist (nunca deixar artefato antigo).
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

let ok = 0, missing = [];
for (const f of FILES) {
  const src = join(ROOT, f);
  if (!existsSync(src)) { missing.push(f); continue; }
  copyFileSync(src, join(OUT, f));
  ok++;
}
for (const d of DIRS) {
  const src = join(ROOT, d);
  if (!existsSync(src)) { missing.push(d); continue; }
  cpSync(src, join(OUT, d), { recursive: true });
  ok++;
}

console.log(`✅ build-pages: ${ok} arquivo(s)/pasta(s) copiado(s) para dist/`);
if (missing.length) {
  console.error("⚠️  FALTANDO (verifique):", missing.join(", "));
  process.exit(1);
}
console.log("   - arquivos sensíveis (.env, worker/, crawler/, scripts/, docs) NÃO saem no dist/");
