// ============================================================
//  PREMIUM.JS — assinatura, concursos salvos e notificações
//  Tudo no dispositivo (privacidade first).
// ============================================================

const KEY = "caca-prova:sub:v1";

// Armazenamento seguro (fallback em memória se localStorage for bloqueado).
let memoryStore = {};
let storageOK = (() => {
  try { const k = "__t__"; window.localStorage.setItem(k, "1"); window.localStorage.removeItem(k); return true; }
  catch { return false; }
})();
const store = {
  get(k) { if (storageOK) { try { return window.localStorage.getItem(k); } catch {} } return memoryStore[k] ?? null; },
  set(k, v) { if (storageOK) { try { window.localStorage.setItem(k, v); return; } catch {} } memoryStore[k] = v; },
};

const DEFAULT_SUB = () => ({
  premium: false,
  saved: [],                 // ids de concursos salvos (favoritos)
  notif: { enabled: false, frequencia: "semanal" },  // frequência do resumo
});

export function loadSub() {
  const raw = store.get(KEY);
  try {
    const s = raw ? JSON.parse(raw) : null;
    if (!s) return DEFAULT_SUB();
    return {
      premium: !!s.premium,
      saved: Array.isArray(s.saved) ? s.saved : [],
      notif: {
        enabled: !!(s.notif && s.notif.enabled),
        frequencia: (s.notif && s.notif.frequencia) || "semanal",
      },
    };
  } catch { return DEFAULT_SUB(); }
}
export function saveSub(s) { store.set(KEY, JSON.stringify(s)); }
export function setPremium(on) { const s = loadSub(); s.premium = !!on; saveSub(s); return s; }

