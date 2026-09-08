// sources/fundatec.js — Fundatec.
// Listas públicas em http://www.fundatec.org.br/portal/concursos/
const cheerio = require("cheerio");
const { fetchHTML, UA } = require("../http.js");
const { buildRecord, data } = require("../norm.js");
const { cargoOrgao } = require("../parse.js");
const config = require("../config.js");

const BASE = "https://www.fundatec.org.br";
const PAGES = [
  "/portal/concursos/concursos_abertos.php", // inscrições abertas (prioritário)
  "/portal/concursos/concursos_andamento.php", // em andamento
];

module.exports = {
  code: "fundatec",
  nome: "Fundatec",
  descricao: "Concursos e processos seletivos organizados pela Fundatec (RS e região).",
  base: BASE,
  ua: UA,
  async run() {
    const records = [];
    const seen = new Set();
    const rawItems = []; // guarda {idNum, title, url}
    for (const p of PAGES) {
      let html;
      try {
        ({ html } = await fetchHTML(BASE + p, { retries: 3, timeout: 25000 }));
      } catch (e) {
        console.error(`  [fundatec] ${p}: ${e.message}`);
        continue;
      }
      const $ = cheerio.load(html);
      $('a[href*="index_concursos.php?concurso="]').each((i, el) => {
        const href = $(el).attr("href");
        const title = $(el).text().replace(/\s+/g, " ").trim();
        if (!href || href.includes("Concurso.aspx")) return;
        const m = href.match(/concurso=(\d+)/);
        if (!m) return;
        const idNum = m[1];
        if (seen.has(idNum)) return;
        seen.add(idNum);
        rawItems.push({ idNum, title, url: `${BASE}/portal/concursos/${encodeURI(href)}` });
      });
    }

    // Passo 1: base (sem datas) a partir dos títulos.
    for (const it of rawItems) {
      const { orgao, cargo, esfera } = cargoOrgao(it.title);
      records.push(
        buildRecord({
          fonte: this.nome,
          fonteCode: this.code,
          id: `fundatec-${it.idNum}`,
          orgao,
          cargo,
          esfera,
          cidade: null,
          estado: null,
          link: it.url,
          titulo: it.title,
        })
      );
    }

    // Passo 2: enriquecimento (datas de inscrição) na página de detalhe, com limite.
    const max = config.maxDetails || 0;
    for (let i = 0; i < records.length && (max === 0 || i < max); i++) {
      const rec = records[i];
      const idNum = rec.id.replace("fundatec-", "");
      try {
        const { html } = await fetchHTML(rec.link, { retries: 2, timeout: 20000 });
        const $ = cheerio.load(html);
        const txt = $("body").text().replace(/\s+/g, " ");
        // datas de inscrição: "Inscrições: dd/mm/aaaa Fim Inscrições: dd/mm/aaaa"
        const ins = txt.match(/Inscri[çc][õo]es?:\s*(\d{1,2}\/\d{1,2}\/\d{4})[\s\S]{0,140}?Fim\s*(?:das\s+)?Inscri[çc][õo]es?:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
        if (ins) {
          rec.dt_inscricao_abre = data(ins[1]);
          rec.dt_inscricao_fecha = data(ins[2]);
          rec.status = statusNow(rec);
        }
        // link do edital de abertura (PDF público)
        const edital = $('a[href*="edital_abertura"], a[href*="edital"]').map((k, el) => $(el).attr("href")).get().find((h) => h && h.includes(".pdf"));
        if (edital && !/javascript/.test(edital)) rec.edital = edital;
      } catch (e) {
        // falha ao enriquecer não derruba o item (fica sem datas)
      }
    }

    return records;
  },
};

function statusNow(c) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const abre = c.dt_inscricao_abre ? new Date(c.dt_inscricao_abre + "T00:00:00") : null;
  const fecha = c.dt_inscricao_fecha ? new Date(c.dt_inscricao_fecha + "T00:00:00") : null;
  if (abre && fecha) {
    if (today < abre) return "Edital publicado";
    if (today >= abre && today <= fecha) return "Inscrições abertas";
    if (today > fecha) return "Inscrições encerradas";
  }
  return "Inscrições encerradas"; // andamento não re-verificado
}
