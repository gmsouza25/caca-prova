// norm.js — NORMALIZAÇÃO: converte o texto raspado de cada fonte no schema do app.
// Objetivo: dado "bruto" (título/órgão/cargo/estado/salário/vagas/datas/link) -> registro
// compatível com match.js e com a tela "Concursos" do CAÇA PROVAS.

const { geoFor, normalize } = require("./geo.js");

// ---- Escolaridade (chaves do schema: fundamental|medio|tecnico|superior|pos) ----
const MEDIO = ["medio", "médio", "ensino medio", "segundo grau", "nivel medio"];
const TECNICO = ["tecnico", "técnico", "educacao profissional"];
const SUPERIOR = ["superior", "graduacao", "graduação", "nivel superior", "bacharelado", "licenciatura"];
const POS = ["pos-graduacao", "pós-graduação", "mestrado", "doutorado", "especializacao", "especialização"];
// Cargos que costumam exigir nível médio mesmo quando a palavra "técnico" aparece:
const CARGO_MEDIO = ["tecnico judiciario", "tecnico administrativo", "tecnico em administracao", "tecnico do tribunal", "tecnico de secretaria"];

function escolaridade(raw) {
  const t = normalize(raw);
  const low = t.toLowerCase();
  if (POS.some((k) => low.includes(k))) return "pos";
  if (SUPERIOR.some((k) => low.includes(k))) return "superior";
  if (TECNICO.some((k) => low.includes(k))) {
    // se for "técnico judiciário/administrativo", o requisito real é médio
    if (CARGO_MEDIO.some((k) => low.includes(k))) return "medio";
    return "tecnico";
  }
  if (MEDIO.some((k) => low.includes(k))) return "medio";
  // heurística por cargo: analista/advogado/médico/engenheiro -> superior
  if (/(analista|advogado|auditor|procurador|defensor|juiz|medico|enfermeiro|engenheiro|odontolog|farmacaceut|professor|psicolog|assistente social|geologo|arquiteto|biologo|quimico)/.test(low)) {
    return "superior";
  }
  if (/(policia|militar|soldado|cabo|bombeiro|agente|escrivao|guarda)/.test(low)) return "medio";
  return null; // desconhecido -> neutro (não chutamos um nível)
}

