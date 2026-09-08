#!/usr/bin/env node
// ============================================================
//  scripts/limpar-dados.mjs — LIMPEZA DOS DADOS SUSPEITOS
//
//  Remove valores implausíveis que poderiam enganar o usuário:
//    - salário < R$ 500  => null   (ex.: "R$ 30" que veio do scraper)
//    - vagas  <= 0        => null
//  NÃO apaga valores apenas por estarem repetidos (ex.: R$ 30.505 é a
//  remuneração inicial real de juiz em todo o país; R$ 9.114 a de promotor).
//  Esses, você decide depois olhando a listagem de "repetidos" impressa aqui.
//
//  Uso (pode operar em concursos.json ou concursos.llm.json):
//    node scripts/limpar-dados.mjs                            # concursos.json
//    node scripts/limpar-dados.mjs concursos.llm.json         # arquivo específico
//    node scripts/limpar-dados.mjs concursos.llm.json --apply # salva no arquivo (senão só mostra)
//  Faz backup do arquivo antes de gravar (concursos.antes-limpeza.json).
// ============================================================
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ARG = process.argv.find((a) => a.endsWith(".json"));
const FILE = ARG ? join(ROOT, ARG) : join(ROOT, "concursos.json");
const APPLY = process.argv.includes("--apply");
const LIMPAR_REP = process.argv.includes("--limpar-repetidos"); // zera salários repetidos (>2x)

if (!existsSync(FILE)) { console.error("Arquivo não encontrado:", FILE); process.exit(1); }
const j = JSON.parse(readFileSync(FILE, "utf8"));
const lista = j.concursos || [];

let nSal = 0, nVag = 0, nGeral = 0;
for (const c of lista) {
  let mexeu = false;
  if (c.salario != null && Number(c.salario) < 500) { c.salario = null; nSal++; mexeu = true; }
  if (c.vagas != null && Number(c.vagas) <= 0) { c.vagas = null; nVag++; mexeu = true; }
  if (mexeu) nGeral++;
}

// zera salários cujo valor aparece >2x (valores "tabelados"/repetidos não confirmados pelo edital)
let nRep = 0;
if (LIMPAR_REP) {
  const cont = {};
  for (const x of lista) if (x.salario != null) cont[String(x.salario)] = (cont[String(x.salario)] || 0) + 1;
  const suspeitos = Object.keys(cont).filter((s) => cont[s] > 2);
  for (const x of lista) {
    if (x.salario != null && suspeitos.includes(String(x.salario))) { x.salario = null; nRep++; }
  }
}

// ---- lista de valores REPETIDOS (suspeitos) que ficaram para sua revisão ----
function repetidos(key) {
  const m = {};
  for (const x of lista) { const v = x[key]; if (v == null) continue; const s = String(v); (m[s] = m[s] || []).push(x.id); }
  const rows = [];
  for (const s in m) if (m[s].length > 2) rows.push(`${key}=${s}  (${m[s].length}x)  ex: ${m[s].slice(0, 5).join(", ")}${m[s].length > 5 ? "..." : ""}`);
  return rows;
}
const reps = [...repetidos("salario"), ...repetidos("vagas")];

console.log(`📋 ${basename(FILE)}: ${lista.length} registro(s).`);
console.log(`🧹 Limpos: salário < R$500 → ${nSal} | vagas <= 0 → ${nVag} | salários repetidos (>2x) → ${nRep} | ${nGeral} registro(s) alterado(s) por regra simples.`);
if (nRep) console.log(`   (salários repetidos zerados: "NÃO CONSTA")`);

if (reps.length) {
  console.log("\n⚠️  Valores REPETIDOS que ainda estão no acervo (revise se são reais):");
  reps.forEach((r) => console.log("   - " + r));
} else {
  console.log("\n✅ Nenhum valor repetido (acima de 2) no acervo.");
}

if (APPLY) {
  const backup = FILE.replace(/\.json$/, ".antes-limpeza.json");
  writeFileSync(backup, readFileSync(FILE, "utf8"), "utf8");
  writeFileSync(FILE, JSON.stringify(j, null, 2), "utf8");
  console.log("\n💾 Salvo no arquivo. Backup:", basename(backup));
}
