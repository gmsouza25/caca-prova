#!/usr/bin/env node
// ============================================================
//  scripts/lote-ids.mjs — imprime os PRÓXIMOS N ids a processar pelo LLM
//  (aqueles que AINDA não têm fonteDados e têm campo vazio).
//
//  Uso:  node scripts/lote-ids.mjs 18          # primeiros 18
//        node scripts/lote-ids.mjs 19          # primeiros 19
//  Saída: lista comma-separated de ids (ou vazio se nada pendente).
//
//  Por que isso é melhor que LLM_OFFSET: é calculado em tempo de execução
//  sobre o acervo real. Como, após processar, cada edital ganha `fonteDados`,
//  ele sai da lista — então "os primeiros N pendentes" no sábado são o lote 1,
//  no domingo o lote 2, na segunda o lote 3 — sem nunca desalinhar, mesmo que
//  o acervo mude (crawl diário) ou algum edital fique 100% preenchido.
// ============================================================
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const N = parseInt(process.argv[2] || "18", 10) || 18;
const FIELDS = ["cargo", "escolaridade", "vagas", "salario", "dt_publicacao", "dt_inscricao_abre", "dt_inscricao_fecha", "dt_prova", "area", "cidade", "estado"];
const vazio = (v) => v == null || v === "" || v === "Não informado" || v === "Cargo não informado" || (Array.isArray(v) && v.length === 0);

const j = JSON.parse(readFileSync(join(ROOT, "concursos.json"), "utf8"));
const pend = (j.concursos || [])
  .filter((c) => !c.fonteDados && FIELDS.some((k) => vazio(c[k])))
  .map((c) => c.id)
  .slice(0, N);

process.stdout.write(pend.join(","));
