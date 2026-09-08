// enrich.js — CAMADA DE ENRIQUECIMENTO (PCI Concursos).
// Para cada edital vindo das FONTES OFICIAIS, tenta achar um card correspondente
// no PCI e preenche APENAS os campos que estavam DESCONHECIDOS (null/''/0).
// Princípios de honestidade:
//   - Nunca sobrescreve um dado já confiável (oficial > agregador).
//   - Nunca chuta: só preenche quando há uma correspondência de órgão segura.
//   - Mantém o LINK OFICIAL (não usa o link do PCI).
//   - Se não há indício confiável, deixa como está.

const { normalize, salario, vagas, data } = require("./norm.js");

// Comparador de órgão: tokens com >= 5 letras, mede sobreposição.
function tokens(s) {
  return new Set(normalize(s).toLowerCase().split(" ").filter((w) => w.length >= 5));
}
function similar(a, b) {
  const ta = tokens(a), tb = tokens(b);
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / Math.min(ta.size, tb.size); // 0..1
}
function matchScore(rec, card) {
  const org = rec.orgao || "";
  // órgão bate forte com o card.
  let s = similar(org, card.orgao);
  // se o cargo do registro aparece no texto do card, dá um boost.
  const cargo = String(rec.cargo || "").toLowerCase();
  const cardText = normalize(card.raw).toLowerCase();
  if (cargo && cardText.includes(normalize(cargo))) s = Math.max(s, 0.72);
  return s;
}

// Preenche salário/vagas/escolaridade/data de um rec a partir do card (se null).
function apply(rec, card) {
  const changed = [];
  if (!rec.salario && /r\$\s?[\d.]/i.test(card.raw)) {
    const v = salario(card.raw);
    if (v > 0) { rec.salario = v; changed.push("salario"); }
  }
  if (!rec.vagas && /\b\d[\d.]*\s*(?:vagas|vaga)/i.test(card.raw)) {
    const v = vagas(card.raw);
    if (v > 0) { rec.vagas = v; changed.push("vagas"); }
  }
  // Escolaridade: só quando o card aponta UM nível (não "Vários Cargos").
  if (!rec.escolaridade && card.escolaridade && !/v[aá]rios/i.test(card.cargos)) {
    rec.escolaridade = card.escolaridade; changed.push("escolaridade");
  }
  // Data: preenche a data de fechamento só se ainda não houver e for futura.
  if (!rec.dt_inscricao_fecha && card.dataTxt && /\d{1,2}\/\d{1,2}\/\d{4}/.test(card.dataTxt)) {
    const d = data(card.dataTxt);
    if (d && new Date(d + "T00:00:00").getTime() >= Date.now()) {
      rec.dt_inscricao_fecha = d; changed.push("dt_inscricao_fecha");
    }
  }
  return changed;
}

// Enriquecer uma lista de registros com os cards do PCI.
// Apenas preenche campos não confiáveis; retorna { records, matched, changes }.
function enrich(records, cards) {
  let matched = 0, changes = 0;
  const recordsOut = records.map((rec) => {
    if (!cards || !cards.length) return rec;
    let best = null, bestScore = 0;
    for (const card of cards) {
      const s = matchScore(rec, card);
      if (s > bestScore) { bestScore = s; best = card; }
    }
    if (best && bestScore >= 0.6) {
      matched++;
      const ch = apply(rec, best);
      changes += ch.length;
    }
    return rec;
  });
  return { records: recordsOut, matched, changes };
}

module.exports = { enrich, matchScore, similar };
