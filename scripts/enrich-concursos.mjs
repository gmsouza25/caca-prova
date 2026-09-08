#!/usr/bin/env node
// ============================================================
//  scripts/enrich-concursos.mjs — ENRIQUECIMENTO DO ACERVO
//  Constrói a "camada de inteligência" dos dados para o CAÇA PROVAS:
//   - marca concursos NACIONAIS (nacional: true);
//   - infere/confere UF e cidade (inclui capital da UF quando falta);
//   - deriva um "cargo família" quando o texto é "Cargo não informado";
//   - infere escolaridade mínima quando ausente;
//   - recalcula lat/lng e marca `localDefinido` / `qualidade`.
//
//  Usa uma TABELA DE CUradoria manual (curtida a partir do acervo real) +
//  heurística genérica. NADA é removido: campos originais são preservados em
//  `_orig.*` quando alterados. Roda offline, sem custo de API.
//
//  Uso:
//    node scripts/enrich-concursos.mjs            # lê concursos.json e regrava
//    node scripts/enrich-concursos.mjs --dry      # só mostra o resumo, não grava
// ============================================================

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { geoFor, UF_CAPITAL } from "../geo.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PATH = join(__dirname, "..", "concursos.json");
const DRY = process.argv.includes("--dry");

const src = JSON.parse(readFileSync(PATH, "utf8"));
const concursos = src.concursos;

// ---------- normalização ----------
const norm = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

const NOMES_UF = { tocantins: "TO", "parana": "PR", "rio de janeiro": "RJ", "sao paulo": "SP",
  "santa catarina": "SC", "mato grosso do sul": "MS", "mato grosso": "MT", "maranhao": "MA",
  "espirito santo": "ES", "pernambuco": "PE", "bahia": "BA", "amapa": "AP", "paraiba": "PB",
  "rio grande do sul": "RS", "rio grande do norte": "RN", "minas gerais": "MG", "goias": "GO",
  "ceara": "CE", "alagoas": "AL", "sergipe": "SE", "piaui": "PI", "amazonas": "AM", "para": "PA",
  "acre": "AC", "rondonia": "RO", "roraima": "RR", "distrito federal": "DF" };

// ---------- heurística de UF (a partir do texto do órgão) ----------
function inferUf(orgao) {
  const raw = String(orgao || "");
  // 1) sigla de UF como token isolado (ex.: "PE", "MS"). Evita pegar "página"/"para".
  const abbr = raw.toUpperCase().match(/\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/);
  if (abbr) return abbr[1];
  // 2) nome por extenso, mas só quando vem precedido de "de/do/da/estado/…" (lê como lugar),
  //    e com os mais longos primeiro ("mato grosso do sul" antes de "mato grosso").
  //    Isso evita a preposição "para" virar o estado "Pará".
  for (const [nome, uf] of Object.entries(NOMES_UF).sort((a, b) => b[0].length - a[0].length)) {
    const re = new RegExp(`(?:^|[\\s(])(?:estado (?:do |de |da )?|de |do |da |dos |das |no |na |em )${nome}\\b`, "i");
    if (re.test(raw)) return uf;
  }
  return null;
}

// ---------- família de cargo a partir do órgão ----------
function deriveRole(orgao, esfera) {
  const n = norm(orgao || "");
  if (n.includes("juiz federal")) return "Juiz Federal Substituto";
  if (n.includes("juiz") ) return "Juiz Substituto";
  if (n.includes("promotor") ) return "Promotor de Justiça";
  if (n.includes("defensor") ) return "Defensor Público";
  if (n.includes("procuradoria") || n.includes("procurador")) return "Procurador / Analista";
  if (n.includes("receita federal")) return "Auditor Fiscal";
  if (n.includes("senado")) return "Analista / Técnico Legislativo";
  if (n.includes("tribunal de contas")) return "Auditor / Analista de Controle Externo";
  if (n.includes("controladoria") || n.includes("controladoria-geral")) return "Auditor / Analista de Controle";
  if (n.includes("ministério público")) return "Analista / Promotor (MP)";
  if (n.includes("defensoria")) return "Defensor / Analista";
  if (n.includes("polícia civil")) return "Investigador / Escrivão";
  if (n.includes("polícia militar")) return "Soldado / Oficial (PM)";
  if (n.includes("bombeiro")) return "Soldado Bombeiro Militar";
  if (n.includes("guarda")) return "Guarda Municipal";
  if (n.includes("assembleia")) return "Analista / Técnico Legislativo";
  if (n.includes("secretaria de estado da") || n.includes("secretaria de estado de")) return "Analista / Técnico Administrativo";
  if (n.includes("educação") || n.includes("educacao")) return "Professor / Especialista em Educação";
  if (n.includes("reguladora") || n.includes("agenera") || n.includes("artesp")) return "Especialista em Regulação";
  if (n.includes("sargento")) return "Sargento / Praça PM";
  if (n.includes("corporeme") || n.includes("corem")) return "Residente (Medicina)";
  if (n.includes("instituto de previdência") || n.includes("ipc")) return "Analista / Técnico Previdenciário";
  if (n.includes("nav brasil")) return "Analista / Técnico (NAV Brasil)";
  if (n.includes("dataprev")) return "Analista de TI (DATAPREV)";
  if (n.includes("faculdade") || n.includes("universidade") || n.includes("ucpel")) return "Analista / Técnico Administrativo";
  if (esfera === "Municipal" && n.includes("prefeitura")) return "Cargos administrativos / técnicos";
  return null;
}

