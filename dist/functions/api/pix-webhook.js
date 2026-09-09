// ============================================================
//  functions/api/pix-webhook.js — WEBHOOK DE CONFIRMAÇÃO PIX
//  Recebe o aviso do gateway de cobrança quando o pagamento do
//  Premium (R$ 19,90/ano) é confirmado, valida a assinatura,
//  normaliza a carga e grava no KV. O app consulta /api/pix-status
//  para liberar o Premium automaticamente.
//
//  É um ESQUELETO: o normalizador já entende os formatos mais
//  comuns (Mercado Pago, Efí/Gerencianet, Asaas e "custom"), você
//  só ajusta os campos do seu gateway e aponta a URL de notificação
//  para:  https://<seu-app>.pages.dev/api/pix-webhook
//
//  Segurança (configure no Pages):
//    PIX_WEBHOOK_SECRET   segredo compartilhado
//    PIX_WEBHOOK_SIG      "token" (header x-pix-token) ou "hmac"
//                         (HMAC-SHA256 do corpo, header x-pix-signature)
//    PIX_VALOR            valor mínimo p/ liberar (default 19.90)
//    PIX_GATEWAY          "mercadopago" | "gerencianet" | "asas" | "custom"
//  KV binding:  PIX   (crie um namespace e vincule nas Settings do Pages)
// ============================================================

import { json } from "../_lib.js";

// --- chaves candidatas (busca recursiva) para id/ref/valor/status ---
const REF_KEYS = ["external_reference", "externalReference", "custom_id", "customId",
  "referencia", "reference", "ref", "txid", "external_ref"];
const ID_KEYS = ["id", "payment_id", "paymentId", "charge_id", "chargeId", "identificador", "codigo"];
const AMOUNT_KEYS = ["amount", "valor", "value", "total", "valor_total", "amount_value",
  "payment_amount", "valor_final", "transaction_amount", "transactionAmount"];
const STATUS_KEYS = ["status", "fechamento", "situacao", "payment_status", "estado"];

function deepPick(o, names) {
  if (o === null || typeof o !== "object") return undefined;
  for (const k of Object.keys(o)) if (names.includes(k)) return o[k];
  for (const k of Object.keys(o)) {
    const v = o[k];
    if (v && typeof v === "object") {
      const r = deepPick(v, names);
      if (r !== undefined) return r;
    }
  }
  return undefined;
}

function isPaid(raw) {
  const v = String(raw ?? "").toLowerCase().trim().replace(/[\s\-_]/g, "_");
  // Estados que significam pago/confirmado.
  return /^(1|200|paid|pago|concluida|concluido|aprovado|aprovada|aprovacao|received|confirmed|confirmada|approved|success|successfully|ok|identificado)$/.test(v)
    || /\b(paid|pago|aprovado|aprovada|received|confirmed|approved|concluida)\b/.test(v);
}

// Normaliza a carga em {id, ref, amount, statusRaw, event}.
export function normalizarPagamento(body) {
  return {
    id: deepPick(body, ID_KEYS),
    ref: deepPick(body, REF_KEYS),
    amount: Number(deepPick(body, AMOUNT_KEYS) || 0),
    statusRaw: deepPick(body, STATUS_KEYS),
    event: deepPick(body, ["event", "evento", "type", "acao", "action"]),
  };
}

