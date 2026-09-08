# 🚀 Publicar o CAÇA PROVAS — Cloudflare Pages (Etapas 5 + 7)

Este guia coloca o app **no ar** com HTTPS, PWA instalável, e ativa o **backend
leve** (push em background + relato de problema + acervo) — **tudo no plano
gratuito** do Cloudflare Pages. É a Etapa 5 (publicação) e a Etapa 7 (servidor leve)
juntas, num só lugar.

---

## 0. Pré-requisitos

- Conta **Cloudflare** (grátis): https://dash.cloudflare.com
- Conta **GitHub** com o projeto (se ainda não subiu, veja o passo 1).
- (Opcional) domínio próprio `cacaprova.com.br` — se não tiver, o site fica em
  `<seu-projeto>.pages.dev`.

---

## 1. Subir o projeto para o GitHub

```bash
cd /home/user/caca-prova
git init
git add .
git commit -m "feat: CAÇA PROVAS - MVP + raspagem (4 fontes) + premium + push + pix"
git remote add origin https://github.com/SEU_USUARIO/caca-prova.git
git branch -M main
git push -u origin main
```

> O `.gitignore` já exclui `node_modules/`, `crawler/out/`, `crawler/db/`, `.env`,
> `.wrangler/`. **Não commite a chave PIX real** — use o mecanismo de segredo abaixo.

---

## 2. Criar o projeto no Cloudflare Pages

1. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Escolha o repositório `caca-prova`.
3. **Build settings:**
   - **Framework preset:** `None` (é estático, sem bundler).
   - **Build command:** `node scripts/build-config.mjs`
   - **Build output directory:** `/` (a raiz).
4. **Create project** → aguarde o deploy.

> Sem build command funciona também (o site é estático): a única diferença é que
> o `build-config.mjs` só roda se você colocar o comando acima (para injetar os
> segredos no build). Se não injetar, o `config.js` versionado é usado.

---

## 2.5 Publicar pela linha de comando (alternativa mais rápida)

Se preferir não configurar o build no painel, há um script pronto:

```bash
cd /home/user/caca-prova
npm i -g wrangler
wrangler login          # abre o navegador para autenticar

# Crie os namespaces KV (uma vez) e cole os IDs no dashboard > Bindings:
npx wrangler kv namespace create PUSH
npx wrangler kv namespace create PIX
npx wrangler kv namespace create SUPPORT

# Preencha o .env (copie do .env.example) e publique:
./deploy-pages.sh
```

O script **injeta os segredos** (`scripts/build-config.mjs`) e roda
`npx wrangler pages deploy . --project-name="caca-prova"`. O output dir é a raiz
(`pages_build_output_dir = "."` no `wrangler.toml` da raiz), e a pasta `functions/`
é publicada junto → as rotas `/api/...` (push, feedback, PIX) ficam ativas.

---

## 3. Segredos e variáveis de ambiente (não commitar a chave)

Vá em **Settings → Environment variables** (Produção) e adicione:

| Nome | Valor | Descrição |
|---|---|---|
| `PIX_CHAVE` | `03386809502` | Chave PIX do recebedor (pode ser CPF/CNPJ/e-mail) |
| `PIX_NOME_RECEBEDOR` | `Seu Nome Completo` | Nome do titular que aparece no PIX |
| `EMAIL_PUBLICO` | `suporte@cacaprova.com.br` | Endereço de suporte exibido |
| `EMAIL_DESTINO` | `gmsouza25@gmail.com` | Destino real (oculto) |
| `FEEDBACK_ENDPOINT` | `/api/feedback` | Ativa a rota de relato no mesmo domínio |
| `PUSH_USE_FUNCTIONS` | `true` | Ativa push via Pages Functions |
| `VAPID_PUBLIC_KEY` | `...` | Gerada em `worker/README.md` |
| `VAPID_PRIVATE_KEY` | `...` | Gerada em `worker/README.md` |
| `VAPID_SUBJECT` | `mailto:suporte@cacaprova.com.br` | Contato do VAPID |
| `RESEND_API_KEY` | (opcional) | Para envio de e-mail + auto-resposta automática |
| `PIX_WEBHOOK_SECRET` | (segredo) | Segredo compartilhado do **webhook PIX** (header `x-pix-token`, ou assinatura se `PIX_WEBHOOK_SIG=hmac`) |
| `PIX_WEBHOOK_SIG` | `token` (padrão) | Como validar o webhook: `token` ou `hmac` (HMAC-SHA256 no header `x-pix-signature`) |
| `PIX_VALOR` | `19.90` | Valor mínimo para liberar o Premium |
| `PIX_GATEWAY` | `mercadopago`/`gerencianet`/`asas`/`custom` | Qual gateway envia o webhook (ajusta o normalizador) |
| `PIX_STATUS_ENDPOINT` | `/api` (padrão) | Endpoint que o app consulta para confirmar (vazio = `/api` no mesmo domínio) |
| `PIX_CRIAR_ENDPOINT` | `/api` (padrão) | Endpoint que cria a cobrança (vazio = `/api` no mesmo domínio) |
| `MP_ACCESS_TOKEN` / `EFI_CLIENT_ID`+`EFI_CLIENT_SECRET` / `ASAAS_API_KEY` | (segredos) | Credenciais do gateway para o `/api/pix-create` criar a cobrança real |

