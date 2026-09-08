#!/usr/bin/env node
// index.js — ORQUESTRADOR de raspagem semanal dos editais públicos.
// Uso:
//   node crawler/index.js                 # escreve concursos.json (na raiz do app)
//   node crawler/index.js --source=fgv    # só uma fonte
//   node crawler/index.js --dry-run       # não grava, só mostra o resumo
//   node crawler/index.js --limit=10      # limita o nº de itens por fonte (teste)
// Portas de saída: /concursos.json (servido ao app) e /crawler/out/* (auditoria).

const { writeOutput, dedupe, mergeWithCache, readPrevious, exportSQL } = require("./store.js");

const config = require("./config.js");
const sources = require("./sources/index.js");
const pciSource = require("./sources/pci.js");
const { enrich } = require("./enrich.js");

const argv = process.argv.slice(2);
const flag = (name) => {
  const a = argv.find((x) => x.startsWith(`--${name}`));
  const eq = a && a.indexOf("=");
  return a ? (eq >= 0 ? a.slice(eq + 1) : "true") : null;
};
const filtered = flag("source");
const dryRun = argv.includes("--dry-run");
const enrichOnly = argv.includes("--enrich-only");
const limit = parseInt(flag("limit") || "0", 10) || 0;

async function runAll() {
  const generatedAt = new Date().toISOString();
  const sourceStatus = {};

  // ---- MODO: enriquecer o acervo ATUAL com o PCI (sem re-raspar fontes) ----
  if (enrichOnly) {
    const base = readPrevious(); // já é o array de concursos
    let records = base, matched = 0, changes = 0, ok = false, cardsCount = 0;
    try {
      const cards = await pciSource.fetchCards();
      cardsCount = cards.length;
      if (cards.length) {
        const outEnrich = enrich(base, cards);
        records = outEnrich.records;
        matched = outEnrich.matched;
        changes = outEnrich.changes;
      }
      ok = true;
    } catch (e) {
      // PCI indisponível: mantém o acervo atual sem quebrar (o CI não cai).
      console.error(`  ✖ [pci --enrich-only] PCI Concursos: ${e.message} (acervo atual mantido)`);
    }
    const meta = { generatedAt, schedule: config.schedule, sources: { existing: { ok: true, count: base.length } },
      enrichment: { ok, count: cardsCount, matched, changes, ...(ok ? {} : { error: null }) } };
    const ativos = config.keepActiveOnly
      ? records.filter((c) => c.status !== "Inscrições encerradas" && c.status !== "Concluído")
      : records;
    if (dryRun) {
      console.log(`\n[dry-run --enrich-only] ${base.length} registros · ${matched} match · ${changes} campo(s) enriquecido(s) (nada gravado).`);
      return;
    }
    const out = writeOutput(ativos, meta);
    console.log(`\n✅ ${out.count} concursos ATIVOS (enriquecidos de ${base.length}) gravados em concursos.json`);
    console.log(`   • PCI: ${cardsCount} cards · ${matched} match · ${changes} campo(s) preenchido(s)`);
    console.log(`   • Esferas: ${countBy(ativos, "esfera")}`);
    console.log(`   • Gerado em: ${generatedAt}`);
    return;
  }

  let current = [];
  let baseOrder = 0;
  for (const src of sources) {
    if (filtered && src.code !== filtered) continue;
    const t0 = Date.now();
    sourceStatus[src.code] = { nome: src.nome, ok: false, count: 0, ms: 0 };
    try {
      let recs = await src.run();
      if (limit > 0) recs = recs.slice(0, limit);
      current.push(...recs);
      sourceStatus[src.code] = { nome: src.nome, ok: true, count: recs.length, ms: Date.now() - t0 };
      console.log(`  ✔ [${src.code}] ${src.nome}: ${recs.length} concursos (${Date.now() - t0}ms)`);
    } catch (e) {
      sourceStatus[src.code] = { nome: src.nome, ok: false, count: 0, ms: Date.now() - t0, error: e.message };
      console.error(`  ✖ [${src.code}] ${src.nome}: ${e.message}`);
    }
  }

  // ---- Enriquecimento via PCI (opcional, só em run completo) ----
  // Preenche salário/vagas/escolaridade/data dos editais oficiais com os fatos
  // da listagem pública do PCI, mantendo o link oficial. Se o PCI falhar, ignora.
  let pciStatus = { ok: false, count: 0, matched: 0, changes: 0 };
  if (!filtered && config.enrichPci !== false) {
    const t0 = Date.now();
    try {
      const cards = await pciSource.fetchCards();
      if (cards.length) {
        const { records, matched, changes } = enrich(current, cards);
        current = records;
        pciStatus = { ok: true, count: cards.length, matched, changes, ms: Date.now() - t0 };
        console.log(`  ✔ [pci] PCI Concursos: ${cards.length} cards · ${matched} match · ${changes} campo(s) enriquecido(s) (${Date.now() - t0}ms)`);
      } else {
        pciStatus = { ok: false, count: 0, matched: 0, changes: 0 };
      }
    } catch (e) {
      pciStatus = { ok: false, count: 0, matched: 0, changes: 0, error: e.message };
      console.error(`  ✖ [pci] PCI Concursos: ${e.message}`);
    }
  }

  // Merge com o crawl anterior (para não "sumir" a lista se uma fonte falhar).
  // Num run completo (sem --source) com TODAS as fontes OK, não mantemos stale:
  // itens legados/desatualizados saem da lista central.
  const anyFailed = Object.values(sourceStatus).some((s) => !s.ok);
  const keepStale = !!filtered || anyFailed;
  const previous = readPrevious();
  const merged = mergeWithCache(current, previous, keepStale);
  const unique = dedupe(merged);

  // Acervo central focado em concursos ATIVOS (descarta encerrados/concluídos)
  const ativos = config.keepActiveOnly
    ? unique.filter((c) => c.status !== "Inscrições encerradas" && c.status !== "Concluído")
    : unique;
  const deskartados = unique.length - ativos.length;

  const meta = {
    generatedAt,
    schedule: config.schedule,
    sources: sourceStatus,
    enrichment: pciStatus,
  };

  if (dryRun) {
    console.log(`\n[dry-run] ${unique.length} concursos únicos (nada gravado).`);
    return;
  }

  const out = writeOutput(ativos, meta);
  exportSQL(ativos);
  const est = ativos.filter((c) => c.status === "Inscrições abertas").length;
  console.log(`\n✅ ${out.count} concursos ATIVOS gravados em concursos.json`);
  if (config.keepActiveOnly) console.log(`   • (${deskartados} encerrados/concluídos descartados)`);
  console.log(`   • Inscrições abertas: ${est}`);
  console.log(`   • Esferas: ${countBy(ativos, "esfera")}`);
  console.log(`   • Fontes: ${Object.keys(sourceStatus).join(", ")}`);
  if (pciStatus.ok) console.log(`   • Enriquecimento PCI: ${pciStatus.matched} match(es), ${pciStatus.changes} campo(s) preenchido(s)`);
  console.log(`   • Gerado em: ${generatedAt}`);

  if (filtered) console.log(`\n(aviso: filtrado por --source=${filtered})`);
}

function countBy(arr, key) {
  const m = {};
  for (const r of arr) {
    const k = r[key] || "—";
    m[k] = (m[k] || 0) + 1;
  }
  return Object.entries(m)
    .map(([k, v]) => `${k} ${v}`)
    .join(" · ");
}

runAll().catch((e) => {
  console.error("Falha geral do crawler:", e);
  process.exitCode = 1;
});
