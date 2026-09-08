// functions/api/unsubscribe.js — remove a assinatura de push.
import { json, rr, kv } from "../_lib.js";

export async function onRequestPost({ request, env }) {
  const body = await rr(request);
  const store = kv(env, env.KV_PUSH_NAME || "PUSH");
  if (!store) return json({ error: "KV PUSH não configurado" }, 500);
  const subId = body.userId || (body.subscription && body.subscription.endpoint) || "anon";
  await store.delete(`sub:${subId}`);
  return json({ ok: true });
}
