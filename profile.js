// ============================================================
//  PROFILE.JS — perfil do usuário (somente no dispositivo)
//  + extração de dados do PDF do Linkedin (pdf.js, local)
// ============================================================

const KEY = "caca-prova:profile:v1";

// Armazenamento SEGURO: usa localStorage quando disponível e cai para
// um objeto em memória se o ambiente bloquear (ex.: iframe sandbox/opaque).
// Assim o app nunca quebra por causa de storage.
let memoryStore = {};
let storageOK = (() => {
  try { const k = "__t__"; window.localStorage.setItem(k, "1"); window.localStorage.removeItem(k); return true; }
  catch { return false; }
})();

const store = {
  get(k) {
    if (storageOK) { try { return window.localStorage.getItem(k); } catch { /* falls through */ } }
    return memoryStore[k] ?? null;
  },
  set(k, v) {
    if (storageOK) { try { window.localStorage.setItem(k, v); return; } catch { /* falls through */ } }
    memoryStore[k] = v;
  },
  remove(k) {
    if (storageOK) { try { window.localStorage.removeItem(k); return; } catch { /* falls through */ } }
    delete memoryStore[k];
  },
};

export function loadProfile() {
  const raw = store.get(KEY);
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}
export function saveProfile(p) { store.set(KEY, JSON.stringify(p)); }
export function deleteProfile() { store.remove(KEY); }

// ---------- aceitação dos Termos de Uso ----------
const TERMS_KEY = "caca-prova:terms:v1";
export function loadTermsAccepted() {
  const raw = store.get(TERMS_KEY);
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}
export function saveTermsAccepted(version) {
  store.set(TERMS_KEY, JSON.stringify({ accepted: true, version, at: new Date().toISOString() }));
}

export function emptyProfile() {
  return {
    nome: "", email: "", escolaridade: "medio", interesses: [],
    cidade: "Recife", uf: "PE", lat: -8.0543, lng: -34.8813, raio_km: 100,
    pretensao: 5000, regime: "qualquer", disponibilidade: "imediata",
    vinculo: "estudante", resumo: "",
  };
}

// ---------- extração de texto do PDF (pdf.js local) ----------
let pdfjsReady = false;
export async function getPdfText(arrayBuffer) {
  if (!pdfjsReady) {
    // pdf.js legacy (UMD) expõe window.pdfjsLib
    if (!window.pdfjsLib) {
      await new Promise((res, rej) => {
        const s = document.createElement("script");
        s.src = "lib/pdfjs/pdf.min.js";
        s.onload = res; s.onerror = rej; document.head.appendChild(s);
      });
    }
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = "lib/pdfjs/pdf.worker.min.js";
    pdfjsReady = true;
  }
  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    text += layoutToLines(tc.items) + "\n";
  }
  return text || null;
}

// Reconstrói o texto respeitando as quebras de linha reais (posição Y no PDF).
// Isso é essencial para o interpretador distinguir nome, título, seções etc.
function layoutToLines(items) {
  const lines = [];
  let cur = null, lastY = null, lastX = null;
  // ordena itens por posição (Y de cima pra baixo, X da esquerda pra direita)
  const sorted = items
    .filter((it) => it && typeof it.str === "string" && it.str.length)
    .map((it) => ({ str: it.str, y: it.transform ? it.transform[5] : 0, x: it.transform ? it.transform[4] : 0, hasEOL: it.hasEOL }))
    .sort((a, b) => (b.y - a.y) || (a.x - b.x));

  for (const it of sorted) {
    const sameLine = lastY !== null && Math.abs(it.y - lastY) < 4; // mesma linha visual
    if (cur && sameLine) {
      if (it.x - lastX > 35) cur += " ";
      cur += it.str.replace(/\s+/g, " ");
    } else {
      if (cur) lines.push(cur);
      cur = it.str.replace(/\s+/g, " ");
    }
    lastY = it.y; lastX = it.x + (it.str.replace(/\s+/g, " ").length);
    if (it.hasEOL) { lines.push(cur); cur = null; lastY = null; }
  }
  if (cur) lines.push(cur);
  return lines.join("\n");
}

