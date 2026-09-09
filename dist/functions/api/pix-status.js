// ============================================================
//  functions/api/pix-status.js — STATUS DA COBRANÇA
//  GET /api/pix-status?ref=<referencia>
//  O app chama isso no "Já paguei" (e/ou por polling) para saber se
//  o webhook do gateway já confirmou o pagamento. Se paid/premium,
//  o app libera o acesso Premium automaticamente.
//
//  KV binding:  PIX
// ============================================================

import { json, kv } from "../_lib.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const ref = url.searchParams.get("ref") || "";
  if (!ref) return json({ ok: false, error: "missing ref" }, 400);

  const store = kv(env, env.KV_PIX_NAME || "PIX");
  if (!store) return json({ ok: true, status: "unknown", premium: false, detalhe: "KV PIX não configurado" });

  let rec = null;
  try {
    const raw = await store.get(`pay:${ref}`);
    if (raw) rec = JSON.parse(raw);
  } catch { rec = null; }

  const paid = !!(rec && rec.status === "paid");
  return json({
    ok: true,
    ref,
    status: rec ? rec.status : "pending",   // pending | paid | underpaid
    paid,
    premium: paid,
    valor: rec && rec.amount ? rec.amount : null,
    at: rec ? rec.at : null,
  });
}
