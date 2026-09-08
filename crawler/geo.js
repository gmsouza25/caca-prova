// geo.js — geocodificação offline (lat/lng) de capitais e cidades comuns do Brasil.
// Usada apenas para o score de "proximidade geográfica". Sem requisições externas.
// Cidades fora da tabela herdam a coordenada da capital do respectivo estado (aproximação).

// Nomes próprios (capitalizados, com acentos) -> sigla da UF.
// Evita confundir a preposição "para" com o estado "Pará" (sem acento na preposição),
// pois a correspondência é feita no texto original: "Pará" só casa com o "Pará" acentuado.
const ESTADO_PROPER_UF = {
  "Acre": "ac", "Alagoas": "al", "Amapá": "ap", "Amazonas": "am", "Bahia": "ba",
  "Ceará": "ce", "Distrito Federal": "df", "Espírito Santo": "es", "Goiás": "go",
  "Maranhão": "ma", "Mato Grosso": "mt", "Mato Grosso do Sul": "ms", "Minas Gerais": "mg",
  "Pará": "pa", "Paraíba": "pb", "Paraná": "pr", "Pernambuco": "pe", "Piauí": "pi",
  "Rio de Janeiro": "rj", "Rio Grande do Norte": "rn", "Rio Grande do Sul": "rs",
  "Rondônia": "ro", "Roraima": "rr", "Santa Catarina": "sc", "São Paulo": "sp",
  "Sergipe": "se", "Tocantins": "to",
};

// Nome normalizado -> nome próprio (para exibir cidade com acentos corretos).
const CAP_NOME = {
  "rio branco": "Rio Branco", maceio: "Maceió", macapa: "Macapá", manaus: "Manaus",
  salvador: "Salvador", fortaleza: "Fortaleza", brasilia: "Brasília", vitoria: "Vitória",
  goiania: "Goiânia", "sao luis": "São Luís", cuiaba: "Cuiabá", "campo grande": "Campo Grande",
  "belo horizonte": "Belo Horizonte", belem: "Belém", "joao pessoa": "João Pessoa",
  curitiba: "Curitiba", recife: "Recife", teresina: "Teresina", "rio de janeiro": "Rio de Janeiro",
  natal: "Natal", "porto alegre": "Porto Alegre", "porto velho": "Porto Velho",
  "boa vista": "Boa Vista", florianopolis: "Florianópolis", "sao paulo": "São Paulo",
  aracaju: "Aracaju", palmas: "Palmas",
};

// UF -> capital (normalizada) para o fallback de proximidade.
const UF_CAPITAL = {
  ac: ["rio branco"], al: ["maceio"], am: ["manaus"], ap: ["macapa"], ba: ["salvador"],
  ce: ["fortaleza"], df: ["brasilia"], es: ["vitoria"], go: ["goiania"], ma: ["sao luis"],
  mg: ["belo horizonte"], ms: ["campo grande"], mt: ["cuiaba"], pa: ["belem"],
  pb: ["joao pessoa"], pe: ["recife"], pi: ["teresina"], pr: ["curitiba"], rj: ["rio de janeiro"],
  rn: ["natal"], ro: ["porto velho"], rr: ["boa vista"], rs: ["porto alegre"], sc: ["florianopolis"],
  se: ["aracaju"], sp: ["sao paulo"], to: ["palmas"],
};

