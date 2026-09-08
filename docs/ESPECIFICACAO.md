# 🎯 Concursei — Especificação & Arquitetura (v1)

> **Nome de trabalho:** *Concursei* (pode ser trocado). Alternativas: *ConcurseiroFit*, *Rumo ao Concurso*, *ConcursoMatch*.
> **Documento de referência** para o desenvolvimento em etapas. Aborda requisitos, arquitetura **híbrida** (privacidade-first), modelo de match, estratégia de **raspagem legal**, e a **stack 100% gratuita** para rodar o MVP.

---

## 1. Visão geral

Aplicativo web/PWA que **ajuda concurseiros a encontrar os concursos públicos certos**. O usuário informa o seu perfil e o sistema calcula um **índice de compatibilidade** para cada concurso (baseado no perfil, localização e pretensão salarial), montando uma **tela pessoal atualizada** com notificações e links que abrem a página do edital **dentro do próprio app** — sem perder o foco.

### Proposta de valor (o "porquê" de existir)
- **Privacidade first:** todos os dados pessoais do usuário ficam **no dispositivo dele**. O servidor não conhece o usuário (só serve a base pública de concursos). Diferencial real e difícil de copiar.
- **Foco:** links abertos no próprio ambiente (sem cair em redes sociais/abas).
- **Custo:** grátis para usar; premium acessível (R$ 19,90/ano).

---

## 2. Público-alvo e personas

| Persona | Perfil | Dor |
|---------|--------|-----|
| **Concurseira de interior (25–35)** | Ensino médio/superior, busca estabilidade, pouco tempo para pesquisar | Sente que "nunca fica sabendo" dos editais a tempo |
| **Concurseiro concorrido (graduado)** | Já fez vários concursos, quer filtros finos | Muitas fontes dispersas, perde prazos de inscrição |
| **Transição de carreira (30–45)** | Quer mudar de área, compara salários antes de decidir | Dificuldade em saber quanto vale cada concurso |

**Plataforma-alvo:** mobile (celular) e desktop — **PWA responsivo** (um app só, instalável).

---

## 3. Funcionalidades principais

### 3.1 Perfil do usuário
- Cadastro **100% manual**: formação/escolaridade, área de interesse, UF+cidade de preferência e raio de aceitação, pretensão salarial, regime preferido (estatutário/CLT/militar), disponibilidade (imediata/nos próximos X meses), e vínculo (estudante/graduado/pós).
- **Importação por PDF do Linkedin:** extrai os campos do currículo, pré-preenche o formulário e permite **editar** antes de salvar. O PDF **não é armazenado** — só os campos.
- Tudo salvo **no dispositivo**.

### 3.2 Base de concursos (central, no servidor)
- Coletada por **raspagem** de fontes públicas, **1×/semana** (em horário de baixo fluxo do servidor) — ver §6.
- Campos por concurso: órgão, esfera (municipal/estadual/federal), cargo, escolaridade mínima, área, UF/cidade, salário/remuneração, vagas, datas (publicação, abertura e fechamento de inscrição), prova, link oficial, fonte, hash do conteúdo.

### 3.3 Match ("Meus Concursos")
- Cálculo do **Índice de Compatibilidade 0–100** §5.
- Lista pessoal priorizada por score, com **explicação do motivo** ("sua formação ✓ · salário R$ 8.000 ✓ · a 80 km").
- Filtros refinados (escolaridade, área, UF, salário mínimo, data-limite).

### 3.4 Notificações (por etapa) + "modo foco"
- Alertas por **etapa**: edital publicado → inscrição aberta → fechamento de inscrição → prova → resultado.
- **Abrir no app:** a página oficial do edital carrega em uma **aba interna** (WebView/iframe), mantendo o usuário no app.

### 3.5 Conta & assinatura (Free / Premium) — §8

---

## 4. Arquitetura (HÍBRIDA — decisão central)

Há dois blocos de dados com naturezas **opostas**, e é isso que define a arquitetura:

