// ============================================================
//  DATA.JS — base de concursos SIMULADA (Recife-PE e região)
//  Nota: dados fictícios/ilustrativos para demonstração do MVP.
//  Na Etapa 2 estes registros virão da raspagem centralizada.
// ============================================================

// Coordenadas aproximadas de cidades de PE (para a proximidade geográfica)
const CID = {
  "Recife":            [-8.0543, -34.8813],
  "Olinda":            [-7.9913, -34.8476],
  "Jaboatão dos Guararapes": [-8.1128, -34.9375],
  "Camaragibe":        [-8.0226, -34.9812],
  "Paulista":          [-7.9400, -34.8733],
  "Caruaru":           [-8.2827, -35.9721],
  "Petrolina":         [-9.3891, -40.5028],
  "Garanhuns":         [-8.8908, -36.4927],
  "Salvador (BA)":     [-12.9777, -38.5016],
  "Brasília (DF)":     [-15.8267, -47.9218],
  "Vitória (ES)":      [-20.3155, -40.3128],
  "São Paulo (SP)":    [-23.5505, -46.6333],
};

const mk = (o, latD = 0, lngD = 0) => {
  const [lat, lng] = CID[o.cidade];
  o.lat = lat + latD; o.lng = lng + lngD;
  return o;
};