O build (`node scripts/build-config.mjs`) lê `PIX_CHAVE`, `EMAIL_DESTINO`,
`PUSH_USE_FUNCTIONS` etc. e injeta nos campos `[SECRET:...]` do `config.js`
**neste commit** — assim o repo não carrega a chave secreta.

> **Binding KV:** crie **Settings → Bindings (KV)** com nome `PUSH`
> (e, opcionalmente, `SUPPORT`). São o banco leve das assinaturas de push e dos
> relatos. Use **KV** (grátis) — o `functions/*.js` espera `env.PUSH` / `env.SUPPORT`.
> Para o **webhook PIX**, crie um binding adicional chamado **`PIX`** — ele guarda
> `pay:<ref>` (pagamento confirmado) e `sub:<ref>` (assinatura). O `functions/api/pix-webhook.js`
> grava e o `/api/pix-status` lê.
> **Para o push ser *enviado*, use o MESMO id de `PUSH` que o Worker** (ver seção 7),
> senão o site registra a assinatura num KV e o cron do Worker procura em outro.

> **Recomendado (mais simples):** em vez de misturar Pages Functions + Worker, use o
> **Worker como backend único de push**. Deixe `PUSH_USE_FUNCTIONS=false` e aponte
> `PUSH_ENDPOINT=https://<seu-worker>.workers.dev`. Aí `/subscribe`, `/schedule` e o
> **cron de envio** vivem no mesmo Worker com o mesmo KV — nada depende de os dois
> KV coincidirem. As Pages Functions ficam só para o `/api/feedback`.

---

### 📍 Onde ficam "Pages" e "Email Routing" no painel Cloudflare

> **A causa mais comum de "não acho":** os dois ficam em lugares DIFERENTES.

**Pages** — é do **nível da A CONTA**, não da zona do domínio:
1. Clique no **nome da conta** (topo esquerdo) ou em **"Home"** para sair da zona e ir ao painel da conta.
2. Na **barra lateral esquerda**, clique em **"Workers & Pages"**.
3. Verá a lista de projetos → **"Create"** / **"caca-prova"**.

**Email Routing** — é **DA ZONA** do domínio:
1. Clique na zona **`cacaprova.com.br`** (para voltar a ela).
2. Na **barra lateral esquerda**, clique em **"E-mail"** → **"Email Routing"**.
3. **On** → **Add destination** → `gmsouza25@gmail.com` → verificar o e-mail → cria a regra de encaminhamento.

> 💡 Se você não vê "Workers & Pages" na barra lateral, procure na **Home** da conta
> o cartão/atalho **"Workers & Pages"**. Também pode acessar direto por
> `https://dash.cloudflare.com/<SUA_CONTA>/workers-and-pages`.

---

## 4. Publicar e conferir

- O site fica em `https://<seu-projeto>.pages.dev`. Acesse e instale como PWA
  (ícone de instalar no navegador).
- **Relato:** tela Conta → "Relatar problema". Com `FEEDBACK_ENDPOINT=/api/feedback`,
  o envio vai para o `functions/api/feedback.js`. Sem chave Resend, a auto-resposta
  vem do **auto-responder** da caixa `suporte@` (ver `INSTALACAO.md`).