// ---------- interpreta o texto do currículo ----------
export function interpretarCurriculo(texto) {
  const t = texto.replace(/\s+/g, " ").toLowerCase();
  const res = {};
  const linhas = texto.split("\n").map((l) => l.trim().replace(/\s+/g, " ")).filter(Boolean);

  // Nome: procura uma linha que realmente pareça um nome completo.
  res.nome = detectarNome(linhas);

  // Escolaridade
  if (/(mestrado|doutorado|p[óo]s[- ]gradua)/.test(t)) res.escolaridade = "pos";
  else if (/(bacharel|licenciatura|superior|gradua|universit[aá]rio)/.test(t)) res.escolaridade = "superior";
  else if (/(t[ée]cnico|tecnol)/.test(t)) res.escolaridade = "tecnico";
  else if (/(ensino m[ée]dio|segundo grau)/.test(t)) res.escolaridade = "medio";
  else if (/(ensino fundamental|primeiro grau)/.test(t)) res.escolaridade = "fundamental";

  // Áreas de interesse (PT + EN), captadas somente do "título" + "competências"
  // (região representativa da área profissional), evitando falsos positivos
  // que aparecem no texto corrido da experiência (ex.: "gestão de incidentes").
  res.interesses = detectarAreas(contextoCompetencias(linhas));

  // Resumo — primeira frase relevante (junto ao início)
  const frase = (texto.match(/([^.\n]{20,180}\.)/) || [])[0];
  if (frase) res.resumo = frase.trim();

  return res;
}

// Constrói um "contexto" curto com o título/cabeçalho e as competências do
// currículo. É o que melhor representa a área de atuação da pessoa.
function contextoCompetencias(linhas) {
  // junta todas as linhas da "headline" (podem estar quebradas em várias linhas)
  const head = linhas.filter((l) => l.includes("|")).join(" ");
  let comp = [];
  let inComp = false, count = 0;
  const STOP = /certifica[cç][aã]o|certificacao|forma[cç][aã]o acad[eê]mica|experi[eê]ncia|idiomas|educa[cç][aã]o|habilidades|skills|publica|cursos\b/i;
  for (const l of linhas) {
    if (/compet[eê]ncias|habilidades|skills|principais compet/.test(l)) { inComp = true; continue; }
    if (inComp) {
      if (STOP.test(l)) break;
      if (l.trim() && count < 12) { comp.push(l.trim()); count++; }
    }
  }
  return (head + " " + comp.join(" "));
}

// Palavras que indicam que a linha NÃO é o nome do candidato
// (endereço, seção, cidade, cargo, competência/título técnico).
const NAO_NOME = new Set([
  "avenida","av.","rua","r.","travessa","praça","pça","quadra","bloco","lote","s/n","número","nº",
  "linkedin","github","email","e-mail","contato","resumo","summary","perfil","profile","experiência",
  "experiencia","experience","formação","formacao","education","habilidades","skills","idiomas",
  "languages","publicações","publicacoes","certificações","certificacoes","certifications","download",
  "export","baixar","currículo","curriculo","cv","home","sobre","about","objetivo","competências",
  "competencias","recife","olinda","paulista","caruaru","petrolina","garanhuns","pernambuco","bahia",
  "brasil","jaboatão","jaboatao","guararapes","camaragibe","salvador","camacari","camaçari","ipojuca",
  "simões","simões filho","montador","montadora",
  // cargos / títulos de função
  "operador","operadora","técnico","tecnico","técnica","tecnica","analista","auxiliar","assistente",
  "instrumentista","engenheiro","professor","professora","gerente","supervisor","diretor","coordenador",
  "especialista","consultor","gestor","estagiário","estagiario","vendedor","representante","geral",
  // termos técnicos que costumam encabeçar títulos/competências (não são nome)
  "instrumentação","instrumentacao","automação","automacao","robótica","robotica","mecatrônica",
  "mecatronica","controle","processos","desenvolvimento","sistemas","software","elétrica","eletrica",
  "elétrica","sala","salas","impulsionando","competências","fluencia","prevenção","prevencao",
  "comunicação","comunicacao","diagnóstico","diagnostico","manutenção","manutencao","calibração",
  "calibracao","operações","operacoes","procedimentos","procedimento",
]);
// Palavras de ligação que podem aparecer dentro de nomes (e são aceitas)
const LINK = new Set(["de","da","do","dos","das","e","van","von","el","la","del","di"]);
// Palavras que denotam empresa/CNPJ (excluem a linha do nome)
const EMPRESA = new Set(["me","ltda","s.a","s/a","serviços","servicos","solar","coca","cola","coca-cola","alpek","elinq","consórcio","consorcio","polyester","brasil"]);

