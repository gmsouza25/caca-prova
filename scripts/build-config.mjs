#!/usr/bin/env node
// scripts/build-config.mjs — INJEÇÃO DE SEGREDOS no build (produção).
//
// Lê variáveis de ambiente e substitui os campos marcados com [SECRET:XXX]
// no config.js. Assim você monta a chave PIX / e-mail / gateway / push no
// deploy SEM commitar o valor no GitHub.
//
// Como usar (local ou no build do Cloudflare Pages):
//   PIX_CHAVE=03386809502 node scripts/build-config.mjs
//   PIX_CHAVE=... EMAIL_DESTINO=... node scripts/build-config.mjs
//
// Se uma env var não estiver definida, o valor atual do config.js é mantido.
// Reescrito linha a linha (seguro): só troca o conteúdo entre aspas (ou o
// booleano) da LINHA que contém o marcador [SECRET:<TOKEN>] no final.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, "..", "config.js");

// Mapeia env var -> marcador [SECRET:...]
// Suporta alias (ex.: .env usa PIX_GATEWAY, mas config.js marca [SECRET:GATEWAY_MODE]).
const MAP = {
  PIX_CHAVE: "PIX_CHAVE",
  PIX_NOME_RECEBEDOR: "PIX_NOME_RECEBEDOR",
  GATEWAY_MODE: "GATEWAY_MODE",
  GATEWAY_URL: "GATEWAY_URL",
  PIX_STATUS_ENDPOINT: "PIX_STATUS_ENDPOINT",
  PIX_CRIAR_ENDPOINT: "PIX_CRIAR_ENDPOINT",
  EMAIL_PUBLICO: "EMAIL_PUBLICO",
  EMAIL_DESTINO: "EMAIL_DESTINO",
  FEEDBACK_ENDPOINT: "FEEDBACK_ENDPOINT",
  PUSH_ENDPOINT: "PUSH_ENDPOINT",
  PUSH_PUBLIC_KEY: "PUSH_PUBLIC_KEY",
  PUSH_USE_FUNCTIONS: "PUSH_USE_FUNCTIONS",
  PIX_NOME: "PIX_NOME",
  PIX_VALOR: "PIX_VALOR",
};

// Nomes de env alternativos por token (a ordem é a prioridade; pepgar o primeiro presente).
const ALIASES = {
  GATEWAY_MODE: ["GATEWAY_MODE", "PIX_GATEWAY"],
  PIX_VALOR: ["PIX_VALOR"],
  PIX_CHAVE: ["PIX_CHAVE"],
  EMAIL_PUBLICO: ["EMAIL_PUBLICO"],
  EMAIL_DESTINO: ["EMAIL_DESTINO"],
  PUSH_USE_FUNCTIONS: ["PUSH_USE_FUNCTIONS"],
};

function envVal(token) {
  const list = ALIASES[token] || [token];
  for (const name of list) {
    const v = process.env[name];
    if (v !== undefined && v !== "") return v;
  }
  return process.env[token];
}

let src = readFileSync(CONFIG_PATH, "utf8");
let changed = 0;
const lines = src.split("\n");

for (const [env, token] of Object.entries(MAP)) {
  const val = envVal(token);
  if (!val) continue;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // A linha exata que tem o marcador [SECRET:<token>] no FIM.
    if (!line.trimEnd().includes(`[SECRET:${token}]`)) continue;

    // Captura a parte do valor entre aspas (primeiro par de aspas na linha).
    const qm = line.match(/^(\s*[^:]+:\s*)(["'])([^"']*)(["'])(.*)$/);
    if (qm) {
      const [, pre, q1, , q2, tail] = qm;
      lines[i] = `${pre}${q1}${val.replace(/"/g, '\\"')}${q2}${tail}`;
      changed++;
      continue;
    }
    // Valor booleano/número sem aspas (ex.: useFunctions: true, gateway...).
    const bm = line.match(/^(\s*[^:]+:\s*)(true|false|\d+(?:\.\d+)?)(\s*(?:,|\)|\n).*)$/);
    if (bm) {
      const bool = /^(1|true)$/i.test(val) ? "true" : (/^(0|false)$/i.test(val) ? "false" : val);
      lines[i] = `${bm[1]}${bool}${bm[3]}`;
      changed++;
      continue;
    }
  }
}

writeFileSync(CONFIG_PATH, lines.join("\n"), "utf8");
console.log(`✅ build-config: ${changed} segredo(s) injetado(s) em config.js`);
if (!changed) console.log("   (defina PIX_CHAVE, GATEWAY_URL, EMAIL_DESTINO, PUSH_ENDPOINT etc. para injetar)");
