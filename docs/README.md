# 🎯 CAÇA PROVAS — Etapa 1 (MVP) + Etapa 2 (Raspagem real) + Etapa 3 (Notificações) + Etapa 4 (PIX)

> **Aplicativo PWA para concurseiros** que calcula a compatibilidade com os
> concursos públicos com base no seu perfil. **Dados 100% no seu dispositivo**
> (perfil) + **acervo central de editais públicos** (raspagem semanal).

## O que já funciona nesta Etapa 1

- **Perfil do usuário (no aparelho):**
  - Preenchimento **manual** (escolaridade, áreas de interesse, cidade, pretensão
    salarial, regime, disponibilidade, vínculo).
  - **Importação de PDF (LinkedIn):** extrai os campos com `pdf.js` (local, offline)
    e permite **editar** antes de salvar. O PDF não é armazenado — só os campos.
  - Tudo gravado em `localStorage` **no dispositivo**. Nada sai do aparelho.
- **Acervo central de concursos (raspagem real — Etapa 2):** 4 fontes públicas
  oficiais (FGV, Fundatec, IDECAN, IFPE) geram `concursos.json` (semanal, via
  GitHub Actions). Dezenas de editais reais com **órgão, cargo, localização, área,
  escolaridade, datas e link oficial**. `data.js` permanece como **exemplo local
  (fallback offline)** para o Recife-PE.
  > Como o acervo vem centralizado, o app usa o `concursos.json` e, se estiver
  > offline, cai nos dados de exemplo.
- **Motor de match (local):** índice de compatibilidade **0–100** com pesos:
  **50% encaixe no perfil + 30% proximidade geográfica + 20% pretensão salarial**,
  com badges do "porquê" (Formação ✓ · Área ✓ · Salário ✓ · X km).
- **Tela "Meus Concursos":** lista ordenada por score, filtros por **área** e
  **escolaridade**, gráfico de score e detalho do porquê de cada componente.
- **Detalhe do concurso** com todos os campos (datas, salário, vagas, status) e
  **modo foco** ("Ler no app") — abre a página do edital dentro do próprio
  ambiente, para **não perder o foco**. Há também o link da página oficial.
- **Free vs Premium (simulado):** no plano Free, até **10 concursos** e menos recursos;
  no Premium, ilimitado + banner de upgrade. (A cobrança real via PIX é a Etapa 4.)
- **PWA:** manifest, ícone SVG e **Service Worker** com cache offline.

## ✅ Etapa 2 — Raspagem real (acervo central)

- **Fontes (públicas/oficiais, editais públicos):** FGV Conhecimento, Fundatec e
  IDECAN. A prioridade é **legalidade + estabilidade**: respeitamos `robots.txt`,
  usamos `User-Agent` identificável com contato, aplicamos **rate-limit** e rodamos
  no **horário de menor tráfego** (quarta, 03:00 AM em Recife).
- **Pipeline (`crawler/`):** fetch honesto → parse por fonte → **normalização** para
  o schema do app (escolaridade, áreas, esfera, regime, cidade/estado+lat/lng por
  geocodificação offline, datas, status) → **deduplicação por hash** → **merge com cache**
  (não "some" a lista se a fonte cair) → grava `concursos.json` + schema **D1** opcional.
- **Agendamento (GitHub Actions):** `scrape.yml` roda **semanal** (cron) e uma
  **checagem diária leve** de disponibilidade das fontes. 100% Grátis.
- **Integração no app:** o app carrega `concursos.json` (rede-primeiro, com fallback
  cache/offline); se indisponível, usa os dados de exemplo (`data.js`).
- **Datas reais:** para a Fundatec, buscamos a página de cada edital para extrair o
  período de inscrições (o que alimenta o filtro premium "Inscrições abertas" e os
  alertas por etapa). O acervo central é **filtrado para concursos ativos**.

> **Transparência:** fontes que ficam atrás de WAF/anti-bot (ex.: Cebraspe, IBFC,
> AOCP, VUNESP, Consulplan) foram sondadas; algumas respondem 403 para robôs. Elas
> estão mapeadas na especificação e entram na Etapa 5 (via Workers/headless) sem
> comprometer a legalidade. Também deixamos o **IDECAN** listado a partir do domínio
> `www` (o portal de detalhe é protegido, mas só usamos o link oficial).

**Como gerar o acervo novamente (local ou CI):**

```bash
cd caca-prova/crawler
npm install          # instala o cheerio (só dependência)
node index.js        # escreve ../concursos.json (+ crawler/out/ e db/schema.sql)
node index.js --dry-run         # só mostra o resumo
node index.js --source=fgv      # só uma fonte
```

## Como executar

