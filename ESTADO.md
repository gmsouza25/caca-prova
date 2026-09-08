# 📌 CAÇA PROVAS — Estado do projeto

> Documento de retomada. Este arquivo diz **onde paramos** e **o que falta**.
> Atualizado em **29/08/2026**. O código-fonte é a fonte da verdade.

> 🟢 **APP PUBLICADO E NO AR** em **`https://cacaprova.com.br`** (Cloudflare Pages,
> domínio próprio já apontando, HTTPS ativo).
> - **Domínio** `cacaprova.com.br` conectado ao Pages ✅ (`custom domain` ativo, HTTP 200).
> - **Email Routing ativo** ✅: `suporte@cacaprova.com.br` → encaminha → `gmsouza25@gmail.com`
>   (SPF `v=spf1 include:_spf.mx.cloudflare.net ~all`, MX Cloudflare, DKIM presente, DMARC `p=reject`).
> - **Pages Functions** `/api/...` ativas com KV bindings `PUSH`/`PIX`/`SUPPORT` vinculados.
> **Restam:** teste real de entrega de e-mail (enviar p/ `suporte@` e ver no Gmail) — que depende
> de você; e opcionalmente configurar `RESEND_API_KEY` p/ envio automático do relato.

---

## 🚀 Resumo do produto

App **PWA** para concurseiros. O usuário monta/importa o perfil (localmente) e o app
calcula o **índice de compatibilidade** de cada concurso público, com **notificações
por etapa** e **Premium (PIX R$ 19,90/ano)**. Base de editais **centralizada**
(raspagem semanal de fontes públicas). **Perfil nunca sai do aparelho.**

**Plataformas:** PWA (instalável, offline). **Custo:** máximo de recursos gratuitos.

---

## ✅ O que está PRONTO e validado

### Etapa 1 — MVP (base)
- Perfil manual **ou** import de PDF do LinkedIn (pdf.js local, offline) — editável.
- Perfil guardado **só no aparelho** (localStorage).
- Match por compatibilidade (score 0–100), proximidade (geo offline) e salário.
- Termos/Responsabilidade com **gate** bloqueando o app até "de acordo".
- Diferenciação **Free** (10 melhores) vs **Premium** (ilimitado) **de verdade**:
  filtros avançados, salvos (favoritos), alertas por etapa, notificações (semanal/mensal/trimestral).

### Etapa 2 — Raspagem real
- **4 fontes públicas**: FGV, Fundatec, IDECAN, **IFPE**.
- Normalização honesta (nulls exibem "a definir"; nunca chutar), geo offline,
  filtro de ativos. **`concursos.json` = 55 editais** (Federal 10 · Estadual 20 · Municipal 25).
- Cron semanal (GitHub Actions) em `.github/workflows/scrape.yml` + checagem diária.

### Motor de compatibilidade (re-escrito)
- **NEUTRO = 70** para dado ausente (não reprova por falta de salário/escolaridade/etc.).
- `confianca` por campo; `eligible=true` quando escolaridade desconhecida.
- **Validado e2e no navegador:** 0 NaN, 0 fora de 0–100.

### Etapa 3 — Notificações
- **Local (app aberto):** alertas por etapa dos concursos salvos, deep-link abre o edital
  em **modo foco**.
- **Background (Web Push):** Worker Cloudflare pronto (`worker/webpush.js` + `push.js`),
  deploy grátis documentado em `worker/README.md`.

### Etapa 4 — PIX
- `pix.js` gera **payload PIX (BR Code/EMV)** + QR (lib MIT offline) + **gateway**: `criarCobranca()`/`consultarStatus()`.
- **Gateway real:** preencher `gatewayUrl` + trocar `gateway:"demo"`. Webhook libera o Premium.
- Fluxo demo "Já paguei" libera Premium. **Validado no navegador** (QR + copia-e-cola 131 chars, CRC válido).

### Identidade visual
- **Ícone novo** (mira + lupa + check) aplicado em todo o app (SVG inline) — header, hero, nav, termos, offline.
- **Paleta coerente**: azul-escuro profundo + **verde-esmeralda** (marca) + **teal** (labels) + **dourado** (Premium).

