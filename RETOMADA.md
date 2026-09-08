# 🔁 RETOMADA — CAÇA PROVAS

> **Atualizado em 30/08/2026 — O APP ESTÁ NO AR!** 🎉
> Este arquivo é o ponto de parada. Leia o sumário e as pendências restantes.
>
> **Última sessão (30/08):** corrigido o **bug da busca fixa em Recife** (novo `geo.js` no
> cliente + `salvarCidade` com fallback por UF, em vez de chutar Recife); **webhook MP**
> entregando `200 - Entregue`; **token Cloudflare `cfut_3KA…` validado e ativo**; acervo
> **enriquecido** (nacionais marcados, cargos/cidades preenchidos); **revalidação de licença**
> no cliente. Falta **decidir/go-live** (ver §Pendências 4-6).

---

## 🧭 Sumário (1 minuto)

- **App:** publicado e **funcionando** em `https://caca-prova.pages.dev` (PWA, perfil,
  match, Premium via PIX, push, relato — com as Pages Functions `/api/...` ativas).
- **Domínio:** `cacaprova.com.br` — **comprado e registrado** (sem o "s", decisão sua).
- **E-mail configurado no app:** `suporte@cacaprova.com.br`.
- **O que falta:** ligar o **domínio** no site, ativar o **e-mail (Email Routing)**,
  e (opcional) definir as **variáveis de ambiente** de produção.

---

## ✅ O que JÁ está feito (não refaça)

| Item | Status |
|---|---|
| App publicado no Cloudflare Pages | ✅ `https://caca-prova.pages.dev` |
| Pages Functions `/api/...` ativas | ✅ (keys, feedback, pix-*) |
| Projeto Pages `caca-prova` criado | ✅ |
| **KV bindings vinculados** (`PUSH`, `PIX`, `SUPPORT`) | ✅ via `wrangler.toml` |
| Domínio `cacaprova.com.br` | ✅ REGISTRADO no Registro.br |
| App local (PWA, perfil, match, Premium, push, relato) | ✅ `python3 serve.py 8080` |
| Raspagem + enriquecimento PCI | ✅ `node crawler/index.js` |
| Webhook/status/criação PIX | ✅ testados |
| `config.js` com valores corretos | ✅ `suporte@cacaprova.com.br` · `gateway=demo` (✅ pronto p/ `mercadopago` via `GATEWAY_MODE=mercadopago`) |
| `build-config.mjs` (injetor de segredos) | ✅ **reescrito** (corrigido, não corrompe) · aceita alias `PIX_GATEWAY`/`PIX_VALOR` |
| Busca por cidade (bug Recife fixo) | ✅ **corrigido** — `geo.js` + `salvarCidade` com mapa de capitais + fallback por UF |
| Acervo enriquecido (dados) | ✅ `scripts/enrich-concursos.mjs` — nacionais marcados, cargo/cidade/UF/escolaridade preenchidos |
| Revalidação de assinatura (anti-tamper) | ✅ `premium.js:revalidarPremium` + chamada no boot (roda quando gateway real) |
| Token Cloudflare `cfut_3KA…` | ✅ **validado e ativo** |

---

## ⏭️ PENDÊNCIAS RESTANTES (a próxima ação de cada uma)

### 1️⃣ Conectar o domínio `cacaprova.com.br` no site
- **Cloudflare → Workers & Pages → `caca-prova` → Custom domains → Set up a custom domain**
  → digite **`cacaprova.com.br`** → **Continue/Add**.
- O Cloudflare cria o registro DNS e emite o HTTPS automaticamente.
- Depois, o site passa a responder em `https://cacaprova.com.br` (e o `*.pages.dev` também funciona).

### 2️⃣ Ativar o e-mail (Email Routing) — `suporte@cacaprova.com.br` → Gmail
- **Cloudflare → zona `cacaprova.com.br` → E-mail → Email Routing** → **On**.
- **Add destination address** → `gmsouza25@gmail.com` → confirme o e-mail de verificação.
- Crie a regra: **`suporte@cacaprova.com.br`** → encaminhar → `gmsouza25@gmail.com`
  (ou **Catch-all** para todo o domínio).
- Adicione os registros **SPF/MX/DKIM** que o Cloudflare indicar.

