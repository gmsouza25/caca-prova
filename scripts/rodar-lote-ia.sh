#!/usr/bin/env bash
# ============================================================
#  scripts/rodar-lote-ia.sh — roda UM lote do enriquecimento por IA
#  (o Gemini gratuito limita a ~20 requisições/dia, então rodamos
#   1 lote por dia; o Lote 1 só roda quando a cota diária renova).
#
#  Uso:
#    LLM_API_KEY=<chave> ./scripts/rodar-lote-ia.sh 1          # dry (gera concursos.llm.json p/ revisar)
#    LLM_API_KEY=<chave> ./scripts/rodar-lote-ia.sh 1 --apply  # aplica no concursos.json
#    ./scripts/rodar-lote-ia.sh 2 --apply
#    ./scripts/rodar-lote-ia.sh 3
#
#  Lote → offset/limit (55 editais no total; respeita a cota de ~20 req/dia do free):
#    1: OFFSET=0  LIMIT=18
#    2: OFFSET=18 LIMIT=18
#    3: OFFSET=36 LIMIT=19
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."

LOTE="${1:-1}"
APPLY="${2:-}"

case "$LOTE" in
  1) OFFSET=0; LIMIT=18 ;;
  2) OFFSET=18; LIMIT=18 ;;
  3) OFFSET=36; LIMIT=19 ;;
  *) echo "Lote inválido: use 1, 2 ou 3."; exit 1 ;;
esac

if [ -z "$(printenv LLM_API_KEY || true)" ] && [ -f .env.llm ]; then
  # arquivo dedicado só da chave Gemini (gitignored). Prioridade: LLM_API_KEY > .env.llm > .env
  set -a; . ./.env.llm; set +a
fi
if [ -z "$(printenv LLM_API_KEY || true)" ]; then
  # tenta carregar do .env (não commitar; fora do deploy)
  if [ -f .env ]; then set -a; . ./.env; set +a; fi
fi
if [ -z "$(printenv LLM_API_KEY || true)" ]; then
  echo "⛔ Faltou LLM_API_KEY. Exporte:  export LLM_API_KEY=<sua chave Gemini>  (ou preencha .env.llm)"
  exit 1
fi

EXTRA=""
[ "$APPLY" == "--apply" ] && EXTRA="--apply"

echo "▶ Lote $LOTE (OFFSET=$OFFSET LIMIT=$LIMIT) ${EXTRA:-(--dry)}"
export LLM_ESTIMATE="${LLM_ESTIMATE:-1}"
LLM_OFFSET="$OFFSET" LLM_LIMIT="$LIMIT" node scripts/llm-enrich.mjs $EXTRA