### Suporte / Contato
- **`config.js`** = configuração central (e-mail com portabilidade, PIX, push, relato).
- Tela **"🛠️ Relatar problema"** (8 categorias) → envia por e-mail + **auto-resposta** de confirmação.

---

## 🎨 Esquema de cores (paleta final)

| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#0b1120` | fundo |
| `--bg2` | `#101a33` | modal / gradação |
| `--card` | `#16203d` | cards |
| `--card2` | `#1d2a4f` | inputs / secundário |
| `--line` | `#2a3a63` | bordas |
| `--text` | `#eef2ff` / `--muted #94a2c8` | texto |
| `--accent` | `#22c55e` / `--accent2 #4ade80` | **marca (verde)** |
| `--blue` | `#2dd4bf` | labels de esfera (teal) |
| `--accent-deep` | `#16a34a` | hover |
| `--amber`/`--premium` | `#f5b301` | Premium / favoritos (dourado) |
| `--red` | `#ef4444` | erros |

---

## 🗂 Arquivos importantes

| Arquivo | Função |
|---|---|
| `config.js` | **Edite aqui**: e-mail (portabilidade), PIX, push, feedback, segredos `[SECRET:...]` |
| `concursos.json` | Acervo central (raspagem) — fonte da verdade |
| `app.js` | Interface/lógica |
| `match.js` | Motor de compatibilidade (NEUTRO=70) |
| `premium.js` / `pix.js` / `feedback.js` / `push.js` | Premium · PIX · Relato · Push |
| `crawler/` | Pipeline de raspagem (4 fontes) |
| `scripts/build-config.mjs` | **Injeta segredos** no build (não commitar chave/e-mail) |
| `worker/webpush.js` | Worker Cloudflare de push (cron) |
| `functions/` | **Pages Functions** (`/api/keys`, `/subscribe`, `/schedule`, `/unsubscribe`, `/feedback`) |
| `_headers` | Cabeçalhos de segurança/cache (Cloudflare Pages) |
| `PUBLICAR.md` | **Guia de publicação** (Etapa 5+7, Cloudflare Pages) |
| `INSTALACAO.md` | Instalar, confiar (SHA-256), **portabilidade de e-mail** |
| `fingerprints.json` | Hashes SHA-256 (verificação anti-adulteração) |

---

## 📋 Configuração de produto (a fazer por você)

Tudo em `config.js` (o app **já funciona** com os valores de exemplo; só substituir):

1. **E-mail (portabilidade):** `email.publico` (já `suporte@cacaprova.com.br`) e
   `email.destino` (já `gmsouza25@gmail.com`, **oculto**). Configurar o reencaminhamento
   no **Cloudflare Email Routing** (passo a passo em `INSTALACAO.md`).
   - ⚠️ A **auto-resposta** de agradecimento precisa de: auto-responder do Gmail **ou**
     endpoint Apps Script (código pronto em `feedback.js`).
2. **PIX:** `pix.chave` (chave real) e, para cobrança automática, `pix.gatewayUrl` +
   `pix.gateway` (Mercado Pago/Gerencianet/Asas/custom).
3. **Push em background:** publicar o Worker (`worker/README.md`) e setar `push.endpoint`.
   Sem isso, notifica só com o app aberto (ainda funcional).
4. **Relato:** `feedback.endpoint` (opcional; sem ele usa `mailto:`).

---

## ✅ Recém-implementado (28/08/2026)

- **Segredos para não commitar a chave:** `scripts/build-config.mjs` injeta `PIX_CHAVE`,
  `EMAIL_DESTINO`, `PUSH_USE_FUNCTIONS` etc. no build (campos `[SECRET:...]` do `config.js`).
- **Tela PIX:** mostra o nome do recebedor (`nomeRecebedor`, fallback `nome`) e aviso
  de **confirmação manual no piloto** (vs. automática com gateway). Chave CPF registrada.
