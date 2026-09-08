#!/usr/bin/env node
// ============================================================
//  scripts/llm-enrich.mjs — ENRIQUECIMENTO POR IA DOS EDITAIS
//
//  Fluxo (política B + cache com limpeza):
//   1. Tenta LER o edital de verdade:
//        a) se o `edital`/`link` é um PDF direto (.pdf / %PDF) => baixa e extrai.
//        b) se é uma página HTML => procura o primeiro link de PDF dentro dela
//           e baixa/extrai.
//   2. Se conseguiu texto => manda pro LLM => dados EXTRAÍDOS DO EDITAL
//      (marca `fonteDados: "edital"`).
//   3. Se NÃO conseguiu (captcha/anti-bot/bloqueado/sem PDF):
//        - factual (vagas, salário, datas): fica `null` (não inventa) ...
//        - ... A MENOS que LLM_ESTIMATE=1 (modo B): o LLM sugere e marcamos
//          `estimado:true` / `fonteDados:"estimado"` (interface mostra "≈").
//
//  CACHE: PDF + texto extraído ficam em crawler/edital_cache/<hash>.* .
//  Ao final, apagamos as entradas NÃO usadas neste ciclo (limpeza automática).
//
//  Uso:
//    npm install                              # instala pdf-parse
//    LLM_API_KEY=... node scripts/llm-enrich.mjs --dry     # concursos.llm.json (REVISAR)
//    LLM_API_KEY=... node scripts/llm-enrich.mjs --apply   # só após revisar
//    LLM_LIMIT=3 LLM_API_KEY=... node scripts/llm-enrich.mjs --dry   # teste rápido
//  Flags: LLM_API_KEY | LLM_BASE_URL | LLM_MODEL | LLM_LIMIT | LLM_ESTIMATE (0/1)
//         LLM_CACHE_DAYS (limpeza, padrão 14)
// ============================================================

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync, statSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, basename } from "node:path";
import { createHash } from "node:crypto";
import { PDFParse } from "pdf-parse";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PATH = join(ROOT, "concursos.json");
const CACHE_DIR = join(ROOT, "crawler", "edital_cache");
const APPLY = process.argv.includes("--apply");
const DRY = !APPLY;

const KEY = process.env.LLM_API_KEY;
// Padrão: API NATIVA do Gemini (models/{MODEL}:generateContent + ?key=).
//   IMPORTANTE: as chaves novas do Google (formato "AQ.Ab...") funcionam na API
//   NATIVA, mas são REJEITADAS no caminho OpenAI-compatível (/v1beta/openai/**)
//   com Authorization: Bearer. Por isso o padrão é a rota nativa.
//   Se você usar uma chave clássica "AIza..." e preferir a rota OpenAI, defina:
//     LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
const BASE = (process.env.LLM_BASE_URL || "https://generativelanguage.googleapis.com/v1beta").replace(/\/$/, "");
const NATIVE = !BASE.includes("/openai");
const MODEL = process.env.LLM_MODEL || "gemini-3.6-flash";
const OFFSET = Number(process.env.LLM_OFFSET || 0); // pula os primeiros N que precisam (p/ lotes)
const LIMIT = process.env.LLM_LIMIT ? Number(process.env.LLM_LIMIT) : Infinity;
const ESTIMATE = process.env.LLM_ESTIMATE === "1";
const CACHE_DAYS = Number(process.env.LLM_CACHE_DAYS || 14);
const DELAY = Number(process.env.LLM_DELAY || 3500); // ms entre chamadas (respeita ~15 RPM da camada free)
const MAX_EDITAL_CHARS = 30000; // texto máximo mandado pro LLM por edital
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";

if (!KEY) {
  console.log("ℹ️  LLM não configurado (faltou LLM_API_KEY). Nada a fazer. Veja PUBLICAR.md §8.2.");
  process.exit(0);
}

