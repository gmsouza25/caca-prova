# CAÇA PROVAS — Como instalar e como confiar (sem App Store/Play Store)


## Por que não está nas lojas?

Você está certo em perguntar. O CAÇA PROVAS **não usa** Google Play nem App Store de propósito:

1. **Direito de escolha e liberdade** — lojas cobram (R$ ~125/ano a Google, 30% da Apple no in-app), impõem regras e podem **remover o app a qualquer momento**. Um PWA instalado direto do navegador é seu: você é o dono.
2. **Privacidade-first** — o app roda no seu aparelho, os dados de perfil **nunca saem** do dispositivo. Não há rastreador, nem conta obrigatória, nem servidor coletando dados. Isso é uma escolha de arquitetura, não uma limitação.
3. **Tudo gratuito e verificado** — a hospedagem é em serviço gratuito (GitHub Pages / Cloudflare Pages), o código é aberto e você pode **auditar** cada linha.

**Troca justa:** como não há loja "mediando", a instalação é feita pelo próprio navegador ("Adicionar à tela inicial"/"Instalar aplicativo"). O app continua **funcionando offline** depois do primeiro acesso, pois guarda tudo em cache no aparelho.

---

## Como confiar no download

Você confia por **quatro camadas** que, juntas, tornam a verificação muito mais forte do que "baixar de uma loja":

### 1. HTTPS (conexão criptografada)
O site é servido com **HTTPS** (cadeado na barra de endereço). Qualquer arquivo que você baixa **veio do servidor cujo certificado foi validado** — ninguém no meio do caminho (rede de café, provedor) consegue injetar código sem quebrar o cadeado.

### 2. Código aberto que você pode ler
Você pode baixar o projeto inteiro e ler o que cada arquivo faz. Não há código ofuscado nem binário "caixa-preta". Conferir o que o app faz é literalmente abrir `app.js`, `match.js`, `profile.js`.

### 3. Assinatura de integridade (SHA-256) — detecção de adulteração
Junto ao app publicamos `fingerprints.json`, com o **hash SHA-256 de cada arquivo**. Qualquer pessoa pode conferir se os arquivos que estão no ar (ou que você baixou) batem com o que foi publicado.

### 4. Nada sai do seu aparelho
Mesmo que houvesse código malicioso, o pior cenário seria limitado: o app **não tem backend**, não envia seus dados a lugar nenhum. Não há o que "roubar" — a base de editais é pública e o perfil fica só no seu celular.

---

## Como verificar a integridade (hash)

Baixe o projeto (ou os arquivos) e compare com `fingerprints.json`.

**Linux / macOS (terminal):**
```bash
sha256sum caminho/para/app.js
brew install coreutils   # se no macOS faltar 'sha256sum' (usa 'gsha256sum')
```

**Windows (PowerShell):**
```powershell
Get-FileHash .\app.js -Algorithm SHA256
```

Compare o resultado com o valor em `fingerprints.json`. Se **bater**, o arquivo é exatamente o publicado. `concursos.json` é **volátil** (regenera na raspagem semanal), por isso fica fora da lista — mas o app funciona com ele apenas como cache do acervo central.

---

## Como instalar como app (PWA)

**Android / Chrome:**
1. Abra a URL do CAÇA PROVAS.
2. Toque no menu **⋮** (canto superior direito) → **"Adicionar à tela inicial"** (ou **"Instalar aplicativo"**).
3. Confirme. O ícone (mira + lupa + check) vai para a tela inicial.

**iPhone / Safari:**
1. Abra a URL. Toque no botão **Compartilhar** (quadrado com seta).
2. Escolha **"Adicionar à tela de início"**.
3. Confirme. Abra pelo ícone — agora roda em tela cheia.

**Computador (Chrome/Edge):**
1. Abra a URL.
2. Clique no ícone de **instalar** na barra de endereço (ou menu ⋮ → **Instalar CAÇA PROVAS**).

> O primeiro acesso precisa de internet (para baixar o shell e a base). Depois disso o app funciona **offline**.

---

## ✉️ E-mail de suporte com PORTABILIDADE (endereço oficial → destino oculto)

