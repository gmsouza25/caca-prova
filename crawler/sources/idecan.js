// sources/idecan.js — IDECAN (banca nacional).
// A listagem pública está em https://www.idecan.org.br/ (homepage), que apresenta os
// editais ativos com links para o portal de cada concurso (concurso.idecan.org.br/...).
// Apenas usamos a lista (não abrimos a página de detalhe), então o site de detalhe
// ficar atrás de WAF não afeta a coleta.
const cheerio = require("cheerio");
const { fetchHTML, UA } = require("../http.js");
const { buildRecord } = require("../norm.js");
const { cargoOrgao } = require("../parse.js");

const BASE = "https://www.idecan.org.br";

module.exports = {
  code: "idecan",
  nome: "IDECAN",
  descricao: "Concursos públicos organizados pelo IDECAN (banca nacional).",
  base: BASE,
  ua: UA,
  async run() {
    const { html } = await fetchHTML(BASE + "/", { retries: 3, timeout: 25000 });
    const $ = cheerio.load(html);
    const seen = new Set();
    const records = [];
    $('a[href*="Concurso.aspx"]').each((i, el) => {
      const href = $(el).attr("href");
      const title = $(el).text().replace(/\s+/g, " ").trim();
      if (!href || title.length < 8) return;
      const idM = href.match(/ID=(\d+)/);
      if (!idM) return;
      const idNum = idM[1];
      if (seen.has(idNum)) return;
      seen.add(idNum);
      const url = href.startsWith("http") ? href : `https://concurso.idecan.org.br/${href}`;
      const { orgao, cargo, esfera } = cargoOrgao(title);
      records.push(
        buildRecord({
          fonte: this.nome,
          fonteCode: this.code,
          id: `idecan-${idNum}`,
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