// ---------- --apply: PROMOVE o concursos.llm.json já revisado (não re-rodar o LLM) ----------
//  O fluxo recomendado é:  --dry  →  revisar concursos.llm.json  →  --apply.
//  O --apply então apenas "promove" o arquivo revisado, SEM chamar a API de novo
//  (preservando a cota diária). O caminho antigo (rodar de novo e aplicar direto)
//  continua disponível: apague concursos.llm.json antes de --apply.
const LLM_PATH = join(ROOT, "concursos.llm.json");
const PATH_ = PATH; // legibilidade
if (APPLY && existsSync(LLM_PATH)) {
  const rev = JSON.parse(readFileSync(LLM_PATH, "utf8"));
  const meta = rev.llm || {};
  if (meta.aplicado === false) {
    rev.llm.aplicado = true;
    writeFileSync(join(ROOT, "concursos.antes-llm.json"), readFileSync(PATH_, "utf8"), "utf8"); // backup
    writeFileSync(PATH_, JSON.stringify(rev, null, 2), "utf8");
    writeFileSync(LLM_PATH, JSON.stringify(rev, null, 2), "utf8"); // marca como aplicado (evita re-promover)
    console.log(`✅ llm-enrich (--apply): promovido concursos.llm.json → concursos.json.`);
    console.log(`   ${meta.processados || 0} processado(s) | ${meta.lidosDeEdital || 0} lidos do edital | ${meta.estimados || 0} estimados | ${meta.nErros || 0} erro(s) | modelo ${meta.model || "?"}.`);
    console.log("   Backup: concursos.antes-llm.json");
    process.exit(0);
  }
}

const src = JSON.parse(readFileSync(PATH, "utf8"));
const concursos = src.concursos;

// LLM_IDS: lista separada por vírgula de ids EXATOS a processar. Se definido,
// IGNORA offset/limit e processa só esses (preservando a ordem no arquivo).
// Útil para distribuir os editais entre vários modelos (cada modelo = 1 chamada
// por id), evitando a ambiguidade do offset após aplicar lotes parciais.
const IDS_RAW = (process.env.LLM_IDS || "").trim();
const idSet = IDS_RAW ? new Set(IDS_RAW.split(",").map((s) => s.trim()).filter(Boolean)) : null;

// ---------- fields que o LLM propõe ----------
const FIELDS = ["cargo", "escolaridade", "vagas", "salario", "dt_publicacao", "dt_inscricao_abre", "dt_inscricao_fecha", "dt_prova", "area", "cidade", "estado"];
const vazio = (v) => v == null || v === "" || v === "Não informado" || v === "Cargo não informado" || (Array.isArray(v) && v.length === 0);
const FACTUAL = ["vagas", "salario", "dt_publicacao", "dt_inscricao_abre", "dt_inscricao_fecha", "dt_prova"];

// ---------- cache ----------
const hash = (s) => createHash("sha1").update(String(s)).digest("hex").slice(0, 16);
const used = new Set();
const pdfPath = (h) => join(CACHE_DIR, h + ".pdf");
const txtPath = (h) => join(CACHE_DIR, h + ".txt");
function cacheRead(h) { if (existsSync(txtPath(h))) return readFileSync(txtPath(h), "utf8"); return null; }
function cacheWrite(h, pdf, text) { mkdirSync(CACHE_DIR, { recursive: true }); if (pdf) writeFileSync(pdfPath(h), pdf); writeFileSync(txtPath(h), text, "utf8"); used.add(h); }
function cleanup(referenced) {
  if (!existsSync(CACHE_DIR)) return;
  const now = Date.now();
  for (const f of readdirSync(CACHE_DIR)) {
    const p = join(CACHE_DIR, f);
    const base = f.replace(/\.(pdf|txt)$/, "");
    if (!referenced.has(base) || (now - statSync(p).mtimeMs) / 86400000 > CACHE_DAYS) unlinkSync(p);
  }
}

