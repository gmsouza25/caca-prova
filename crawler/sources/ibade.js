// sources/ibade.js — Instituto Brasileiro de Apoio e Desenvolvimento Executivo (IBADE).
// Banca que organiza concursos municipais/estaduais e de conselhos profissionais.
// Lista pública em https://portal.ibade.selecao.site/edital (os editais, com status).
const cheerio = require("cheerio");
const { fetchHTML, UA } = require("../http.js");
const { buildRecord } = require("../norm.js");
const config = require("../config.js");

const CODE = "ibade";
const NOME = "IBADE";
const BASE = "https://portal.ibade.selecao.site";
const LIST = `${BASE}/edital`;

module.exports = {
  code: CODE,
  nome: NOME,
  descricao:
    "Concursos públicos organizados pelo IBADE (Instituto Brasileiro de Apoio e Desenvolvimento Executivo), com editais e status no portal oficial.",
  base: BASE,
  ua: UA,
  async run() {
    const { html } = await fetchHTML(LIST, { retries: 3, timeout: 20000 });
    const $ = cheerio.load(html);
    const records = [];
    const seen = new Set();

    $(".card").each((i, el) => {
      const $card = $(el);
      const a = $card.find('a[href*="/edital/ver/"]').first();
      const href = a.attr("href") || "";
      const m = href.match(/\/edital\/ver\/(\d+)/);
      if (!m) return;
      const id = m[1];
      if (seen.has(id)) return;
      seen.add(id);
      const url = href.startsWith("http") ? href : `${BASE}${href}`;

      // título (uppercase, pequeno) e órgão (maior) dentro do card
      const title = $card
        .find("p.text-500")
        .filter((j, e) => /text-(12|uppercase)/i.test($(e).attr("class") || ""))
        .first()
        .text()
        .replace(/\s+/g, " ")
        .trim();
      let orgao = $card
        .find("p.text-500")
        .filter((j, e) => /text-18/i.test($(e).attr("class") || ""))
        .first()
        .text()
        .replace(/\s+/g, " ")
        .trim();
      if (!orgao) orgao = title;

      const statusRaw = statusFrom($, el);
      records.push(
        buildRecord({
          fonte: NOME,
          fonteCode: CODE,
          id: `ibade-${id}`,
          orgao,
          cargo: null,
          link: url,
          titulo: title,
          statusRaw,
        })
      );
    });
    return records;
  },
};

// Mapeia o heading (h2/h3) da seção onde o card está para o status do app.
function statusFrom($, cardEl) {
  const txt = sectionHeading($, cardEl).toLowerCase();
  if (/inscri|aberto/.test(txt)) return "Inscrições abertas";
  if (/andamento/.test(txt)) return "Inscrições abertas";
  if (/futur|previs|proxim/.test(txt)) return "Edital publicado";
  if (/encerrad|finalizad|suspend|cancelad|conclu/.test(txt)) return "Inscrições encerradas";
  return "";
}

// Sobe procurando o heading mais próximo acima do card (a seção de status).
function sectionHeading($, cardEl) {
  let node = $(cardEl);
  for (let k = 0; k < 8 && node.length; k++) {
    const h = node.find("h2,h3,h4,h5").first();
    if (h.length && h.text().trim()) return h.text().trim();
    node = node.parent();
  }
  return "";
}