| Bloco | Dados | Onde vive | Motivo |
|-------|-------|-----------|--------|
| **Perfil do usuário** | Pessoal, CPF/endereço, pretensão salarial | **No dispositivo** | Privacidade absoluta, zero vazamento |
| **Base de concursos** | Editais, cargos, salários, links | **No servidor** | É a mesma para todos; é o "ativo" central |

**Como o match funciona sem expor o usuário:**
1. O app (no dispositivo) baixa a **base de concursos** (que é pública).
2. O app calcula o **score localmente**, comparando o perfil local com a base.
3. Nada do perfil sai do aparelho. O servidor é "burro" (não conhece usuários) — apenas serve e atualiza a base e dispara notificações.

> ⚠️ **Exceção:** para **notificações push** é necessário registrar um "tópico/assinatura" do dispositivo. Para manter a privacidade, recomendamos **não** amarrar o push a dados pessoais — usa-se um identificador opaco (não é nome/CPF).

### Diagrama (visão)

```
   Dispositivo (PWA)                       Servidor (gratuito)
 ┌─────────────────────────┐            ┌──────────────────────────┐
 │  Perfil local (+ cripto) │            │  Base de concursos (DB)  │
 │  Motor de match (local)  │  ──dados──▶│                          │
 │  Tela "Meus Concursos"   │  públicos  │  Raspador (cron semanal) │
 │  WebView do edital       │  ◀──────── │  Push (FCM/web-push)     │
 │  Service Worker (PWA)    │            │  API "leve" de match? no │
 └─────────────────────────┘            └──────────────────────────┘
```

---

## 5. Índice de Compatibilidade (score)

```
Score (0–100) = 0,50 · Encaixe no Perfil + 0,30 · Proximidade Geográfica + 0,20 · Pretensão Salarial
```

**A. Encaixe no Perfil (50%)** — *cumpre os requisitos?*
- Escolaridade mínima exigida ≤ a sua → pontuação alta.
- Área do cargo ∈ suas áreas de interesse → pontua por overlap.
- Regime (estatutário/CLT) compatível com sua preferência.
- **Gate de elegibilidade:** se não cumpre a escolaridade mínima, o concurso é **excluído** de "recomendados" (pode aparecer em "parciais").

**B. Proximidade Geográfica (30%)** — *a que distância?*
- Faixas por distância da cidade do concurso à sua:
  - até 50 km → 100
  - 50–150 km → 80
  - 150–400 km → 55
  - >400 km → 25
- Usa latitude/longitude (ou UF+capital no free geocoding).

**C. Pretensão Salarial (20%)** — *vale a pena?*
- Remuneração ≥ pretensão → 100 (e cresce até um teto).
- Abaixo da pretensão → decresce até 0.

> **Por que mostrar o "porquê":** cada item listado (A/B/C) aparece como um "badge" no cartão do concurso. Isso não é só UX — é o que gera confiança e reduz a rejeição da recomendação.

---

## 6. Raspagem (legal e econômica)

### Regras de ouro da legalidade
- **Somente dados públicos**, sem login/paywall/captcha.
- **Respeitar `robots.txt` e termos de uso** de cada fonte.
- **Identificação:** `User-Agent` claro + contact info + rate limit agressivo.
- **Usar feeds/APIs estruturados** sempre que existirem (Diários Oficiais com dados abertos, sitemaps, RSS). É mais robusto e mais "legítimo" que quebrar HTML.
- **Cache inteligente:** gravar `hash` do conteúdo e usar `If-Modified-Since`; reprocessar **só o que mudou**. Reduz tráfego e tempo de crawl, e é mais gentil com o servidor.

### Fontes-alvo (exemplos)
- Diários Oficiais (municipal/estadual/federal) — muitos têm **API/dados abertos**.
- Portais de concursos consolidados (ex.: AOCP, FGV, Cebraspe, IBFC — sempre licitados/publicados publicamente).
- Sites de secretarias e órgãos (prefeituras, tribunais, defensorias, IFs/universidades).
- Feeds RSS de "editais" de cada órgão.

