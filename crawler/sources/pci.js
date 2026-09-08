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
const { data } = require("../norm.js");

const BASE = "https://www.pciconcursos.com.br";
const LIST = `${BASE}/concursos/`;

module.exports = {
  code: "pci",
  nome: "PCI Concursos (enriquecimento)",
  descricao: "Agregador de concursos — usado apenas para enriquecer (salário, escolaridade, data) os editais das fontes oficiais.",
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
      const title = $(el).find("a").first().text().replace(/\s+/g, " ").trim();
      if (!title || title.length < 4) return;
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
        cdText, cargos: cargosTxt,
        escolaridade: this._escolaridade(escTxt),
        dataTxt: dataTxt,                   // ex.: "14/09/2026"
        raw: cdText,
      });
    });
    return cards;
  },
};
