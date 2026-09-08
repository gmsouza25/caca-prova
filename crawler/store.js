// store.js — normalização final, deduplicação por hash, cache e escrita de saída.
// Também emite o schema D1 (opcional) para quando a base passa a viver no banco central.

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { normalize } = require("./geo.js");

const ROOT = path.join(__dirname, "..");

// Identidade do edital: preferimos o `id` (determinístico por fonte/edital, estável
// entre execuções) ao hash de conteúdo. O hash é usado apenas para auditoria.
function hash(rec) {
  const key = normalize(`${rec.orgao}|${rec.cargo}|${rec.cidade}|${rec.link}`);
  return crypto.createHash("sha1").update(key).digest("hex").slice(0, 8);
}

// Deduplica por `id`. Registros não-stale têm prioridade.
function dedupe(records) {
  const seen = new Map();
  for (const r of records) {
    const k = r.id;
    const cur = seen.get(k);
    if (!cur || (cur.stale && !r.stale)) seen.set(k, r);
  }
  return [...seen.values()];
}

// Merge com o crawl anterior: mantém itens que sumiram (ex.: fonte caiu) marcando-os
// como stale, para o app não "perder" a lista de uma hora para outra.
// `keepStale` = true apenas quando há fonte que falhou ou run filtrado; num run completo
// com todas as fontes OK, itens stale (legados de schema antigo / que sumiram) são descartados
// para não exibir concurso desatualizado ou com cargo/UF ruins.
function mergeWithCache(current, cacheArray, keepStale = true) {
  const cur = dedupe(current);
  if (!keepStale) return cur;
  const curIds = new Set(cur.map((r) => r.id));
  const cached = dedupe((cacheArray || []));
  const keep = cached
    .filter((c) => !curIds.has(c.id))
    .map((c) => ({ ...c, stale: true }));
  return [...cur, ...keep];
}

function writeOutput(records, meta) {
  const concursos = dedupe(records);
  const out = {
    generatedAt: meta.generatedAt,
    schedule: meta.schedule || "semanal",
    sources: meta.sources,
    count: concursos.length,
    concursos,
  };
  const json = JSON.stringify(out, null, 2);
  const targets = [path.join(ROOT, "concursos.json"), path.join(__dirname, "out", "concursos.json")];
  fs.mkdirSync(path.join(__dirname, "out"), { recursive: true });
  for (const t of targets) fs.writeFileSync(t, json);
  // cache leve de hashes para auditoria
  fs.writeFileSync(
    path.join(__dirname, "out", "cache.json"),
    JSON.stringify({ generatedAt: meta.generatedAt, hashes: concursos.map(hash) }, null, 2)
  );
  return out;
}

function readCache() {
  const p = path.join(__dirname, "out", "cache.json");
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function readPrevious() {
  const p = path.join(ROOT, "concursos.json");
  try {
    const j = JSON.parse(fs.readFileSync(p, "utf8"));
    return j.concursos || [];
  } catch {
    return [];
  }
}

function exportSQL(records) {
  // Schema D1 (Cloudflare) — tabela de concursos normalizados.
  const schema = `-- CAÇA PROVAS — schema D1 (Cloudflare) para o acervo central de concursos
CREATE TABLE IF NOT EXISTS concursos (
  id    TEXT PRIMARY KEY,
  hash  TEXT NOT NULL UNIQUE,
  orgao TEXT NOT NULL,
  esfera TEXT,
  cargo TEXT,
  escolaridade TEXT,
  area TEXT,               -- JSON array de ids de área
  cidade TEXT,
  estado TEXT,
  lat REAL, lng REAL,
  salario REAL,
  vagas INTEGER,
  dt_publicacao TEXT,
  dt_inscricao_abre TEXT,
  dt_inscricao_fecha TEXT,
  dt_prova TEXT,
  regime TEXT,
  link TEXT,
  fonte TEXT,
  status TEXT,
  crawled_at TEXT,
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_concursos_status ON concursos(status);
CREATE INDEX IF NOT EXISTS idx_concursos_area ON concursos(area);
CREATE INDEX IF NOT EXISTS idx_concursos_uf ON concursos(estado);
`;
  fs.mkdirSync(path.join(__dirname, "db"), { recursive: true }); // cria a pasta se não existir (ex.: CI/clone limpo)
  fs.mkdirSync(path.join(__dirname, "out"), { recursive: true });
  fs.writeFileSync(path.join(__dirname, "db", "schema.sql"), schema);
  return schema;
}

module.exports = { hash, dedupe, mergeWithCache, writeOutput, readCache, readPrevious, exportSQL, ROOT };