### Frequência e horário
- **Semanal (principal):** varredura completa. Cron em **horário de baixo fluxo** (madrugada de domingo/segunda, UTC).
- **Diária leve (opcional, recomendada):** apenas checar índices/sitemaps/RSS para detectar edital novo e sinalizar ("uma notificação a mais por dia"). Na prática, **editais importantes saem no meio da semana** — esperar 7 dias custa caro para o usuário; uma checagem leve diária é um meio-termo.

> **Nota técnica (agendamento):** o cron do **GitHub Actions** pode ser configurado com `timezone:` (disponível desde 2026) para alinhar ao horário local do servidor-alvo. Veja §7.

---

## 7. Stack 100% gratuita (recomendação)

> Revisados em 2026. Limites podem mudar — confirme antes de arquitetar em torno dos tetos.

### Front-end (PWA)
| Ferramenta | Custo | Papel |
|------------|-------|-------|
| React + **Vite** | Grátis (open-source) | App SPA / PWA |
| **vite-plugin-pwa** | Grátis | Manifest + Service Worker (instalável, offline, push) |
| Tailwind CSS | Grátis | UI responsiva (mobile-first) |
| **pdf.js** (+ Tesseract.js p/ OCR) | Grátis | Extração de dados do PDF do Linkedin **no dispositivo** |

### Hospedagem & Edge
| Ferramenta | Custo | Papel |
|------------|-------|-------|
| **Cloudflare Pages** | Grátis | Hospeda o PWA estático (builds ilimitados de estático; 500 builds/mês). Funções contam p/ Workers (100 mil req/dia). |
| **Cloudflare Workers** | Grátis | API leve / proxy para a base de concursos + **Cron Triggers** p/ agendamento (alternativa ao GitHub Actions). |
| **Cloudflare D1** | Grátis (SQLite, 500 MB, 5M leituras/dia) | Banco da **base de concursos** (edge). |

> **Alternativa (se preferir Postgres + Auth + Realtime):** **Supabase** grátis (500 MB Postgres, 50 mil MAU, 1 GB storage, 5 GB egress, 2 projetos). **Atenção:** projeto grátis **pausa após 7 dias de inatividade** — combina com crawl semanal se houver chamada que "acorde" o projeto.

### Raspagem / agendamento (free)
| Ferramenta | Custo | Papel |
|------------|-------|-------|
| **Python + requests + BeautifulSoup/lxml** (ou Playwright p/ JS/SPA) | Grátis | Coleta das fontes públicas |
| **GitHub Actions** (`on.schedule`) | Grátis (público: ilimitado; privado: 2.000 min/mês) | Cron semanal + diária leve. Mín. 5 min; precisa `timezone:` p/ alinhar; **repos públicos são desabilitados após 60 dias sem atividade** → manter repo ativo ou usar Cloudflare Cron. |
| **Cloudflare Workers Cron Triggers** | Grátis | Alternativa de cron na edge (sem "repo inativo"). |

### Extração de PDF (no cliente) — free
- **pdf.js** (Mozilla) para textos; **Tesseract.js** (OCR em Web Worker) como fallback para PDFs digitalizados.

### Notificações / push — free
- **Web Push (Push API + VAPID)** — biblioteca `web-push` (Node). **Sem serviço de terceiros**, chaves geradas por você. Funciona em navegadores/PWA (no iOS, exige o app **instalado na home screen**).
- **Firebase Cloud Messaging (FCM)** — entrega ilimitada e gratuita; bom se você já quer Android nativo depois.
- **OneSignal** — tem tier gratuito (mais simples p/ campanhas), porém via terceiros.

### Analytics — free e privacy-friendly
- **Umami** (self-hosted) ou **PostHog** (tier grátis). Evita Google Analytics (que coleta dados de usuários — conflita com sua proposta de privacidade).