const COORD = {
  "rio branco": [-9.97499, -67.8103], "maceio": [-9.66599, -35.7353], "macapa": [0.0349, -51.0694],
  "manaus": [-3.11903, -60.0217], "salvador": [-12.9777, -38.5016], "fortaleza": [-3.71722, -38.5433],
  "brasilia": [-15.8267, -47.9218], "vitoria": [-20.3155, -40.3128], "goiania": [-16.6794, -49.2538],
  "sao luis": [-2.52972, -44.3028], "cuiaba": [-15.5961, -56.0967], "campo grande": [-20.4428, -54.6466],
  "belo horizonte": [-19.9167, -43.9345], "belem": [-1.4558, -48.4902], "joao pessoa": [-7.115, -34.8636],
  "curitiba": [-25.4284, -49.2733], "recife": [-8.0543, -34.8813], "teresina": [-5.08917, -42.8019],
  "rio de janeiro": [-22.9068, -43.1729], "natal": [-5.795, -35.2095], "porto alegre": [-30.0346, -51.2177],
  "porto velho": [-8.7619, -63.9039], "boa vista": [2.8197, -60.6733], "florianopolis": [-27.5954, -48.5485],
  "sao paulo": [-23.5505, -46.6333], "aracaju": [-10.9162, -37.0773], "palmas": [-10.1689, -48.3317],
  // cidades comuns
  "olinda": [-7.9913, -34.8476], "jaboatao dos guararapes": [-8.1128, -34.9375],
  "camaragibe": [-8.0226, -34.9812], "paulista": [-7.94, -34.8733], "caruaru": [-8.2827, -35.9721],
  "petrolina": [-9.3891, -40.5028], "garanhuns": [-8.8908, -36.4927], "santos": [-23.9608, -46.3336],
  "campinas": [-22.9099, -47.0626], "niteroi": [-22.8832, -43.1034], "duque de caxias": [-22.7858, -43.302],
  "sao goncalo": [-22.8268, -43.0684], "nova iguacu": [-22.7592, -43.4511],
  "sao bernardo do campo": [-23.6934, -46.565], "santo andre": [-23.6638, -46.5383],
  "osasco": [-23.5325, -46.7917], "uberlandia": [-18.9186, -48.2772], "sorocaba": [-23.5015, -47.4525],
  "ribeirao preto": [-21.1775, -47.8103], "contagem": [-19.9317, -44.0536], "betim": [-19.9678, -44.1983],
  "londrina": [-23.3045, -51.1696], "maringa": [-23.4205, -51.9338], "joinville": [-26.3044, -48.8455],
  "blumenau": [-26.9194, -49.0661], "caxias do sul": [-29.1678, -51.1795],
  "sao jose dos campos": [-23.1794, -45.8869], "maraba": [-5.3686, -49.1223],
  "imperatriz": [-5.5264, -47.4917], "vitoria da conquista": [-14.8491, -40.8484],
  "ilheus": [-14.7936, -39.0396], "feira de santana": [-12.2664, -38.9663],
  "pelotas": [-31.7654, -52.3376], "gravatai": [-29.9413, -50.9938], "caxias do sul": [-29.1678, -51.1795],
  "passo fundo": [-28.262, -52.4083], "cachoeirinha": [-29.9511, -51.0928],
  "santa maria": [-29.6842, -53.8069], "ji-para": [-10.8849, -49.6692],
};

// Nome normalizado -> nome próprio para cidades comuns (melhor exibição).
const CIDADE_NOME = {
  "olinda": "Olinda", "jaboatao dos guararapes": "Jaboatão dos Guararapes",
  "camaragibe": "Camaragibe", "paulista": "Paulista", "caruaru": "Caruaru",
  "petrolina": "Petrolina", "garanhuns": "Garanhuns", "santos": "Santos",
  "campinas": "Campinas", "niteroi": "Niterói", "duque de caxias": "Duque de Caxias",
  "sao goncalo": "São Gonçalo", "nova iguacu": "Nova Iguaçu",
  "sao bernardo do campo": "São Bernardo do Campo", "santo andre": "Santo André",
  "osasco": "Osasco", "uberlandia": "Uberlândia", "sorocaba": "Sorocaba",
  "ribeirao preto": "Ribeirão Preto", "contagem": "Contagem", "betim": "Betim",
  "londrina": "Londrina", "maringa": "Maringá", "joinville": "Joinville",
  "blumenau": "Blumenau", "caxias do sul": "Caxias do Sul", "sao jose dos campos": "São José dos Campos",
  "maraba": "Marabá", "imperatriz": "Imperatriz", "vitoria da conquista": "Vitória da Conquista",
  "ilheus": "Ilhéus", "feira de santana": "Feira de Santana", "pelotas": "Pelotas",
  "gravatai": "Gravataí", "passo fundo": "Passo Fundo", "cachoeirinha": "Cachoeirinha",
  "santa maria": "Santa Maria", "ji-para": "Ji-Paraná", "jaragua do sul": "Jaraguá do Sul",
};

