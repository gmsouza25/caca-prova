// functions/api/schedule.js — agenda os eventos das etapas dos concursos salvos.
import { json, rr, kv } from "../_lib.js";

const WINDOW_MS = 90 * 86400000; // 90 dias

export async function onRequestPost({ request, env }) {
  const body = await rr(request);
  const store = kv(env, env.KV_PUSH_NAME || "PUSH");
  if (!store) return json({ error: "KV PUSH não configurado" }, 500);
  const subId = body.userId || (body.subscription && body.subscription.endpoint) || "anon";
  const eventos = Array.isArray(body.eventos) ? body.eventos : [];
  const deadline = body.deadline || (Date.now() + WINDOW_MS);
  let queued = 0;
  for (const ev of eventos) {
    const sendAt = new Date(ev.data + "T00:00:00").getTime();
    if (!sendAt || sendAt > deadline) continue;
    const key = `ev:${subId}:${ev.id}:${ev.etapa}`;
    await store.put(key, JSON.stringify({ subId, ...ev, sendAt, sent: false }), { expirationTtl: Math.floor(WINDOW_MS / 1000) });
    queued++;
  }
  if (body.subscription) await store.put(`sub:${subId}`, JSON.stringify(body.subscription));
  return json({ ok: true, queued });
}
