// sources/fgv.js — FGV Conhecimento (fonte oficial de bancas, editais públicos).
// Lista pública e estruturada em https://conhecimento.fgv.br/concursos
const cheerio = require("cheerio");
const { fetchHTML, UA } = require("../http.js");
const { buildRecord } = require("../norm.js");
const { cargoOrgao } = require("../parse.js");
const { normalize } = require("../geo.js");

const BASE = "https://conhecimento.fgv.br";
const LIST = `${BASE}/concursos`;

module.exports = {
  code: "fgv",
  nome: "FGV Conhecimento",
  descricao: "Concursos públicos organizados pela Fundação Getulio Vargas.",
  base: BASE,
  ua: UA, // aceita nosso bot
  async run() {
    const { html } = await fetchHTML(LIST, { retries: 3, timeout: 20000 });
    const $ = cheerio.load(html);
    const seen = new Set();
    const records = [];
    $('a[href^="/concursos/"]').each((i, el) => {
      const href = $(el).attr("href");
      const title = $(el).text().replace(/\s+/g, " ").trim();
      if (!href || !title || title.length < 8) return;
      if (seen.has(href)) return;
      seen.add(href);
      const url = href.startsWith("http") ? href : `${BASE}${href}`;
      const { orgao, cargo, esfera } = cargoOrgao(title);
      records.push(
        buildRecord({
          fonte: this.nome,
          fonteCode: this.code,
          id: `fgv-${slug(href)}`,
          orgao,
          cargo,
          esfera,
          cidade: null,
          estado: null,
          link: url,
          titulo: title,
        })
      );
    });
    return records;
  },
};

function slug(href) {
  // extrai o último segmento do slug para um id legível e estável
  const m = String(href).match(/\/concursos\/([a-z0-9-]+)/i);
  return m ? m[1].slice(0, 14) : "item";
}
