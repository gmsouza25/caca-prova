# 🔧 Guia — configurar integrações do CAÇA PROVAS (GitHub + Cloudflare + push)

> Passo a passo para deixar o **agendamento semanal** e o **broadcast de Seg 08h** funcionando.
> São 3 blocos: **(A)** secret `LLM_API_KEY` no GitHub · **(B)** secrets VAPID + redeploy do worker
> no Cloudflare · **(C)** `git push` dos arquivos ao repositório.
>
> **Pré-requisitos:** você precisa de 2 logins abertos em abas distintas:
> - **GitHub** (onde está o repositório do projeto)
> - **Cloudflare** (dash.cloudflare.com — conta `294d134330d5b019e048675a56cc8b84`)

---

## 🔑 Dados que você vai usar (já gerados/confirmados)

| Item | Valor |
|---|---|
| **VAPID_PUBLIC_KEY** | `BKOGHkoR0phRf45IutXcrHIIplsYxqAtLVbk4l4dZ6rpRiW-gEBKhbRvSgetQ1B-8iILmVfEL2JxSRzphlmvKbs` |
| **VAPID_PRIVATE_KEY** | `0Zw7PopuWbPY9KghgfIKJfER6Zp7Xfgj2j4KlR0FjiU` |
| **VAPID_SUBJECT** | `mailto:suporte@cacaprova.com.br` |
| **KV namespace `PUSH` id** | `3889998d201b4b458ab2aaaa888f4e39` |
| **Worker (nome)** | `caca-prova-push` · main `webpush.js` |
| **Cron do worker** | `*/15 * * * *` (etapas) + `0 11 * * 1` (Seg 08h BRT) |

> ⚠️ **Same KV** é essencial: o worker de push (que ENVIA) e as Pages Functions `/api/subscribe`
> (que GRAVAM as assinaturas) precisam apontar para o **mesmo** namespace KV `3889998d...`.
> Caso contrário o cron não enxerga os inscritos.

---

# 🇦 BLOCK A — Secret `LLM_API_KEY` no GitHub

Serve para o workflow **`.github/workflows/semana-ia.yml`** rodar o LLM (raspagem de Sáb + Lotes).
Sem esse secret, cada job dele falha na etapa "Lote N (IA)".

## A.1 Se ainda não tem a chave do Gemini
1. Abra **https://aistudio.google.com/apikey**
2. **Create API key** → copie a chave (começa com `AQ.Ab...`). Guarde-a.

## A.2 Adicionar o secret no repositório
1. No **GitHub**, dentro do repositório do projeto → aba **Settings**.
2. Menu lateral esquerdo → **Secrets and variables** → **Actions**.
3. Botão **New repository secret**.
4. **Name:** `LLM_API_KEY`  (exatamente assim, maiúsculas/subscrito igual)
5. **Secret:** cole a chave do Gemini.
6. **Add secret.** ✅

## A.3 Conferir
- Na mesma página, a lista deve mostrar `LLM_API_KEY` como **`Actions`** (não "Organization").
- Não é preciso mais nada aqui — os 3 jobs de `semana-ia.yml` já referenciam `${{ secrets.LLM_API_KEY }}`.

---

# 🇧 BLOCK B — Secrets VAPID + redeploy do worker no Cloudflare

Serve para o worker **`caca-prova-push`** enviar o **broadcast semanal (Seg 08h BRT)** e as
notificações de etapas. Feito em 2 partes: (B1) configurar no painel OU (B2) via CLI. Escolha **uma**.

## B.1 (painel — recomendado)
1. **Cloudflare Dashboard → Workers & Pages** → clique no worker **`caca-prova-push`**. Se não existir,
   **Create Application → Create Worker** (nome `caca-prova-push`) — o código será substituído no deploy.
2. No worker → aba **Settings**.
   - **Variables and Secrets** → **Add**:
     - **Encrypt** → Name `VAPID_PRIVATE_KEY` → Value `0Zw7PopuWbPY9KghgfIKJfER6Zp7Xfgj2j4KlR0FjiU`.
     - **Text** (variável) → Name `VAPID_PUBLIC_KEY` → Value `BKOGHkoR0phRf45IutXcrHIIplsYxqAtLVbk4l4dZ6rpRiW-gEBKhbRvSgetQ1B-8iILmVfEL2JxSRzphlmvKbs`.
     - **Text** (variável) → Name `VAPID_SUBJECT` → Value `mailto:suporte@cacaprova.com.br`.
   - **Bindings → Add → KV namespace**:
     - Variable name: `PUSH`
     - **Select the namespace with id `3889998d201b4b458ab2aaaa888f4e39`** (o mesmo do Pages).
3. **Triggern (Cron Triggers)**: em **Settings → Triggers**, garanta que existem os crons
   `*/15 * * * *` e `0 11 * * 1`. (O `worker/wrangler.toml` já os lista; se publicar via `wrangler deploy`,
   os crons do `[triggers]` são aplicados automaticamente.)

