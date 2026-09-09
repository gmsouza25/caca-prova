// ============================================================
//  FEEDBACK.JS — "Relatar problema" (Contato com a equipe)
//  Envia o relato para o e-mail de suporte e apresenta um aviso
//  de confirmação (o usuário receberá um e-mail automático de
//  agradecimento informando que a equipe verificará a falha).
//
//  Estratégia de envio (máximo de recursos gratuitos):
//   - Se `FEEDBACK.endpoint` estiver configurado (Web3Forms/Formspree/
//     Google Apps Script), faz POST e o serviço envia o e-mail.
//   - Senão, cai em `mailto:` (abre o app de e-mail do usuário já
//     preenchido) — funciona hoje, sem custo e sem cadastro.
//
//  AUTO-RESPOSTA (e-mail de agradecimento): acontece no servidor de
//  e-mail de destino, por uma destas opções gratuitas:
//   1) Auto-responder da caixa de suporte (Gmail: Configurações →
//      Ver todas as configurações → Avançado → Resposta automática).
//   2) Um endpoint Google Apps Script (grátis) que grava o relato em
//      uma planilha E envia o e-mail de agradecimento ao usuário.
//   Ver `EXEMPLO_APPS_SCRIPT` abaixo.
// ============================================================

import { CONFIG } from "./config.js";

// O endereço exibido ao usuário é o PÚBLICO (com portabilidade). O destino
// real fica oculto (CONFIG.email.destino) e é usado apenas no servidor de
// reencaminhamento — nunca aparece no app.
export const FEEDBACK = {
  email: CONFIG.email.publico || "suporte@cacaprova.com.br",
  destino: CONFIG.email.ocultarDestino ? CONFIG.email.destino : CONFIG.email.publico,
  ocultarDestino: !!CONFIG.email.ocultarDestino,
  endpoint: CONFIG.feedback.endpoint || "",   // Web3Forms/Formspree/Apps Script (vazio = mailto)
  assunto: "Relato de problema — CAÇA PROVAS",
  mensagemAuto: CONFIG.feedback.mensagemAuto,
};

// Categorias de problema para o formulário.
export const TIPOS = [
  { id: "bug", label: "Bug / erro no app" },
  { id: "match", label: "Compatibilidade / score errado" },
  { id: "dado", label: "Dado de concurso incorreto" },
  { id: "link", label: "Link do edital não abre" },
  { id: "pdf", label: "Importação do PDF (LinkedIn)" },
  { id: "pagamento", label: "Pagamento (PIX / Premium)" },
  { id: "notif", label: "Notificações" },
  { id: "outro", label: "Outro" },
];

// Monta o corpo da mensagem (texto puro, amigável a e-mail).
export function montarCorpo({ tipo, descricao, email, contexto }) {
  const tipoLabel = (TIPOS.find((t) => t.id === tipo) || {}).label || "Outro";
  const linhas = [
    `Tipo: ${tipoLabel}`,
    ``,
    `Descrição:`,
    (descricao || "").trim() || "(não informada)",
    ``,
    `Contato de resposta: ${(email || "").trim() || "(não informado)"}`,
  ];
  if (contexto) linhas.push(``, `Contexto do aparelho:`, String(contexto).slice(0, 600));
  return linhas.join("\n");
}

// Envia o relato. Retorna { ok, via } — via = "endpoint" | "mailto" | "local".
export async function enviarFeedback(dados) {
  const corpo = montarCorpo(dados);
  if (FEEDBACK.endpoint) {
    try {
      const res = await fetch(FEEDBACK.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: FEEDBACK.email,
          subject: `${FEEDBACK.assunto} — ${(TIPOS.find((t) => t.id === dados.tipo) || {}).label || ""}`,
          message: corpo,
          _replyto: dados.email || "",
        }),
      });
      if (res.ok) return { ok: true, via: "endpoint" };
    } catch { /* cai para local */ }
    return { ok: false, via: "endpoint" };
  }
  // Sem endpoint: abre o app de e-mail do usuário (funciona hoje, grátis).
  const subject = encodeURIComponent(FEEDBACK.assunto);
  const body = encodeURIComponent(corpo);
  return { ok: true, via: "mailto", url: `mailto:${FEEDBACK.email}?subject=${subject}&body=${body}` };
}

// Marca/limpa histórico local do contato (opcional, para UX).
const KEY = "caca-prova:feedback:v1";
export function loadFeedback() { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } }
export function saveFeedback(f) { try { localStorage.setItem(KEY, JSON.stringify(f)); } catch {} }

// ---- EXEMPLO de endpoint grátis (Google Apps Script) ----
// Crie um Apps Script, cole abaixo, publique como web app (acesso: qualquer),
// e use a URL em `feedbackEndpoint`:
//
//   function doPost(e) {
//     const d = JSON.parse(e.postData.contents);
//     const ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.create("CAÇA PROVAS — Relatos");
//     const sh = ss.getSheets()[0];
//     sh.appendRow([new Date(), d.subject, d.message, d.email, d._replyto]);
//     // E-mail automático de agradecimento ao usuário
//     if (d._replyto) {
//       MailApp.sendEmail(d._replyto, "Recebemos seu relato — CAÇA PROVAS",
//         "Olá!\n\nRecebemos sua mensagem e agradecemos o contato. " +
//         "Nossa equipe verificará o problema relatado e retornará em breve.\n\n" +
//         "Atenciosamente,\nEquipe CAÇA PROVAS");
//     }
//     return ContentService.createTextOutput(JSON.stringify({ ok: true }))
//       .setMimeType(ContentService.MimeType.JSON);
//   }
//
// Alternativa sem código: ative o "Resposta automática" na caixa de suporte
// (Gmail/Outlook) com o texto de agradecimento.