Você quer `suporte@cacaprova.com.br` **encaminhando** as mensagens para
`gmsouza25@gmail.com`, sem o usuário ver o destino. Isso se faz com
**reencaminhamento (forwarding) gratuito**. A opção mais simples e robusta:

### Cloudflare Email Routing (grátis, ilimitado)
1. **Aponte seu domínio** (`cacaprova.com.br`) para o Cloudflare (se ainda não estiver).
   É grátis — basta adicionar o site e trocar os *nameservers* no seu registrador (Registro.br/GoDaddy/Hostinger etc.) pelos do Cloudflare.
2. No painel Cloudflare → **Email → Email Routing** → **Enable**.
3. Adicione o **destino real**: `gmsouza25@gmail.com` e **verifique** (o Google envia um código).
4. Crie a **regra de roteamento**:
   - Personalizado: `suporte@cacaprova.com.br` → encaminhar para `gmsouza25@gmail.com`.
   - (ou *Catch-all*: tudo de `cacaprova.com.br` → `gmsouza25@gmail.com`).
5. O Cloudflare cria **automaticamente** os registros **MX + SPF** (não precisa mexer à mão; só garanta que não haja outro MX de outra plataforma).

**Resultado:** quem escreve para `suporte@cacaprova.com.br` cai na sua caixa do Gmail.
O Gmail **não aparece** para quem enviou — só o endereço oficial. ✔

> ⚠️ **Como as mensagens chegam ao Gmail.** Ao responder *de dentro do Gmail*, o "De:" mostra
> `gmsouza25@gmail.com` (a não ser que você configure). Para **reponder como** `suporte@...`:
> - **Gmail "Enviar como"** (Configurações → Contas → Enviar mensagens como), adicionando
>   `suporte@cacaprova.com.br` (você valida o domínio com o MX/SPF do Cloudflare), **ou**
> - Use o **auto-responder** da caixa: Gmail → Configurações → *Ver todas* → *Avançado* →
>   **Resposta automática**, com o texto de agradecimento (assim o usuário recebe a confirmação
>   mesmo sem você responder manualmente), **ou**
> - Endpoint **Google Apps Script** (grátis) que grava em planilha e responde — código pronto
>   em `feedback.js`.

## Requisitos para recursos opcionais

- **Notificações (Premium):** exigem HTTPS + permissão concedida no navegador. Sem um servidor de push (a Etapa 3 com Web Push/VAPID), os alertas aparecem quando o app está aberto. O caminho com envio real está documentado no `README.md`.
- **Importação de PDF do LinkedIn (ex.: `exemplo/perfil-exemplo.pdf`):** roda 100% no aparelho (PDF.js), sem enviar o arquivo a nenhum servidor.

---

## Resumo

| O que | Status |
|---|---|
| Instalação sem lojas | ✅ por design (PWA instalável) |
| Funciona offline | ✅ após o 1º acesso |
| Código auditável | ✅ aberto, sem ofuscação |
| Verificação anti-adulteração | ✅ SHA-256 (`fingerprints.json`) |
| Privacidade (perfil fica no aparelho) | ✅ 100% local |
| Assinatura Premium (PIX R$ 19,90/ano) | ✅ QR + copia-e-cola + chave CPF + aviso de piloto |
| Notificações por etapa (app aberto) | ✅ implementado |
| Notificações push reais (com app fechado) | ✅ Worker + Pages Functions prontas (Cloudflare grátis) |
| Relatar problema (e-mail + auto-resposta) | ✅ tela + envio (`functions/api/feedback.js`) + confirmação |
| Publicação (Etapa 5+7) | ✅ guia `PUBLICAR.md` + `_headers` + Pages Functions |
| Segredos (não commitar chave/e-mail) | ✅ `scripts/build-config.mjs` injeta env vars no build |

> **Publicar:** veja `PUBLICAR.md` (passo a passo Cloudflare Pages, Etapas 5+7 juntas).
> **Segredos:** rode `node scripts/build-config.mjs` no build com as env vars
> (`PIX_CHAVE`, `EMAIL_DESTINO`, etc.) — assim o repo não guarda a chave.
