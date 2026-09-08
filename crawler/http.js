// http.js — cliente HTTP "educado": respeita robots.txt, taxa de requisições e
// faz retries com backoff. Tudo em fetch nativo (Node 20+), sem dependências.

const UA =
  "CacaProvaBot/1.0 (+https://github.com/caca-prova; raspagem semanal de editais publicos; contato: contato@cacaprova.com.br)";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Cache simples de robots.txt por origem
const robotsCache = new Map();

async function getRobots(url) {
  const u = new URL(url);
  const origin = u.origin;
  if (robotsCache.has(origin)) return robotsCache.get(origin);
  const txt = await fetch(`${origin}/robots.txt`, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(10000),
  })
    .then((r) => (r.ok ? r.text() : ""))
    .catch(() => "");
  robotsCache.set(origin, txt);
  return txt;
}

// Regras simples de robots.txt seguindo a precedência do padrão:
//  - a regra mais longa que casa o path vence;
//  - em caso de empate, "Allow" tem precedência sobre "Disallow";
//  - "Disallow:" vazio equivale a liberar; "Allow: /" libera tudo.
// Aplica-se apenas ao bloco "User-agent: *" (nosso bot não é um dos nomeados).
async function allowedByRobots(url) {
  try {
    const txt = await getRobots(url);
    if (!txt) return true;
    const u = new URL(url);
    const path = u.pathname + u.search;
    const rules = [];
    let inWildcard = false;
    let cur = null;
    for (const line of txt.split(/\r?\n/)) {
      const l = line.trim();
      if (/^User-agent:/i.test(l)) {
        const ua = l.replace(/^User-agent:\s*/i, "").trim().toLowerCase();
        if (ua === "*") { inWildcard = true; cur = "*"; }
        else if (/cacaprovabot|caca/.test(ua)) { inWildcard = false; cur = ua; }
        else { inWildcard = false; cur = null; }
      } else if (/^(Allow|Disallow):/i.test(l)) {
        if (inWildcard || cur === "*") {
          const allow = /^Allow/i.test(l);
          const val = l.replace(/^(Allow|Disallow):\s*/i, "").trim();
          // Disallow vazio = permite tudo; é a mesma coisa que não haver regra
          rules.push({ allow, val });
        }
      }
    }
    // ignora regras don't-care (Disallow vazio ou Allow "/")
    const aplica = rules.filter((r) => r.val && !(r.val === "/"));
    if (aplica.length === 0) return true;
    // descarta regras que não casam o path
    const matches = aplica.filter((r) => path.startsWith(r.val.replace(/\*$/, "")));
    if (matches.length === 0) return true;
    // regra mais específica (mais longa); empate -> Allow
    matches.sort((a, b) => {
      const la = a.val.length, lb = b.val.length;
      if (la !== lb) return lb - la;
      return a.allow ? -1 : 1;
    });
    return matches[0].allow;
  } catch {
    return true;
  }
}

let lastReqAt = 0;
let minIntervalMs = 1500; // ~40 req/min, bem abaixo do "low traffic"

async function politeFetch(url, opts = {}) {
  const now = Date.now();
  const wait = lastReqAt + minIntervalMs - now;
  if (wait > 0) await sleep(wait);
  lastReqAt = Date.now();

  const res = await fetch(url, {
    headers: {
      "User-Agent": opts.ua || UA,
      Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
      "Accept-Language": "pt-BR,pt;q=0.9",
    },
    signal: AbortSignal.timeout(opts.timeout || 20000),
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res;
}

// Busca HTML com retries (3 tentativas, backoff) e verificação de robots.
// `ua` permite que uma fonte use um user-agent diferente (ex.: sites que bloqueiam
// UA de bot no WAF, mas cuja robots.txt não proíbe a coleta).
async function fetchHTML(url, { timeout = 20000, retries = 3, ua } = {}) {
  if (!(await allowedByRobots(url))) {
    throw new Error(`bloqueado por robots.txt (${url})`);
  }
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await politeFetch(url, { timeout, ua });
      const html = await decodeHTML(res);
      // Detector simples de "just a moment" / desafio anti-bot
      if (/just a moment|Enable JavaScript and cookies to continue/i.test(html) && html.length < 80000) {
        throw new Error("desafio anti-bot detectado");
      }
      return { html, url, status: res.status };
    } catch (e) {
      lastErr = e;
      await sleep(800 * (i + 1));
    }
  }
  throw lastErr;
}

// Decodifica o corpo respeitando o charset do servidor. Muitos sites brasileiros
// ainda servem ISO-8859-1/Latin-1; se a decodificação UTF-8 gerar muitos caracteres
// de substituição, re-decodifica como Latin-1.
async function decodeHTML(res) {
  const buf = await res.arrayBuffer();
  const m = (res.headers.get("content-type") || "").match(/charset=([\w-]+)/i);
  const enc = m ? m[1].toLowerCase() : "utf-8";
  let text = new TextDecoder(enc).decode(buf);
  if (!m) {
    const bad = (text.match(/\uFFFD/g) || []).length;
    if (bad > 0) text = new TextDecoder("latin1").decode(buf);
  }
  return text;
}

module.exports = { fetchHTML, politeFetch, UA, allowedByRobots };
