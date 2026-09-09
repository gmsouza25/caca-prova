// ============================================================
//  PUSH.JS — cliente de notificações PUSH em background (Web Push)
//  Assina a assinatura de push e agenda os eventos das etapas dos
//  concursos SALVOS para o servidor enviar quando for a hora.
//
//  Dois modos:
//   - useFunctions=true  => usa as Pages Functions no MESMO domínio
//                           (rotas /api/keys, /api/subscribe, /api/schedule...)
//   - useFunctions=false => usa um Worker externo (PUSH.endpoint, full URL),
//                           ex.: https://caca-prova-push.<sub>.workers.dev
//  Sem nada configurado, as funções retornam false sem quebrar nada
//  (o app continua com as notificações locais quando aberto).
// ============================================================

import { CONFIG } from "./config.js";

export const PUSH = {
  enabled: false,                      // true quando o usuário ativa notificações
  useFunctions: !!CONFIG.push.useFunctions, // Pages Functions no mesmo domínio
  endpoint: CONFIG.push.endpoint || "",     // Worker externo (se useFunctions=false)
  publicKey: CONFIG.push.publicKey || "",
};

// Raiz das rotas do servidor de push.
function base() {
  return PUSH.useFunctions ? "/api" : (PUSH.endpoint || "");
}
function url(path) {
  const b = base();
  return b ? `${b}${path}` : "";
}

export function pushSupported() {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  return PUSH.useFunctions || !!PUSH.endpoint;
}

export async function carregarChave() {
  if (!pushSupported()) return null;
  try {
    const r = await fetch(url("/keys"));
    const j = await r.json();
    if (j.publicKey) { PUSH.publicKey = j.publicKey; return j.publicKey; }
  } catch {}
  return null;
}

function b64urlToUint8(s) {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const str = atob(b64);
  const arr = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) arr[i] = str.charCodeAt(i);
  return arr;
}

export async function ativarPush(userId) {
  if (!pushSupported()) return null;
  if (Notification.permission !== "granted") {
    const p = await Notification.requestPermission();
    if (p !== "granted") return null;
  }
  const key = PUSH.publicKey || await carregarChave();
  if (!key) return null;
  const reg = await navigator.serviceWorker.register("sw.js");
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64urlToUint8(key) });
  }
  try {
    await fetch(url("/subscribe"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, subscription: sub.toJSON() }) });
  } catch {}
  return sub;
}

export async function agendarEventos(userId, eventos, sub) {
  if (!pushSupported() || !sub) return 0;
  try {
    const res = await fetch(url("/schedule"), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, subscription: sub.toJSON(), eventos, deadline: Date.now() + 90 * 86400000 }),
    });
    const j = await res.json();
    return (j && j.queued) || 0;
  } catch { return 0; }
}

export async function desativarPush(userId, sub) {
  try {
    await fetch(url("/unsubscribe"), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, subscription: sub && sub.toJSON ? sub.toJSON() : null }),
    });
  } catch {}
}
