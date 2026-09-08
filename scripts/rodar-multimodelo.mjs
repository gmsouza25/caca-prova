#!/usr/bin/env node
// ============================================================
//  scripts/rodar-multimodelo.mjs — RE-EXECUTA a leitura dos editais
//  distribuindo entre VÁRIOS modelos do Gemini, até esgotar a cota
//  diária de cada modelo (ou processar todos os editais).
//
//  Motivação: cada modelo Flash tem ~20 req/dia na camada gratuita.
//  Distribuir os 55 editais por vários modelos permite processar TUDO
//  no mesmo dia, em vez de esperar a cota de UM modelo renovar.
//
//  Como funciona:
//    1. Lê concursos.json e descobre os ids que precisam de enriquecimento.
//    2. Percorre a lista de modelos (rotação). Para cada modelo, processa um
//       lote de ids (LLM_IDS) chamando scripts/llm-enrich.mjs (--dry + --apply).
//    3. Após cada modelo, recomputa o que ainda falta; o excedente vai para o
//       próximo modelo. Quando um modelo esgota a cota (muitos erros), segue
//       para o seguinte.
//    4. Para: todos processados OU nenhum modelo com cota restante.
//
//  Uso:
//    LLM_ESTIMATE=1 node scripts/rodar-multimodelo.mjs            # processa tudo
//    LLM_ESTIMATE=1 LLM_MODELS="gemini-3.5-flash,gemini-3.6-flash" node scripts/rodar-multimodelo.mjs
//    ... LLM_PER_MODEL=10 node scripts/rodar-multimodelo.mjs       # máx. por modelo
// ============================================================
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PATH = join(ROOT, "concursos.json");
const FIELDS = ["cargo", "escolaridade", "vagas", "salario", "dt_publicacao", "dt_inscricao_abre", "dt_inscricao_fecha", "dt_prova", "area", "cidade", "estado"];
const vazio = (v) => v == null || v === "" || v === "Não informado" || v === "Cargo não informado" || (Array.isArray(v) && v.length === 0);
const DELAY = Number(process.env.LLM_DELAY || 3600);

const KEY = process.env.LLM_API_KEY;
if (!KEY) { console.error("⛔ Faltou LLM_API_KEY (exporte ou .env.llm)."); process.exit(1); }

const models = (process.env.LLM_MODELS || "gemini-3.6-flash,gemini-3.5-flash,gemini-3.5-flash-lite,gemini-3.1-flash-lite,gemini-3.1-flash-lite-preview,gemini-3.7-flash,gemini-3-flash-preview")
  .split(",").map((s) => s.trim()).filter(Boolean);
const PER_MODEL = Number(process.env.LLM_PER_MODEL || 12); // ≈ dentro do teto ~20/dia

// "Precisa" = etiqueta de origem ausente (ainda não passou pelo LLM) e tem campo vazio.
// Uma vez com fonteDados (edital/estimado/sem-edital), considera-se PROCESSADO —
// não reprocessamos (evita re-raspar/re-chamar a API para o mesmo edital).
const needIds = () => {
  const j = JSON.parse(readFileSync(PATH, "utf8"));
  return (j.concursos || []).filter((c) => !c.fonteDados && FIELDS.some((k) => vazio(c[k]))).map((c) => c.id);
};
const summary = (file) => {
  if (!existsSync(file)) return null;
  const j = JSON.parse(readFileSync(file, "utf8"));
  return j.llm || null;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function run(mode, env) {
  execFileSync("node", ["scripts/llm-enrich.mjs", mode], {
    cwd: ROOT, stdio: "inherit", env: { ...process.env, ...env },
  });
}

(async () => {
  let pending = needIds();
  console.log(`📚 ${pending.length} edital(is) a processar | ${models.length} modelo(s) na rotação | máx ${PER_MODEL}/modelo\n`);

  for (const model of models) {
    if (!pending.length) break;
    const chunk = pending.slice(0, PER_MODEL);
    console.log(`\n=== ▶ MODELO ${model} (lote ${chunk.length}) ===`);

    let errsInChunk = 0, lidosInChunk = 0;
    // dry + apply por modelo (com um pouco de espaçamento p/ não estourar RPM)
    run("--dry", { LLM_MODEL: model, LLM_IDS: chunk.join(","), LLM_ESTIMATE: process.env.LLM_ESTIMATE || "1" });
    const meta = summary(join(ROOT, "concursos.llm.json"));
    errsInChunk = meta ? meta.nErros : 0;
    lidosInChunk = meta ? (meta.lidosDeEdital || 0) : 0;
    run("--apply", { LLM_MODEL: model, LLM_IDS: chunk.join(","), LLM_ESTIMATE: process.env.LLM_ESTIMATE || "1" });

    // se o modelo não rendeu (ex.: cota esgotada → tudo erro), não insiste nele
    if (chunk.length > 0 && lidosInChunk === 0 && errsInChunk >= chunk.length) {
      console.log(`   ⚠️ ${model} rendeu 0 leituras (${errsInChunk} erro(s)) — pulando para o próximo modelo.`);
    } else {
      console.log(`   ✔ ${model}: ${lidosInChunk} lidos do edital, ${errsInChunk} erro(s).`);
    }

    await sleep(DELAY);
    const after = new Set(needIds());
    pending = pending.filter((id) => after.has(id));
    console.log(`   → resta(m) ${pending.length} edital(is) sem dados confirmados.`);
  }

  const finalSummary = summary(PATH);
  console.log(`\n========== RESUMO FINAL ==========`);
  console.log(`Modelos usados: ${models.length}`);
  console.log(`Fonte atual (concursos.json): ${finalSummary ? JSON.stringify({ model: finalSummary.model, lidos: finalSummary.lidosDeEdital, estimados: finalSummary.estimados, erros: finalSummary.nErros }) : "?"}`);
  console.log(`Ainda pendentes: ${pending.length} ${pending.length ? "(→ " + pending.join(", ") + ")" : ""}`);
  console.log(`\n${pending.length === 0 ? "🎉 TODOS os editais processados." : "⏳ Falta processar (cota diária esgotou ou fonte bloqueada)."}`);
})();