// ---- Áreas (chaves do schema). Classifica pelo cargo + órgão. ----
const AREA_RULES = [
  ["industrial", /(automacao|instrumentacao|eletrica|eletrico|eletrotecnic|eletricista|mecanic|caldeira|industrial|manutencao|robotica|termocampo|sensor|pneumatic|hidraulica|soldador|torneiro)/],
  ["tecnologia", /(sistema|desenvolvedor|desenvolvimento|programador|programacao|tecnologia|informatica|computacao|dados|software|web|ti\b|analista de sistemas|ciencias da computacao|rede)/],
  ["juridica", /(juridico|advogado|analista judiciario|tribunal|procurador|defensor|juiz|magistrado|cartorio|notario|direito)/],
  ["seguranca", /(policia|policial|militar|soldado|cabo|bombeiro|guarda municipal|seguranca publica|penitenciario|carcereiro|agente de seguranca|perito criminal|escrivao)/],
  ["saude", /(saude|medico|enfermeir|farmac|fisioterap|odontolog|nutric|biomedic|terapeuta|auxiliar de enfermagem|tecnico em enfermagem|vigilancia sanitaria)/],
  ["social", /(assistente social|socioeducativo|social|creas|centro de referencia|assistencia)/],
  ["fiscal", /(fiscal|auditor fiscal|tributario|receita federal|tribunal de contas|inspetor|arrecadacao|aferidor)/],
  ["contabilidade", /(contador|contabil|auditoria|financas publicas)/],
  ["financeira", /(financeir|banco|caixa economica|banco do brasil|economia|tesouraria)/],
  ["infraestrutura", /(engenharia civil|engenheiro civil|obra|infraestrutura|arquitetura|urbanismo|topografia|estrada|saneamento)/],
  ["engenharia", /(engenheiro|engenharia)/],
  ["educacao", /(professor|docente|pedagog|educacao|escola|coordenador pedagogico|licenciatura|diretor de escola)/],
  ["gestao", /(gestao|gerente|gerencia|administracao publica|chefia)/],
  ["administracao", /(administrativ|administracao|secretaria|assistente administrativo|analista administrativo|apoio administrativo|office boy)/],
  ["licenciatura", /(licenciatura)/],
  ["meio_ambiente", /(ambiental|meio ambiente|sustentabilidade|licenca ambiental|agencia nacional de aguas|ibama|saneamento ambiental|residuos|clima|biodiversidade)/],
  ["agropecuaria", /(agropecuaria|agricultura|agronom|agroindustria|agronegocio|zootecnia|produtor rural|defesa agropecuaria|pesca|aquicultura|extensao rural)/],
  ["comunicacao", /(comunicacao|jornalismo|jornalista|publicidade|relacoes publicas|radio|televisao|midia|design grafico|comunicador|redator|social media)/],
  ["cultura", /(cultura|museu|arquivo historico|patrimonio|artes|music|biblioteca|folclore|cinema|editoracao|historiador)/],
  ["esportes", /(esporte|esportivo|educacao fisica|atleta|lazer|recreacao|paradesporto|arbitro|preparador fisico)/],
  ["trabalho", /(trabalho|previdencia|inss|seguridade|beneficio|fiscal do trabalho|auditor fiscal do trabalho|mediador|minis[te]rio do trabalho|agente de inspecao)/],
  ["logistica", /(logistica|transporte|transito|mobilidade|almoxarifado|estoque|distribuicao|frota|portuario|ferroviario|rodoviario|aereo|infraero|anac|conductor|motorista)/],
  ["qualidade", /(qualidade|metrologia|normalizacao|inmetro|afericao|calibracao|certificacao|inspecao de qualidade|padronizacao)/],
  ["energia", /(energia|petroleo|gas natural|eletricidade|usina|aneel|transmissao de energia|petrobras|combustivel|fontes renovaveis|solar|eolica|hidreletrica)/],
  ["defesa", /(defesa|aeronautica|exercito|marinha|forca aerea|policia federal|policia rodoviaria federal|aguas|comando|militar|seguranca de fronteira|fronteira|cabos|soldado)/],
  ["arquivologia", /(biblioteconomia|bibliotec|arquivolog|arquivo|documentacao|gestao documental|repositorio|midiateca)/],
  ["estatistica", /(estatistica|estat[ií]stico|dados|ciencia de dados|pesquisa|consultor de dados|biometria|geografia|cartografia|demografia|censo)/],
  ["comercio", /(comercio exterior|comercio|relacoes internacionais|economia internacional|aduana|alfandega|importacao|exportacao|camex|tratados|consul|diplomata|secretaria de comercio)/],
  ["mineracao", /(mineracao|minera[cç][aã]o|geologia|geologo|mina|garimpo|mineral|dnpm|recursos minerais|lavra|geofisica|topografia|agua subterranea)/],
];

function areas(cargo, orgao) {
  const texto = normalize(`${cargo} ${orgao}`).toLowerCase();
  const out = new Set();
  for (const [id, re] of AREA_RULES) {
    if (re.test(texto)) out.add(id);
  }
  // Sem indício confiável de área -> lista vazia (o match trata como neutro).
  return [...out];
}

// ---- Esfera (Municipal|Estadual|Federal|Fundacional/Privada) ----
function esfera(orgao, sigla) {
  const t = normalize(`${orgao} ${sigla || ""}`).toLowerCase();
  if (/(municip|prefeitura|camara municipal|guarda municipal|fundo municipal)/.test(t)) return "Municipal";
  if (/(federal|uniao|ministe|secretaria executiva|receita federal|universidade federal|instituto federal|banco do brasil|caixa economica|agencia|departamento nacional|ibama|incra|inss)/.test(t)) return "Federal";
  if (/(estadual|state|policia militar|policia civil|tribunal de justica|governo do estado|secretaria de estado|defensoria|ministerio publico estadual|assembleia legislativa|companhia)/.test(t)) return "Estadual";
  return "Municipal";
}

// ---- Regime: militar | estatutario | clt ----
function regime(cargo, orgao) {
  const t = normalize(`${cargo} ${orgao}`).toLowerCase();
  if (/(policia militar|bombeiro|soldado|cabo|oficial da pm|corpo de bombeiros|militar)/.test(t)) return "militar";
  // vínculo estatutário (servidores públicos)
  if (/(instituto federal|universidade federal|instituto de previdencia|autarquia|agencia reguladora|defensoria|ministerio publico|procuradoria|tribunal|assembleia|prefeitura|camara municipal|governo do estado|secretaria de|conselho|fundacao publica)/.test(t)) return "estatutario";
  // vínculo celetista (empresas públicas/privadas, bancos, fundações, companhias)
  if (/\b(banco|caixa economica|s\/a|sociedade de economia mista|empresa publica|companhia|fundacao)\b/.test(t)) return "clt";
  return null; // desconhecido -> neutro
}

