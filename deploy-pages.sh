#!/usr/bin/env bash
# ============================================================
#  deploy-pages.sh — publica o CAÇA PROVAS no Cloudflare Pages
#  (via CLI Wrangler, mais simples que arrastar no painel).
#
#  Antes de rodar:
#    1) npm i -g wrangler          (ou use npx wrangler)
#    2) wrangler login              (abre o navegador para autenticar)
#    3) Crie os namespaces KV (uma vez) e cole os IDs no dashboard:
#         npx wrangler kv namespace create PUSH
#         npx wrangler kv namespace create PIX
#         npx wrangler kv namespace create SUPPORT
#       Depois, no Pages > projeto > Settings > Bindings, vincule:
#         PUSH / PIX / SUPPORT  (KV)  com os IDs criados.
#
#  Variáveis de ambiente (defina todas; senão usa o valor já no config.js):
#    PIX_CHAVE, PIX_NOME_RECEBEDOR, EMAIL_PUBLICO, EMAIL_DESTINO,
#    PUSH_USE_FUNCTIONS, PUSH_PUBLIC_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
#    PIX_WEBHOOK_SECRET, PIX_VALOR, PIX_GATEWAY, FEEDBACK_ENDPOINT, ...
#
#  Uso:
#    ./deploy-pages.sh                 # usa o que estiver no ambiente
#    PIX_CHAVE=033... ./deploy-pages.sh
# ============================================================
set -euo pipefail

cd "$(dirname "$0")"

echo "▶ Carregando .env (se existir)…"
if [ -f .env ]; then
  set -a; . ./.env; set +a
  echo "   .env carregado."
fi

echo "▶ Injetando segredos no config.js (build-config.mjs)…"
node scripts/build-config.mjs

echo "▶ Gerando o dist/ (só o que vai pro ar; SEM .env/worker/crawler/scripts/docs)…"
node scripts/build-pages.mjs

echo "▶ Publicando o dist/ no Cloudflare Pages…"
# Publica o `dist/` (não a raiz). O Wrangler detecta `dist/functions/` e sobe
# junto as Pages Functions (/api/...). Publicar a raiz subiria TUDO (segredos).
npx wrangler pages deploy dist --project-name="caca-prova" --commit-dirty=true

echo "✅ Deploy enviado! A URL do projeto aparece acima (ex.: https://caca-prova.pages.dev)"
echo "   Depois conecte o domínio:  Cloudflare > Workers & Pages > caca-prova > Custom domains"
echo "   > adicione  cacaprova.com.br"