export const CONCURSOS = [
  mk({
    id: "C001", orgao: "Prefeitura do Recife", esfera: "Municipal",
    cargo: "Analista de Administração", escolaridade: "superior", area: ["administracao", "gestao"],
    cidade: "Recife", salario: 6500, vagas: 12,
    dt_publicacao: "2026-08-20", dt_inscricao_abre: "2026-09-01", dt_inscricao_fecha: "2026-09-25", dt_prova: "2026-11-15",
    regime: "estatutario", link: "https://recife.pe.gov.br", fonte: "Diário Oficial do Recife", status: "Inscrições abertas",
  }),
  mk({
    id: "C002", orgao: "Tribunal de Justiça de PE", esfera: "Estadual",
    cargo: "Técnico Judiciário", escolaridade: "medio", area: ["administracao", "juridica"],
    cidade: "Recife", salario: 4700, vagas: 40,
    dt_publicacao: "2026-08-18", dt_inscricao_abre: "2026-08-28", dt_inscricao_fecha: "2026-09-15", dt_prova: "2026-10-25",
    regime: "estatutario", link: "https://www.tjpe.jus.br", fonte: "TJPE", status: "Inscrições abertas",
  }),
  mk({
    id: "C003", orgao: "Polícia Militar de PE", esfera: "Estadual",
    cargo: "Soldado PM", escolaridade: "medio", area: ["seguranca"],
    cidade: "Recife", salario: 5200, vagas: 300,
    dt_publicacao: "2026-08-25", dt_inscricao_abre: "2026-09-10", dt_inscricao_fecha: "2026-10-05", dt_prova: "2026-11-22",
    regime: "militar", link: "https://www.pm.pe.gov.br", fonte: "PM-PE", status: "Edital publicado",
  }),
  mk({
    id: "C004", orgao: "Instituto Federal de PE (IFPE)", esfera: "Federal",
    cargo: "Técnico em Administração", escolaridade: "medio", area: ["administracao", "educacao"],
    cidade: "Recife", salario: 3900, vagas: 8,
    dt_publicacao: "2026-08-15", dt_inscricao_abre: "2026-08-24", dt_inscricao_fecha: "2026-09-12", dt_prova: "2026-10-11",
    regime: "estatutario", link: "https://www.ifpe.edu.br", fonte: "IFPE", status: "Inscrições abertas",
  }),
  mk({
    id: "C005", orgao: "Universidade Federal de PE (UFPE)", esfera: "Federal",
    cargo: "Assistente em Administração", escolaridade: "medio", area: ["administracao", "educacao"],
    cidade: "Recife", salario: 4200, vagas: 15,
    dt_publicacao: "2026-08-22", dt_inscricao_abre: "2026-09-02", dt_inscricao_fecha: "2026-09-23", dt_prova: "2026-11-08",
    regime: "estatutario", link: "https://www.ufpe.br", fonte: "UFPE", status: "Edital publicado",
  }),
  mk({
    id: "C006", orgao: "Prefeitura de Olinda", esfera: "Municipal",
    cargo: "Assistente Social", escolaridade: "superior", area: ["social", "saude"],
    cidade: "Olinda", salario: 5100, vagas: 6,
    dt_publicacao: "2026-08-10", dt_inscricao_abre: "2026-08-20", dt_inscricao_fecha: "2026-09-09", dt_prova: "2026-10-05",
    regime: "estatutario", link: "https://www.olinda.pe.gov.br", fonte: "Diário Oficial de Olinda", status: "Inscrições abertas",
  }),
  mk({
    id: "C007", orgao: "Ministério da Fazenda", esfera: "Federal",
    cargo: "Auditor Fiscal", escolaridade: "superior", area: ["fiscal", "contabilidade"],
    cidade: "Recife", salario: 21000, vagas: 5,
    dt_publicacao: "2026-08-30", dt_inscricao_abre: "2026-09-15", dt_inscricao_fecha: "2026-10-15", dt_prova: "2027-01-17",
    regime: "estatutario", link: "https://www.gov.br/fazenda", fonte: "Gov.br", status: "Edital publicado",
  }),
  mk({
    id: "C008", orgao: "BANCO do Nordeste", esfera: "Federal",
    cargo: "Escriturário", escolaridade: "medio", area: ["financeira", "administracao"],
    cidade: "Recife", salario: 3800, vagas: 60,
    dt_publicacao: "2026-08-28", dt_inscricao_abre: "2026-09-08", dt_inscricao_fecha: "2026-09-28", dt_prova: "2026-11-02",
    regime: "clt", link: "https://www.bnb.gov.br", fonte: "BNB", status: "Inscrições abertas",
  }),
  mk({
    id: "C009", orgao: "Prefeitura de Caruaru", esfera: "Municipal",
    cargo: "Professor de Matemática", escolaridade: "superior", area: ["educacao", "licenciatura"],
    cidade: "Caruaru", salario: 4600, vagas: 20,
    dt_publicacao: "2026-08-05", dt_inscricao_abre: "2026-08-14", dt_inscricao_fecha: "2026-09-04", dt_prova: "2026-10-19",
    regime: "estatutario", link: "https://caruaru.pe.gov.br", fonte: "Diário Oficial de Caruaru", status: "Inscrições abertas",
  }),
  mk({
    id: "C010", orgao: "Prefeitura de Petrolina", esfera: "Municipal",
    cargo: "Engenheiro Civil", escolaridade: "superior", area: ["infraestrutura", "engenharia"],
    cidade: "Petrolina", salario: 9000, vagas: 3,
    dt_publicacao: "2026-08-26", dt_inscricao_abre: "2026-09-07", dt_inscricao_fecha: "2026-09-27", dt_prova: "2026-11-16",
    regime: "estatutario", link: "https://petrolina.pe.gov.br", fonte: "Diário Oficial de Petrolina", status: "Edital publicado",
  }),
  mk({
    id: "C011", orgao: "Secretaria Estadual de Educação (PE)", esfera: "Estadual",
    cargo: "Professor de Língua Portuguesa", escolaridade: "superior", area: ["educacao", "licenciatura"],
    cidade: "Recife", salario: 4800, vagas: 55,
    dt_publicacao: "2026-08-19", dt_inscricao_abre: "2026-08-29", dt_inscricao_fecha: "2026-09-20", dt_prova: "2026-11-01",
    regime: "estatutario", link: "https://educacao.pe.gov.br", fonte: "SEDUC-PE", status: "Inscrições abertas",
  }),
  mk({
    id: "C012", orgao: "Polícia Federal", esfera: "Federal",
    cargo: "Agente de Polícia Federal", escolaridade: "superior", area: ["seguranca", "juridica"],
    cidade: "Recife", salario: 13800, vagas: 100,
    dt_publicacao: "2026-08-27", dt_inscricao_abre: "2026-09-12", dt_inscricao_fecha: "2026-10-06", dt_prova: "2026-12-06",
    regime: "estatutario", link: "https://www.gov.br/pf", fonte: "PF", status: "Edital publicado",
  }),
  mk({
    id: "C013", orgao: "Prefeitura de Jaboatão dos Guararapes", esfera: "Municipal",
    cargo: "Enfermeiro", escolaridade: "superior", area: ["saude"],
    cidade: "Jaboatão dos Guararapes", salario: 5400, vagas: 18,
    dt_publicacao: "2026-08-21", dt_inscricao_abre: "2026-08-31", dt_inscricao_fecha: "2026-09-21", dt_prova: "2026-11-09",
    regime: "estatutario", link: "https://jaboatao.pe.gov.br", fonte: "Diário Oficial de Jaboatão", status: "Inscrições abertas",
  }),
  mk({
    id: "C014", orgao: "Sebrae PE", esfera: "Privado",
    cargo: "Analista de Contabilidade", escolaridade: "superior", area: ["contabilidade", "gestao"],
    cidade: "Recife", salario: 7800, vagas: 4,
    dt_publicacao: "2026-08-24", dt_inscricao_abre: "2026-09-03", dt_inscricao_fecha: "2026-09-22", dt_prova: "2026-10-27",
    regime: "clt", link: "https://www.sebrae.com.br", fonte: "Sebrae", status: "Inscrições abertas",
  }),
  mk({
    id: "C015", orgao: "Defensoria Pública de PE", esfera: "Estadual",
    cargo: "Analista Jurídico", escolaridade: "superior", area: ["juridica"],
    cidade: "Recife", salario: 11000, vagas: 10,
    dt_publicacao: "2026-08-17", dt_inscricao_abre: "2026-08-27", dt_inscricao_fecha: "2026-09-14", dt_prova: "2026-10-18",
    regime: "estatutario", link: "https://www.defensoria.pe.gov.br", fonte: "DPE-PE", status: "Inscrições abertas",
  }),
  mk({
    id: "C016", orgao: "Companhia PE de Automação (CXA)", esfera: "Estadual",
    cargo: "Técnico de Automação Industrial", escolaridade: "tecnico", area: ["industrial", "tecnologia"],
    cidade: "Recife", salario: 5600, vagas: 9,
    dt_publicacao: "2026-08-23", dt_inscricao_abre: "2026-09-04", dt_inscricao_fecha: "2026-09-24", dt_prova: "2026-11-12",
    regime: "clt", link: "https://www.pe.gov.br", fonte: "Governo de PE", status: "Inscrições abertas",
  }),
  mk({
    id: "C017", orgao: "Companhia de Tecnologia de PE (CT-PE)", esfera: "Estadual",
    cargo: "Analista de Sistemas / Desenvolvedor", escolaridade: "superior", area: ["tecnologia"],
    cidade: "Recife", salario: 8200, vagas: 14,
    dt_publicacao: "2026-08-24", dt_inscricao_abre: "2026-09-05", dt_inscricao_fecha: "2026-09-26", dt_prova: "2026-11-14",
    regime: "clt", link: "https://www.pe.gov.br", fonte: "Governo de PE", status: "Edital publicado",
  }),
  mk({
    id: "C018", orgao: "Companhia Ambiental de PE (CA-PE)", esfera: "Estadual",
    cargo: "Técnico de Instrumentação e Controle", escolaridade: "tecnico", area: ["industrial", "engenharia"],
    cidade: "Recife", salario: 5400, vagas: 7,
    dt_publicacao: "2026-08-25", dt_inscricao_abre: "2026-09-06", dt_inscricao_fecha: "2026-09-27", dt_prova: "2026-11-13",
    regime: "clt", link: "https://www.pe.gov.br", fonte: "Governo de PE", status: "Edital publicado",
  }),
];

