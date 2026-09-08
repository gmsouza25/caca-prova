// sources/ifpe.js — Instituto Federal de Pernambuco (IFPE).
// Concurso/servidor e professor são divulgados na página institucional de ingresso.
// Fonte pública federal 100% legal. Relevante para o usuário (Pernambuco).
const cheerio = require("cheerio");
const { fetchHTML, UA } = require("../http.js");
const { buildRecord } = require("../norm.js");

const BASE = "https://www.ifpe.edu.br";
const LIST = `${BASE}/concursos`;

module.exports = {
  code: "ifpe",
  nome: "IFPE (Instituto Federal de PE)",
  descricao: "Concursos para servidores e docentes do Instituto Federal de Pernambuco.",
  base: BASE,
  ua: UA,
  async run() {
    const { html } = await fetchHTML(LIST, { retries: 3, timeout: 25000 });
    const $ = cheerio.load(html);
    const seen = new Set();
    const records = [];
    $('a[href*="concurso-"], a[href*="/ingresso/"]').each((i, el) => {
      const href = $(el).attr("href") || "";
      const text = $(el).text().replace(/\s+/g, " ").trim();
      // Foca nos concursos de carreira (servidor/docente), ignora notícias/outros editais
      if (!/concurso/i.test(text)) return;
      if (!/concurso-tecnico|concurso-professor|concurso|seletivo/i.test(href)) return;
      if (text.length < 8 || seen.has(href)) return;
      seen.add(href);
      const cargo = cargoIFPE(text);
      const url = href.startsWith("http") ? href : BASE + href;
      records.push(
        buildRecord({
          fonte: this.nome,
          fonteCode: this.code,
          id: `ifpe-${slug(url)}`,
          orgao: "Instituto Federal de Pernambuco (IFPE)",
          cargo,
          esfera: "Federal",
          cidade: "Recife",
          estado: "PE",
          link: url,
          titulo: text,
        })
      );
    });
    return records;
  },
};

// Extrai o cargo do texto do link (ex.: "Concurso Técnico-Administrativo").
function cargoIFPE(text) {
  const t = text.replace(/\s+/g, " ").trim();
  const m = t.match(/concurso\s+(t[ée]cnico[^,;]*|professor[a-z]*)/i);
  if (m) return capitalize(m[1].split(" para ")[0]);
  if (/professor/i.test(t)) return "Professor";
  if (/t[ée]cnico/i.test(t)) return "Técnico-Administrativo";
  return "Concurso público";
}

function slug(u) {
  const m = String(u).match(/concurso-([a-z0-9-]+)/i);
  return (m ? m[1] : "item").slice(0, 20);
}
function capitalize(s) {
  return String(s || "")
    .replace(/(^|\s)([a-zà-ú])/g, (_, sp, c) => sp + c.toUpperCase())
    .trim();
}
