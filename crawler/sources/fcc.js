// sources/fcc.js — Fundação Carlos Chagas (FCC). Banca que organiza muitos
// concursos públicos (tribunais, defensorias, polícias, prefeituras, estaduais).
//
// Lista pública em https://www.concursosfcc.com.br/ (a home lista os ativos).
// NOTA: o robots.txt do site proíbe /concursos/ e *.pdf para * User-Agents.
// Por isso esta fonte é LISTA-ONLY (não abre páginas de detalhe nem baixa PDFs):
// respeitamos o site e deixamos o enriquecimento (PCI/LLM) preencher salário,
// vagas, escolaridade e datas a partir do edital.
const cheerio = require("cheerio");
const { fetchHTML, UA } = require("../http.js");
const { buildRecord } = require("../norm.js");
const config = require("../config.js");

const CODE = "fcc";
const NOME = "Fundação Carlos Chagas (FCC)";
const BASE = "https://www.concursosfcc.com.br";
const LIST = `${BASE}/`;

// Frases que, quando concatenadas ao final de um órgão, indicam início do cargo
// (o site às vezes emenda "ÓrgãoCargo" sem separador). São frases específicas o
// bastante para não cortar dentro de um nome de órgão (ex.: "Defensoria").
const CARGO_SPLIT =
  /(?:Diversos\s+Cargos|Concurso\s+Interno|Defensor\(a\)\s*P[uú]blic[oa]\(a\)|Defensor\(a\)|Pra[cç]a\s+(?:PM|da\s+PM)|Soldado\s+(?:PM|da\s+PM)|Analista\s+(?:Judici[aá]rio|Administrativo|de\s+Finan[cç]as)|Auxiliar\s+de\s+(?:Enfermagem|Administrativo)|Assistente\s+Administrativo|Escriv[aã]o\s+de\s+Pol[ií]cia|Auditor\s+Fiscal|T[eé]cnico\s+Judici[aá]rio)/i;

module.exports = {
  code: CODE,
  nome: NOME,
  descricao:
    "Concursos públicos organizados pela Fundação Carlos Chagas (FCC). Lista oficial; o edital e as datas são preenchidos no enriquecimento.",
  base: BASE,
  ua: UA,
  async run() {
    const { html } = await fetchHTML(LIST, { retries: 3, timeout: 20000 });
    const $ = cheerio.load(html);
    const items = [];
    const seen = new Set();
    // A home lista os concursos ativos com links /concursos/<slug>/index.html
    $('a[href*="/concursos/"]').each((i, el) => {
      const href = $(el).attr("href") || "";
      const m = href.match(/\/concursos\/([a-z0-9-]+)\/index\.html/i);
      if (!m) return;
      const slug = m[1];
      if (!slug || seen.has(slug)) return;
      seen.add(slug);
      const url = href.startsWith("http") ? href : `${BASE}${href}`;
      const text = $(el).text().replace(/\s+/g, " ").replace(/\u00a0/g, " ").trim();
      items.push({ slug, url, text });
    });

    const max = config.maxDetails || 0;
    const lista = max > 0 ? items.slice(0, max) : items;
    return lista.map((item) => {
      const { orgao, cargo, esfera } = parseTitle(item.text);
      return buildRecord({
        fonte: NOME,
        fonteCode: CODE,
        id: `fcc-${item.slug}`,
        orgao,
        cargo,
        esfera,
        link: item.url,
        titulo: item.text,
      });
    });
  },
};

// Extrai órgão/cargo a partir do título da lista. Para a FCC, o título é
// essencialmente o ÓRGÃO ("Instituto A - sigla" / "Tribunal de Justiça do X").
// Só tratamos como CARGO o que vier depois de um marcador claro (ex.: "Diversos
// Cargos", "Defensor(a) Público(a)") quando o site emenda "ÓrgãoCargo" na lista.
// Assim não deixamos o `cargoOrgao` pegar "siglas" como se fossem cargo.
function parseTitle(text) {
  const t = String(text || "").replace(/\s+/g, " ").replace(/\u00a0/g, " ").trim();
  const m = t.search(CARGO_SPLIT);
  if (m >= 0) {
    const left = t.slice(0, m).replace(/[–\s-]+$/g, "").trim();
    const right = t.slice(m).replace(/^[\s–-]+/g, "").trim();
    if (left.length >= 3) {
      return { orgao: left, cargo: !/^(?:Diversos\s+Cargos|Concurso\s+Interno)$/i.test(right) ? right : null };
    }
  }
  // Sem marcador claro: o título inteiro é o órgão (cargo fica para o enriquecimento).
  return { orgao: t, cargo: null };
}
