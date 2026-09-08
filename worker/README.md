# Worker de Push (Web Push / VAPID) — Etapa 3

Notificações **em background** (app fechado) via **Web Push**. Publicado num
**Cloudflare Worker (plano gratuito)** para não gastar nada.

> **Privacidade:** o Worker guarda apenas a **assinatura de push** e uma lista
> mínima de eventos `{órgão, cargo, etapa, data}` dos concursos **salvos**.
> O **perfil nunca sai do aparelho** — ele só existe localmente.

## O que está no projeto

| Arquivo | Função |
|---|---|
| `worker/webpush.js` | Código do Worker: `/keys`, `/subscribe`, `/schedule`, `/unsubscribe` + **Cron Trigger** que envia os pushs agendados |
| `push.js` (na raiz) | Cliente: ativa assinatura, agenda eventos dos concursos salvos |
| `notif` (Premium) | Ao ativar, se `pushEndpoint` estiver configurado, chama `ativarPush()` + `agendarEventos()` |

## Como publicar (grátis)

0. **Instale as dependências e gere o par VAPID:**
   ```bash
   cd /home/user/caca-prova/worker
   npm install          # instala web-push
   npm run keys         # gera VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY
   ```

1. **Instale o CLI:**
   ```bash
   npm i -g wrangler
   ```

2. **Gere o par VAPID** (uma vez):
   ```bash
   npx web-push generate-vapid-keys
   ```
   Guarde `VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY`.

3. **Crie o namespace KV** para guardar assinaturas/eventos:
   ```bash
   wrangler kv namespace create PUSH
   ```
   Copie o `id` para o `wrangler.toml` (ex.: `KV_NAMESPACE`).

4. **`wrangler.toml`** (na pasta `worker/`):
   ```toml
   name = "caca-prova-push"
   main = "webpush.js"
   compatibility_date = "2024-01-01"
   nodejs_compat = true

   [[kv_namespaces]]
   binding = "PUSH"
   id = "SEU_ID_AQUI"

   [vars]
   VAPID_SUBJECT = "mailto:suporte@cacaprova.com.br"
   ```
   As chaves VAPID vão como **segredos**:
   ```bash
   wrangler secret put VAPID_PUBLIC_KEY
   wrangler secret put VAPID_PRIVATE_KEY
   ```

5. **Cron Trigger** (envia os pushs vencidos a cada 15 min). Adicione no `wrangler.toml`:
   ```toml
   [triggers]
   crons = ["*/15 * * * *"]
   ```

6. **Publique:**
   ```bash
   cd worker && wrangler deploy
   ```
   Observe a URL, ex.: `https://caca-prova-push.<sub>.workers.dev`

7. **No app,** em `config.js` (campos `[SECRET:PUSH_ENDPOINT]` etc. — injetados pelo
   `scripts/build-config.mjs` no build). Para usar este Worker como **backend único**:
   ```js
   push: {
     useFunctions: false,
     endpoint: "https://caca-prova-push.<sub>.workers.dev",  // env PUSH_ENDPOINT
   }
   ```
   Assinatura, agenda **e envio** ficam todos no mesmo Worker (um KV só) — é o
   caminho **mais simples e consistente** para o piloto.

> **Se você preferir `useFunctions=true` (Pages Functions no mesmo domínio do site):**
> o `/api/subscribe` e `/api/schedule` (Pages) **registram** a assinatura, mas quem
> **envia** é este Worker no cron. Então o namespace KV **`PUSH` precisa ser o mesmo**
> nos dois: no Pages (Settings → Bindings → KV) e no `wrangler.toml`/Worker.
> Use o `id` retornado por `wrangler kv namespace create PUSH` e cole-o nos dois lugares.

## Como funciona o fluxo

```
[aparelho]  buildDigest() -> eventos das etapas dos concursos SALVOS
   │  POST /schedule  {userId, subscription, eventos[]}
   ▼
[Worker]  guarda cada evento em KV com `sendAt` (data da etapa)
   │  Cron (*/15 min) -> se sendAt <= agora: sendNotification(subscription, payload)
   ▼
[aparelho]  SW recebe o push -> mostra notificação -> clique abre o edital (modo foco)
```

## Alternativa sem full-push
Se preferir **100% local** (nenhum dado sai do aparelho), basta **não** configurar
`pushEndpoint`. O app continua notificando enquanto está **aberto** (`premium.js`).
O envio em background é o trade-off opcional (só a subscription + eventos de
concursos **salvos** saem — nunca o perfil).