const normalize = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const escapeReg = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

// ---- UF ----
const UFS = "AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MG|MS|MT|PA|PB|PE|PI|PR|RJ|RN|RO|RR|RS|SC|SE|SP|TO";

function findUF(texto) {
  const s = String(texto || "");
  // UF explícita em maiúsculas (ex.: "/SC", "(RS)", " - PA")
  const m = s.match(new RegExp(`(?:^|[\\s/(,-])(${UFS})(?:[\\s/)\\.]|$)`));
  if (m) return m[1].toLowerCase();
  // nome do estado (com acento/capitalização) no texto original.
  // Usa lookbehind/lookahead que tratam letras acentuadas como letras.
  for (const [nome, uf] of Object.entries(ESTADO_PROPER_UF)) {
    if (new RegExp(`(?<![A-Za-zÀ-ú])${escapeReg(nome)}(?![A-Za-zÀ-ú])`, "i").test(s)) return uf;
  }
  return null;
}

// ---- cidade ----
function cidadeFromText(texto) {
  const s = String(texto || "");
  const n = normalize(s);
  for (const nome of Object.keys(COORD)) {
    if (n.includes(normalize(nome))) return proper(nome);
  }
  // "Prefeitura/Câmara Municipal de <Cidade>/UF"
  let m = s.match(/de\s+([^,/]{2,32})\s*\/(?:AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MG|MS|MT|PA|PB|PE|PI|PR|RJ|RN|RO|RR|RS|SC|SE|SP|TO)\b/i);
  if (m) return titleCase(m[1]);
  // "Prefeitura/Câmara Municipal de <Cidade>" (simples, sem "de" interno)
  m = s.match(/(?:prefeitura|c.mara|munic.pio)\s+municipal\s+d[eo]\s+([A-Za-zÀ-ú][A-Za-zÀ-ú\s]{1,28})$/i);
  if (m) {
    const c = m[1].trim();
    if (!/\s+de\s+/i.test(c) && c.split(/\s+/).length <= 3) return titleCase(c);
  }
  return null;
}

function proper(nome) {
  return CIDADE_NOME[nome] || CAP_NOME[nome] || titleCase(nome);
}

function titleCase(s) {
  return String(s)
    .split(" ")
    .map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

// ---- coordenadas ----
function geoFor(texto) {
  if (!texto) return null;
  const n = normalize(texto);
  // (1) cidade conhecida no texto
  for (const nome of Object.keys(COORD)) {
    if (n.includes(normalize(nome))) {
      const [lat, lng] = COORD[nome];
      const uf = findUF(texto);
      return { lat, lng, cidade: proper(nome), estado: uf ? uf.toUpperCase() : null };
    }
  }
  // (2) fallback -> capital do estado
  const uf = findUF(texto);
  if (uf && UF_CAPITAL[uf]) {
    const [cap] = UF_CAPITAL[uf];
    const coord = COORD[cap];
    if (coord) {
      return { lat: coord[0], lng: coord[1], cidade: cidadeFromText(texto) || CAP_NOME[cap] || titleCase(cap), estado: uf.toUpperCase() };
    }
  }
  return null;
}

module.exports = { geoFor, findUF, normalize, COORD, UF_CAPITAL, ESTADO_PROPER_UF };
