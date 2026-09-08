#!/usr/bin/env node
// worker/generate-vapid.mjs — gera o par de chaves VAPID para o push (uma vez).
// Uso:  node generate-vapid.mjs   (depende de `web-push` instalado em worker/)
// Depois: coloque VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY como segredos no Cloudflare.
import webpush from "web-push";

const v = webpush.generateVAPIDKeys();
console.log("=== Chaves VAPID (guarde em local seguro) ===");
console.log("VAPID_PUBLIC_KEY =", v.publicKey);
console.log("VAPID_PRIVATE_KEY =", v.privateKey);
console.log("\nEx.:");
console.log("wrangler secret put VAPID_PUBLIC_KEY");
console.log("wrangler secret put VAPID_PRIVATE_KEY");
