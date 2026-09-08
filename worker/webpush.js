// ============================================================
//  WORKER / WEBPUSH.JS — Servidor de Push (Etapa 3, em background)
//  Cloudflare Workers (plano gratuito) + KV + VAPID + Cron Trigger.
//
//  RESPONSABILIDADE: guarda a assinatura de push do usuário e envia
//  notificações quando chega a etapa de um concurso SALVO.
//
//  PRIVACIDADE FIRST: o Worker só conhece a *subscription* + uma lista
//  mínima de eventos {titulo, etapa, data}. NUNCA recebe o perfil; a
//  lista de concursos salvos é calculada no aparelho e enviada como
//  "eventos a notificar". (O envio em si é opcional — se preferir 100%
//  local, mantenha apenas as notificações com o app aberto.)
//
//  DEPLOY (grátis):
//    1) npm i -g wrangler
//    2) npx web-push generate-vapid-keys   -> VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY
//    3) wrangler kv namespace create PUSH
//    4) Configure as variáveis/segredos no Dashboard (ou wrangler.toml):
//         VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:suporte@...)
//    5) wrangler deploy
//    6) Cron Trigger: */15 * * * *  (verifica eventos a enviar)
//    7) No app, defina PUSH.endpoint = https://<seu-worker>.workers.dev
// ============================================================

const JSON_HEADERS = { "Content-Type": "application/json" };

// Web Push (requer nodejs_compat no wrangler.toml).
let webpush;
try { webpush = require("web-push"); } catch { webpush = null; }

function keys() {
  const publicKey = env("VAPID_PUBLIC_KEY");
  const privateKey = env("VAPID_PRIVATE_KEY");
  const subject = env("VAPID_SUBJECT", "mailto:suporte@cacaprova.com.br");
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject };
}
function env(k, d) { return globalThis.env && globalThis.env[k] ? globalThis.env[k] : (d || ""); }

// Armazenamento: Cloudflare KV namespace "PUSH".
async function kv() { return globalThis.PUSH; }

export default {
  async fetch(req, env, ctx) {
    globalThis.env = env;
    const url = new URL(req.url);
    const path = url.pathname;

    // Chave pública VAPID (o cliente usa para assinar e receber push).
    if (path === "/keys" && req.method === "GET") {
      const k = keys();
      if (!k) return new Response(JSON.stringify({ error: "VAPID não configurado" }), { status: 500, headers: JSON_HEADERS });
      return new Response(JSON.stringify({ publicKey: k.publicKey }), { headers: JSON_HEADERS });
    }

    // Registra/atualiza a assinatura de push de um usuário.
    if (path === "/subscribe" && req.method === "POST") {
      const body = await req.json();
      if (!body.subscription) return new Response(JSON.stringify({ error: "missing subscription" }), { status: 400, headers: JSON_HEADERS });
      const subId = body.userId || body.subscription.endpoint;
      await (await kv()).put(`sub:${subId}`, JSON.stringify(body.subscription));
      return new Response(JSON.stringify({ ok: true }), { headers: JSON_HEADERS });
    }

    // Agenda eventos a notificar (vindos do aparelho: concursos salvos + etapas).
    if (path === "/schedule" && req.method === "POST") {
      const body = await req.json();
      const subId = body.userId || (body.subscription && body.subscription.endpoint) || "anon";
      const eventos = Array.isArray(body.eventos) ? body.eventos : [];
      const deadline = body.deadline || (Date.now() + 90 * 86400000);
      for (const ev of eventos) {
        const sendAt = new Date(ev.data + "T00:00:00").getTime();
        if (!sendAt || sendAt > deadline) continue;
        const key = `ev:${subId}:${ev.id}:${ev.etapa}`;
        await (await kv()).put(key, JSON.stringify({ subId, ...ev, sendAt, sent: false }), { expirationTtl: 90 * 86400 });
      }
      if (body.subscription) await (await kv()).put(`sub:${subId}`, JSON.stringify(body.subscription));
      return new Response(JSON.stringify({ ok: true, queued: eventos.length }), { headers: JSON_HEADERS });
    }

    // Desassinar.
    if (path === "/unsubscribe" && req.method === "POST") {
      const body = await req.json();
      const subId = body.userId || (body.subscription && body.subscription.endpoint) || "anon";
      await (await kv()).delete(`sub:${subId}`);
      return new Response(JSON.stringify({ ok: true }), { headers: JSON_HEADERS });
    }

    return new Response(JSON.stringify({ ok: true, app: "CAÇA PROVAS push" }), { headers: JSON_HEADERS });
  },

  // Cron Trigger: envia pushs agendados que venceram.
  async scheduled(event, env, ctx) {
    globalThis.env = env;
    const k = keys();
    if (!k || !webpush) return;
    webpush.setVapidDetails(k.subject, k.publicKey, k.privateKey);
    const store = await kv();

    // Broadcast semanal (Seg, 08h BRT = 11h UTC): aviso genérico aos inscritos.
    // Privacidade first: envia só uma notificação genérica, SEM receber o perfil.
    // O perfil/concorrência ficam no aparelho; aqui só avisamos que há novidades.
    if (event && event.cron === "0 11 * * 1") {
      const subs = await store.list({ prefix: "sub:" });
      let sent = 0;
      for (const entry of subs.keys) {
        const sub = JSON.parse((await store.get(entry.name)) || "null");
        if (!sub) continue;
        try {
          await webpush.sendNotification(sub, JSON.stringify({
            title: "🧭 Novos concursos esta semana",
            body: "Atualização semanal do CAÇA PROVAS. Abra o app para ver os concursos que combinam com seu perfil.",
            icon: "icon-192.png",
            data: { url: "./index.html" },
          }));
          sent++;
        } catch (e) {
          // subscription expirada -> remove
          if (/404|410|403/.test(String(e.statusCode || e))) await store.delete(entry.name);
        }
      }
      // Event.ctx.waitUntil não é necessário aqui (não há promises pendentes críticas).
      return;
    }

    const now = Date.now();
    const list = await store.list({ prefix: "ev:" });
    for (const entry of list.keys) {
      const ev = (await store.get(entry.name)) && JSON.parse(await store.get(entry.name));
      if (!ev || ev.sent || ev.sendAt > now) continue;
      const sub = JSON.parse((await store.get(`sub:${ev.subId}`)) || "null");
      if (!sub) { await store.delete(entry.name); continue; }
      try {
        await webpush.sendNotification(sub, JSON.stringify({
          title: `${ev.orgao} — ${ev.etapaLabel}`,
          body: `${ev.data} · ${ev.cargo}`,
          icon: "icon-192.png",
          data: { url: `./index.html#conc=${encodeURIComponent(ev.id)}` },
        }));
        await store.put(entry.name, JSON.stringify({ ...ev, sent: true }));
      } catch (e) {
        // subscription expirada -> remove
        if (/404|410|403/.test(String(e.statusCode || e))) await store.delete(`sub:${ev.subId}`);
      }
    }
  },
};