// ---------- baixar e extrair texto de um edital ----------
async function fetchBytes(url) {
  const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/pdf,text/html,*/*" }, redirect: "follow" });
  if (!r.ok) throw new Error("HTTP " + r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  return buf;
}
function isPdf(buf) { return buf && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46; }
function findPdfLinks(html) {
  const out = new Set();
  const re = /href=["']([^"']+\.pdf(?:\?[^"']*)?)["']/gi;
  let m; while ((m = re.exec(html))) { const u = m[1]; if (/^https?:\/\//i.test(u)) out.add(u); else out.add(new URL(u, "https://x.invalid").href); }
  return [...out];
}
async function extractText(buf) {
  try { const parser = new PDFParse({ data: buf }); const r = await parser.getText(); return String(r && (r.text || r)); }
  catch { return null; }
}
async function editalText(url) {
  const h = hash(url);
  const cached = cacheRead(h);
  if (cached && cached.trim().length > 500) { used.add(h); return cached; } // reutiliza texto (PDF fica p/ limpeza)
  let buf;
  try { buf = await fetchBytes(url); } catch { return null; }
  if (!isPdf(buf)) {
    // página HTML: procura PDF dentro
    const html = buf.toString("utf8");
    for (const lu of findPdfLinks(html)) {
      try { const b2 = await fetchBytes(lu); if (isPdf(b2)) { buf = b2; break; } } catch {}
    }
    if (!isPdf(buf)) return null; // não achou PDF
  }
  const text = await extractText(buf);
  if (!text || text.trim().length < 200) return null;
  cacheWrite(h, isPdf(buf) ? buf : null, text);
  return text;
}

// ---------- prompt do LLM ----------
function promptGrounded(c, text) {
  const t = text.slice(0, MAX_EDITAL_CHARS);
  return `Você é um especialista em concursos públicos do Brasil. Leia o TEXTO DO EDITAL abaixo e preencha os dados. Responda SOMENTE um JSON válido, sem texto extra, com APENAS os campos que o edital confirma (não invente).

CONCURSO ATUAL:
${JSON.stringify({ orgao: c.orgao, esfera: c.esfera, cargo: c.cargo, cidade: c.cidade, estado: c.estado, id: c.id }, null, 2)}

TEXTO DO EDITAL (início):
${t}

Campos: cargo, escolaridade (fundamental|medio|tecnico|superior), vagas (número), salario (número R$), dt_publicacao, dt_inscricao_abre, dt_inscricao_fecha, dt_prova (formato AAAA-MM-DD), area (ids: administracao, juridica, saude, educacao, seguranca, fiscal, financeira, tecnologia, infraestrutura), cidade, estado.
Onde o edital não informar, devolva null.`;
}
function promptEstimate(c) {
  return `Você é um especialista em concursos públicos no Brasil. Só com o ÓRGÃO, proponha valores PLAUSÍVEIS que deverão ser revisados por um humano (valores aproximados). Responda somente JSON válido.

CONCURSO: ${JSON.stringify({ orgao: c.orgao, esfera: c.esfera, cargo: c.cargo, cidade: c.cidade, estado: c.estado }, null, 2)}

Campos: cargo, escolaridade, vagas, salario, area, cidade, estado. Se não souber, null.`;
}

function parseJSON(text) {
  const t = String(text || "").trim();
  try { return JSON.parse(t); } catch {}
  const start = t.indexOf("{");
  if (start >= 0) {
    let depth = 0, inStr = false, esc = false;
    for (let i = start; i < t.length; i++) {
      const ch = t[i];
      if (esc) { esc = false; continue; }
      if (ch === "\\") { esc = true; continue; }
      if (ch === '"') inStr = !inStr;
      if (inStr) continue;
      if (ch === "{") depth++;
      else if (ch === "}") { depth--; if (depth === 0) { try { return JSON.parse(t.slice(start, i + 1)); } catch { break; } } }
    }
  }
  throw new Error("resposta do LLM não é JSON válido");
}

// ---------- normalização (para o app nunca quebrar) ----------
const AREAS = new Set(["administracao","gestao","educacao","licenciatura","juridica","seguranca","saude","social","fiscal","contabilidade","financeira","infraestrutura","engenharia","tecnologia","industrial","meio_ambiente","agropecuaria","comunicacao","cultura","esportes","trabalho","logistica","qualidade","energia","defesa","arquivologia","estatistica","comercio","mineracao"]);
const AREA_SIN = { "direito":"juridica","administrativo":"administracao","adm":"administracao","ti":"tecnologia","informatica":"tecnologia","contabil":"contabilidade","contabeis":"contabilidade","saude":"saude","seguranca":"seguranca","educacao":"educacao","pedagogia":"educacao","professor":"educacao","esporte":"esportes","ambiental":"meio_ambiente","construcao":"infraestrutura","regulacao":"infraestrutura","transporte":"logistica" };
const ESC = new Set(["fundamental","medio","tecnico","superior","pos"]);
const normStr = (v) => String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9_ ]/g, "").trim();
function normArea(raw) {
  const arr = Array.isArray(raw) ? raw : String(raw || "").split(/[,\/;\n]/);
  const out = [];
  for (let a of arr) {
    const n = normStr(a);
    if (!n) continue;
    const id = AREAS.has(n) ? n : AREA_SIN[n];
    if (id && !out.includes(id)) out.push(id);
  }
  return out.length ? out : null;
}
function normEsc(raw) { const n = normStr(raw); return ESC.has(n) ? n : null; }
function normNum(raw) {
  let s = String(raw || "").replace(/[^\d.,-]/g, "");
  if (!s) return null;
  const neg = s.startsWith("-");
  s = s.replace(/-/g, "");
  if (s.includes(",") && s.includes(".")) { s = s.replace(/\./g, "").replace(",", "."); } // pt-BR: 35.845,21
  else if (s.includes(",")) { s = s.replace(",", "."); }                                  // 35,84
  else if (s.includes(".")) { const p = s.split("."); if (p.length === 2 && p[1].length === 3) s = s.replace(".", ""); } // "35.845" => 35845
  const n = parseFloat(s);
  return Number.isFinite(n) ? (neg ? -n : n) : null;
}
function normDate(raw) { const m = String(raw || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${m[1]}-${m[2]}-${m[3]}` : null; }
function normalizar(k, v) {
  if (k === "area") return normArea(v);
  if (k === "escolaridade") return normEsc(v);
  if (k === "vagas") return normNum(v);
  if (k === "salario") return normNum(v);
  if (/^dt_/.test(k)) return normDate(v);
  if (k === "cidade" || k === "estado") { const s = String(v || "").trim(); return s && s !== "Não informado" ? s : null; }
  if (k === "cargo") { const s = String(v || "").trim(); return s || null; }
  return v;
}

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
async function callLLM(prompt) {
  const retryable = new Set([408, 429, 500, 502, 503, 504]);
  const SYSTEM = "Responda APENAS com JSON válido, sem texto extra, sem comentários.";
  for (let attempt = 0; attempt < 4; attempt++) {
    let r = null;
    try {
      if (NATIVE) {
        const url = `${BASE}/models/${MODEL}:generateContent?key=${encodeURIComponent(KEY)}`;
        const body = {
          systemInstruction: { parts: [{ text: SYSTEM }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0 },
        };
        r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      } else {
        const body = { model: MODEL, temperature: 0, messages: [{ role: "system", content: SYSTEM }, { role: "user", content: prompt }] };
        r = await fetch(`${BASE}/chat/completions`, {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` }, body: JSON.stringify(body),
        });
      }
    } catch (e) { /* erro de rede: retenta */ }
    if (r && r.ok) {
      try {
        const j = await r.json();
        if (NATIVE) {
          const text = (j.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("").trim();
          if (text) return parseJSON(text);
          throw new Error("resposta vazia do Gemini");
        }
        return parseJSON(j.choices?.[0]?.message?.content || "{}");
      } catch (e) {
        // JSON inválido: tenta de novo uma vez, senão falha
        if (attempt === 3) throw e;
        await sleep(5000 * (attempt + 1)); continue;
      }
    }
    if (r && retryable.has(r.status)) { await sleep(6000 * (attempt + 1) + Math.random() * 1000); continue; }
    if (r) { // 4xx permanente (ex.: modelo inválido / chave inválida)
      throw new Error("LLM HTTP " + r.status + " " + (await r.text().catch(() => "")).slice(0, 160));
    }
    await sleep(4000 * (attempt + 1)); // erro de rede: tenta de novo
  }
  throw new Error("LLM HTTP 429/5xx (rate limit indisponível) após 4 tentativas");
}

