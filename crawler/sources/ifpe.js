// sources/ifpe.js — Instituto Federal de Pernambuco (IFPE).
// Concurso/servidor e professor são divulgados na página institucional de ingresso.
// Fonte pública federal 100% legal. Relevante para o usuário (Pernambuco).
// Agora também segue a página "Edital e anexos" para resolver o URL DIRETO do
// PDF do edital (assim o pipeline de IA consegue ler o edital de verdade, em vez
// de estimar). Se não achar, mantém o link da página (e o LLM tenta achar lá).
const cheerio = require("cheerio");
const { fetchHTML, UA } = require("../http.js");
const { buildRecord } = require("../norm.js");

const BASE = "https://www.ifpe.edu.br";
const LIST = `${BASE}/concursos`;
const BOT_UA = "CacaProvaBot/1.0 (+https://github.com/caca-prova; raspagem semanal de editais publicos; contato: contato@cacaprova.com.br)";

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
          edital: null, // será preenchido em seguida (PDF direto, se achável)
          titulo: text,
        })
      );
    });
    // Enriquecimento assíncrono: para cada registro, tenta resolver o PDF do edital.
    await Promise.all(records.map((r) => resolveEdital(r, BOT_UA)));
    return records;
  },
};

// Tenta achar o link do PDF real do edital. Se conseguir, define r.edital (URL direto).
async function resolveEdital(rec, ua) {
  try {
    // 1) Na página do concurso: procura link "Edital e anexos" ou ".pdf" direto.
    const page = await fetchHTML(rec.link, { retries: 2, timeout: 22000 });
    const $ = cheerio.load(page.html);
    let target = null;
    // qualquer href que aponte para .pdf (direto na página)
    const directPdf = $('a[href*=".pdf"]').first().attr("href");
    if (directPdf) target = directPdf;
    else {
      // link "Edital e anexos" / "edital" (página secundária que agrega os arquivos)
      const editalLink = $('a[href*="edital"], a[href*="anexo"]').filter((_, el) => {
        const t = $(el).text().replace(/\s+/g, " ").trim();
        return /edital|anexo/i.test(t);
      }).first().attr("href");
      if (editalLink) {
        const edUrl = absolutize(editalLink, rec.link);
        const edPage = await fetchHTML(edUrl, { retries: 2, timeout: 22000 });
        const $2 = cheerio.load(edPage.html);
        target = $2('a[href*=".pdf"]').first().attr("href");
      }
    }
    if (!target) return;
    const pdfUrl = absolutize(target, rec.link);
    // valida que é um PDF acessível
    const head = await fetch(pdfUrl, { method: "HEAD", headers: { "User-Agent": ua }, signal: AbortSignal.timeout(15000) });
    if (!head.ok) return;
    const ct = head.headers.get("content-type") || "";
    if (/pdf/i.test(ct) || /\.pdf(\?|$)/i.test(pdfUrl)) rec.edital = pdfUrl;
  } catch { /* sem edital direto: mantém link (LLM tenta estimar) */ }
}

function absolutize(href, base) {
  try { return new URL(href, base).href; } catch { return href; }
}

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
