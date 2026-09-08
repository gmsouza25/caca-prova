// functions/api/keys.js — expõe a chave pública VAPID para o cliente assinar.
export async function onRequestGet({ env }) {
  const pub = env.VAPID_PUBLIC_KEY || "";
  if (!pub) return new Response(JSON.stringify({ publicKey: "" }), { status: 200, headers: { "Content-Type": "application/json" } });
  return new Response(JSON.stringify({ publicKey: pub }), { headers: { "Content-Type": "application/json" } });
}