// Referência estável de assinatura (usada como external_reference na cobrança
// PIX e para o app consultar o status no webhook). Fica separada da `sub`
// para não ser descartada pelo loadSub() re-serializado.
const REF_KEY = "caca-prova:pix:ref";
export function getSubRef() {
  let ref = store.get(REF_KEY);
  if (!ref) {
    ref = (globalThis.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : ("cp-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10));
    store.set(REF_KEY, ref);
  }
  return ref;
}

// ---------- revalidação da licença (anti-tamper / expiração) ----------
// Em produção, a fonte da verdade do Premium é o backend (webhook do gateway),
// não o localStorage. Esta consulta pergunta ao /api/pix-status se a assinatura
// `ref` continua ativa. Se o servidor responder "não é premium" (e NÃO for um
// erro de rede), o app rebaixa para Free. Assim quem expirou ou não pagou
// volta ao plano gratuito mesmo sem o app ser reaberto pelo concursante.
export async function revalidarPremium(ref, statusEndpoint = "") {
  // `statusEndpoint` pode vir do config.js (PIX_CONFIG.statusEndpoint); vazio => mesmo domínio (/api).
  const base = String(statusEndpoint || "").replace(/\/$/, "") || "/api";
  try {
    const res = await fetch(`${base}/pix-status?ref=${encodeURIComponent(ref)}`, { method: "GET" });
    if (!res.ok) return { premium: null, offline: true }; // erro => NÃO rebaixa
    const j = await res.json();
    return { ...j, offline: false };
  } catch {
    return { premium: null, offline: true };
  }
}
export function isSaved(id, sub) { return (sub || loadSub()).saved.includes(id); }
export function toggleSave(id, sub) {
  const s = sub || loadSub();
  const i = s.saved.indexOf(id);
  if (i >= 0) s.saved.splice(i, 1); else s.saved.push(id);
  saveSub(s);
  return s;
}

// ---------- configuração de notificações ----------
export const FREQ = [
  { id: "semanal", label: "Semanal", days: 7 },
  { id: "mensal", label: "Mensal", days: 30 },
  { id: "trimestral", label: "Trimestral", days: 90 },
];
export function setNotif(cfg, sub) {
  const s = sub || loadSub();
  s.notif = { enabled: !!cfg.enabled, frequencia: cfg.frequencia || s.notif.frequencia };
  saveSub(s);
  return s;
}

// ---------- estágios de um concurso ----------
const ts = (d) => (d ? new Date(d + "T00:00:00").getTime() : null);

export function stageOf(c) {
  const events = [
    { k: "publicacao", label: "Edital publicado", d: c.dt_publicacao, hint: "publicação" },
    { k: "inscricao_abre", label: "Inscrições abertas", d: c.dt_inscricao_abre, hint: "abre inscrição" },
    { k: "inscricao_fecha", label: "Fim das inscrições", d: c.dt_inscricao_fecha, hint: "último dia" },
    { k: "prova", label: "Prova", d: c.dt_prova, hint: "prova" },
  ].filter((e) => e.d).map((e) => ({ ...e, t: ts(e.d) }));
  const now = Date.now();
  const next = events.find((e) => e.t >= now) || null;
  const passed = events.filter((e) => e.t < now).length;
  return { next, passed };
}

// ---------- resumo (digest) de alertas ----------
// Gera os eventos futuros (dentro da janela da frequência) para os salvos.
export function buildDigest(concursos, sub, nowMs = Date.now()) {
  const freq = FREQ.find((f) => f.id === sub.notif.frequencia) || FREQ[0];
  const windowMs = freq.days * 86400000;
  const items = [];
  for (const c of concursos) {
    if (!sub.saved.includes(c.id)) continue;
    const { next } = stageOf(c);
    if (!next) continue;
    const diff = next.t - nowMs;
    if (diff >= 0 && diff <= windowMs) {
      items.push({ c, event: next, days: Math.floor(diff / 86400000) + (diff % 86400000 ? 1 : 0) });
    }
  }
  items.sort((a, b) => a.event.t - b.event.t);
  return { items, freq, windowDays: freq.days };
}

// ---------- notificação local por etapa (Etapa 3) ----------
// Mostra uma notificação do SO quando chega a etapa de um concurso SALVO.
// Não depende de servidor: os alertas aparecem quando o app está aberto
// (o envio real em background com Web Push/VAPID fica documentado no README).
const NOTIFIED_KEY = "caca-prova:notified:v1";
function loadNotified() { try { return JSON.parse(store.get(NOTIFIED_KEY) || "{}"); } catch { return {}; } }
function saveNotified(m) { store.set(NOTIFIED_KEY, JSON.stringify(m)); }
function nkey(id, k, d) { return `${id}|${k}|${d}`; }
function fmtData(d) {
  if (!d) return "";
  const [a, m, dd] = String(d).split("-");
  return `${dd}/${m}/${a}`;
}
function fechaFmt(t) { return fmtData(t); }

export async function notifyUpcoming(concursos, sub, baseUrl = ".") {
  if (!sub.premium || !sub.notif.enabled) return 0;
  if (!("Notification" in window)) return 0;
  if (Notification.permission !== "granted") return 0;
  let reg = null;
  try { if ("serviceWorker" in navigator) reg = await navigator.serviceWorker.getRegistration(); } catch {}
  if (!reg) { try { reg = await navigator.serviceWorker.register("sw.js"); } catch {} }
  if (!reg || !reg.showNotification) return 0;

  const { items } = buildDigest(concursos, sub);
  const shown = loadNotified();
  const today = new Date().toISOString().slice(0, 10);
  let count = 0;
  for (const it of items) {
    const key = nkey(it.c.id, it.event.k, it.event.d);
    if (shown[key] === today) continue; // não repete no mesmo dia
    const opts = {
      tag: `caca-${it.c.id}-${it.event.k}`,
      icon: "icon-192.png",
      badge: "icon-192.png",
      data: { url: `${baseUrl}/index.html#conc=${encodeURIComponent(it.c.id)}` },
      vibrate: [120, 60, 120],
      requireInteraction: false,
    };
    try {
      reg.showNotification(`${it.c.orgao} — ${it.event.label}`, {
        ...opts,
        body: `${fechaFmt(it.event.d)} · vence em ${it.days} dia(s)`,
      });
      shown[key] = today;
      count++;
    } catch {}
  }
  if (count) saveNotified(shown);
  return count;
}