// ---- salário: extrai R$ ou número. Retorna número. ----
function salario(raw) {
  if (!raw) return 0;
  // evita pegar ano "2026" — procura padrão de moeda primeiro
  const moeda = String(raw).match(/r\$\s?([\d.,]+)/i);
  let s = moeda ? moeda[1] : String(raw).match(/(\d{1,3}(?:\.\d{3})*,\d{2}|\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/);
  if (!s) return 0;
  s = moeda ? s : s[1];
  s = String(s).replace(/\./g, "").replace(/,(\d{2})$/, ".$1");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : Math.round(n * 100) / 100;
}

// ---- vagas: extrai número depois de "vagas" ou número isolado ----
function vagas(raw) {
  if (!raw) return 0;
  const m = String(raw).match(/(\d[\d.]*)\s*(?:vagas|vaga|cargo|cargo|oportunidades|postos)/i);
  if (m) return parseInt(String(m[1]).replace(/[^\d]/g, ""), 10) || 0;
  const n = String(raw).match(/\b(\d{1,4})\b/);
  if (n && /\d/.test(n[1])) return parseInt(n[1], 10);
  return 0;
}

// ---- datas: converte dd/mm/aaaa ou dd/mm/yy -> aaaa-mm-dd, outras formas -> null ----
function data(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  let m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) {
    const d = +m[1], mo = +m[2], y = +m[3];
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }
  const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  // "25/08" sem ano -> usa ano corrente (ou próximo)
  m = s.match(/(\d{1,2})\/(\d{1,2})/);
  if (m) {
    const d = +m[1], mo = +m[2];
    const now = new Date();
    let y = now.getFullYear();
    if (mo < now.getMonth() + 1) y += 1;
    return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  return null;
}

// ---- status: derivado das datas (relativo a "hoje"), independente do texto da fonte ----
function status(c) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const abre = c.dt_inscricao_abre ? new Date(c.dt_inscricao_abre + "T00:00:00") : null;
  const fecha = c.dt_inscricao_fecha ? new Date(c.dt_inscricao_fecha + "T00:00:00") : null;
  const prova = c.dt_prova ? new Date(c.dt_prova + "T00:00:00") : null;
  if (abre && fecha) {
    if (today < abre) return "Edital publicado";
    if (today >= abre && today <= fecha) return "Inscrições abertas";
    if (today > fecha && (!prova || today <= prova)) return "Inscrições encerradas";
    if (prova && today > prova) return "Concluído";
  }
  if (prova && today > prova) return "Concluído";
  return c.statusRaw || "Edital publicado";
}

// Só valores positivos; 0/desconhecido vira null (o app mostra "—" e o match trata como neutro).
const onlyPositive = (v) => (v && Number(v) > 0 ? Number(v) : null);

// ---- constrói o registro final ----
function buildRecord({ fonte, fonteCode, id, orgao, cargo, cidade, estado, esfera: esf, salario: sal, vagas: vag, dt_publicacao, dt_inscricao_abre, dt_inscricao_fecha, dt_prova, regime: reg, link, statusRaw, titulo }) {
  const geo = geoFor(`${cidade || ""} ${estado || ""} ${orgao || ""} ${titulo || ""}`);
  const c = {
    id,
    orgao: orgao || "Órgão não informado",
    esfera: esf || esfera(orgao, estado),
    cargo: cargo || "Cargo não informado",
    escolaridade: escolaridade(`${cargo || ""} ${orgao}`),
    area: areas(cargo || "", orgao),
    cidade: (geo && geo.cidade) || cidade || "Não informado",
    estado: (geo && geo.estado ? geo.estado : estado || "").toUpperCase(),
    lat: geo ? geo.lat : null,
    lng: geo ? geo.lng : null,
    salario: onlyPositive(sal || salario(sal || "")),
    vagas: onlyPositive(vag || vagas(vag || "")),
    dt_publicacao: dt_publicacao || null,
    dt_inscricao_abre: dt_inscricao_abre || null,
    dt_inscricao_fecha: dt_inscricao_fecha || null,
    dt_prova: dt_prova || null,
    regime: reg || regime(cargo || "", orgao),
    link: link || "",
    fonte,
    statusRaw: statusRaw || "",
  };
  c.status = status(c);
  return c;
}

module.exports = {
  buildRecord,
  escolaridade,
  areas,
  esfera,
  regime,
  salario,
  vagas,
  data,
  status,
  normalize,
};