// Verifica se uma linha "parece um nome de pessoa" (2–4 palavras).
function pareceNome(t) {
  if (!t || t.length < 4 || t.length > 70) return false;
  if (t.includes("@")) return false;
  if (/\d{2,}/.test(t)) return false;                 // telefone, datas, números
  if (/-[A-Z]{2}$/.test(t)) return false;             // termina com UF (ex.: ...-PE)
  if (!/^[A-Za-zÀ-ÖØ-öø-ÿ'\-.\u00B7\s]+$/.test(t)) return false; // só letras/pontuação
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 4) return false;
  // exclui se houver palavra de endereço/cargo/cidade/título técnico/empresa
  for (const w of words) {
    const lw = w.toLowerCase().replace(/[.\u00B7]/g, "");
    if (NAO_NOME.has(lw) || EMPRESA.has(lw)) return false;
  }
  // a maioria das palavras deve começar com maiúscula (nome próprio)
  const caps = words.filter((w) => /^[A-ZÀ-Ý]/.test(w)).length;
  if (caps < words.length - 1) return false;
  // exclui linhas que sejam só palavras de ligação (ex.: "de Paula")
  const lig = words.filter((w) => LINK.has(w.toLowerCase())).length;
  if (lig >= words.length) return false;
  return true;
}

// Nome completo. Estratégia (da mais confiável à de fallback):
//  1) a linha IMEDIATAMENTE ANTES da "headline" do LinkedIn (linha que contém "|").
//  2) as primeiras linhas da página (nome costuma vir no topo).
//  3) qualquer linha que pareça um nome.
function detectarNome(linhas) {
  // 1) antes da headline (linha com "|")
  for (let i = 0; i < linhas.length; i++) {
    if (/\|/.test(linhas[i]) && i > 0) {
      const cand = linhas[i - 1].trim();
      if (pareceNome(cand)) return cand;
    }
  }
  // 2) primeiras ~30 linhas
  for (let i = 0; i < Math.min(linhas.length, 30); i++) {
    const cand = linhas[i].trim();
    if (pareceNome(cand)) return cand;
  }
  // 3) qualquer linha
  for (const l of linhas) if (pareceNome(l)) return l;
  return null;
}

// Áreas (PT + EN), captadas principalmente por função/título/competências.
// Usa limites de palavra para reduzir falsos positivos e cobre automação,
// robótica, mecatrônica, instrumentação, TI e indústria 4.0.
const W = (re) => new RegExp("(^|[^0-9a-zA-ZÀ-ÖØ-öø-ÿ])(" + re + ")([^0-9a-zA-ZÀ-ÖØ-öø-ÿ]|$)", "i");

function detectarAreas(t) {
  const rules = [
    // Industrial / Automação (categoria nova)
    ["industrial", W("automa[cç][aã]o|robotica|rob[óo]tica|mecatr[ôo]nica|instrumenta[cç][aã]o|instrumenta[cç][aã]o industrial|ind[úu]stria 4\\.0|ind[úu]stria\\b|processos qu[íi]micos|controle de processos|processos industrial|industrial")],
    // Tecnologia / TI
    ["tecnologia", W("desenvolvimento de sistemas|tecnologia da informa[cç][aã]o|analista de sistemas|devops|engenharia de software|software|programador|programa[cç][aã]o|desenvolvedor|ci[eê]ncia de dados|analytics|big data|inform[aá]tica|sistemas digitais|tecnolog[aá]|dados")],
    ["engenharia", W("engenharia|engenheiro|engenharia de produ[cç][aã]o|mec[aâ]nica|el[ée]trica|eletr[ôo]nica")],
    // Administração / Gestão
    ["administracao", W("administra[cç][aã]o|administrativ[aão]|administrador|assistente administrat|auxiliar administrat")],
    ["gestao", W("gest[aã]o de projetos|analista de gest[aã]o|gestor|business|management|gest[aã]o\\b")],
    // Educação / Licenciatura
    ["educacao", W("professor|professora|pedagogia|licenciatura em|doc[eê]ncia|educa[cç][aã]o infantil|educa[cç][aã]o f[íi]sica")],
    ["licenciatura", W("licenciatura|licenciado em|letras|matem[aá]tica|hist[oó]ria|geografia|qu[íi]mica|f[íi]sica|biologia")],
    // Jurídica / Segurança
    ["juridica", W("direito|advogado|advogada|jur[íi]dico|juiz|procuradoria|delegado|bacharel em direito")],
    ["seguranca", W("seguran[cç]a p[uú]blica|policial|polic[íi]cia\\b|pmpe|bombeiro|agente de pol[íi]cia|defesa civil|cargo de seguran")],
    // Saúde / Social
    ["saude", W("sa[uú]de|enfermagem|enfermeiro|enfermeira|m[ée]dico|medicina|fisioterapia|nutri[cç][aã]o|odontologia|farm[aá]cia|psicologia|biom[ée]dico")],
    ["social", W("assist[eê]ncia social|assistente social|servi[cç]o social|cras|conselho")],
    // Fiscal / Contábil / Financeira
    ["fiscal", W("fiscal|tributa[rç]io|auditor[aá]rio|auditor fiscal|receita federal|procura d[aá] fazenda")],
    ["contabilidade", W("ci[eê]ncias cont[aá]beis|contabilidade|contador[aá]|cont[aá]bil")],
    ["financeira", W("financeiro|financeir|banco|economia|escritur[aá]rio|tesouraria|c[aâ]mbio")],
    // Novas áreas (PT + EN)
    ["meio_ambiente", W("meio ambiente|ambiental|sustentabilidade|environment|sustainability|licen[cç]a ambiental|ibama|res[ií]duos|esgoto")],
    ["agropecuaria", W("agropecu[aá]ria|agronomia|agricultor|agroneg[oó]cio|zootecnia|agr[ií]cola|pecu[aá]ria|agrobusiness|veterin[aá]ria")],
    ["comunicacao", W("comunica[cç][aã]o|jornalismo|jornalista|publicidade|rela[cç][oõ]es p[uú]blicas|marketing|m[ií]dia|comunicador|redator|social media|design gr[aá]fico")],
    ["cultura", W("cultura\\b|cultural|museu|patrim[oô]nio|artes\\b|artes visuais|m[uú]sica|historiador|editora[cç][aã]o|folclore|biblioteca")],
    ["esportes", W("esporte|esportivo|educa[cç][aã]o f[ií]sica|atleta|preparador f[ií]sico|lazer|recrea[cç][aã]o")],
    ["trabalho", W("trabalho\\b|previd[eê]ncia|inss|seguridade|benef[ií]cio|auditor fiscal do trabalho|mediador|minist[ée]rio do trabalho")],
    ["logistica", W("log[ií]stica|logistics|transporte|transport|mobilidade|almoxarifado|estoque|distribui[cç][aã]o|frota|portu[aá]rio|ferrovi[aá]rio|rodovi[aá]rio|anac|infraero|motorista")],
    ["qualidade", W("qualidade\\b|quality|metrologia|inmetro|calibra[cç][aã]o|certifica[cç][aã]o|normaliza[cç][aã]o|padroniza[cç][aã]o")],
    ["energia", W("energia\\b|energy|petr[oó]leo|oil|g[aá]s natural|eletricidade|electric|usina|aneel|petrobras|renov[aá]veis|solar|e[oó]lica|hidrel[ée]trica")],
    ["defesa", W("defesa\\b|defense|aeron[aá]utica|for[cç]a a[ée]rea|ex[ée]rcito|marinha|policia federal|policia rodovi[aá]ria federal|comando|fronteira")],
    ["arquivologia", W("biblioteconomia|bibliotec[aá]rio|arquivologia|arquivista|gest[aã]o documental|documenta[cç][aã]o|arquivo\\b")],
    ["estatistica", W("estat[ií]stica|data science|ci[eê]ncia de dados|estat[ií]stico|geografia|cartografia|demografia|censo|pesquisa\\b")],
    ["comercio", W("com[ée]rcio exterior|international trade|rela[cç][oõ]es internacionais|international relations|aduana|importa[cç][aã]o|exporta[cç][aã]o|diplomata|consul")],
    ["mineracao", W("minera[cç][aã]o|mining|geologia|geology|ge[oó]logo|mina\\b|mineral|recursos minerais|topografia|geof[ií]sica")],
    // Infraestrutura
    ["infraestrutura", W("infraestrutura|constru[cç][aã]o|obra|arquitetura|urbanismo|topografia|el[ée]trica predial")],
  ];
  const out = [];
  for (const [id, re] of rules) if (re.test(t)) out.push(id);
  return [...new Set(out)];
}