- **Push:** ativando notificações no Premium, e com `PUSH_USE_FUNCTIONS=true`,
  o app chama `/api/keys`, `/api/subscribe`, `/api/schedule` (as Pages Functions).
  O **envio em background** (quando vence a data da etapa) é feito pelo **Cron** —
  veja `worker/README.md` para o Worker com `*/15 * * * *` (ou o Cron das Pages).

---

## 5. (Opcional) domínio próprio

1. No Pages → project → **Custom domains** → **Set up a custom domain** →
   `cacaprova.com.br`.
2. Siga a validação automática do Cloudflare (DNS).
3. HTTPS é ativado automaticamente.

---

## 6. Receita do piloto — o que fica grátis

| Recurso | Plano |
|---|---|
| Hosting + HTTPS + CDN | Cloudflare Pages (grátis) |
| Domínio `cacaprova.com.br` | ~R$ 40/ano no Registro.br (único custo fixo) |
| E-mail `suporte@` (portabilidade) | Cloudflare Email Routing (grátis) |
| Push em background | Worker/Cron (grátis) |
| Backend leve (KV) | Cloudflare KV (grátis) |
| Envio de e-mail de suporte (opcional) | Resend (grátis até ~3.000/mês) |
| Acervo central (raspagem semanal) | GitHub Actions (grátis) |

> Assim, praticamente **só o domínio custa** — ideal para o piloto.

---

## 6.5 Webhook PIX (confirmação automática do Premium)

O app já vem com o esqueleto pronto em `functions/api/pix-webhook.js`:

```text
[app]  usuário clica "Assinar Premium" (R$ 19,90/ano)
   └─ (produção) POST /api/pix-create { ref, valor }   -> QR dinâmico do gateway
   └─ (piloto)   mostra o payload gerado localmente
[gateway]  quando o banco confirma o PIX, chama o webhook:
   POST  https://<seu-projeto>.pages.dev/api/pix-webhook
   Header x-pix-token: <PIX_WEBHOOK_SECRET>
[webhook]  valida token/assinatura, normaliza a carga e grava no KV "PIX"
[app]  botão "Já paguei" chama GET /api/pix-status?ref=<ref>
   └─ se paid => libera o Premium automaticamente
```

**Para ligar:** configure no Pages as env vars `PIX_WEBHOOK_SECRET`, `PIX_GATEWAY`,
`PIX_VALOR` (ver seção 3), crie o binding KV **`PIX`**, e aponte a *notification URL*
do seu gateway (Mercado Pago, Efí/Gerencianet, Asaas…) para o endpoint acima com o
header `x-pix-token`. O normalizador já entende os formatos desses gateways; se usar
outro, ajuste as chaves em `normalizarPagamento()`.

> **Piloto:** com `gateway: "demo"` (padrão) o app mantém a **confirmação manual**
> (botão "Já paguei" libera direto) — sem backend, sem custo. Para cobrar de verdade,
> troque para o gateway e ative o webhook.

---

## 6.6 Cobrar de verdade com Mercado Pago (Etapa 8)

O código de produção já está pronto e no ar (`/api/pix-create`, `/api/pix-webhook`,
`/api/pix-status`), com suporte à assinatura e ao payload real do **Mercado Pago**.
Para ativar a cobrança automática (R$ 19,90/ano), faça:

### A) Criar a integração no Mercado Pago
1. Entre em **mercadopago.com.br** → **Suas integrações** → **+ Criar aplicação**.
2. Escolha um nome (ex.: "CAÇA PROVAS") e **crie**. Fique na **Produção**.
3. Em **Credenciais**, copie o **Access Token** (é o `MP_ACCESS_TOKEN`).

### B) Configurar os segredos no Cloudflare Pages
Vá em **Workers & Pages → caca-prova → Settings → Environment variables →
Production** e adicione:

| Variável | Valor |
|---|---|
| `MP_ACCESS_TOKEN` | seu Access Token do MP (secreto) |
| `PIX_WEBHOOK_SECRET` | a **chave de assinatura** do webhook do MP |
| `PIX_WEBHOOK_SIG` | `mp` |
| `PIX_GATEWAY` | `mercadopago` |
| `PIX_WEBHOOK_URL` | `https://cacaprova.com.br/api/pix-webhook` |

