// functions/api/subscribe.js — registra a assinatura de push do usuário.
import { json, rr, kv } from "../_lib.js";

export async function onRequestPost({ request, env }) {
  const body = await rr(request);
  if (!body.subscription) return json({ error: "missing subscription" }, 400);
  const subId = body.userId || body.subscription.endpoint;
  const store = kv(env, env.KV_PUSH_NAME || "PUSH");
  if (!store) return json({ error: "KV PUSH não configurado" }, 500);
  await store.put(`sub:${subId}`, JSON.stringify(body.subscription));
  return json({ ok: true });
}