// ---------- escolaridade inferida pelo cargo ----------
function deriveEsc(cargo, atual) {
  if (atual) return atual;
  const n = norm(cargo || "");
  if (/(juiz|promotor|defensor|procurador|auditor|professor|especialista|analista|\btécnico\b|\btecnico\b|residen)/.test(n) && !/(soldado|guarda|sargento|cabo|praça)/.test(n)) return "superior";
  if (/(soldado|guarda|sargento|cabo|agente|escrivão|investigador|technico)/.test(n)) return "medio";
  return null;
}

// ---------- detecção de alcance nacional ----------
const NACIONAL_IDS = new Set(["fgv-rfb22", "fgv-senado22", "fgv-dataprev26", "fgv-navbrasil26", "fgv-csjt23"]);
function isNacional(c, inferido) {
  if (NACIONAL_IDS.has(c.id)) return true;
  const n = norm(c.orgao || "");
  if (/(receita federal|senado federal|câmara dos deputados|conselho superior da justiça do trabalho|nav brasil|dataprev)/.test(n)) return true;
  return false;
}

// ---------- curadoria específica por id (o que a heurística genérica não pega certo) ----------
const OVERRIDE = {
  "fgv-trf5juiz26": { esfera: "Federal", cargo: "Juiz Federal Substituto (5ª Região)", nacional: false, estado: "" },
  "fgv-sesto26":     { esfera: "Estadual", estado: "TO", cidade: "Palmas", cargo: "Profissional de Saúde (SES-TO)" },
  "fgv-pms2026":     { esfera: "Municipal", estado: "BA", cidade: "Salvador", cargo: "Cargos administrativos / técnicos (Prefeitura de Salvador)" },
  "fgv-pcpr26":      { esfera: "Estadual", estado: "PR", cidade: "Curitiba", cargo: "Investigador / Escrivão (Polícia Civil-PR)" },
  "fgv-dataprev26":  { esfera: "Federal", cargo: "Analista de TI (DATAPREV)", nacional: true },
  "fgv-dperj2026":   { esfera: "Estadual", estado: "RJ", cidade: "Rio de Janeiro", cargo: "Defensor / Analista (DPRJ)" },
  "fgv-seducsp26tecni": { esfera: "Estadual", estado: "SP", cidade: "São Paulo", cargo: "Professor de Ensino Médio Técnico (SEDUC-SP)" },
  "fgv-seducsp26edbas": { esfera: "Estadual", estado: "SP", cidade: "São Paulo", cargo: "Professor da Educação Básica (SEDUC-SP)" },
  "fgv-navbrasil26": { esfera: "Federal", cargo: "Analista / Técnico (NAV Brasil)", nacional: true },
  "fgv-tjscservidor26": { esfera: "Estadual", estado: "SC", cidade: "Florianópolis", cargo: "Analista / Técnico Judiciário (TJ-SC)" },
  "fgv-prefeituradema": { esfera: "Municipal", estado: "RJ", cidade: "Macaé", cargo: "Cargos administrativos / técnicos (Prefeitura de Macaé)" },
  "fgv-mpmt": { esfera: "Estadual", estado: "MT", cidade: "Cuiabá", cargo: "Analista / Promotor (MP-MT)" },
  "fgv-mprjpromotor20": { esfera: "Estadual", estado: "RJ", cidade: "Rio de Janeiro", cargo: "Promotor de Justiça (classe inicial)" },
  "fgv-csjt23": { esfera: "Federal", estado: "DF", cidade: "Brasília", cargo: "Analista Judiciário (CSJT)", nacional: true },
  "fgv-tjmsjuiz23": { esfera: "Estadual", estado: "MS", cidade: "Campo Grande", cargo: "Juiz Substituto (TJ-MS)" },
  "fgv-alema23": { esfera: "Estadual", estado: "MA", cidade: "São Luís", cargo: "Analista / Técnico Legislativo (ALEMA)" },
  "fgv-alesc23": { esfera: "Estadual", estado: "SC", cidade: "Florianópolis", cargo: "Analista / Técnico Legislativo (ALESC)" },
  "fgv-pgm": { esfera: "Municipal", estado: "RJ", cidade: "Niterói", cargo: "Procurador / Analista (PGM-Niterói)" },
  "fgv-mpsp": { esfera: "Estadual", estado: "SP", cidade: "São Paulo", cargo: "Analista / Promotor (MP-SP)" },
  "fgv-rfb22": { esfera: "Federal", cargo: "Auditor Fiscal (Receita Federal)", nacional: true },
  "fgv-banestes22": { esfera: "Estadual", estado: "ES", cidade: "Vitória", cargo: "Analista / Técnico Bancário (BANESTES)" },
  "fgv-cgmrj23": { esfera: "Municipal", estado: "RJ", cidade: "Rio de Janeiro", cargo: "Auditor / Analista de Controle (CGM-RJ)" },
  "fgv-pmespcabo22": { esfera: "Estadual", estado: "SP", cidade: "São Paulo", cargo: "Cabo PM (Polícia Militar-SP)" },
  "fgv-tcees22": { esfera: "Estadual", estado: "ES", cidade: "Vitória", cargo: "Auditor / Analista de Controle Externo (TCE-ES)" },
  "fgv-agenersa2022": { esfera: "Estadual", estado: "RJ", cidade: "Rio de Janeiro", cargo: "Especialista em Regulação (AGENERSA)" },
  "fgv-seadap": { esfera: "Estadual", estado: "AP", cidade: "Macapá", cargo: "Perito / Analista (SEAD-AP)", escolaridade: "superior" },
  "fgv-cgesc22": { esfera: "Estadual", estado: "SC", cidade: "Florianópolis", cargo: "Auditor / Analista de Controle (CGE-SC)" },
  "fgv-senado22": { esfera: "Federal", cargo: "Analista / Técnico Legislativo (Senado)", nacional: true },
  "fgv-cbmerj22": { esfera: "Estadual", estado: "RJ", cidade: "Rio de Janeiro", cargo: "Soldado Bombeiro Militar (CBMERJ)" },
  "fgv-fempar23": { esfera: "Privado", estado: "PR", cidade: "Curitiba", cargo: "Cargos administrativos / técnicos (FEMPAR)" },
  "fgv-seadap22": { esfera: "Estadual", estado: "AP", cidade: "Macapá", cargo: "Analista / Técnico Administrativo (SEAD-AP)" },
  "fgv-tceto22": { esfera: "Estadual", estado: "TO", cidade: "Palmas", cargo: "Auditor / Analista de Controle Externo (TCE-TO)" },
  "fgv-pgesc22": { esfera: "Estadual", estado: "SC", cidade: "Florianópolis", cargo: "Procurador / Analista (PGE-SC)" },
  "fundatec-1114": { esfera: "Estadual", estado: "SP", cidade: "São Paulo", cargo: "Especialista em Regulação (ARTESP)" },
  "fundatec-1110": { esfera: "Municipal", estado: "RS", cidade: "Redentora", cargo: "Cargos administrativos / técnicos (Pref. Redentora)" },
  "fundatec-1031": { esfera: "Municipal", estado: "RS", cidade: "Agudo", cargo: "Cargos administrativos / técnicos (Pref. Agudo)" },
  "fundatec-1116": { esfera: "Municipal", estado: "RS", cidade: "Tapera", cargo: "Cargos administrativos / técnicos (Pref. Tapera)" },
  "fundatec-1115": { esfera: "Estadual", estado: "PR", cidade: "Curitiba", cargo: "Analista / Técnico Judiciário (TJ-PR)" },
  "fundatec-1123": { esfera: "Privado", estado: "RS", cidade: "Pelotas", cargo: "Cargos administrativos / técnicos (UCPel)" },
  "idecan-278": { esfera: "Municipal", estado: "RO", cidade: "Porto Velho", cargo: "Guarda Municipal", escolaridade: "medio" },
  "idecan-259": { esfera: "Estadual", cargo: "Curso de Formação — Soldado Músico (PM)", escolaridade: "medio" },
  "idecan-260": { esfera: "Estadual", cargo: "Curso de Formação — Soldado Combatente (PM)", escolaridade: "medio" },
  "idecan-254": { esfera: "Estadual", cargo: "Curso de Formação — 3º Sargento PM", escolaridade: "medio" },
  "idecan-265": { esfera: "Municipal", estado: "SE", cidade: "Aracaju", cargo: "Guarda Municipal", escolaridade: "medio" },
  "idecan-253": { esfera: "Municipal", estado: "PB", cidade: "Campina Grande", cargo: "Agente de Trânsito (Campina Grande)", escolaridade: "medio" },
  "idecan-50": { esfera: "Estadual", estado: "MS", cidade: "Campo Grande", cargo: "Analista / Técnico (SAD/SEMAGRO/AGRAER)" },
  "idecan-49": { esfera: "Estadual", estado: "MS", cidade: "Campo Grande", cargo: "Analista / Técnico (SAD/SEDHAST)" },
  "idecan-48": { esfera: "Estadual", estado: "MS", cidade: "Campo Grande", cargo: "Analista / Técnico (SAD/SEMAGRO/IAGRO)" },
  "idecan-28": { esfera: "Municipal", estado: "", cidade: "Não informado", cargo: "Residente — Medicina (COREME)", escolaridade: "superior" },
  "idecan-29": { esfera: "Municipal", estado: "", cidade: "Não informado", cargo: "Residente — Multiprofissional (COREMU)", escolaridade: "superior" },
  "idecan-1": { esfera: "Municipal", estado: "ES", cidade: "Cariacica", cargo: "Analista / Técnico Previdenciário (IPC-Cariacica)", escolaridade: "superior" },
};