// comparação em tempo constante (evita timing attack no token)
function safeEq(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

// Consulta o status de um pagamento no Mercado Pago (para confirmar de forma
// autoritativa quando o webhook chega sem assinatura, ou por sanitização).
async function mpStatus(token, paymentId) {
  if (!token || !paymentId) return null;
  try {
    const r = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

// HMAC-SHA256 (hex) do corpo usando o segredo, via Web Crypto (sem deps).
async function hmacHex(secret, data) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function autorizado(request, raw, env) {
  const secret = env.PIX_WEBHOOK_SECRET || "";
  if (!secret) return { ok: true, dev: true }; // sem segredo: modo dev (local/teste)
  const mode = (env.PIX_WEBHOOK_SIG || "token").toLowerCase();
  if (mode === "hmac") {
    const header = request.headers.get("x-pix-signature") || "";
    const calc = await hmacHex(secret, raw);
    return safeEq(calc, header) ? { ok: true } : { ok: false, erro: "assinatura inválida" };
  }
  if (mode === "mp") {
    // Assinatura do Mercado Pago: header "x-signature" = "ts=<ts>&v1=<hmac>".
    // HMAC de "id=<data.id>&request-id=<x-request-id>&ts=<ts>".
    const sig = request.headers.get("x-signature") || "";
    const params = new URLSearchParams(sig);
    const ts = params.get("ts") || "";
    const v1 = params.get("v1") || "";
    if (!ts || !v1) return { ok: false, erro: "assinatura MP inválida" };
    let body = {};
    try { body = JSON.parse(raw); } catch { return { ok: false, erro: "json inválido" }; }
    const id = (body && body.data && body.data.id) || (body && body.id) || "";
    const reqId = request.headers.get("x-request-id") || "";
    const payloadString = `id=${id}&request-id=${reqId}&ts=${ts}`;
    const calc = await hmacHex(secret, payloadString);
    return safeEq(calc, v1) ? { ok: true } : { ok: false, erro: "assinatura MP não confere" };
  }
  // token (padrão)
  const token = request.headers.get("x-pix-token") || "";
  return safeEq(token, secret) ? { ok: true } : { ok: false, erro: "token inválido" };
}

export async function onRequestPost({ request, env }) {
  const raw = await request.text();
  let body = {};
  try { body = raw ? JSON.parse(raw) : {}; } catch { return json({ error: "json inválido" }, 400); }

  const auth = await autorizado(request, raw, env);
  const store = env.PIX;
  if (!store) return json({ ok: false, error: "binding KV 'PIX' não configurado no Pages" }, 500);

  // Se a assinatura falhou MAS o gateway é Mercado Pago, ainda podemos confirmar
  // consultando o próprio MP (via Access Token) — evita perder pagamento se o
  // webhook chegar sem x-signature (comum quando a "chave de assinatura" não
  // foi configurada no painel do MP).
  const isMp = (env.PIX_GATEWAY || "").toLowerCase() === "mercadopago";
  let viaApi = null;
  if (!auth.ok && isMp && body && body.data && body.data.id) {
    viaApi = await mpStatus(env.MP_ACCESS_TOKEN, body.data.id);
    if (viaApi && (viaApi.status === "approved" || viaApi.status === "authorized")) {
      // confirmado pelo MP -> segue
    } else {
      return json({ ok: false, error: auth.erro }, 401);
    }
  } else if (!auth.ok) {
    return json({ ok: false, error: auth.erro }, 401);
  }

  const p = normalizarPagamento(body);
  const minAmount = Number(env.PIX_VALOR || "19.90");

  // Mercado Pago: o webhook vem com { action, data:{id} } e SEM external_reference.
  // Recuperamos a nossa ref a partir do payment id (mapeado no /api/pix-create).
  let ref = p.ref;
  // paymentId é o id do pagamento no MP (de body.data.id, se veio por aí).
  const paymentId = (body && body.data && body.data.id) || p.id;
  if (!ref && paymentId) {
    try {
      const mm = await store.get(`mp:${paymentId}`);
      if (mm) ref = (JSON.parse(mm) || {}).ref;
    } catch {}
  }
  if (!ref) ref = paymentId || String(Date.now());

  // Status: se confirmamos via API do MP (assinatura ausente), usa o status do MP.
  let status;
  if (viaApi) {
    const mpApproved = (viaApi.status === "approved" || viaApi.status === "authorized");
    status = mpApproved ? "paid" : "pending";
  } else {
    status = isPaid(p.statusRaw) ? "paid" : "pending";
  }
  // atenção: se o valor vier e for menor que o mínimo, não liberar.
  const amount = viaApi ? (viaApi.transaction_amount || viaApi.transaction_amount || p.amount) : p.amount;
  if (status === "paid" && Number(amount || 0) > 0 && Number(amount) < minAmount) status = "underpaid";

  const rec = {
    ref, id: paymentId || null, status, paid: status === "paid",
    amount: Number(amount || 0) || null, min: minAmount,
    at: new Date().toISOString(), method: "pix",
    gateway: env.PIX_GATEWAY || "custom", event: p.event || null,
  };

  await store.put(`pay:${ref}`, JSON.stringify(rec));
  if (status === "paid") {
    await store.put(`sub:${ref}`, JSON.stringify({
      premium: true, at: rec.at,
      until: new Date(Date.now() + 365 * 86400000).toISOString(),
      valor: (p.amount || minAmount).toFixed(2),
    }));
  }

  // ACK 200 — o gateway não deve reenviar.
  return json({ ok: true, paid: status === "paid", ref });
}

// Alguns gateways fazem um GET de verificação do endpoint; responde "ok".
export async function onRequestGet() {
  return json({ ok: true, app: "CAÇA PROVAS — webhook PIX" });
}
