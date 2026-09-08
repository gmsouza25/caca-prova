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
//  Melhorias (v2):
//    • Timestamps + progresso por modelo.
//    • Não derruba o script se um modelo falhar/estourar cota — pula para o próximo.
//    • Detecta cota esgotada (429/"quota") e não insiste no modelo.
//    • Modo --check: só sonda os modelos (gasta 1 req cada) e mostra o que está livre,
//      sem processar nada.
//    • Modo --ids: imprime os ids exatos que seriam processados agora (útil p/ revisão),
//      sem chamar a API.
//
//  Uso:
//    LLM_ESTIMATE=1 node scripts/rodar-multimodelo.mjs                 # processa tudo
//    LLM_ESTIMATE=1 LLM_MODELS="gemini-3.5-flash,gemini-3.6-flash" node scripts/rodar-multimodelo.mjs
//    ... LLM_PER_MODEL=10 node scripts/rodar-multimodelo.mjs           # máx. por modelo
//    node scripts/rodar-multimodelo.mjs --check                        # sonda modelos
//    node scripts/rodar-multimodelo.mjs --ids                          # só imprime ids pendentes
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

const MODE_CHECK = process.argv.includes("--check");
const MODE_IDS = process.argv.includes("--ids");
const MODE_DRY_ONLY = process.argv.includes("--dry-only"); // gera concursos.llm.json mas NÃO aplica

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
  try { const j = JSON.parse(readFileSync(file, "utf8")); return j.llm || null; } catch { return null; }
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ts = () => new Date().toISOString().slice(11, 19);

function run(mode, env) {
  // execFileSync lança se o subprocesso sair != 0. Capturamos para não derrubar o script.
  try {
    execFileSync("node", ["scripts/llm-enrich.mjs", mode], {
      cwd: ROOT, stdio: "inherit", env: { ...process.env, ...env },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, msg: String(e.status ?? e.message).slice(0, 120) };
  }
}

// ---- --ids: só imprime o que seria processado ----
if (MODE_IDS) {
  const pending = needIds().slice(0, Number(process.env.LLM_LIMIT || Infinity));
  process.stdout.write(pending.join(","));
  console.error(`\nℹ️  [--ids] ${pending.length} pendente(s).`);
  process.exit(0);
}

// ---- --check: sonda os modelos (1 req cada) e mostra o que está livre ----
if (MODE_CHECK) {
  let pending = needIds().length;
  console.log(`🔎 [--check] ${pending} edital(is) pendente(s) | modelos: ${models.length}\n`);
  for (const m of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${encodeURIComponent(KEY)}`;
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "ok" }] }], generationConfig: { temperature: 0 } }) });
      let extra = "";
      try { const j = await r.json(); if (j.error) extra = (j.error.message || "").slice(0, 46); } catch { extra = ""; }
      const ok = r.status === 200;
      console.log(`   ${ok ? "✅" : "❌"} ${m.padEnd(32)} HTTP ${r.status}${extra ? " · " + extra : ""}`);
    } catch (e) {
      console.log(`   ❌ ${m.padEnd(32)} erro de rede: ${e.message}`);
    }
    await sleep(400); // espaça p/ não estourar o RPM na sonda
  }
  process.exit(0);
}

// ---- fluxo principal ----
(async () => {
  let pending = needIds();
  console.log(`[${ts()}] 📚 ${pending.length} edital(is) a processar | ${models.length} modelo(s) | máx ${PER_MODEL}/modelo | ${MODE_DRY_ONLY ? "DRY-ONLY (não aplica)" : "aplica"}\n`);

  let appliedFor = []; // ids efetivamente marcados (fonteDados) após aplicar

  for (const model of models) {
    if (!pending.length) break;
    const chunk = pending.slice(0, PER_MODEL);
    console.log(`[${ts()}] === ▶ MODELO ${model} (lote ${chunk.length}) ===`);

    // dry (gera concursos.llm.json p/ revisar). Se falhar, tenta outro modelo.
    const d = run("--dry", { LLM_MODEL: model, LLM_IDS: chunk.join(","), LLM_ESTIMATE: process.env.LLM_ESTIMATE || "1" });
    const meta = summary(join(ROOT, "concursos.llm.json"));
    const lidos = meta ? (meta.lidosDeEdital || 0) : 0;
    const errs = meta ? (meta.nErros || 0) : 0;
    const estimados = meta ? (meta.estimados || 0) : 0;

    // Se o modelo não rendeu (0 leitura e muito erro), provavelmente cota esgotada → pula.
    const exhausted = chunk.length > 0 && lidos === 0 && errs >= chunk.length;
    if (exhausted) {
      console.log(`   ⚠️ ${model} rendeu 0 leituras (${errs} erro(s)) — cota esgotada/instável, pulando.`);
      await sleep(DELAY);
      continue;
    }

    if (!MODE_DRY_ONLY) {
      const ap = run("--apply", { LLM_MODEL: model, LLM_IDS: chunk.join(","), LLM_ESTIMATE: process.env.LLM_ESTIMATE || "1" });
      if (!ap.ok) console.log(`   ⚠️ apply não retornou com sucesso (${ap.msg}) — continua mesmo assim.`);
    } else {
      console.log(`   [--dry-only] não aplicou (conferir concursos.llm.json).`);
    }

    console.log(`   ✔ ${model}: ${lidos} lidos do edital, ${estimados} estimados, ${errs} erro(s).`);

    await sleep(DELAY);
    const after = new Set(needIds());
    pending = pending.filter((id) => after.has(id));
    console.log(`[${ts()}]   → resta(m) ${pending.length} edital(is) sem dados confirmados.`);
  }

  const finalSummary = summary(PATH);
  console.log(`\n[${ts()}] ========== RESUMO FINAL ==========`);
  console.log(`Fonte atual (concursos.json): ${finalSummary ? JSON.stringify({ model: finalSummary.model, lidos: finalSummary.lidosDeEdital, estimados: finalSummary.estimados, erros: finalSummary.nErros }) : "?"}`);
  console.log(`Ainda pendentes: ${pending.length} ${pending.length ? "(→ " + pending.join(", ") + ")" : ""}`);
  console.log(`\n${pending.length === 0 ? "🎉 TODOS os editais processados." : "⏳ Falta processar (cota diária esgotou ou fonte bloqueada)."}`);
})();