> **IMPORTANTE:** use o servidor `serve.py` (não o `python -m http.server`).
> Ele adiciona o cabeçalho `Access-Control-Allow-Origin: *`, necessário para que os
> módulos ES carreguem quando a página roda dentro de um iframe de origem opaca
> (como o preview interno). Sem isso, o app abre em branco.

```bash
cd caca-prova
python3 serve.py 8080
# acesse http://localhost:8080/index.html
```

### Git (salvar / publicar)

Toda a configuração sensível (PIX, e-mail, endpoints) fica no **`config.js`** com
marcadores `[SECRET:...]`; no build, o `scripts/build-config.mjs` injeta os valores
reais vindos de variáveis de ambiente — assim **não commita a chave PIX real**.

```bash
cd /home/user/caca-prova
git init
git add .
git commit -m "feat: CAÇA PROVAS - MVP + raspagem + premium + push + pix"
git remote add origin https://github.com/SEU_USUARIO/caca-prova.git
git branch -M main
git push -u origin main
```

> **Preview interno (iframe sem internet):** o app roda e a interface funciona
> normalmente. O **import de PDF** usa `pdf.js` local, então também funciona. Para
> ver o PWA completo (instalável + service worker), abra em um navegador com
> internet (e servindo via HTTP/HTTPS).

> **Se abrir com `python -m http.server` ou direto no arquivo:** o app pode não
> carregar por causa do CORS (módulos) e/ou do `localStorage` (iframe sandbox).
> Sempre use `serve.py`.

## Como testar

1. Clique em **"Montar meu perfil"**.
2. Ou clique em **"✨ Usar exemplo"** para preencher um perfil de demonstração
   (Maria Clara, graduada em Administração, Recife-PE, pretensão R$ 5.200).
3. Clique em **"Importar PDF (LinkedIn)"** se tiver um PDF de currículo — o app
   lê e pré-preenche os campos (edite antes de salvar).
4. Volte em **"Concursos"** para ver a lista ordenada por compatibilidade.
5. Abra um concurso com **"Abrir edital"** → o conteúdo aparece **dentro do app** (modo foco); use **"Abrir no site do órgão"** para o portal oficial (funciona em navegador real).
6. Em **"Conta"**, ative o **Premium** (demo) para liberar os 10+ concursos.
7. No **primeiro acesso** o app exige aceitar os **Termos de Responsabilidade, de Uso e de
   Privacidade** — sem marcar "Li e aceito", o app **não inicia**. A aceitação é salva no
   aparelho (com versão e data) e pode ser revista em *Conta → Termos*.

## 🆓 Free vs 👑 Premium (diferenciação real)

| Recurso | Free | Premium (R$ 19,90/ano) |
|---|---|---|
| Perfil + importação de PDF | ✓ | ✓ |
| Match por compatibilidade | **até 10** | ilimitado |
| Badges "por que apareceu" | parcial | completo |
| **Filtros avançados** (salário mín., distância máx., inscrições abertas) | — | ✓ |
| **Concursos salvos (favoritos ⭐)** + filtro "Salvos" | — | ✓ |
| **Notificações por etapa** (edital → inscrição → prova) | — | ✓ |
| **Frequência do resumo**: semanal / mensal / trimestral | — | ✓ |

- Os **filtros avançados** e o botão de **salvar** só aparecem/logicamente só funcionam no
  Premium; no Free aparecem bloqueados convidando ao upgrade.
- O **sino 🔔** no topo mostra o contador de etapas futuras dos seus concursos salvos.
- A **configuração de notificações** está em *Conta* e é exclusiva do Premium; a escolha de
  frequência (semanal/mensal/trimestral) define a janela do resumo de etapas.

> **Nota:** as notificações exibidas são o **resumo das próximas etapas** calculado no
> aparelho. O envio real de push push (mesmo para o celular) requer um servidor — previsto
> na Etapa 3 (Web Push/FCM).

## Estrutura

