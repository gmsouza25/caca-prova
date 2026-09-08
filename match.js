// ============================================================
//  MATCH.JS — motor de compatibilidade (score 0–100)
//  Executado LOCALMENTE no dispositivo (nada do perfil sai do aparelho).
//
//  Princípio: quando um dado do concurso NÃO está disponível (desconhecido),
//  aquele componente fica NEUTRO — não penaliza nem favorece o candidato.
//  Isso evita que a ausência de salário/vagas/localização/escolaridade
//  distorça a compatibilidade.
// ============================================================

import { ESC_ORDER } from "./data.js";

const R = 6371000;
const rad = (d) => (d * Math.PI) / 180;
export function distKm(a, b) {
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const la1 = rad(a.lat), la2 = rad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return (2 * R * Math.asin(Math.sqrt(h))) / 1000;
}

const NEUTRO = 70; // valor "neutro" para um componente cujo dado é desconhecido

// ---------- sub-especificidades ----------

function encaixe(perfil, c) {
  const escPerf = ESC_ORDER[perfil.escolaridade] || 2;
  const escCon = c.escolaridade ? ESC_ORDER[c.escolaridade] || 2 : null; // null = desconhecido

  let escScore, eligible;
  if (escCon == null) {
    // escolaridade do concurso desconhecida -> neutro e NÃO exclui
    escScore = NEUTRO; eligible = true;
  } else if (escPerf >= escCon) { escScore = 100; eligible = true; }
  else if (escPerf + 1 === escCon) { escScore = 25; eligible = true; } // quase
  else { escScore = 0; eligible = false; }

  // área de interesse (overlap). Sem dados de área -> neutro, sem boost.
  // A cobertura mede QUANTO dos interesses do perfil o concurso atende (não penaliza
  // um concurso só por listar várias áreas).
  const int = perfil.interesses || [];
  const cArea = (c.area && c.area.length) ? c.area : null;
  const overlap = cArea ? cArea.filter((a) => int.includes(a)).length : 0;
  const areaScore = cArea ? (int.length ? Math.min(100, Math.round((overlap / int.length) * 100)) : NEUTRO) : NEUTRO;
  const areaBoost = cArea && cArea.some((a) => int.includes(a)) ? 10 : 0;

  // regime. Desconhecido -> neutro.
  const reg = perfil.regime || "qualquer";
  const regimeScore = reg === "qualquer" ? 100 : (c.regime == null ? NEUTRO : reg === c.regime ? 100 : 40);

  // Pesos no encaixe: escolaridade 45, área 40, regime 15
  const s = 0.45 * escScore + 0.40 * areaScore + 0.15 * regimeScore;
  return { score: s, eligible, escScore, areaScore, regimeScore, areaBoost };
}

function proximidade(perfil, c) {
  if (!perfil.lat || !perfil.lng || c.lat == null) return { score: NEUTRO, km: null, known: false };
  const d = distKm({ lat: perfil.lat, lng: perfil.lng }, { lat: c.lat, lng: c.lng });
  let p;
  if (d <= 50) p = 100;
  else if (d <= 150) p = 82;
  else if (d <= 400) p = 55;
  else if (d <= 900) p = 30;
  else p = 15;
  return { score: p, km: d, known: true };
}

function salarial(perfil, c) {
  const preten = perfil.pretensao || 0;
  if (!preten || !c.salario) return { score: NEUTRO, ratio: null, known: false };
  if (c.salario >= preten) return { score: 100, ratio: c.salario / preten, known: true };
  const r = c.salario / preten;
  return { score: Math.max(5, Math.round(100 * r)), ratio: r, known: true };
}

// ---------- score principal ----------
export function matchConcursos(perfil, concursos) {
  return concursos.map((c) => {
    const e = encaixe(perfil, c);
    const p = proximidade(perfil, c);
    const s = salarial(perfil, c);
    // Bônus de confiança: dados confirmados NO edital são mais confiáveis -> leve destaque.
    const confBonus = c.fonteDados === "edital" ? 4 : 0;
    const total = 0.5 * e.score + 0.3 * p.score + 0.2 * s.score;
    const score = Math.round(Math.min(100, total + (e.areaBoost || 0) + confBonus));
    const motivo = [];
    if (c.fonteDados === "edital") motivo.push("✓ edital");
    if (e.escScore === 100) motivo.push("Formação ✓");
    if (e.areaScore >= 60) motivo.push("Área ✓");
    if (e.regimeScore === 100 && perfil.regime !== "qualquer") motivo.push("Regime ✓");
    if (p.km != null) motivo.push(`${Math.round(p.km)} km`);
    if (s.ratio && s.ratio >= 1) motivo.push("Salário ✓");
    return {
      ...c,
      score,
      eligible: e.eligible,
      motivo,
      componentes: { encaixe: Math.round(e.score), proximidade: Math.round(p.score), salario: Math.round(s.score) },
      km: p.km != null ? Math.round(p.km) : null,
      confianca: {
        escolaridade: c.escolaridade != null,
        area: !!(c.area && c.area.length),
        regime: c.regime != null,
        localizacao: c.lat != null && c.lng != null,
        salario: c.salario != null,
        vagas: c.vagas != null,
        datas: !!(c.dt_inscricao_abre || c.dt_inscricao_fecha || c.dt_prova),
      },
    };
  }).sort((a, b) => b.score - a.score);
}

// Filtra os elegíveis (cumpre escolaridade mínima) e devolve os que têm score minimamente útil
export function recomendados(perfil, concursos) {
  const m = matchConcursos(perfil, concursos);
  return m.filter((c) => c.eligible);
}