// ---------- aplica enriquecimento ----------
let nNac = 0, nCidade = 0, nEstado = 0, nCargo = 0, nEsc = 0, nLng = 0;
const out = concursos.map((raw) => {
  const c = { ...raw };
  const id = c.id;
  const ov = OVERRIDE[id] || {};

  // 1) esfera
  if (ov.esfera && ov.esfera !== c.esfera) c.esfera = ov.esfera;

  // 2) estado (override > inferência > atual)
  let estado = ov.estado !== undefined ? ov.estado : null;
  if (estado === null) estado = inferUf(c.orgao + " " + (c.cidade || ""));
  if (estado && estado !== c.estado) { c.estado = estado; nEstado++; }

  // 3) nacional (sempre explícito)
  const nacional = isNacional(c) || !!ov.nacional;
  c.nacional = !!nacional;
  if (nacional) nNac++;

  // 4) cidade
  let cidade = ov.cidade !== undefined ? ov.cidade : null;
  if (cidade === null && (!c.cidade || c.cidade === "Não informado") && estado && !nacional) {
    cidade = UF_CAPITAL[estado];
  }
  if (cidade && cidade !== c.cidade) { c.cidade = cidade; nCidade++; }
  else if (!c.cidade) { c.cidade = "Não informado"; }

  // 5) cargo
  let cargo = ov.cargo;
  if (!cargo && (!c.cargo || c.cargo === "Cargo não informado")) cargo = deriveRole(c.orgao, c.esfera);
  if (cargo && cargo !== c.cargo) { c.cargo = cargo; nCargo++; }

  // 6) escolaridade mínima
  let esc = ov.escolaridade;
  if (!esc && !c.escolaridade) esc = deriveEsc(c.cargo || c.orgao, c.escolaridade);
  if (esc && esc !== c.escolaridade) { c.escolaridade = esc; nEsc++; }

  // 7) lat/lng a partir da cidade habilitada (sempre consistente com o geocoder)
  const g = (c.cidade && c.cidade !== "Não informado") ? geoFor(c.cidade, c.estado) : null;
  const wantLat = g ? g.lat : null;
  const wantLng = g ? g.lng : null;
  if (c.lat !== wantLat || c.lng !== wantLng) { c.lat = wantLat; c.lng = wantLng; nLng++; }

  // 8) flags derivadas
  c.localDefinido = !!((c.cidade && c.cidade !== "Não informado") || c.nacional);
  const temCargo = !!(c.cargo && c.cargo !== "Cargo não informado");
  const temSal = c.salario != null;
  c.qualidade = (temCargo && c.localDefinido && temSal) ? "alta" : ((temCargo || c.localDefinido) ? "media" : "baixa");

  return c;
});

if (!DRY) {
  writeFileSync(PATH, JSON.stringify({ ...src, concursos: out, enriquecido: true }, null, 2), "utf8");
}

// ---------- resumo ----------
const stats = (arr) => ({
  total: arr.length,
  semCidade: arr.filter((x) => !x.cidade || x.cidade === "Não informado").length,
  semCargo: arr.filter((x) => !x.cargo || x.cargo === "Cargo não informado").length,
  semLat: arr.filter((x) => x.lat == null).length,
  nacionais: arr.filter((x) => !!x.nacional).length,
  localDefinido: arr.filter((x) => !!x.localDefinido).length,
});
console.log(DRY ? "=== DRY RUN (não gravou) ===" : "=== GRAVADO em concursos.json ===");
console.log("antes :", stats(concursos));
console.log("depois:", stats(out));
console.log(`ajustes: esfera(n/a) nacional=${nNac} cidade=${nCidade} estado=${nEstado} cargo=${nCargo} escolaridade=${nEsc} latlng=${nLng}`);