// ---------- aplica ----------
const out = [];
let n = 0, errs = 0, lidos = 0, estimados = 0, semEdital = 0, processados = 0, skipped = 0;
for (const c of concursos) {
  const inTarget = idSet ? idSet.has(c.id) : true; // LLM_IDS filtra os ids
  if (!inTarget) { out.push(c); continue; }
  const precisa = FIELDS.some((k) => vazio(c[k]));
  if (!precisa) { out.push(c); continue; }
  if (idSet) { /* modo LLM_IDS: ignora OFFSET/LIMIT */ }
  else if (skipped < OFFSET) { skipped++; out.push(c); continue; } // pula até o offset (lote)
  else if (processados >= LIMIT) { out.push(c); continue; }
  processados++;
  if (processados > 1) await sleep(DELAY); // espaça chamadas (camada free ~15 RPM)

  const candUrls = [c.edital, c.link].filter(Boolean);
  let text = null;
  for (const u of candUrls) { text = await editalText(u); if (text) break; }

  const aplicar = (novo, prop) => {
    let preencheu = 0;
    for (const k of FIELDS) {
      if (!vazio(novo[k])) continue; // não sobrescreve o que já existe
      if (prop[k] === undefined || prop[k] === null || String(prop[k]).trim() === "") continue;
      const val = normalizar(k, prop[k]);
      if (val === null || val === undefined) continue; // inválido => mantém como está
      novo[k] = val;
      preencheu++;
    }
    return preencheu;
  };

  try {
    if (text) {
      // ---- LIDO DO EDITAL (dados confiáveis) ----
      const novo = { ...c };
      const preencheu = aplicar(novo, await callLLM(promptGrounded(c, text)));
      novo.fonteDados = "edital";
      out.push(novo); n++; lidos++;
      process.stderr.write(`✔ ${c.id} [edital] (${preencheu} campo(s))\n`);
    } else if (ESTIMATE) {
      // ---- SEM EDITAL, MAS COM ESTIMATIVA PERMITIDA (modo B) ----
      const novo = { ...c };
      const preencheu = aplicar(novo, await callLLM(promptEstimate(c)));
      novo.fonteDados = "estimado"; novo.estimado = true;
      out.push(novo); n++; estimados++;
      process.stderr.write(`✔ ${c.id} [estimado] (${preencheu} campo(s))\n`);
    } else {
      // ---- SEM EDITAL E SEM ESTIMATIVA: não inventa factual; avisa ----
      const novo = { ...c, fonteDados: "sem-edital", semEdital: true };
      out.push(novo); n++; semEdital++;
      process.stderr.write(`✔ ${c.id} [sem-edital] (sem preencher)\n`);
    }
  } catch (e) {
    errs++;
    process.stderr.write(`✖ ${c.id}: ${e.message}\n`);
    out.push(c);
  }
}

// limpeza: só mantém entradas usadas/recentes deste ciclo
cleanup(used);

const res = { ...src, concursos: out, llm: { model: MODEL, processados, nAlterados: n, nErros: errs, lidosDeEdital: lidos, estimados, semEdital, aplicado: APPLY, offset: OFFSET, limit: LIMIT === Infinity ? null : LIMIT, cache: CACHE_DIR } };
if (DRY) {
  writeFileSync(join(ROOT, "concursos.llm.json"), JSON.stringify(res, null, 2), "utf8");
  console.log(`✅ llm-enrich (--dry): ${n} registro(s) em concursos.llm.json — ${lidos} lidos do edital, ${estimados} estimados, ${semEdital} sem edital, ${errs} erro(s).`);
  console.log("   ⚠️  REVISE e rode com --apply para aplicar em concursos.json.");
} else {
  writeFileSync(PATH, JSON.stringify(res, null, 2), "utf8");
  console.log(`✅ llm-enrich (--apply): ${n} registro(s) aplicados em concursos.json — ${lidos} do edital, ${estimados} estimados, ${semEdital} sem edital, ${errs} erro(s).`);
}