### Pagamentos (PIX) — atenção: única área com custo real
- **Não existe gateway PIX 100% grátis.** O custo é **por transação** (não mensal). Opções com **mensalidade zero + taxa por transação**: **Mercado Pago**, **Asaas**, **Pagar.me**.
- Estratégia de custo: usar o **PIX estático/dinâmico + webhook** de um desses provedores e cobrar a taxa de R$ 19,90 na transação. Como o valor é baixo e a recorrência é anual, a taxa por transação é aceitável.
- **Pix Automático** (recorrência) está ganhando espaço — útil para o plano anual.

> **Conclusão de custo:** o MVP roda **com R$ 0 de assinatura mensal** (Cloudflare + GitHub Actions + libs open-source). O único custo é a **taxa por transação do PIX** quando houver cobrança, e/ou **Cloudflare Pro (opcional, ~US$ 5/mês)** se ultrapassar a cota de Workers.

---

## 8. Free vs Premium

| Recurso | Free | Premium (R$ 19,90/ano) |
|---------|:----:|:-----:|
| Perfil (manual + PDF) | ✅ | ✅ |
| Match com índice de compatibilidade | ✅ (nº de concursos limitado) | ✅ (ilimitado) |
| Explicação do motivo do match | Parcial | ✅ Completa |
| Filtros avançados (salário mínimo, área, data) | ❌ (básico) | ✅ |
| Alertas por etapa (edital→inscrição→prova) | Padrão | ✅ Todos + prioridade |
| App → abrir edital no app (foco) | ✅ | ✅ |
| Concursos salvos / histórico de editais | ❌ | ✅ |
| Alertas inteligentes de "novo edital" | ❌ | ✅ |

> **Check do preço:** R$ 19,90/ano ≈ R$ 1,66/mês. Excelente ponto de entrada. **No PWA/Web o PIX é direto (fica 100% seu).** Se migrar para **app nativo de loja**, a Apple/Google cobra 15–30% → o líquido cai para ~R$ 14–17. Verifique antes de decidir (e PIX em loja tem restrições de política).

---

## 9. Modelo de dados

### 9.1 No dispositivo (LocalStorage / IndexedDB) — *nunca sai do aparelho*
```
perfil = {
  nome, email_contato, formacao: {nivel, area, instituicao},
  interesses: [area1, area2], 
  localizacao: {uf, cidade, lat, lng, raio_km},
  pretensao_salarial,
  regime_preferido, disponibilidade, vinculo,
  versao_cripto, pin_hash        // opcional: criptografia local
}
saved_concursos = [ {concursoId, score, data_salvo} ]
```
> **Opcional (recomendado):** criptografia local dos campos sensíveis com chave derivada de PIN. Se o usuário perder o PIN, os dados "são esquecidos" (pode oferecer backup criptografado).

### 9.2 No servidor (D1/SQLite ou Supabase/Postgres)
```
consumos (concurso) = {
  id, orgao, esfera, cargo, escolaridade_min, area, 
  uf, cidade, lat, lng, salario, vagas,
  dt_publicacao, dt_inscricao_abre, dt_inscricao_fecha, dt_prova,
  link_oficial, fonte, hash_conteudo, ativo
}
push_topics = { topic_key, kind }   // p/ notificações (identificador opaco, não pessoal)
crawl_log   = { fonte, last_fetch, last_hash, status }
```

---

## 10. Telas / fluxo (PWA)

1. **Onboarding / Importar perfil** → botão "Importar do PDF (LinkedIn)" ou "Preencher manualmente" → formulário editável.
2. **Dashboard "Meus Concursos"** → lista ordenada por score, com badges do porquê; filtros.
3. **Detalhe do concurso** → cartão com todos os campos + ações ("Salvar", "Abrir edital no app").
4. **Aba interna do edital** → WebView/iframe da página oficial (mantém o foco).
5. **Alertas/Notificações** → centro de notificações + push por etapa.
6. **Conta / Assinatura** → status Free/Premium + upgrade PIX.
7. *(Admin, v2)* → painel para conferir base, fontes e logs do crawl.

---

## 11. Requisitos não funcionais