## B.2 (via CLI — alternativa)
No terminal, dentro de `worker/`:
```bash
cd worker
npm i                # instala web-push
npx wrangler login
# definir os segredos (private como secret; publico/subject como var no wrangler.toml)
npx wrangler secret put VAPID_PRIVATE_KEY
#   cole a private key
```
- No `worker/wrangler.toml`, já estão as `[vars]` `VAPID_SUBJECT` e as `[triggers]`. **Edite** o
  valor do KV:
  ```toml
  [[kv_namespaces]]
  binding = "PUSH"
  id = "3889998d201b4b458ab2aaaa888f4e39"   # troque "SEU_ID_DO_KV_AQUI"
  ```
- **Publicar**:
  ```bash
  npx wrangler deploy
  ```

## B.3 Validação do worker
- Depois do deploy, rode (você os executa; eu não alcanço o Cloudflare):
  ```bash
  # gera as chaves VAPID (para conferir se batem com os secrets)
  npx web-push generate-vapid-keys
  ```
- Para **testar imediatamente** o broadcast sem esperar segunda: use o **trigger manual** do Cron,
  ou verifique que o worker responde em `https://caca-prova-push.<subdomain>.workers.dev/keys` retornando
  `{"publicKey":"BKOG..."}`.

> ⚠️ **Redeploy obrigatório:** o código do broadcast de Seg e os crons só entram em vigor depois do
> `wrangler deploy` (a versão hoje publicada pode ser antiga).

---

# 🇨 BLOCK C — `git push` dos arquivos ao repositório

O sandbox **não é um repositório git** (não tem `.git`/remote), então você **copia/commita** no clone local.

## C.1 Arquivos que mudaram/adicionados (novos na semana de IA)
Copie do projeto do sandbox para o seu clone local os que **ainda não estiverem lá**:

| Caminho | Por quê |
|---|---|
| `.github/workflows/semana-ia.yml` | **NOVO** — raspagem Sáb + Lote 1/2/3 (Dom/Seg) |
| `.github/workflows/scrape.yml` | editado — agora só checagem diária |
| `crawler/config.js` | editado — `cronUtc = "0 6 * * 6"` (raspagem no sábado) |
| `worker/webpush.js` | editado — broadcast Seg 08h + rotas |
| `worker/wrangler.toml` | editado — KV id real + crons `0 11 * * 1` |
| `package-lock.json`, `crawler/package-lock.json` | para o `npm ci` no GitHub Actions |

> **Obrigatório** para o worker funcionar: dentro do `worker/wrangler.toml` do clone, o **id do KV**
> tem que ser `3889998d201b4b458ab2aaaa888f4e39` (não `SEU_ID_DO_KV_AQUI`).

> Opcional: `scripts/` (limpar-dados.mjs, rodar-multimodelo.mjs, llm-enrich.mjs) e `docs/` — úteis,
> mas não são necessários para o workflow em produção.

## C.2 Commitar e enviar (no seu terminal, dentro do clone)
```bash
cd <caminho-do-projeto>            # ex.: ~/Documents/PROJETOS/caca-prova

git add -A
git status                          # confira o que vai subir
git commit -m "IA: carga multi-modelo + agendamento semanal (Sáb/Dom/Seg) + broadcast Seg 08h"
git push origin main                # (ou o branch usado, ex.: main/master)
```

## C.3 Conferir que o workflow está ativo
1. **GitHub → repositório → Actions** → aba **Workflows**. Deve aparecer:
   - **"Ciclo semanal (raspagem + lotes IA)"** — com os 3 jobs (Sáb/Dom/Seg) e as datas próximas.
2. **GitHub → repositório → Settings → Actions → General → Workflow permissions**:
   - marque **"Read and write permissions"** (o workflow faz commit/push do `concursos.json`).
3. O secret **`LLM_API_KEY`** (Block A) garante que os jobs de IA não falhem.

---

## ✅ Checklist final
- [ ] `LLM_API_KEY` presente em **GitHub → Settings → Secrets → Actions**.
- [ ] Worker `caca-prova-push` deployado com os 3 secrets **VAPID** e binding **PUSH** = `3889998d...`.
- [ ] `worker/wrangler.toml` com **id do KV** real e **cron `0 11 * * 1`**.
- [ ] `git push` feito; workflow `semana-ia.yml` visível em **Actions**.
- [ ] Workflow permissions = **Read and write** no GitHub.

---

## 📝 Notas
- O broadcast de Seg 08h é **genérico e privado**: envia "Novos concursos esta semana" a TODOS os
  inscritos no KV, **sem** receber o perfil (o matching continua no aparelho). Se preferir, dá para
  restringir a assinantes Premium ajustando `worker/webpush.js`.
- A cota gratuita do Gemini (~20 req/dia por modelo) é o motivo dos 3 lotes/dias. O workflow já
  distribui cada lote em um dia (Sáb/Dom/Seg). Se ativar cobrança, pode reduzir para 1 job só.