// Níveis de escolaridade e áreas (para o formulário de perfil)
export const ESCOLARIDADES = [
  { id: "fundamental", label: "Ensino Fundamental" },
  { id: "medio", label: "Ensino Médio" },
  { id: "tecnico", label: "Ensino Técnico" },
  { id: "superior", label: "Superior (graduação)" },
  { id: "pos", label: "Pós-graduação / Mestrado" },
];

export const AREAS = [
  { id: "administracao", label: "Administração" },
  { id: "gestao", label: "Gestão" },
  { id: "educacao", label: "Educação" },
  { id: "licenciatura", label: "Licenciatura" },
  { id: "juridica", label: "Jurídica" },
  { id: "seguranca", label: "Segurança Pública" },
  { id: "saude", label: "Saúde" },
  { id: "social", label: "Assistência Social" },
  { id: "fiscal", label: "Fiscal / Tributária" },
  { id: "contabilidade", label: "Contabilidade" },
  { id: "financeira", label: "Financeira" },
  { id: "infraestrutura", label: "Infraestrutura" },
  { id: "engenharia", label: "Engenharia" },
  { id: "tecnologia", label: "Tecnologia / TI" },
  { id: "industrial", label: "Industrial / Automação" },
  { id: "meio_ambiente", label: "Meio Ambiente / Sustentabilidade" },
  { id: "agropecuaria", label: "Agropecuária / Agronegócio" },
  { id: "comunicacao", label: "Comunicação / Jornalismo" },
  { id: "cultura", label: "Cultura / Artes" },
  { id: "esportes", label: "Esporte / Lazer" },
  { id: "trabalho", label: "Trabalho / Previdência" },
  { id: "logistica", label: "Logística / Transportes" },
  { id: "qualidade", label: "Qualidade / Metrologia" },
  { id: "energia", label: "Energia / Petróleo e Gás" },
  { id: "defesa", label: "Defesa / Aeronáutica / Polícia Federal" },
  { id: "arquivologia", label: "Biblioteconomia / Arquivologia" },
  { id: "estatistica", label: "Estatística / Dados" },
  { id: "comercio", label: "Comércio Exterior / Relações Internacionais" },
  { id: "mineracao", label: "Mineração / Geologia" },
];

export const REGIMES = [
  { id: "estatutario", label: "Estatutário" },
  { id: "clt", label: "CLT (celetista)" },
  { id: "militar", label: "Militar" },
  { id: "qualquer", label: "Qualquer" },
];

// Mapa de escolaridade → ordem (maior = mais estudo)
export const ESC_ORDER = { fundamental: 1, medio: 2, tecnico: 3, superior: 4, pos: 5 };
export const areaLabel = (id) => AREAS.find((a) => a.id === id)?.label || id;