- **Privacidade (LGPD):** princípio da minimização; dados locais; sem cookie de rastreamento por terceiros.
- **Offline-first:** PWA com cache da base de concursos; funciona sem conexão para o match.
- **Performance:** base leve; listas virtualizadas; malha de tiles leve.
- **Acessibilidade:** foco do público é amplo (interior, apps antigos) → botões grandes, alto contraste.

---

## 12. Roadmap (etapas)

**Etapa 0 — Especificação** ✅ *(este documento)*

**Etapa 1 — MVP (validação):**
- Perfil manual + importação PDF (pdf.js) no dispositivo.
- Base de concursos **simulada** (dados de exemplo + 1 fonte real se possível).
- Motor de match + score + tela "Meus Concursos" + badges do porquê.
- Deploy: Cloudflare Pages (PWA).

**Etapa 2 — Raspagem real** ✅ *(implementada)*
- Fontes públicas oficiais integradas: **FGV Conhecimento, Fundatec, IDECAN** (3 fontes).
- GitHub Actions (`scrape.yml`): **cron semanal** (quarta 03:00 BRT) + **checagem diária leve**.
- Limpeza/normalização + **deduplicação por id/hash** + **cache**. Grava `concursos.json`
  (acervo central servido ao app) + **schema D1** opcional (`crawler/db/schema.sql`).
- O app carrega o acervo central com **fallback local** (`data.js`).
- Fontes atrás de WAF/anti-bot (Cebraspe, IBFC, AOCP, VUNESP, Consulplan) ficam para a Etapa 5
  (via Workers/headless), mantendo a legalidade (robots.txt respeitado).

**Etapa 3 — Valor recorrente:**
- Notificações push por etapa (Web Push/VAPID ou FCM) + aba interna do edital.

**Etapa 4 — Monetização:**
- Free vs Premium (limites) + checkout PIX (Mercado Pago/Asaas) + webhook.

**Etapa 5 — Escala:**
- Mais fontes, filtros avançados, histórico de editais, métricas (Umami/PostHog), busca e IA para resumir editais (opcional, via Workers AI/API gratuita).

---

## 13. Métricas de sucesso (OKRs)

- **Ativação:** % de usuários que completam o perfil e veem ≥1 match.
- **Retenção:** abertura de notificação por etapa; reengajamento semanal.
- **Conversão:** taxa Free→Premium (meta inicial 2–5%).
- **Foco:** tempo no app via aba interna (proxy de "não perdeu o foco").

---

## 14. Decisões pendentes / riscos

| Tema | Decisão | Risco / observação |
|------|---------|--------------------|
| Nome do app | Concursei? | Troca simples antes de produção |
| Fonte inicial | Qual 1ª fonte real de concursos | Depende de `robots.txt`/estrutura da fonte |
| Cripto do perfil | PIN opcional | Balanço UX x segurança |
| Push iOS | Requer instalar PWA na home | Limitação técnica da Apple |
| Gateway PIX | Escolher provedor (Mercado Pago/Asaas) | **Único custo real** (taxa por transação) |
| Cloudflare Pro | Só se exceder Workers (100k dia) | Upgrade ~US$ 5/mês quando crescer |

---

## Referências / verificação de limites gratuitos (2026)
- Cloudflare Pages & Workers free tiers — builds, requests, CPU: [custos/limites](https://www.devtoolreviews.com/reviews/cloudflare-pages-pricing-bandwidth-limits-2026)
- Supabase free tier (500 MB Postgres, 50k MAU, pausa 7 dias): [supabase pricing](https://makerkit.dev/blog/saas/supabase-pricing)
- GitHub Actions free minutes e cron (mín 5 min, `timezone:`, 60 dias inativo): [free tier](https://cicdcalculator.com/github-actions-free-tier), [cron guide](https://cronuru.com/guides/github-actions-scheduled-workflows)
- Web Push com `web-push`/VAPID (grátis, sem terceiros) e FCM (entrega ilimitada grátis): [web-push vs FCM vs OneSignal](https://www.pkgpulse.com/guides/web-push-vs-onesignal-vs-firebase-push-notifications-2026)
