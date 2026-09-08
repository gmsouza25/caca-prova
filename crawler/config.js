// config.js — configuração do crawler. Horário/periodicidade e regras de polidez.
// A raspagem é SEMANAL e agendada no horário de menor tráfego (ver .github/workflows).
module.exports = {
  // Fuso do usuário (Recife/PE): America/Recife = UTC-3
  timezone: "America/Recife",
  // Cron do GitHub Actions (UTC). 06:00 UTC = 03:00 AM em Recife (madrugada).
  // Sábado = raspagem + Lote 1 (LLM). Domingo = Lote 2. Segunda = Lote 3.
  // Ver .github/workflows/semana-ia.yml.
  cronUtc: "0 6 * * 6",
  // Checagem diária leve apenas para detectar se uma fonte ficou fora do ar (não raspa).
  cronDailyUtc: "0 12 * * *",
  schedule: "semanal",
  // Prioridade das fontes (a primeira vence em caso de duplicata).
  order: ["fgv", "fundatec", "idecan", "ifpe"],
  // Polidez: intervalo mínimo entre requisições (ms). 1000ms ~ 60 req/min.
  minIntervalMs: 1000,
  userAgent:
    "CacaProvaBot/1.0 (+https://cacaprova.com.br; raspagem semanal de editais publicos; contato: contato@cacaprova.com.br)",
  // Limite de itens por fonte (0 = sem limite). Útil em testes e para não estourar.
  limitPerSource: 0,
  // Máximo de páginas de detalhe para enriquecer datas (0 = só listas).
  maxDetails: 60,
  // Mantém só concursos "ativos" no acervo central (descarta inscrições encerradas/concluídos).
  keepActiveOnly: true,
  // Enriquecimento com o PCI Concursos (preenche salário/vagas/escolaridade/data
  // dos editais oficiais, mantendo o link oficial). Desative com enrichPci:false.
  enrichPci: true,
  outFile: "concursos.json",
};
