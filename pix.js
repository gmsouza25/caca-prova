// ============================================================
//  PIX.JS — geração do "copia e cola" (BR Code) e do QR Code
//  do CAÇA PROVAS (Premium R$ 19,90/ano).
//  Tudo gerado no dispositivo; a configuração do recebedor vem de
//  config.js (fonte única). Gera o payload padrão BCB (EMV®).
// ============================================================

import { CONFIG } from "./config.js";

// ---- configuração do recebedor (lida de config.js) ----
export const PIX_CONFIG = CONFIG.pix;

// Cria uma cobrança no backend (POST /api/pix-create). Sem gateway real,
// o backend devolve o payload local (piloto). `ref` é a referência estável
// de assinatura (external_reference) para o webhook casar com o pagamento.
export async function criarCobranca(cfg = PIX_CONFIG, ref = "") {
  const payload = buildPixPayload(cfg);
  const base = cfg.criarEndpoint || "/api";
  if (!cfg.gateway || cfg.gateway === "demo") {
    return { modo: "payload", payload, status: "pending_manual", id: "demo-" + Date.now(), ref };
  }
  try {
    const res = await fetch(ensureSlash(base) + "/pix-create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ref: ref || undefined, valor: cfg.valor, txid: cfg.txid, payload }),
    });
    if (!res.ok) throw new Error("gateway PIX: HTTP " + res.status);
    return await res.json();
  } catch (e) {
    // Fallback: se o backend/PSP falhar, mostra o payload local (não quebra o usuário).
    return { modo: "payload", payload, status: "pending_manual", id: "demo-" + Date.now(), ref, erro: String(e.message) };
  }
}

function ensureSlash(s) { return s ? s.replace(/\/$/, "") : ""; }

// Consulta o status de uma cobrança no gateway (GET). Demo => sempre "pending" até confirmar manualmente.
export async function consultarStatus(id, cfg = PIX_CONFIG) {
  if (cfg.gateway === "demo" || !cfg.gatewayUrl) return { id, status: "pending_manual" };
  const res = await fetch(`${cfg.gatewayUrl}?acao=status&id=${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error("gateway PIX: HTTP " + res.status);
  return await res.json();
}

// Verifica se o pagamento já foi confirmado pelo webhook (via backend /api/pix-status).
// Usado pelo botão "Já paguei" para liberar o Premium automaticamente em produção.
export async function consultarConfirmacao(ref, cfg = PIX_CONFIG) {
  const base = cfg.statusEndpoint || "/api";
  try {
    const res = await fetch(`${base}/pix-status?ref=${encodeURIComponent(ref)}`, { method: "GET" });
    if (!res.ok) return { ok: false, status: "pending", premium: false };
    return await res.json();
  } catch {
    return { ok: false, status: "pending", premium: false, offline: true };
  }
}

// ---- CRC16-CCITT (0x1021, init 0xFFFF) — exigido na tag 63 ----
export function crc16(payload) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

// ---- campo TLV: ID + tamanho (2 dígitos) + valor ----
function tl(id, value) {
  const v = String(value ?? "");
  return `${id}${String(v.length).padStart(2, "0")}${v}`;
}

// ---- monta o payload PIX (BR Code) ----
export function buildPixPayload(cfg = PIX_CONFIG) {
  const chave = String(cfg.chave || "");
  const nome = san(cfg.nome || "CACA PROVAS", 25);
  const cidade = san(cfg.cidade || "RECIFE", 15);
  const txid = san(cfg.txid || "***", 25);
  const valor = Number(cfg.valor);
  const amount = (Number.isFinite(valor) && valor > 0) ? (cfg.valor).toFixed(2) : "";

  // 26: Merchant Account Information
  const gui = tl("00", "br.gov.bcb.pix");
  const keyField = tl("01", chave);
  const mai = tl("26", gui + keyField);

  let p = "000201";            // 00: Payload Format Indicator = "01"
  p += mai;                    // 26
  p += tl("52", "0000");       // 52: Merchant Category Code
  p += tl("53", cfg.moeda || "986"); // 53: Moeda
  if (amount) p += tl("54", amount); // 54: Valor
  p += tl("58", "BR");         // 58: País
  p += tl("59", nome);         // 59: Nome do recebedor
  p += tl("60", cidade);       // 60: Cidade
  p += tl("62", tl("05", txid)); // 62: Additional Data (txid)

  // 63: CRC16
  const withoutCrc = p + "6304";
  const crc = crc16(withoutCrc);
  return withoutCrc + crc;
}

function san(s, max) {
  // Limpa e limita, mantendo letras acentuadas, alfanuméricos e os símbolos
  // permitidos no EMV/PIX (inclui '*' usado como txid genérico).
  return String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9 .()*-]/g, "").slice(0, max);
}

// ---- renderiza o QR em SVG a partir do payload ----
// Usa a lib global window.qrcode (lib/qrcode.js, MIT).
export function pixQrSvg(payload, size = 220) {
  const qr = window.qrcode(0, "M"); // auto tipo de dado, correção M
  qr.addData(payload, "Byte");
  qr.make();
  const n = qr.getModuleCount();
  const quiet = 2; // margem de segurança
  const scale = size / (n + quiet * 2);
  let rects = "";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!qr.isDark(r, c)) continue;
      const x = (c + quiet) * scale;
      const y = (r + quiet) * scale;
      rects += `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${Math.ceil(scale)}" height="${Math.ceil(scale)}" />`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="QR Code PIX">
    <rect width="${size}" height="${size}" fill="#ffffff"/>
    <g fill="#0f1226">${rects}</g>
  </svg>`;
}
