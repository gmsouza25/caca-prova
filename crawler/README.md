# 🕷 Crawler — Raspagem semanal (Etapa 2)

Busca, normaliza e deduplica os editais públicos e grava o **acervo central** em
`concursos.json` (na raiz do app) + artefatos de auditoria em `out/`.

## Como rodar

```
cd crawler
npm install          # cheerio (única dependência)
node index.js        # gera ../concursos.json
node index.js --dry-run
node index.js --source=fgv
```

## Fontes (públicas / oficiais)

| Código | Fonte | Estrutura | Observação |
|--------|-------|-----------|-----------|
| `fgv` | FGV Conhecimento | lista de concursos | aceita nosso bot; título descreve o órgão |
| `fcc` | Fundação Carlos Chagas (FCC) | lista na home (lista-only) | **robots.txt** proíbe `/concursos/` e PDFs → não abrimos detalhe; enriquecimento preenche salário/datas |
| `ibade` | IBADE (portal) | cards de editais com órgão + status | ~100 editais; status da seção (abertos/andamento/encerrados); `keepActiveOnly` filtra encerrados |
| `fundatec` | Fundatec | listas "abertos"/"em andamento" + detalhe | extrai **datas de inscrição** no detalhe (mais lenta: ~90s) |
| `idecan` | IDECAN (`www`) | lista na home | usa o link oficial; o portal de detalhe é WAF (bloqueio intermitente) |
| `ifpe` | IFPE | portal "Edital e anexos" | resolve o **PDF do edital** (campo `edital`) |
| `pci` | PCI Concursos | cards (orgão+cargo+salário+data) | **duplo papel**: (1) enriquece os editais oficiais; (2) **fonte** que ADICIONA concursos que as fontes oficiais não cobrem (ex.: bancas WAF-bloqueadas). Link do PCI (agregador), não oficial |

### Fontes avaliadas e NÃO integradas como fonte própria (respeitando cada site)
- **VUNESP, IBFC, Consulplan, Quadrix** → `403`/desafio anti-bot (WAF); não contornamos.
- **CEBRASPE, AOCP** → página é SPA (dados carregados por JS/API); nosso crawler é estático.
- **CESGRANRIO** → `403 "The request is blocked"` (WAF) até no `robots.txt`; porém os concursos dela entram pelo **PCI** (agregador).
- **FAURGS** → lista renderizada via JS (body só CSS).
- **Portais diretos (estado/prefeituras de PE, UPE, etc.)** → instáveis/DNS; aguardamos a Etapa 5 (headless).

> **Legalidade:** respeitamos `robots.txt` (regras por `User-agent`, precedência da regra
> mais específica; `Allow: /` libera), usamos `User-Agent` identificável com contato,
> aplicamos **rate-limit** e rodamos no **horário de menor tráfego**. Quando uma fonte
> bloqueia UA de robô no WAF, mantemos o respeito ao `robots.txt` e ao rate-limit. Fontes
> anti-bot mais rígidas ficam para a Etapa 5 (headless/Workers).

## Pipeline

`fetch (honesto, retries) → parse por fonte → normalização (norm.js) → deduplicação por id
(store.js) → merge com cache → filtro de ativos → concursos.json + schema D1`

- **norm.js** mapeia para o schema do app: escolaridade, áreas, esfera, regime,
  cidade/estado + lat/lng (geocodificação offline com fallback para a capital), datas,
  status, salário/vagas (null quando desconhecido).
- **geo.js** — tabela offline de capitais/cidades; detecta UF por sigla ou nome de estado.
- **parse.js** — extrai órgão/cargo/esfera de títulos das bancas.
- **store.js** — identidade por `id` (estável), hash para auditoria, merge com o crawl
  anterior (marca `stale` o que sumiu), escrita do JSON + schema D1.

## Configuração (`config.js`)

- `cronUtc`: `0 6 * * 6` (sábado 06:00 UTC = 03:00 Recife) — raspagem + Lote 1 de IA.
- `minIntervalMs`: 1000 (rate-limit).
- `maxDetails`: páginas de detalhe para enriquecer datas.
- `keepActiveOnly`: mantém só concursos ativos (descarta inscrições encerradas/concluídos).
