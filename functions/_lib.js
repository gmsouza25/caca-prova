// functions/_lib.js — helpers para as Pages Functions (Cloudflare Pages).
// Cada Function recebe { request, env }. O binding KV "PUSH" guarda as
// assinaturas de push; o binding KV "SUPPORT" (opcional) guarda relatos.

export const JSON_HEADERS = { "Content-Type": "application/json" };

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

export async function rr(req) {
  try { return await req.json(); } catch { return {}; }
}

// Retorna o namespace KV (definido em env.KV_PUSH nas Secrets/vars do Pages).
export function kv(env, binding) {
  return env[binding];
}

// Pequeno envio de Web Push reutilizável: usa o endpoint público do Push Service
// (fcm.googleapis.com ou updates.push.services.mozilla.com). A assinatura VAPID
// é gerada com crypto (Works com nodejs_compat). Para simplicidade no piloto,
// quem envia em background é o Cron do Worker (ver worker/webpush.js); estas
// Functions APENAS armazenam assinaturas e eventos.
export function vapidKeys(env) {
  return { publicKey: env.VAPID_PUBLIC_KEY || "", privateKey: env.VAPID_PRIVATE_KEY || "", subject: env.VAPID_SUBJECT || "mailto:suporte@cacaprova.com.br" };
}
