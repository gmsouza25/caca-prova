// ============================================================
//  functions/api/pix-create.js — CRIAÇÃO DA COBRANÇA PIX
//  POST /api/pix-create   body: { ref, valor, txid?, payload? }
//
//  O app chama para gerar a cobrança do Premium (R$ 19,90/ano).
//  - Sem gateway real/credenciais => devolve o payload (BR Code) local
//    (mesmo que o app já gera) e status "pending_manual" — piloto.
//  - Com gateway real => cria a cobrança no PSP e devolve o QR dinâmico.
//
//  É um ESQUELETO: os builders abaixo já montam a chamada dos 3 gateways
//  mais comuns; ajuste os endpoints/campos conforme seu PSP e defina as
//  credenciais como segredos no Pages (ver PUBLICAR.md).
//
//  KV binding:  PIX  (opcional, para guardar a referência da cobrança)
// ============================================================

import { json } from "../_lib.js";

// Recria um payload BR Code no servidor (fallback), igual ao do cliente.
function buildPixPayload({ chave, nome, cidade, txid, valor, moeda }) {
  const tl = (id, value) => `${id}${String(value ?? "").length.toString().padStart(2, "0")}${value ?? ""}`;
  const san = (s, max) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9 .()*-]/g, "").slice(0, max);
  const nomeC = san(nome || "CACA PROVAS", 25);
  const cidadeC = san(cidade || "RECIFE", 15);
  const txidC = san(txid || "***", 25);
  const amount = (Number.isFinite(Number(valor)) && Number(valor) > 0) ? Number(valor).toFixed(2) : "";
  const mai = tl("26", tl("00", "br.gov.bcb.pix") + tl("01", chave || ""));
  let p = "000201" + mai + tl("52", "0000") + tl("53", moeda || "986");
  if (amount) p += tl("54", amount);
  p += tl("58", "BR") + tl("59", nomeC) + tl("60", cidadeC) + tl("62", tl("05", txidC));
  const withoutCrc = p + "6304";
  let crc = 0xffff;
  for (let i = 0; i < withoutCrc.length; i++) {
    crc ^= withoutCrc.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return withoutCrc + crc.toString(16).toUpperCase().padStart(4, "0");
}