### C) Registrar o webhook no Mercado Pago
1. Na integração, vá em **Webhooks** → **+ Adicionar endpoint**.
2. URL: `https://cacaprova.com.br/api/pix-webhook`.
3. Evento: `payment` (e marque `payment.update`).
4. Copie a **chave de assinatura** gerada → use como `PIX_WEBHOOK_SECRET`.

> ⚠️ **Se o webhook não confirmar sozinho:** com `PIX_WEBHOOK_SIG=mp` o código valida a assinatura;
> porém, se a "chave de assinatura" do painel **não for configurada**, o MP envia o webhook **sem**
> `x-signature` e o sistema **cai no fallback**: consulta o próprio MP (via `MP_ACCESS_TOKEN`) para
> confirmar `approved`. Isso deixa a liberação **robusta** (não depende 100% da assinatura). Ainda
> assim, registre o webhook para a confirmação ser automática (sem ação do usuário).

### D) Ligar no app
- No deploy, injete `PIX_GATEWAY=mercadopago` (ou edite `config.js` → `pix.gateway: "mercadopago"`).
- O `config.js` já tem `chave`, `valor: 19.90`, `txid`, `nome`. O `/api/pix-create`
  passa a criar a cobrança no MP e devolver o **QR dinâmico**; o `/api/pix-webhook`
  confirma e libera o Premium automaticamente.
- **O `/api/pix-create` envia o header `X-Idempotency-Key`** (UUID) — exigência do MP para criar
  pagamentos via API sem o erro `4292` ("Header X-Idempotency-Key can't be null").

> **Teste em sandbox:** antes de produção, o MP tem um ambiente de teste com
> `MP_ACCESS_TOKEN` de teste e cartões fake. Use o endpoint `https://seu-app.pages.dev/api/pix-webhook`
> como `notification_url` do modo teste.

> **Custo:** a integração de PIX do MP é **gratuita** (sem mensalidade); você só paga
> a **taxa por transação** (percentual), que é o único custo do plano.

---

## 7. Deploy do Worker de push (opcional, mas recomendado)

O push **de envio em background** (quando a etapa vence) pode rodar como um
**Worker com Cron** separado do site. O `worker/` já vem pronto:

```bash
cd /home/user/caca-prova/worker
npm install            # instala web-push
npm run keys           # gera VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY
wrangler kv namespace create PUSH      # copie o id retornado
```

Edite `worker/wrangler.toml` e troque `SEU_ID_DO_KV_AQUI` pelo id retornado.
Depois configure os segredos e publique:

```bash
wrangler secret put VAPID_PUBLIC_KEY
wrangler secret put VAPID_PRIVATE_KEY
wrangler deploy
```

Com o endpoint do Worker em `config.js` (`push.endpoint`), o app passa a **enviar
as notificações sozinho** no cron `*/15 * * * *` — o usuário não precisa abrir o
app para ser lembrado. (Como o site fica em `.pages.dev`, você pode deixar o
Worker no mesmo subdomínio Pages Functions; o `wrangler.toml` é a forma mais
simples e ligada ao cron.)

---

## 8. Deploy SEM publicar segredos + enriquecimento por IA

### 8.1 Publicar apenas o `dist/` (nunca a raiz toda)
> ⚠️ O `wrangler pages deploy .` sobe a **pasta raiz inteira** (o site chegou a servi
> `/.env` publicamente). O `.pagesignore` **não é respeitado** no upload direto.
> **Sempre** publique o `dist/` gerado por `scripts/build-pages.mjs`.

```bash
# gera dist/ só com o app + functions (SEM .env, worker/, crawler/, scripts/, docs)
node scripts/build-pages.mjs
# publica o dist/
CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... \
  npx wrangler pages deploy dist --project-name="caca-prova" --commit-dirty=true
```

O `deploy-pages.sh` já faz tudo (build-config → build-pages → deploy dist).

### 8.2 Enriquecer dados/IA na raspagem (opcional — Etapa 9)
O acervo pode ser melhorado **automaticamente por LLM**. Sem chave, o script não faz
nada (não quebra o crawl):

