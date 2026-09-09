// functions/api/feedback.js — recebe o relato do usuário.
// - Grava em KV (binding SUPPORT) para a equipe consultar.
// - Se houver RESEND_API_KEY (opcional, grátis até ~100/dia e 3.000/mês),
//   envia o relato ao seu e-mail de suporte E dispara a auto-resposta
//   de agradecimento ao usuário. Sem a chave, a auto-resposta vem do
//   auto-responder da caixa (Gmail) — ver INSTALACAO.md.
import { json, rr, kv } from "../_lib.js";

export async function onRequestPost({ request, env }) {
  const body = await rr(request);
  const store = kv(env, env.KV_SUPPORT_NAME || "SUPPORT");
  if (store) {
    await store.put(`relato:${Date.now()}`, JSON.stringify({ at: new Date().toISOString(), ...body }));
  }
  const resend = env.RESEND_API_KEY;
  const dest = (env.EMAIL_PUBLICO || "suporte@cacaprova.com.br").trim().toLowerCase();
  // E-mail real do usuário: o cliente manda em `_replyto`. `body.email` é o endereço
  // público do suporte, então só usamos como fallback se não for o destino.
  const envio = (body._replyto || "").trim();
  const userEmail = envio ||
    (typeof body.email === "string" && body.email.trim() && body.email.trim().toLowerCase() !== dest
      ? body.email.trim()
      : "");
  let sent = false;
  if (resend) {
    const jsonBody = body.message || `${body.subject}\n\n${body.descricao || ""}`;
    try {
      // Notifica a equipe (ao endereço público que encaminha pro seu destino).
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${resend}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `${env.SUPPORT_FROM || "CAÇA PROVAS <suporte@cacaprova.com.br>"}`,
          to: [dest],
          reply_to: userEmail || undefined,
          subject: body.subject || "Relato de problema",
          text: jsonBody,
        }),
      });
      // Auto-resposta ao usuário.
      if (userEmail) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${resend}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: `${env.SUPPORT_FROM || "CAÇA PROVAS <suporte@cacaprova.com.br>"}`,
            to: [userEmail],
            subject: "Recebemos seu relato — CAÇA PROVAS",
            text: env.FEEDBACK_AUTO_REPLY || "Olá!\n\nRecebemos sua mensagem e agradecemos o contato. " +
              "Nossa equipe verificará o problema relatado e retornará em breve.\n\n" +
              "Atenciosamente,\nEquipe CAÇA PROVAS",
          }),
        });
      }
      sent = true;
    } catch (e) {
      sent = false;
    }
  }
  return json({ ok: true, enviado: sent });
}