// ---- builders por gateway (exemplos; ajuste endpoints/campos do seu PSP) ----
async function criarMercadoPago(env, { ref, valor, descricao }) {
  const token = env.MP_ACCESS_TOKEN;
  if (!token) throw new Error("falta MP_ACCESS_TOKEN (secret do Pages)");
  // O MP exige um payer identicável; se não vier o e-mail/CPF do cliente,
  // usamos um identificador neutro (não bloqueia a cobrança PIX).
  const payload = {
    transaction_amount: Number(valor),
    description: descricao || "Assinatura CAÇA PROVAS Premium",
    payment_method_id: "pix",
    external_reference: ref,
    notification_url: env.PIX_WEBHOOK_URL || env.PIX_WEBHOOK_URL_HEROKU || "",
    payer: { email: env.PIX_CLIENT_EMAIL || "cliente@cacaprova.com.br" },
  };
  // Se houver um CPF/CNPJ do cliente configurado, manda indentificar (opcional).
  if (env.PIX_CLIENT_CPF) payload.payer.identification = { type: "CPF", number: env.PIX_CLIENT_CPF };
  const res = await fetch("https://api.mercadopago.com/v1/payments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      // O MP exige um header de idempotência único por requisição (UUID).
      "X-Idempotency-Key": (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID() : (`req-${Date.now()}-${Math.random().toString(36).slice(2)}`),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error("Mercado Pago: HTTP " + res.status + " " + err.slice(0, 200));
  }
  const j = await res.json();
  const td = j.point_of_interaction?.transaction_data || {};
  return {
    modo: "gateway", gateway: "mercadopago",
    id: j.id,                          // payment id (usado p/ conferir no webhook)
    paymentId: j.id,
    external_reference: j.external_reference || ref,
    payload: td.qr_code || "",          // copia-e-cola (BR Code)
    copiaECola: td.qr_code || "",
    qrBase64: td.qr_code_base64 || "",  // imagem PNG em base64 (opcional)
    status: (j.status === "approved") ? "paid" : (j.status === "pending" ? "pending" : j.status),
  };
}

async function criarEfi(env, { ref, valor }) {
  const clientId = env.EFI_CLIENT_ID, clientSecret = env.EFI_CLIENT_SECRET;
  const base = env.EFI_BASE || "https://api.efi.com.br";
  if (!clientId || !clientSecret) throw new Error("faltam EFI_CLIENT_ID/EFI_CLIENT_SECRET");
  // OAuth client_credentials
  const tokenRes = await fetch(`${base}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });
  if (!tokenRes.ok) throw new Error("Efí OAuth: HTTP " + tokenRes.status);
  const tok = await tokenRes.json();
  const res = await fetch(`${base}/v2/cob`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tok.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      calendario: { expiracao: 3600 },
      devedor: { cpf: env.PIX_CLIENT_CPF || "" },
      valor: { original: Number(valor).toFixed(2) },
      chave: env.PIX_CHAVE || "",
      solicitacaoPagador: "Assinatura CAÇA PROVAS Premium",
    }),
  });
  if (!res.ok) throw new Error("Efí cob: HTTP " + res.status);
  const j = await res.json();
  return {
    modo: "gateway", gateway: "gerencianet", id: j.loc?.id || j.txid,
    payload: j.pix_copia_e_cola || "", copiaECola: j.pix_copia_e_cola || "",
    txid: j.txid, status: "pending",
  };
}

async function criarAsas(env, { ref, valor }) {
  const key = env.ASAAS_API_KEY;
  if (!key) throw new Error("falta ASAAS_API_KEY (secret do Pages)");
  const base = env.ASAAS_BASE || "https://api.asaas.com/v3";
  const res = await fetch(`${base}/payments`, {
    method: "POST",
    headers: { access_token: key, "Content-Type": "application/json" },
    body: JSON.stringify({
      customer: env.ASAAS_CUSTOMER || "",
      billingType: "PIX",
      value: Number(valor), externalReference: ref, description: "CAÇA PROVAS Premium",
    }),
  });
  if (!res.ok) throw new Error("Asaas: HTTP " + res.status);
  const j = await res.json();
  const qr = await fetch(`${base}/payments/${j.id}/pixQrCode`, { headers: { access_token: key } });
  const q = qr.ok ? await qr.json() : {};
  return {
    modo: "gateway", gateway: "asas", id: j.id,
    payload: q.encodedImage ? "ver-app-banco" : "", copiaECola: q.payload || "",
    status: j.status === "RECEIVED" ? "paid" : "pending",
  };
}

export async function onRequestPost({ request, env }) {
  let body = {};
  try { body = await request.json(); } catch { return json({ error: "json inválido" }, 400); }
  const ref = body.ref || body.external_reference || String(Date.now());
  const valor = Number(body.valor || env.PIX_VALOR || "19.90");
  const txid = body.txid || "";

  const store = env.PIX;
  const gw = (env.PIX_GATEWAY || "demo").toLowerCase();

  // 1) PILOTO: sem gateway real/credenciais -> payload local.
  let result;
  if (gw === "demo") {
    result = {
      modo: "payload", id: "demo-" + Date.now(), gateway: "demo", status: "pending_manual",
      payload: body.payload || buildPixPayload({ chave: env.PIX_CHAVE, valor, txid, nome: env.PIX_NOME_RECEBEDOR || env.PIX_NOME || "CACA PROVAS", cidade: env.PIX_CIDADE || "RECIFE" }),
    };
  } else {
    try {
      if (gw === "mercadopago") result = await criarMercadoPago(env, { ref, valor, descricao: body.descricao });
      else if (gw === "gerencianet") result = await criarEfi(env, { ref, valor });
      else if (gw === "asas") result = await criarAsas(env, { ref, valor });
      else {
        // gateway custom: espera um backend WO (gatewayUrl) que cria a cobrança.
        if (env.GATEWAY_URL) {
          const r = await fetch(env.GATEWAY_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "criar", valor, txid, ref }) });
          if (!r.ok) throw new Error("gateway custom: HTTP " + r.status);
          result = await r.json();
        } else throw new Error("gateway custom sem GATEWAY_URL");
      }
    } catch (e) {
      // Se o PSP falhar/credencial faltando, NÃO derruba o usuário: cai para payload local.
      result = { ...(await criarDemoLocal(env, body, ref, valor, txid)), erro: String(e.message), modo: "payload" };
    }
  }

  // Guarda no KV: a cobrança por ref e o mapeamento paymentId -> ref (para o
  // webhook do Mercado Pago, que envia só o data.id, casar com a nossa ref).
  if (store) {
    try {
      await store.put(`charge:${ref}`, JSON.stringify({ ...result, valor, at: new Date().toISOString() }));
      if (result.paymentId) {
        await store.put(`mp:${result.paymentId}`, JSON.stringify({ ref, at: new Date().toISOString() }));
      }
    } catch {}
  }

  return json(result);
}

async function criarDemoLocal(env, body, ref, valor, txid) {
  const chave = env.PIX_CHAVE || "";
  const payload = body.payload || buildPixPayload({ chave, valor, txid, nome: env.PIX_NOME_RECEBEDOR || "CACA PROVAS", cidade: env.PIX_CIDADE || "RECIFE" });
  return { modo: "payload", id: "demo-" + Date.now(), gateway: "demo", status: "pending_manual", payload };
}