| Arquivo | Função |
|---------|--------|
| `data.js` | Base de **exemplo** local (Recife-PE) + listas de escolaridade/áreas/regimes (fallback) |
| `concursos.json` | **Acervo central** (gerado pela raspagem semanal) — fonte da verdade |
| `central.js` | Carrega o acervo central com fallback para `data.js` (offline) |
| `crawler/` | Pipeline de raspagem: fontes (FGV/Fundatec/IDECAN/IFPE) + **PCI (enriquecimento)**, normalização, hash/dedup, cache. `node crawler/index.js --enrich-only` re-enriquece sem re-raspar |
| `match.js` | Motor de compatibilidade (score 0–100, NEUTRO=70 p/ dado ausente) — roda **localmente** |
| `profile.js` | Perfil no dispositivo + extração de texto do PDF (`pdf.js`) + interpretação |
| `app.js` | Interface (PWA): navegação, match, filtros, detalhe, conta |
| `config.js` | **Configuração central**: e-mail (portabilidade), PIX, push, relato — edite só aqui |
| `pix.js` | Gera **payload PIX (BR Code/EMV)** + QR + integração **gateway PIX** |
| `feedback.js` | Tela **Relatar problema**: envia e-mail + auto-resposta |
| `push.js` | Cliente de **Web Push** (subscription + agendamento de eventos) |
| `worker/webpush.js` | Worker Cloudflare (grátis) que envia os pushs (cron + VAPID) |
| `lib/qrcode.js` | Gerador de QR (MIT, offline) usado por `pix.js` |
| `styles.css` | Tema (mobile-first, dark) |
| `index.html`, `manifest.webmanifest`, `sw.js`, `icon.svg` | Shell do PWA |
| `lib/pdfjs/` | Biblioteca `pdf.js` (local, offline) |
| `INSTALACAO.md` | Como instalar como PWA e **como confiar** (SHA-256, sem lojas) |
| `fingerprints.json` | Hashes SHA-256 dos arquivos (verificação anti-adulteração) |
| `.github/workflows/scrape.yml` | Cron semanal + checagem diária (GitHub Actions) |

## Etapa 3 — Notificações por etapa (parcialmente implementada)

**Já feito (roda no aparelho, sem servidor):**
- Alertas por etapa dos **concursos salvos** (edital publicado → inscrições abertas →
  fim das inscrições → prova) dentro da janela da frequência escolhida
  (**semanal / mensal / trimestral**).
- Só exibe quando o app está **aberto** (`premium.js → notifyUpcoming`).
- Clicar na notificação **foca o app e abre o edital em modo foco** (`#conc=<id>`,
  tratado no `sw.js` → `notificationclick` e no `app.js`).
- Solicitação de permissão no ato de habilitar (com fallback honesto se o usuário negar).

**Por que só quando o app está aberto:** notificações automáticas *em background*
(com o app fechado) exigem **Web Push**, que por sua vez exige um **servidor** para
enviar o push. Para manter a arquitetura **100% local/privada** e usar o **máximo de
recursos gratuitos**, o caminho recomendado é:

1. **Cloudflare Workers** (plano gratuito) guardando as *push subscriptions* dos
   Premium e agendando o envio.
2. Sincronizar as subscriptions quando o usuário ativa as notificações.
3. Usar a lib **`web-push`** + par **VAPID** (chaves geradas uma vez) no Worker,
   com cron (Cron Trigger) na frequência escolhida.
4. Não há perfil no servidor — só a subscription (não identifica o conteúdo do perfil).

> **Trade-off deliberado:** assim que houver push em background, um pequeno dado
> (a subscription) sai do aparelho. A decisão de ativar isso pode ficar para o
> momento em que validarmos o produto com o piloto real.

## Próximas etapas

- **Etapa 3 (push em background):** implementado em `worker/webpush.js` + `push.js`.
  **Deploy grátis em `worker/README.md`** (Cloudflare Worker + KV + VAPID + Cron
  Trigger). Sem configurar `pushEndpoint`, o app mantém as notificações locais (app aberto).
- **Etapa 4 — Monetização:** assinatura via **PIX** gera **QR + código copia-e-cola**
  (`pix.js` + `lib/qrcode.js`, offline). Confirmação demo ("Já paguei") libera na hora.
  **Gateway real:** basta preencher `PIX_CONFIG.gatewayUrl` e trocar `gateway: "demo"`
  por `"mercadopago"|"gerencianet"|"asas"|"custom"`. `criarCobranca()` e
  `consultarStatus()` já estão prontos para o webhook do gateway liberar o Premium.
- **Contato/Relato:** tela **Relatar problema** envia para o e-mail de suporte e o
  usuário recebe uma **confirmação automática**. `feedback.js` usa um endpoint
  (Web3Forms/Formspree/Apps Script) ou **mailto** como fallback; a auto-resposta vem
  do auto-responder da caixa ou do exemplo Apps Script incluído no arquivo.
- **Etapa 5 — Escala:** mais fontes (as que exigem headless/Workers), histórico,
  métricas e IA para resumir editais.

> **Instalação e confiança:** veja `INSTALACAO.md` (instalar como PWA, verificar
> integridade SHA-256, e por que não estamos nas lojas).

> **Arquitetura (resumo):** o **perfil fica no dispositivo** (privacidade total) e a
> **base de concursos fica no servidor** (dados públicos). O **match é calculado no
> aparelho**, comparando o perfil local com a base pública — o servidor **não
> conhece o usuário**. Ver `ESPECIFICACAO.md` (pasta `concursei/`).
