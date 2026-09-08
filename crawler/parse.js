// parse.js — heurísticas de extração de órgão/cargo/esfera a partir de um título de edital.
// Regras testadas contra títulos reais de FGV, Fundatec e IDECAN.
// Prioridade: obter órgão/estado de forma inequívoca; cargo é melhor esforço (nunca inventar).

const { normalize } = require("./geo.js");

// Palavras que, se aparecerem como "órgão", indicam que ainda não achamos o órgão de verdade.
const STOP = ["edital", "concurso", "processo", "seletivo", "exame", "prova", "publico", "público", "nº", "no"];

function cargoOrgao(title) {
  const t = (title || "").replace(/\s+/g, " ").replace(/\u00a0/g, " ").trim();
  const low = normalize(t);
  let orgao = "";
  let cargo = "";

  // ---------- ÓRGÃO ----------
  // (a) FGV: "para a/o <org>"
  let m = t.match(/para\s+(?:o\s+|a\s+)(.{3,110}?)(?:\s+\(|\.|\s+\d{4}\s*$|$)/i);
  if (m && /concurso|seletivo|edital|processo/i.test(low)) {
    orgao = cleanOrg(m[1]);
  } else {
    // (b) Fundatec/IDECAN: "<org> – <resto>"  (o lado esquerdo é o órgão)
    m = t.match(/^(.*?)\s*[–-]\s*(?=concurso|processo|seletivo|edital|exame|prova|ingresso|careira|carreira|mestrado|pos)\b/i);
    if (m && !isStop(m[1]) && m[1].length >= 3) {
      orgao = cleanOrg(m[1]);
    } else {
      // (c) "Concurso <org> ..." (IDECAN)
      m = t.match(/concurso\s+(?:p[úu]blico\s+)?(.{3,90})$/i);
      if (m) {
        // separa sigla (tudo em maisculo) do cargo
        const seg = m[1];
        const sigla = (seg.match(/^([A-ZÀ-Ú]{2,}(?:\/[A-Z]{2,})?(?:\s*[-–]\s*[A-ZÀ-Ú]{2,})?)/) || [])[1];
        if (sigla) { orgao = cleanOrg(sigla); }
        else { orgao = cleanOrg(seg.replace(/\s+\d{4}$/, "")); }
        if (!cargo && /[–-]/.test(seg)) {
          const c = seg.split(/[–-]/).pop().trim();
          if (c && !/^[A-ZÀ-Ú]{2,6}$/.test(c)) cargo = capitalize(c);
        }
      } else {
        // (d) resto do título
        orgao = cleanOrg(t);
      }
    }
  }
  if (!orgao || isStop(orgao) || orgao.length < 2) orgao = title;

  // ---------- CARGO ----------
  // (1) "cargos de <X>" / "provimento ... <X>"
  m = t.match(/(?:cargos?\s+d[eo]\s+|provimento\s+de\s+)(.{3,90}?)(?:\.|$)/i);
  if (m) cargo = capitalize(m[1]);

  // (2) "EDITAL nn – <ORG> – <cargo>"
  if (!cargo) {
    m = t.match(/[–-]\s*([A-ZÀ-Ú0-9][^–-]{1,40}?)\s*[–-]\s*(.{3,90})$/i);
    if (m && !/^edital|^concurso\b/i.test(m[2])) cargo = capitalize(m[2]);
  }
  // (3) "– <cargo>" no fim (não sendo uma sigla curta)
  if (!cargo) {
    m = t.match(/[–-]\s*(.{3,90})$/);
    if (m && !/^edital|^concurso|^processo|^seletivo|^exame|^prova|^mestrado|^pos\b/i.test(m[1]) && !/^[A-ZÀ-Ú]{2,6}$/.test(m[1])) cargo = capitalize(m[1]);
  }
  // (4) fallback: cargo genérico (nulo quando não achamos um cargo de verdade)
  if (!cargo || isOrgLike(cargo)) cargo = null;

  return { orgao: cleanOrg(orgao), cargo, esfera: esferaFromText(low) };
}

// Um "cargo" que na verdade é órgão/lugar (Prefeitura, Departamento, Instituto,
// universidade, município, "/UF") não é cargo — o app mostra "Cargo não informado".
function isOrgLike(c) {
  if (!c) return true;
  const x = normalize(c).toLowerCase();
  if (/(municipal|departamento|instituto|universidade|prefeitura|camara|governo|estado|conselho|empresa|fundacao|companhia|agencia|secretaria|assembleia|procuradoria|tribunal|defensoria|ministerio|orgao)/.test(x)) return true;
  if (/\/\s*(ac|al|ap|am|ba|ce|df|es|go|ma|mg|ms|mt|pa|pb|pe|pi|pr|rj|rn|ro|rr|rs|sc|se|sp|to)\b/i.test(x)) return true;
  return false;
}

function isStop(s) {
  const x = normalize(s).trim();
  return !x || STOP.some((w) => x === w) || x.length < 2;
}

function cleanOrg(s) {
  let x = String(s || "");
  x = x.replace(/\s*\d{4}\s*$/, "");
  x = x.replace(/\s*\([^)]*\)\s*$/, "");
  x = x.replace(/\s*\/\s*[A-Z]{2}\s*$/, " (UF)"); // guarda UF
  x = x.replace(/[.,;:]+$/g, "").trim();
  // limpa UF para nickname (voltamos a UF em geo/estado)
  return x.replace(/ \(UF\)$/, "");
}

function capitalize(s) {
  return String(s || "")
    .replace(/(^|\s)([a-zà-ú])/g, (_, sp, c) => sp + c.toUpperCase())
    .replace(/\s{2,}/g, " ")
    .trim();
}

function esferaFromText(low) {
  if (/(federal|uniao|ministe|receita|universidade federal|instituto federal|banco do brasil|caixa economica|agencia nacional|ibama|inss|serpro|dataprev|departamento nacional|comando da aeronautica|exercito)/.test(low)) return "Federal";
  if (/(estadual|secretaria de estado|policia|tribunal de justica|defensoria|ministerio publico|assembleia|bombeiro|brigada|governo do estado|governo de|conselho regional|fundacao|servico social autonomo|companhia|instituto de previdencia|\bbanco\b|agencia|autarquia)/.test(low)) return "Estadual";
  if (/(municip|prefeitura|camara municipal|guarda municipal)/.test(low)) return "Municipal";
  return "Municipal";
}

module.exports = { cargoOrgao, esferaFromText, capitalize };
