#!/usr/bin/env bash
# ============================================================
#  scripts/rodar-ia-dia.sh — roda UM dia do enriquecimento por IA
#  (cota gratuita = ~20 req/dia para os Flash novos → 1 lote/dia)
#
#  Uso (na raiz do projeto):
#    ./scripts/rodar-ia-dia.sh 2            # --dry  → gera concursos.llm.json p/ REVISAR
#    ./scripts/rodar-ia-dia.sh 2 --apply    # promove o revisado + limpeza + build + deploy
#
#  Lotes:  1  (offset 0,  limit 18)
#          2  (offset 18, limit 18)
#          3  (offset 36, limit 19)
#  Pré-requisitos: .env.llm (chave Gemini) e .env.deploy (token Cloudflare); wrangler@3.112.
#  IMPORTANTE: SEMPRE rode --dry, REVISE o concursos.llm.json e só então --apply.
#  O --apply só promove se o arquivo revisado corresponder AO LOTE pedido (offset+aplicado=false).
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."
LOTE="${1:-}"
MODO="${2:-}"

case "$LOTE" in
  1) OFFSET=0;  LIMIT=18 ;;
  2) OFFSET=18; LIMIT=18 ;;
  3) OFFSET=36; LIMIT=19 ;;
  *) echo "⛔ Lote inválido. Use 1, 2 ou 3."; exit 1 ;;
esac

# carrega segredos
set -a
[ -f .env.llm ]  && . ./.env.llm
[ -f .env ]      && . ./.env
[ -f .env.deploy ] && . ./.env.deploy
set +a

[ -n "${LLM_API_KEY:-}" ] || { echo "⛔ Faltou LLM_API_KEY (.env.llm)."; exit 1; }
[ -n "${CLOUDFLARE_API_TOKEN:-}" ] || { echo "⛔ Faltou CLOUDFLARE_API_TOKEN (.env.deploy)."; exit 1; }
[ -n "${CLOUDFLARE_ACCOUNT_ID:-}" ] || { echo "⛔ Faltou CLOUDFLARE_ACCOUNT_ID (.env.deploy)."; exit 1; }

export LLM_ESTIMATE=1
export LLM_OFFSET=$OFFSET
export LLM_LIMIT=$LIMIT

if [ "$MODO" == "--apply" ]; then
  valid=$(OFFSET=$OFFSET node -e '
    const j=require("./concursos.llm.json");
    const ok = j.llm && j.llm.aplicado===false && Number(j.llm.offset)===Number(process.env.OFFSET);
    process.stdout.write(ok ? "true" : "false");
  ' 2>/dev/null || echo "false")
  if [ "$valid" != "true" ]; then
    echo "⛔ concursos.llm.json não é um 'a revisar' pendente para o Lote $LOTE (offset $OFFSET)."
    echo "   Rode primeiro:  ./scripts/rodar-ia-dia.sh $LOTE  (--dry)  e revise antes de --apply."
    exit 1
  fi
  echo "▶ Lote $LOTE: promovendo revisão + limpeza + build + deploy…"
  node scripts/llm-enrich.mjs --apply
  node scripts/limpar-dados.mjs concursos.json --limpar-repetidos --apply >/dev/null 2>&1
  node scripts/build-config.mjs
  node scripts/build-pages.mjs
  ./node_modules/.bin/wrangler pages deploy dist --project-name="caca-prova" --branch main --commit-dirty=true
  echo ""
  echo "✅ Lote $LOTE aplicado + publicado. Confira: https://caca-prova.pages.dev"
else
  echo "▶ [--dry] Lote $LOTE (OFFSET=$OFFSET LIMIT=$LIMIT) → concursos.llm.json"
  node scripts/llm-enrich.mjs --dry
  echo ""
  echo "   ⚠️  REVISE o concursos.llm.json e rode:  ./scripts/rodar-ia-dia.sh $LOTE --apply"
fi