- **Kit de publicação (Etapa 5+7):** `PUBLICAR.md` (passo a passo Cloudflare Pages),
  `_headers` (segurança/cache), e `functions/api/*.js` (keys/subscribe/schedule/unsubscribe/feedback).
  Push e relato passam a funcionar **no mesmo domínio** (`/api/...`) ao publicar.
- **Worker de push com Cron:** `worker/wrangler.toml` (KV + VAPID + cron `*/15`),
  `worker/package.json` + `worker/generate-vapid.mjs` para gerar o par de chaves.
- **PCI Concursos (enriquecimento de dados):** `crawler/sources/pci.js` + `crawler/enrich.js`.
  Lê os cards públicos (`.`ca/.cd/.ce`) e **preenche os nulos** dos editais oficiais
  (salário/vagas/escolaridade/data), **mantendo o link oficial**. Não copia conteúdo
  editorial nem usa o link do PCI (agregador comercial → só fatos públicos).
  Acervo atual: **55 editais**, `salário 0→32`, `vagas 0→26`, `escolaridade 19→33`,
  `data fechamento 6→29`, **links oficiais mantidos**.
  - Integrado ao `index.js` (enriquecimento automático no crawl, `enrichPci:true`)
    e disponível **sem re-raspar** via `node crawler/index.js --enrich-only`
    (agora com `try/catch` — se o PCI cair, o crawl/CI **não quebra**; idempotente).
- **Ajustes de pendências (28/08/2026):**
  - **`functions/api/feedback.js`:** corrigido o `reply_to`/auto-resposta para usar
    `_replyto` (e-mail real do usuário) em vez de `body.email` (que é o endereço
    público do suporte). Testado em 3 cenários (com/sem `_replyto`).
  - **Push:** fluxo validado de ponta a ponta (`/api/keys` → assinatura → `/api/subscribe`).
    Deixado claro o **gap** no modo `useFunctions=true`: o site **registra** no KV, mas
    quem **envia** é o cron do Worker → o namespace `PUSH` precisa ser o **mesmo** nos
    dois. Recomendado o **Worker como backend único** (`useFunctions=false` +
    `PUSH.endpoint`), documentado em `PUBLICAR.md` e `worker/README.md`.
  - **CI (`scrape.yml`):** passo extra `--enrich-only` (safety net) após o crawl;
    enriquecimento resiliente (não derruba o workflow se o PCI falhar).
  - **Webhook de confirmação PIX (esqueleto):** `functions/api/pix-webhook.js` (valida
    token/assinatura HMAC + segredo, normaliza Mercado Pago/Efí/Asaas/custom, grava em
    KV `PIX`) e `functions/api/pix-status.js` (o app consulta para liberar o Premium).
    No piloto (`gateway:"demo"`) segue manual; em produção o gateway confirma sozinho.
    Adicionados `config.js`→`pix.statusEndpoint` (`[SECRET:PIX_STATUS_ENDPOINT]`) e o
    passo correspondente no `build-config.mjs`. Testado com os 3 formatos de gateway
    + token inválido (401) + valor abaixo do mínimo (underpaid).
  - **Criação da cobrança PIX (esqueleto):** `functions/api/pix-create.js` cria a cobrança
    (`POST /api/pix-create`). Sem gateway/credencial, cai para payload local;
    com gateway, gera QR dinâmico (builders Mercado Pago/Efí/Asaas/custom). Cliente
    `pix.js`→`criarCobranca()` aponta para `/api/pix-create`; `mostrarPix` tenta o backend
    em produção (fallback local). `config.js`→`pix.criarEndpoint` (`[SECRET:PIX_CRIAR_ENDPOINT]`).
    Testado: piloto + credencial faltando (fallback com erro claro).

## ⏭️ Próximos passos sugeridos

> 🎉 **Etapas 5, 7 e 8 CONCLUÍDAS** — app publicado no Cloudflare Pages (domínio próprio),
> e-mail configurado, e **monetização via Mercado Pago operacional** (pagamento real confirmado).

**O projeto está no ar e cobrando.** O que resta são **decisões/târefas**:

1. **‼️ SEGURANÇA — vazamento de `.env` no site** — `cacaprova.com.br/.env` estava servindo os
   segredos (o `wrangler pages deploy .` sobe a raiz TUDO, e `.pagesignore` NÃO é respeitado no
   upload direto). **CORRIGIDO (30/08):** o deploy passou a publicar apenas o `dist/`
   (`scripts/build-pages.mjs`) — só o app + `functions/`, sem `.env`/`worker/`/`crawler/`/docs.
   A origem (`caca-prova.pages.dev`) já está limpa. **AÇÃO RESTANTE (você):** purgar o cache do
   domínio `cacaprova.com.br` (Cloudflare → zona → Caching → Purge Everything) — o cache de borda
   ainda serve a cópia antiga do `.env`/`config demo` até ser purgado (não tenho permissão de
   zona com o token Workers).
2. **Publicar os fixes locais (não publicados ainda):**
   - **Busca por cidade** (bug Recife fixo) → novo `geo.js` + `salvarCidade` com fallback por UF.
   - **Acervo enriquecido** → `scripts/enrich-concursos.mjs` (nacionais/cargo/cidade) + filtro por IA no app.
   - **Revalidação de licença** → `premium.js:revalidarPremium` (roda quando gateway real).
3. **Gateway PIX real (decidir/fazer)** — com `GATEWAY_MODE=mercadopago` o cliente passa a criar
   cobrança real e conferir via `/api/pix-status` (bloqueia quem não pagou/expirou). Hoje `demo`.
4. **Push em background (Etapa 3 finalizar)** — publicar o Worker `worker/` (cron `*/15`).
5. **Mais dados (opcional / ver Etapa 6 e 9)** — ou LLM real para ler PDFs dos editais
   (exige chave de API com custo) ou mais fontes oficiais.
6. **Métricas / gestão de assinatura** — painel para ver quem assinou, renovar, cancelar.
7. **Teste end-to-end** no navegador (e2e) após o redeploy — Playwright no link de produção.

> **O que JÁ está pronto e no ar** (não refazer): app, domínio `cacaprova.com.br`, email routing
> (`suporte@cacaprova.com.br` → Gmail), Pages Functions `/api/*`, KV bindings, Mercado Pago
> (webhook `200 - Entregue`), **token Cloudflare `cfut_3KA…` validado/ativo**, `account id`
> `294d134330d5b019e048675a56cc8b84`.

---

## 🧠 Decisões técnicas (não reverter sem necessidade)

- **Arquitetura:** perfil **só no aparelho**; base de editais **centralizada**; match **no cliente**.
- **Scraping centralizado** (não no dispositivo) — você aprovou.
- **Fonte da verdade:** `concursos.json` (gerado pelo crawler central).
- **Honestidade de dados:** null = "a definir" (tratado como neutro, sem reprovar nem chutar).
- **`store.js`:** num run completo com todas as fontes OK, itens `stale` (legados) são descartados.
- **Push:** trade-off de privacidade documentado (só subscription + eventos de concursos **salvos**).

---

## 🧩 PCI Concursos — análise (em 28/08/2026)

**Sim, dá para usar — e é um dos melhores provedores de dados estruturados.** Verificado:
- `robots.txt` **permite** a listagem `/concursos/` (HTTP 200, sem bloqueio). Só proíbe áreas internas (`/pdf/`, `/*.php`, `/pedido/`…), não a lista pública.
- Os cards usam classes `ca cb cc cd ce` e já trazem **no HTML da listagem**:
  **órgão · salário ("Vagas até R$ X") · cargos · escolaridade ("Médio / Técnico / Superior") · data**. São **~467 cards** só na home.
- Isso resolveria o nosso maior buraco: hoje **55/59 editais sem salário**; o PCI entrega salário+escolaridade+datas de uma vez, cobrindo o Brasil inteiro.

**Por que ainda usamos fontes oficiais como base (e não só o PCI):**
1. **Legal/ético (ponto central):** o PCI é um **agregador comercial** (concorrente). A lista é pública e o `robots.txt` libera, mas os **dados foram compilados por eles** e há **termos de uso** que podem proibir raspagem/redistribuição em massa. Para um app "100% gratuito e legal", precisamos respeitar isso.
2. **Link de destino:** o card aponta para a **notícia do próprio PCI**, não para o **edital oficial da banca/órgão**. Nosso valor é "abrir a página **oficial** do concurso no app". Com o PCI teríamos que extrair o link oficial da notícia (mais trabalho e mais risco de anti-bot).
3. **Anti-bot/ToS:** raspagem pesada pode gerar 403 (como vimos na Fundatec e em subdomínios do IDECAN).
4. **Fidelidade:** o próprio PCI avisa para conferir no portal oficial (é um agregador — pode ter atraso/erro).

**Decisão recomendada (equilíbrio):** manter **fontes oficiais** (FGV, Fundatec, IDECAN, IFPE) como **primárias** (integridade de link + segurança jurídica) e usar o **PCI como camada de ENRIQUECIMENTO**: pegar dos cards só os **fatos** (órgão, cargo, salário, escolaridade, data) para **preencher os nulos** dos registros que já temos, mantendo o **link oficial**. Assim ganhamos os dados ricos sem depender da notícia do PCI e sem copiar conteúdo editorial (só fatos públicos).
  - Alternativa mais simples ainda: adicionar o PCI como **5ª fonte de descoberta** (título → normalização → link). Porém aí o link apontaria para o PCI, não para o oficial.

> **Próximo passo (se você aprovar):** eu implemento um **adapter `pci.js`** que lê os cards `.ca` (com rate-limit e respeito ao robots) e/ou um **enriquecimento** que casa por `orgao+cargo` para preencher `salario/escolaridade/datas` nos registros atuais. Só fazemos isto com seu OK sobre a abordagem.

---

## 🗺️ PRÓXIMAS 5 ETAPAS (roadmap proposto)

| # | Etapa | O que entrega | O que precisamos (recursos) |
|---|---|---|---|
| ~~**5**~~ | ✅ **Publicação (hosting real)** | ~~App no ar com domínio próprio, HTTPS, PWA instalável.~~ **FEITO** — `https://cacaprova.com.br`. | Cloudflare Pages (grátis) + domínio `cacaprova.com.br`. |
| **6** | **Mais dados + PCI de enriquecimento** | Menos "a definir": preencher salário/escolaridade/datas via PCI + mais fontes oficiais (bancas dificeis via headless). | Cloudflare **Workers/D1** ou headless (Playwright) para fontes com JS; adapters novos; respeitar robots. |
| ~~**7**~~ | ✅ **Backend leve (Cloudflare Pages Functions + KV)** | ~~Acervo atualizado agendado, push em background, webhook PIX, endpoint de relato.~~ **FEITO PARTE** — Pages Functions `/api/...` + KV `PUSH`/`PIX`/`SUPPORT` no ar. Falta publicar o **Worker de push (cron)** (opcional) e o **acervo em D1** (quando a base crescer). | Conta Cloudflare; KV criado. `worker/` pronto. |
| **8** | **Monetização completa** | Cobrança **PIX real** com confirmação automática, gestão de assinatura, limites Free/Premium bem ajustados. | **Gateway PIX** (Mercado Pago/Gerencianet/Asas) + chave real; webhook de confirmação; painel/serviço de assinatura. |
| **9** | **IA + histórico + refinamento** | **Resumo de editais por IA**, histórico de concursos, métricas de uso, e remoção dos "Cargo não informado". | API de **IA** (free tier), mais fontes, melhor extração de cargos. |

> **Atalho recomendado:** Etapa 5 + 7 podem ser feitas **juntas** ao publicar no **Cloudflare Pages** (hosting + Worker + D1 + KV num só lugar, tudo grátis). Isso simplifica muito.

---

## 👁️ Como rodar o preview local

```bash
cd /home/user/caca-prova
python3 serve.py 8080      # http://localhost:8080
```

> O servidor está **rodando na porta 8080**. O preview usa `serve.py` (CORS liberado).
> **Atenção:** o `node_modules` (crawler e testes) é **efêmero** — não persiste no snapshot;
> será reinstalado no GitHub Actions (a `package.json` está versionada).
