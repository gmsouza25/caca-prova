// ============================================================
//  CONFIG.JS — configuração central do CAÇA PROVAS
//  Um único lugar para trocar: e-mail de suporte (com portabilidade),
//  PIX e push. Os módulos (pix.js, feedback.js, push.js) leem daqui.
//
//  ➜ Edite APENAS este arquivo para configurar o produto.
//  Os valores marcados com [SECRET:...] podem ser injetados no build
//  via scripts/build-config.mjs lendo variáveis de ambiente.
// ============================================================

export const CONFIG = {
  app: {
    nome: "CAÇA PROVAS",
    versao: "0.4.0",
  },

  // ---------------------------------------------------------
  //  PORTABILIDADE DE E-MAIL
  //  O endereço PÚBLICO (exibido ao usuário) aponta para um DESTINO
  //  real, que fica OCULTO. Configuramos reencaminhamento (forwarding)
  //  gratuito, sem o usuário ver o destino.
  // ---------------------------------------------------------
  email: {
    // Endereço que aparece para o usuário ("oficial").
    publico: "suporte@cacaprova.com.br",          // [SECRET:EMAIL_PUBLICO]

    // Destino real (OCULTO). NUNCA exibimos este endereço no app.
    destino: "gmsouza25@gmail.com",                // [SECRET:EMAIL_DESTINO]

    // Se true, o app mostra apenas `publico`; o `destino` nunca aparece.
    ocultarDestino: true,

    // Como o e-mail chega ao destino (opções: "cloudflare" | "gmail" | "workspace")
    roteamento: "cloudflare",
  },

  // ---------------------------------------------------------
  //  PIX (assinatura Premium R$ 19,90/ano)
  // ---------------------------------------------------------
  pix: {
    // Chave PIX do recebedor (CPF/CNPJ/e-mail/telefone/aleatória).
    chave: "03386809502",                          // [SECRET:PIX_CHAVE]
    nome: "CACA PROVAS",      // máx. 25 caracteres  (marca)
    nomeRecebedor: "",        // nome completo do titular (opcional; se vazio usa `nome`)  [SECRET:PIX_NOME_RECEBEDOR]
    cidade: "RECIFE",         // máx. 15 caracteres
    txid: "***",              // id da transação (até 25)
    valor: 19.90,             // R$ por ano                            [SECRET:PIX_VALOR]
    moeda: "986",             // 986 = BRL

    // Gateway de cobrança automática: "demo" | "mercadopago" | "gerencianet" | "asas" | "custom".
    gateway: "mercadopago",                               // [SECRET:GATEWAY_MODE]
    gatewayUrl: "",           // seu backend/Worker que faz proxy ao gateway  [SECRET:GATEWAY_URL]
    // Endpoint do status (usado no "Já paguei" p/ confirmar pelo webhook).
    // Vazio => "/api" (as Pages Functions no MESMO domínio). Em gateway real,
    // pode apontar para um Worker:  https://seu-worker.workers.dev
    statusEndpoint: "",                            // [SECRET:PIX_STATUS_ENDPOINT]
    // Endpoint que cria a cobrança no backend (Pages Function /api/pix-create).
    // Vazio => "/api". Em gateway real, aponte para o seu Worker de proxy.
    criarEndpoint: "",                             // [SECRET:PIX_CRIAR_ENDPOINT]
  },

  // ---------------------------------------------------------
  //  RELATO DE PROBLEMA (tela de suporte)
  // ---------------------------------------------------------
  feedback: {
    // Endpoint para envio do relato (Web3Forms/Formspree/Google Apps Script).
    // Vazio => usa mailto: (abre o app de e-mail do usuário, grátis).
    endpoint: "/api/feedback",                                  // [SECRET:FEEDBACK_ENDPOINT]
    mensagemAuto: "Recebemos sua mensagem e agradecemos o contato. Nossa equipe verificará o problema relatado e retornará em breve.",
  },

  // ---------------------------------------------------------
  //  NOTIFICAÇÕES PUSH EM BACKGROUND (opcional, sem custo)
  // ---------------------------------------------------------
  push: {
    // true => usa as Pages Functions no MESMO domínio (rotas /api/...). Publique
    // o projeto no Cloudflare Pages e defina a env PUSH_USE_FUNCTIONS=true no build.
    useFunctions: true,                                  // [SECRET:PUSH_USE_FUNCTIONS]
    endpoint: "",             // Worker externo (ex.: https://worker.workers.dev). Vazio => notifica só com app aberto.  [SECRET:PUSH_ENDPOINT]
    publicKey: "",            // preenchido automaticamente via /keys  [SECRET:PUSH_PUBLIC_KEY]
  },
};
