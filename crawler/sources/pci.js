// sources/pci.js — PCI Concursos (enriquecimento de dados).
// O PCI é um agregador comercial. Usamos a LISTA PÚBLICA (permitida por robots.txt)
// apenas para LER FATOS (órgão, cargo, salário, escolaridade, data) e preencher os
// campos DESCONHECIDOS dos editais que já vêm de fontes oficiais.
// Não copiamos conteúdo editorial nem usamos o link do PCI (mantemos o link oficial).
//
// Estrutura verificada dos cards (classes):
//   .ca > a  -> órgão + link (ignoramos o link, usamos o texto)
//   .cb      -> imagem (ignorada)
//   .cd      -> "Vagas até R$ X" | cargos | escolaridade (spans aninhados)
//   .ce span -> data (dd/mm/aaaa)
// Não é uma fonte "run()" padrão: exporta `fetchCards()` para a camada de
// enriquecimento (crawler/enrich.js).
const cheerio = require("cheerio");
const { fetchHTML, UA } = require("../http.js");
const { data, buildRecord, salario } = require("../norm.js");

const BASE = "https://www.pciconcursos.com.br";
const LIST = `${BASE}/concursos/`;

module.exports = {
  code: "pci",
  nome: "PCI Concursos",
  descricao: "Agregador de concursos — enriquece os editais das fontes oficiais e, como fonte, adiciona concursos que as fontes oficiais não cobrem.",
  base: BASE,
  ua: UA,
  // Busca a escolaridade -> id do schema (fundamental|medio|tecnico|superior|pos).
  _escolaridade(t) {
    const s = String(t || "").toLowerCase();
    if (/(p.s|mestrado|doutorado)/.test(s)) return "pos";
    if (/superior|gradua[cç][aã]o|bacharelado|licenciatura/.test(s)) return "superior";
    if (/t[ée]cnico|profissionalizante/.test(s)) return "tecnico";
    if (/m[ée]dio|segundo grau/.test(s)) return "medio";
    if (/fundamental/.test(s)) return "fundamental";
    return null;
  },
  // Baixa e interpreta os cards da listagem pública.
  async fetchCards() {
    const { html } = await fetchHTML(LIST, { retries: 3, timeout: 25000 });
    const $ = cheerio.load(html);
    const cards = [];
    $(".ca").each((i, el) => {
      const a = $(el).find("a").first();
      const title = a.text().replace(/\s+/g, " ").trim();
      if (!title || title.length < 4) return;
      const link = (a.attr("href") || "").startsWith("http")
        ? a.attr("href")
        : `${BASE}${a.attr("href") || ""}`;
      const cd = $(el).find(".cd").first();
      const ce = $(el).find(".ce span").first();
      const cdText = cd.text().replace(/\s+/g, " ").trim();
      // escolaridade (no span mais interno)
      const escTxt = cd.find("span span").first().text().replace(/\s+/g, " ").trim();
      // cargos (span externo, sem o span interno da escolaridade)
      const cargos = cd.children("span").first().clone();
      cargos.children("span").remove();
      const cargosTxt = cargos.text().replace(/\s+/g, " ").trim();
      // datas
      const dataTxt = ce.text().replace(/\s+/g, " ").trim();
      cards.push({
        orgao: title,                       // ex.: "Transpetro - Petrobras Transporte S.A."
        link,
        cdText, cargos: cargosTxt,
        escolaridade: this._escolaridade(escTxt),
        dataTxt: dataTxt,                   // ex.: "14/09/2026"
        raw: cdText,
      });
    });
    return cards;
  },
  // Converte os cards em registros (usado para PCI como FONTE, ver buildRecords abaixo).
  buildRecords,
};

// ---- PCI COMO FONTE (adiciona concursos, além de enriquecer) ----
// Converte os cards públicos em registros no schema do app. Usado para ADICIONAR
// concursos que as fontes oficiais não cobrem (ex.: CESGRANRIO, VUNESP, CEBRASPE,
// que estão WAF-bloqueados). O link é o do PCI (agregador); por isso estes registros
// ficam marcados com `fonteCode:"pci"` e `link` PCI (não oficial).
const CARGO_GENERICO = /vários cargos|diversos cargos|todos os cargos|não informado/i;
function buildRecords(cards) {
  const out = [];
  for (const c of cards || []) {
    const orgao = (c.orgao || "").replace(/\s+/g, " ").trim();
    if (!orgao) continue;
    const cargos = (c.cargos || "").replace(/\s+/g, " ").trim();
    const cargo = cargos && !CARGO_GENERICO.test(cargos) ? cargos : null;
    // salário parseado (número), como o enrich.js faz — evita Number("1.234,56")=NaN
    const sal = salario(c.raw);
    // data única e futura -> fecha de inscrição; intervalos ("09 a22/09/2026") ficam null
    let dt = null;
    const dm = String(c.dataTxt || "").match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
    if (dm) {
      const d = data(dm[1]);
      if (d && new Date(d + "T00:00:00").getTime() >= Date.now()) dt = d;
    }
    const rec = buildRecord({
      fonte: "PCI Concursos",
      fonteCode: "pci",
      id: `pci-${slug(c.link)}`,
      orgao,
      cargo,
      salario: sal || undefined,
      link: c.link,
      titulo: `${orgao}${cargo ? " — " + cargo : ""}`,
    });
    if (c.escolaridade) rec.escolaridade = c.escolaridade; // buildRecord infere; aqui usamos o do card
    if (dt) rec.dt_inscricao_fecha = dt;
    if (dt) {
      // deriva o status pela data (similar ao status() do app)
      rec.status = new Date(dt + "T00:00:00").getTime() >= Date.now() ? "Inscrições abertas" : "Inscrições encerradas";
    }
    out.push(rec);
  }
  return out;
}

function slug(url) {
  // usa o último segmento do path (o slug da notícia/concurso) para um id único
  try {
    const u = new URL(url);
    const seg = (u.pathname.split("/").filter(Boolean).pop() || "").toLowerCase();
    const m = seg.match(/[a-z0-9][a-z0-9-]{4,}/);
    return (m ? m[0] : seg).replace(/[^a-z0-9-]/g, "").slice(0, 24) || "item";
  } catch {
    return "item";
  }
}