> **Localização no painel:** Pages = nível da **conta** (`Home` → `Workers & Pages`);
> **Email Routing** = nível da **zona** (`cacaprova.com.br` → `E-mail`).

### 3️⃣ (Opcional) Variáveis de ambiente de produção
Em **Workers & Pages → caca-prova → Settings → Environment variables → Production**,
adicione (o app **já funciona sem**, pois o `config.js` já tem os valores):
- `PIX_CHAVE=03386809502`
- `EMAIL_PUBLICO=suporte@cacaprova.com.br`
- `EMAIL_DESTINO=gmsouza25@gmail.com`
- `PUSH_USE_FUNCTIONS=true`
- `FEEDBACK_ENDPOINT=/api/feedback`
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` (geradas via `worker/` para o push real)

> O `config.js` **atual** já contém os valores corretos (é o que está sendo servido).
> Definir as env vars é a prática recomendada para **não commitar** a chave PIX no git.

### 4️⃣ Cobrar de verdade = MERCADO PAGO — ✅ OPERACIONAL (Etapa 8)
- **Escolhido:** Mercado Pago. Integração **funcionando de ponta a ponta** no ar:
  - `/api/pix-create` cria a cobrança real (QR dinâmico) — com header `X-Idempotency-Key`.
  - `/api/pix-webhook` valida a assinatura `x-signature` do MP **e** tem fallback que confirma
    via API. Webhook registrado no MP (`payment`, `pagamentos legacy`), chave de assinatura ok.
  - `/api/pix-status` retornou `paid`/`premium` para o pagamento de teste real (R$ 19,90).
  - **Custo:** integração PIX gratuita (só taxa por transação).
- **Status:** a **monetização está funcionando** (pagamento real confirmado e Premium liberado).

#### 4.1 ⚠️ FALTA: cliente verificar o pagamento de verdade
- **Causa raiz (confirmada):** o `config.js` servido está com `gateway:"demo"`, então o botão
  "Já paguei" **libera o Premium sem checar** o backend (o `./deploy-pages.sh` lê `.env` com
  `PIX_GATEWAY`, mas o `build-config.mjs` antigo lia `GATEWAY_MODE` → a injeção nunca aconteceu).
- **Corrigido:** `build-config.mjs` agora aceita os aliases `PIX_GATEWAY` e `PIX_VALOR`.
  **Feito (30/08):** deploy `dist/` (ver abaixo) com `gateway:"mercadopago"` — o cliente agora cria
  cobrança real em `/api/pix-create` e confirma via `/api/pix-status` e **rebaixa** quem não pagou/expirou.
- **Revalidação anti-tamper:** adicionada `revalidarPremium()` (premium.js) chamada no boot do
  app — se o backend não confirmar a assinatura, rebaixa para Free (bloqueia quem não pagou/expirou).
  **Só roda** quando o `gateway` não é `demo`.

### 5️⃣ (Decisão) Busca fixa em Recife — CORRIGIDO, falta publicar
- Novo `geo.js` (capitais + cidades comuns + fallback por UF) e `salvarCidade()` reescrito:
  qualquer cidade passa a ser geocodificada; sem fallback para Recife.
- **Ainda não publicado** — sobe no próximo deploy.

### 6️⃣ (Decisão) Dados / "filtro por IA" — MELHORADO e PUBLICADO
- `scripts/enrich-concursos.mjs` (offline, sem custo de API) marca **nacionais**, preenche
  **cargo/cidade/UF/escolaridade** e calcula `localDefinido`/`qualidade`. Resultado no acervo:
  `sem cargo: 35→0`, `sem cidade: 14→10` (6 viraram nacionais/corretos), **5 nacionais**.
- Nova interface: badge **🇧🇷 Nacional** + filtro **📍 Local (por IA)**: Todos / Com local /
  Nacionais / Local a definir.
- **Opcional (não feito):** integrar um LLM real para ler os PDFs dos editais e extrair
  cargos/vagas/salário automaticamente — requer chave de API com custo. Hoje é heurística.

### 7️⃣ 🔁 LEMBRETE — Enriquecimento por IA (LLM) em 3 LOTES
> **Pendência ativa.** O pipeline `scripts/llm-enrich.mjs` está pronto e **validado** (leu
> 3 editais de verdade: datas + área/escolaridade, sem inventar vagas/salário). Interface com
> badges **"✓ edital" / "≈ estimado" / "ver edital"** já publicada em `caca-prova.pages.dev`.

> **Regra de "inscrição aberta" (30/08):** o app agora **só mostra concursos com inscrição ainda
> aberta** (`isInscricaoAberta` em `app.js`): oculta os com `dt_inscricao_fecha < hoje` (com data)
> e mantém os sem data. Aplicado por padrão (todos os planos), com nota na barra de filtros.
> Nesta raspagem isso ocultou 2 (`fgv-navbrasil26`, `fundatec-1031`).

**Bloqueio:** os Flash **novos** (`gemini-3.5-flash` e `gemini-3.6-flash`) limitam a **~20 req/dia**
na camada gratuita (`GenerateRequestsPerDayPerProjectPerModel-FreeTier`). **Não dá para rodar os
55 num dia só de graça.** Então rodamos **1 lote por dia** (3 dias) — ou ativar billing para tudo de uma vez.

- **Chave armazenada** em `caca-prova/.env.llm` (gitignored; formato `AQ.Ab...`). O script **só funciona
  na rota nativa** do Gemini (padrão). O `rodar-lote-ia.sh` carrega a chave de `.env.llm`.
- **Como rodar** (helper): `./scripts/rodar-lote-ia.sh 1` (dry) e `... 1 --apply`.
  - O `--apply` agora **promove** o `concursos.llm.json` já revisado (NÃO re-rodar o LLM; cria backup
    `concursos.antes-llm.json`). Para rodar de novo do zero, apague `concursos.llm.json`.
  - Lotes: `1` (offset 0, limit 18), `2` (18, limit 18), `3` (36, limit 19). Cota ~20 req/dia.
- **Ordem:** sempre `--dry` → conferir `concursos.llm.json` → `--apply`. Não aplicar sem revisar.
- **Limpeza de dados** (opcional, antes de aplicar): `node scripts/limpar-dados.mjs <arquivo> --apply`.
  - Remove salário < R$500 e vagas <= 0; não apaga valores repetidos (podem ser reais); lista os repetidos.
- **Detalhes/comandos manuais:** ver `PUBLICAR.md §8.2`.
- **Status 30/08:** `gemini-3.6-flash` **cota esgotada HOJE** (429); `gemini-3.5-flash` **funcionando**.
- **Status atual:** `✅ 1/3 lotes concluído` (Lote 1 aplicado com `gemini-3.5-flash`, 18 editais lidos,
  backup `concursos.antes-llm.json`). Próximo: **Lote 2** (amanhã, quando a cota renovar).

---

## 🌐 Sobre o domínio (não confundir)

| Nome | Status | Uso |
|---|---|---|
| `cacaprova.com.br` | ✅ COMPRADO / REGISTRADO | **Usar este** (sem "s") |
| `cacaprovas.com.br` (com "s") | 🟢 disponível | ⚠️ **não usar**; era zona criada por engano no Cloudflare |

---

## 🖥️ Rodar localmente

```bash
cd /home/user/caca-prova
python3 serve.py 8080       # http://localhost:8080/index.html
```
(O servidor não fica de pé entre sessões; reinicie com este comando.)

---

## ✔️ Verificação rápida

- **App no ar:** abrir `https://caca-prova.pages.dev` (deve carregar e aceitar os Termos).
- **Rotas ativas:**
  - `https://caca-prova.pages.dev/api/keys` → `{"publicKey":""}`
  - `https://caca-prova.pages.dev/api/pix-status?ref=x` → `{"ok":true,"status":"pending",...}`
  - `https://caca-prova.pages.dev/` → HTTP 200

---

## 📚 Documentos de referência
- **`PUBLICAR.md`** — passo a passo completo de publicação + localização de Pages/Email Routing + segredos + webhook PIX + Worker de push.
- **`INSTALACAO.md`** — instalar como PWA + como confiar (SHA-256) + portabilidade de e-mail.
- **`ESTADO.md`** — histórico do que está implementado + roadmap (Etapas futuras).
- **`RETOMADA.md`** — este arquivo (ponto de parada).
