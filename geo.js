// ============================================================
//  GEO.JS — geocodificação simples (offline) para o app (cliente)
//  Converte "cidade/UF" em lat/lng para o score de proximidade.
//  Prioridade: 1) tabela direta de cidades; 2) capital da UF; 3) null (desconhecido).
//  Nunca "chuta" Recife para uma cidade diferente — se não sabe, fica NEUTRO.
// ============================================================

// Cidade normalizada (mapeada p/ resolver acentos e variações) -> [lat, lng]
const CID = {
  // Capitais
  "rio branco": [-9.97499, -67.8103], "maceio": [-9.66599, -35.7353],
  "macapa": [0.0349, -51.0694], "manaus": [-3.11903, -60.0217],
  "salvador": [-12.9777, -38.5016], "fortaleza": [-3.71722, -38.5433],
  "brasilia": [-15.8267, -47.9218], "vitoria": [-20.3155, -40.3128],
  "goiania": [-16.6794, -49.2538], "sao luis": [-2.52972, -44.3028],
  "cuiaba": [-15.5961, -56.0967], "campo grande": [-20.4428, -54.6466],
  "belo horizonte": [-19.9167, -43.9345], "belem": [-1.4558, -48.4902],
  "joao pessoa": [-7.115, -34.8636], "curitiba": [-25.4284, -49.2733],
  "recife": [-8.0543, -34.8813], "teresina": [-5.08917, -42.8019],
  "rio de janeiro": [-22.9068, -43.1729], "natal": [-5.795, -35.2095],
  "porto alegre": [-30.0346, -51.2177], "porto velho": [-8.7619, -63.9039],
  "boa vista": [2.8197, -60.6733], "florianopolis": [-27.5954, -48.5485],
  "sao paulo": [-23.5505, -46.6333], "aracaju": [-10.9162, -37.0773],
  "palmas": [-10.1689, -48.3317],
  // Cidades do acervo / comuns
  "olinda": [-7.9913, -34.8476], "jaboatao dos guararapes": [-8.1128, -34.9375],
  "camaragibe": [-8.0226, -34.9812], "paulista": [-7.94, -34.8733],
  "caruaru": [-8.2827, -35.9721], "petrolina": [-9.3891, -40.5028],
  "garanhuns": [-8.8908, -36.4927], "niteroi": [-22.8832, -43.1034],
  "santos": [-23.9608, -46.3336], "campinas": [-22.9099, -47.0626],
  "londrina": [-23.3045, -51.1696], "maringa": [-23.4205, -51.9338],
  "joinville": [-26.3044, -48.8455], "blumenau": [-26.9194, -49.0661],
  "caxias do sul": [-29.1678, -51.1795], "pelotas": [-31.7654, -52.3376],
  "passo fundo": [-28.262, -52.4083], "santa maria": [-29.6842, -53.8069],
  "redentora": [-27.6634, -53.0005], "agudo": [-29.6448, -53.2424],
  "tapera": [-28.6267, -52.8736], "uberlandia": [-18.9186, -48.2772],
  "sorocaba": [-23.5015, -47.4525], "ribeirao preto": [-21.1775, -47.8103],
};

// UF (maiúscula) -> cidade normalizada da capital (fallback)
export const UF_CAPITAL = {
  AC: "rio branco", AL: "maceio", AP: "macapa", AM: "manaus", BA: "salvador",
  CE: "fortaleza", DF: "brasilia", ES: "vitoria", GO: "goiania", MA: "sao luis",
  MT: "cuiaba", MS: "campo grande", MG: "belo horizonte", PA: "belem",
  PB: "joao pessoa", PR: "curitiba", PE: "recife", PI: "teresina", RJ: "rio de janeiro",
  RN: "natal", RO: "porto velho", RR: "boa vista", RS: "porto alegre",
  SC: "florianopolis", SP: "sao paulo", SE: "aracaju", TO: "palmas",
};

// normaliza: minúsculas, sem acentos, espaços extras
function norm(s) {
  return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

// Resolve lat/lng. Retorna { lat, lng, cidade, estado } ou null se desconhecido.
export function geoFor(cidade, uf) {
  let c = norm(cidade);
  if (CID[c]) return { lat: CID[c][0], lng: CID[c][1], cidade: c, estado: (uf || "").toUpperCase() };
  // tenta "cidade, uf" juntos (ex.: "Salvador BA")
  if (uf) {
    const chave = `${c} ${norm(uf)}`.trim();
    if (CID[chave]) return { lat: CID[chave][0], lng: CID[chave][1], cidade: c, estado: (uf || "").toUpperCase() };
  }
  // fallback: capital da UF
  const cap = UF_CAPITAL[(uf || "").toUpperCase()];
  if (cap && CID[cap]) return { lat: CID[cap][0], lng: CID[cap][1], cidade: cap, estado: (uf || "").toUpperCase() };
  return null;
}