```bash
# 1) dependência p/ ler PDFs
npm install                     # instala pdf-parse

# 2) enriquecer (default lê o PDF do edital e extrai de verdade)
#    OBS: a chave nova do Google (formato "AQ.Ab...") SÓ funciona na API nativa
#    do Gemini (que é o padrão). NÃO use a rota /v1beta/openai com chave AQ.
LLM_API_KEY=<sua chave Gemini> \
LLM_MODEL=gemini-3.6-flash \
LLM_ESTIMATE=1 \
node scripts/llm-enrich.mjs            # gera concursos.llm.json p/ revisão (default)
node scripts/llm-enrich.mjs --apply    # SÓ depois de revisar; aplica no concursos.json
```

**Como ele decide (política de confiabilidade):**
- **Edital acessível** → baixa o PDF, extrai o texto e o LLM lê **de verdade** ⇒ `fonteDados:"edital"`.
- **Bloqueado (CAPTCHA/anti-bot)/sem PDF** e `LLM_ESTIMATE=1` → estima e marca **`estimado:true`** (UI mostra "≈").
- **Bloqueado/sem PDF** e `LLM_ESTIMATE=0` → **não inventa** (vagas/salário/datas ficam "a definir"); marca `fonteDados:"sem-edital"`.

**Cache dos editais:** PDF + texto ficam em `crawler/edital_cache/`; ao final apagamos as entradas **não usadas no ciclo** (limpeza automática, `LLM_CACHE_DAYS`). Nenhum PDF vai para o site.

> ⚠️ **Revise sempre o `concursos.llm.json` antes de `--apply`** — LLM pode alucinar mesmo lendo o edital.
> O `enrich-concursos.mjs` (heurística offline, sem custo) faz a maior parte
> (marca nacionais, preenche cargo/cidade/UF/escolaridade, calcula `qualidade`).

**Como o `--apply` funciona (não re-consome a cota):** ele **promove** o `concursos.llm.json` revisado
para `concursos.json` (com backup `concursos.antes-llm.json`), sem chamar a API de novo. Para re-rodar
o LLM do zero, apague `concursos.llm.json` antes do `--apply`.

**Limpeza de dados suspeitos** (antes de aplicar, opcional): `node scripts/limpar-dados.mjs concursos.llm.json --apply`
— remove salário < R$500 e vagas <= 0 (ex.: salário R$30 vindo do scraper) e lista os valores repetidos para revisão.

**Regra "inscrição aberta" (sempre ativa):** o app só exibe concursos com `dt_inscricao_fecha` >= hoje
(ou sem essa data). Quem já passou da data de inscrição é ocultado da lista (`isInscricaoAberta` em `app.js`).

**⚠️ Limite da camada gratuita do Gemini:**
Os modelos Flash **novos** (`gemini-3.5-flash` e `gemini-3.6-flash`) limitam a **~20 requisições/dia** na camada gratuita (`GenerateRequestsPerDayPerProjectPerModel-FreeTier`). Não dá para rodar os 55 num dia só de graça. Para os 55 de uma vez é preciso **ativar cobrança** (custo de centavos) OU rodar em **3 lotes/dias** (18/18/19):

```bash
# Lote 1 (a rota nativa é o padrão; não precisa de LLM_BASE_URL)
LLM_API_KEY=... LLM_ESTIMATE=1 LLM_OFFSET=0  LLM_LIMIT=18 node scripts/llm-enrich.mjs --dry   # revisar antes
LLM_API_KEY=... LLM_ESTIMATE=1 LLM_OFFSET=0  LLM_LIMIT=18 node scripts/llm-enrich.mjs --apply
# Lote 2 (dia seguinte)
LLM_API_KEY=... LLM_ESTIMATE=1 LLM_OFFSET=18 LLM_LIMIT=18 node scripts/llm-enrich.mjs --dry
LLM_API_KEY=... LLM_ESTIMATE=1 LLM_OFFSET=18 LLM_LIMIT=18 node scripts/llm-enrich.mjs --apply
# Lote 3 — 19 editais (dentro do teto de ~20 req/dia)
LLM_API_KEY=... LLM_ESTIMATE=1 LLM_OFFSET=36 LLM_LIMIT=19 node scripts/llm-enrich.mjs --dry
LLM_API_KEY=... LLM_ESTIMATE=1 LLM_OFFSET=36 LLM_LIMIT=19 node scripts/llm-enrich.mjs --apply
```

> A cota diária renova a cada dia. **Revise** cada `concursos.llm.json` antes de `--apply`.
> Para rodar tudo de uma vez, ative billing no projeto do Gemini (custo mínimo).
