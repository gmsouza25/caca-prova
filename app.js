// ============================================================
//  APP.JS — CAÇA PROVAS (PWA) — interface e lógica (local)
// ============================================================

import { CONCURSOS as BASE_CONCURSOS, ESCOLARIDADES, AREAS, REGIMES, areaLabel } from "./data.js";
import { recomendados, matchConcursos } from "./match.js";
import { geoFor } from "./geo.js";
import { loadProfile, saveProfile, deleteProfile, emptyProfile, getPdfText, interpretarCurriculo, loadTermsAccepted, saveTermsAccepted } from "./profile.js";
import { TERMOS, AVISO_LEGAL } from "./termos.js";
import { loadSub, saveSub, setPremium, getSubRef, isSaved, toggleSave, FREQ, setNotif, buildDigest, notifyUpcoming, revalidarPremium } from "./premium.js";
import { loadCentral } from "./central.js";
import { buildPixPayload, pixQrSvg, PIX_CONFIG, criarCobranca, consultarStatus, consultarConfirmacao } from "./pix.js";
import { FEEDBACK, TIPOS, enviarFeedback, loadFeedback, saveFeedback } from "./feedback.js";
import { PUSH, pushSupported, ativarPush, agendarEventos, carregarChave } from "./push.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

let profile = loadProfile() || null;
let sub = loadSub();
// Acervo de concursos: começa com exemplo local; é substituído pelo acervo central (real)
// quando disponível. Mantido como `let` para que o match/digest usem sempre o atual.
let CONCURSOS = BASE_CONCURSOS;
let centralMeta = null;
const state = { view: "home", filtroArea: null, filtroEsc: null, detalhe: null, destaque: null, premium: !!sub.premium, filtroSalMin: null, filtroDistMax: null, filtroDatLimite: false, soSalvos: false, filtroLocal: "todos" };
let lastPixCheck = 0; // throttle da revalidação de assinatura (1x/30min)

// ---------- formatação ----------
const fmtSalario = (v) => (v != null ? "R$ " + v.toLocaleString("pt-BR") : "—");
const fmtVagas = (v) => (v != null ? `${v} vaga(s)` : "vagas não informadas");
const fmtCidade = (c) => {
  if (c.nacional) return "🇧🇷 Nacional";
  return (c.cidade && c.cidade !== "Não informado") ? c.cidade : "local a definir";
};
// badge de confiabilidade dos dados (fonteDados/estimado) — usa "≈" p/ estimado
const fmtFonte = (c) => {
  if (c.fonteDados === "edital") return `<span class="pill ok">✓ edital</span>`;
  if (c.estimado) return `<span class="pill warn">≈ estimado</span>`;
  if (c.semEdital) return `<span class="pill warn">ver edital</span>`;
  return "";
};
const fmtSalarioFonte = (c) => `<span>💼 ${c.estimado ? "≈ " : ""}${fmtSalario(c.salario)}</span>`;
const fmtRegime = (r) => (r == null ? "a definir" : REGIMES.find((x) => x.id === r)?.label || r);
const fmtEsc = (e) => (e == null ? "a definir" : ESCOLARIDADES.find((x) => x.id === e)?.label || e);
const fmtArea = (a) => (a && a.length ? a.map(areaLabel).join(", ") : "a definir");
const fmtData = (d) => (d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—");
const now = new Date();

// REGRA: só divulgamos concursos em que ainda dá para se inscrever.
//  - Sem data de fecho => não sabemos que fechou => mantém (não assumimos que encerrou).
//  - Com data de fecho  => mantém APENAS se for hoje ou futuro (data < hoje => encerrado).
const isInscricaoAberta = (c) => {
  const f = c.dt_inscricao_fecha;
  if (!f) return true;
  const t = new Date(String(f) + "T00:00:00").getTime();
  if (Number.isNaN(t)) return true; // data ilegível => não sabemos => mantém
  return t >= Date.now();
};

// ---------- navegação ----------
function go(view) {
  state.view = view;
  $$(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + view));
  $$(".nav button").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  if (view === "home") renderHome();
  if (view === "perfil") renderPerfil();
  if (view === "conta") renderConta();
  window.scrollTo(0, 0);
}
function bindNav() {
  $$(".nav button").forEach((b) => b.addEventListener("click", () => go(b.dataset.view)));
}

// ---------- HOME / Meus Concursos ----------
function renderHome() {
  const wrap = $("#view-home .match-wrap");
  const data = centralMeta ? centralMeta.generatedAt.split("T")[0] : "2026-08-26";
  const fonte = centralMeta ? "acervo central (raspagem)" : "exemplo local";
  $("#baseCount").textContent = `Base ${fonte} · ${CONCURSOS.length} editais · atualizada em ${fmtData(data)}`;
  const notifCount = state.premium && sub.notif.enabled ? buildDigest(CONCURSOS, sub).items.length : 0;
  const bell = state.premium
    ? `<button class="bell" onclick="go('conta')" title="Notificações">🔔${notifCount ? `<span class="bell-badge">${notifCount}</span>` : ""}</button>`
    : "";
  $("#topUser").innerHTML = `${bell}${profile && profile.nome ? `👤 ${esc(profile.nome.split(" ")[0])}` : ""}`;
  if (!profile) {
    wrap.innerHTML = `
      <div class="hero">
        <div class="hero-icon" aria-hidden="true">
          <svg viewBox="0 0 48 48" width="92" height="92">
            <circle cx="24" cy="24" r="20" fill="none" stroke="#22c55e" stroke-width="3.5"/>
            <circle cx="24" cy="24" r="12" fill="none" stroke="#4ade80" stroke-width="2.6"/>
            <circle cx="24" cy="24" r="4.5" fill="#4ade80"/>
            <g stroke="#22c55e" stroke-width="2.8" stroke-linecap="round">
              <line x1="24" y1="1.5" x2="24" y2="5.5"/><line x1="24" y1="42.5" x2="24" y2="46.5"/>
              <line x1="1.5" y1="24" x2="5.5" y2="24"/><line x1="42.5" y1="24" x2="46.5" y2="24"/>
            </g>
            <circle cx="26" cy="22" r="12.5" fill="rgba(238,241,255,0.06)" stroke="#eef1ff" stroke-width="2.8"/>
            <line x1="35" y1="31" x2="41" y2="37" stroke="#eef1ff" stroke-width="3.6" stroke-linecap="round"/>
            <path d="M20 23 L24 27 L31 18" fill="none" stroke="#4ade80" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <h2>Encontre seu edital ideal</h2>
        <p>Preencha seu perfil (ou importe do seu PDF do LinkedIn) e o <b>CAÇA PROVAS</b> calcula o <b>índice de compatibilidade</b> de cada concurso — tudo no seu aparelho, sem sair daqui.</p>
        <button class="btn primary" onclick="go('perfil')">Montar meu perfil</button>
      </div>`;
    return;
  }
  const FREE_LIMIT = 10; // concursos visíveis no plano Free
  // REGRA (sempre ativa): só concursos com inscrição ainda aberta (não remover fechados da contagem)
  const lista = recomendados(profile, CONCURSOS).filter(isInscricaoAberta);
  const totalMatches = lista.length;
  const best = lista[0]?.score || 0;

  // filtros base (Free)
  let visiveis = lista;
  if (state.filtroArea) visiveis = visiveis.filter((c) => c.area.includes(state.filtroArea));
  if (state.filtroEsc) visiveis = visiveis.filter((c) => c.escolaridade === state.filtroEsc);

  // filtro de local (Filtro por IA): nacionais / com local / sem local
  if (state.filtroLocal === "nacional") visiveis = visiveis.filter((c) => !!c.nacional);
  else if (state.filtroLocal === "comLocal") visiveis = visiveis.filter((c) => !c.nacional && c.cidade && c.cidade !== "Não informado");
  else if (state.filtroLocal === "semLocal") visiveis = visiveis.filter((c) => !c.nacional && (!c.cidade || c.cidade === "Não informado"));

  // filtros avançados (Premium)
  if (state.premium) {
    if (state.filtroSalMin) visiveis = visiveis.filter((c) => c.salario >= state.filtroSalMin);
    if (state.filtroDistMax) visiveis = visiveis.filter((c) => c.km == null || c.km <= state.filtroDistMax);
    if (state.filtroDatLimite) visiveis = visiveis.filter((c) => (new Date(c.dt_inscricao_fecha + "T00:00:00").getTime() >= Date.now()));
    if (state.soSalvos) visiveis = visiveis.filter((c) => isSaved(c.id, sub));
  }

  // limite Free (não premium mostra "até X")
  const capped = !state.premium && visiveis.length > FREE_LIMIT;
  const mostrados = capped ? visiveis.slice(0, FREE_LIMIT) : visiveis;
  const blocoUpgrade = capped
    ? `<div class="upgrade-banner">🔒 Você viu os ${FREE_LIMIT} melhores. <b>Assine o Premium</b> para ver os ${visiveis.length} concursos e ter filtros avançados + alertas por etapa.
        <button class="btn primary" onclick="go('conta')">Quero o Premium</button></div>`
    : ``;
  const blocoSalvos = state.premium && state.soSalvos
    ? `<div class="upgrade-banner">⭐ Mostrando apenas seus <b>${mostrados.length}</b> concursos salvos.</div>`
    : ``;

  $("#view-home .resumo-stats").innerHTML = `
    <div class="stat"><b>${totalMatches}</b><span>concursos<br>que você atende</span></div>
    <div class="stat"><b>${best}</b><span>melhor<br>compatibilidade</span></div>
    <div class="stat"><b>${mostrados.length}</b><span>mostrando<br>agora</span></div>`;

  // filtros
  let filtrosHTML = `
    <div class="fnota">🎯 Mostrando apenas concursos com <b>inscrição ainda aberta</b>.</div>
    <label class="flabel">Área
      <select id="filtroArea">
        <option value="">Todas</option>
        ${AREAS.map((a) => `<option value="${a.id}" ${state.filtroArea === a.id ? "selected" : ""}>${a.label}</option>`).join("")}
      </select>
    </label>
    <label class="flabel">Escolaridade
      <select id="filtroEsc">
        <option value="">Todas</option>
        ${ESCOLARIDADES.map((e) => `<option value="${e.id}" ${state.filtroEsc === e.id ? "selected" : ""}>${e.label}</option>`).join("")}
      </select>
    </label>
    <label class="flabel">📍 Local (filtro por IA)
      <select id="filtroLocal">
        <option value="todos">Todos</option>
        <option value="comLocal" ${state.filtroLocal === "comLocal" ? "selected" : ""}>Com local definido</option>
        <option value="nacional" ${state.filtroLocal === "nacional" ? "selected" : ""}>Nacionais 🇧🇷</option>
        <option value="semLocal" ${state.filtroLocal === "semLocal" ? "selected" : ""}>Local a definir</option>
      </select>
    </label>`;
  if (state.premium) {
    filtrosHTML += `
      <label class="flabel">Salário mín. (R$)
        <input id="filtroSalMin" type="number" min="0" step="100" value="${state.filtroSalMin || ""}" placeholder="0">
      </label>
      <label class="flabel">Distância máx.
        <select id="filtroDistMax">
          <option value="">Todas</option>
          ${[50, 150, 400, 900].map((k) => `<option value="${k}" ${state.filtroDistMax === k ? "selected" : ""}>até ${k} km</option>`).join("")}
        </select>
      </label>
      <button class="btn ghost ${state.soSalvos ? "on" : ""}" id="btnSalvos">⭐ Salvos (${sub.saved.length})</button>`;
  } else {
    filtrosHTML += `<button class="btn ghost" id="btnAvancados">🔒 Filtros avançados</button>`;
  }
  $("#view-home .filtros").innerHTML = filtrosHTML;

  $("#filtroArea").addEventListener("change", (e) => { state.filtroArea = e.target.value || null; renderHome(); });
  $("#filtroEsc").addEventListener("change", (e) => { state.filtroEsc = e.target.value || null; renderHome(); });
  if ($("#filtroLocal")) $("#filtroLocal").addEventListener("change", (e) => { state.filtroLocal = e.target.value || "todos"; renderHome(); });
  if ($("#filtroSalMin")) $("#filtroSalMin").addEventListener("input", (e) => { state.filtroSalMin = Number(e.target.value) || null; renderHome(); });
  if ($("#filtroDistMax")) $("#filtroDistMax").addEventListener("change", (e) => { state.filtroDistMax = Number(e.target.value) || null; renderHome(); });
  if ($("#btnSalvos")) $("#btnSalvos").addEventListener("click", () => { state.soSalvos = !state.soSalvos; renderHome(); });
  if ($("#btnAvancados")) $("#btnAvancados").addEventListener("click", () => { toast("🔒 Filtros avançados são do Premium."); go("conta"); });

  wrap.innerHTML = visiveis.length
    ? blocoUpgrade + blocoSalvos + `<div class="cards">${mostrados.map(card).join("")}</div>`
    : `<div class="empty">Nenhum concurso corresponde aos filtros. Ajuste o perfil ou os filtros.</div>`;

  // badge de destaque no detalhe
  if (state.destaque) { const el = $(`[data-id="${state.destaque}"]`); if (el) el.classList.add("destaque"); }
}

function card(c) {
  const pills = c.motivo.map((m) => `<span class="pill">${m}</span>`).join("");
  const saved = isSaved(c.id, sub);
  const bairroNota = `${c.componentes.proximidade}%`;
  return `
  <article class="card-conc" data-id="${c.id}">
    <div class="c-top">
      <div class="c-orgao">${c.orgao} · <span class="c-esfera">${c.esfera}</span></div>
      <div class="c-top-right">
        <button class="star ${saved ? "on" : ""}" data-salvar="${c.id}" title="Salvar concurso">${saved ? "★" : "☆"}</button>
        <div class="c-score"><span>${c.score}</span><small>/100</small></div>
      </div>
    </div>
    <h3 class="c-cargo">${c.cargo}${fmtFonte(c) ? ` <span style="vertical-align:middle">${fmtFonte(c)}</span>` : ""}</h3>
    <div class="c-meta">
      <span>📍 ${fmtCidade(c)}${c.km != null ? ` (${c.km} km)` : ""}</span>
      ${fmtSalarioFonte(c)}
      <span>👥 ${fmtVagas(c.vagas)}</span>
    </div>
    <div class="c-bar"><i style="width:${Math.min(100, c.score)}%"></i></div>
    <div class="c-motivo">${pills}</div>
    <div class="c-comp">
      <span>Perfil <b>${c.componentes.encaixe}%</b></span>
      <span>Proximidade <b>${bairroNota}</b></span>
      <span>Salário <b>${c.componentes.salario}%</b></span>
    </div>
    <div class="c-actions">
      <button class="btn ghost" data-ver="${c.id}">Ver detalhes</button>
      <button class="btn primary" data-abrir="${c.id}">Abrir edital</button>
    </div>
  </article>`;
}

// ---------- detalhe do concurso ----------
function abrirDetalhe(id, expandEdital = false) {
  const c = recomendados(profile, CONCURSOS).find((x) => x.id === id) || CONCURSOS.find((x) => x.id === id);
  state.detalhe = c;
  const m = $(".modal");
  m.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-card">
      <div class="m-head">
        <div><span class="m-orgao">${c.orgao}</span><span class="m-esfera">${c.esfera}</span></div>
        <button class="m-close" onclick="closeModal()">✕</button>
      </div>
      <div class="m-tag">📄 Edital aberto no app · modo foco</div>
      <h3 class="m-cargo">${c.cargo}${fmtFonte(c) ? ` <span style="vertical-align:middle">${fmtFonte(c)}</span>` : ""}</h3>
      <div class="m-score">Compatibilidade <b>${c.score}/100</b></div>
      <div class="m-grid">
        <div><span>Salário</span><b>${fmtSalario(c.salario)}</b></div>
        <div><span>Vagas</span><b>${fmtVagas(c.vagas)}</b></div>
        <div><span>Cidade</span><b>${fmtCidade(c)}</b></div>
        <div><span>Regime</span><b>${fmtRegime(c.regime)}</b></div>
        <div><span>Escolaridade mínima</span><b>${fmtEsc(c.escolaridade)}</b></div>
        <div><span>Área</span><b>${fmtArea(c.area)}</b></div>
        <div><span>Publicação</span><b>${fmtData(c.dt_publicacao)}</b></div>
        <div><span>Inscrição</span><b>${fmtData(c.dt_inscricao_abre)} → ${fmtData(c.dt_inscricao_fecha)}</b></div>
        <div><span>Prova</span><b>${fmtData(c.dt_prova)}</b></div>
        <div><span>Status</span><b class="c-status">${c.status}</b></div>
      </div>
      <div class="m-motivo">${c.motivo.map((x) => `<span class="pill">${x}</span>`).join("")}</div>

      <div class="m-edital" id="mEdital" style="display:${expandEdital ? "block" : "none"}">
        <div class="reader-bar"><b>📄 Conteúdo do edital (no app)</b><span class="mut">modo foco</span></div>
        <div class="reader-body">${editalHTML(c)}</div>
      </div>

      <div class="m-actions">
        <button class="btn primary" id="btnToggleEdital" ${expandEdital ? "style='display:none'" : ""}>📄 Ler edital completo no app</button>
        <a class="btn ghost" href="${c.link}" target="_blank" rel="noopener" id="btnSite">🌐 Abrir no site do órgão</a>
        <button class="btn ghost" id="btnSalvarModal">⭐ Salvar</button>
      </div>
      <p class="m-note">🔗 O edital oficial fica no portal do órgão. Para preservar o foco, o conteúdo também é exibido aqui dentro do aplicativo.</p>
    </div>`;
  m.style.display = "flex";
  updateModalSaveButton(c.id);

  const toggle = $("#btnToggleEdital");
  if (toggle) toggle.addEventListener("click", () => {
    $("#mEdital").style.display = "block";
    toggle.style.display = "none";
  });
}

function updateModalSaveButton(id) {
  const b = $("#btnSalvarModal");
  if (!b) return;
  const saved = isSaved(id, sub);
  b.textContent = saved ? "★ Salvo" : "⭐ Salvar";
  b.classList.toggle("on", saved);
  b.onclick = () => {
    if (!state.premium) { toast("🔒 Salvar concursos é recurso do Premium."); go("conta"); return; }
    sub = toggleSave(id, sub);
    updateModalSaveButton(id);
    toast(saved ? "Removido dos salvos" : "⭐ Concurso salvo");
    if (state.view === "home") renderHome();
  };
}

function editalHTML(c) {
  const req = [
    ESCOLARIDADES.find((x) => x.id === c.escolaridade)?.label || c.escolaridade,
    (c.area || []).map(areaLabel).join("; "),
    REGIMES.find((r) => r.id === c.regime)?.label || c.regime,
  ].filter(Boolean).join(" · ");
  return `
    <h4>Edital publicado</h4>
    <p>${c.vagas != null ? `São <b>${c.vagas}</b> vaga(s) para o cargo de <b>${c.cargo}</b>` : `Concurso para o cargo de <b>${c.cargo}</b>`} no(a) <b>${c.orgao}</b>, com lotação em ${c.cidade}.</p>

    <h4>Requisitos</h4>
    <p>${esc(req)}</p>

    <h4>Remuneração</h4>
    <p><b>${fmtSalario(c.salario)}</b> (valor de referência). Verifique vantagens e benefícios no edital oficial.</p>

    <h4>Cronograma</h4>
    <ul>
      <li><b>Publicação do edital:</b> ${fmtData(c.dt_publicacao)}</li>
      <li><b>Inscrições:</b> ${fmtData(c.dt_inscricao_abre)} a ${fmtData(c.dt_inscricao_fecha)}</li>
      <li><b>Prova prevista:</b> ${fmtData(c.dt_prova)}</li>
    </ul>

    <h4>Situação atual</h4>
    <p>${c.status}</p>

    <h4>Fonte</h4>
    <p>${esc(c.fonte)}</p>
  `;
}

function closeModal() { const m = $(".modal"); m.style.display = "none"; m.innerHTML = ""; state.detalhe = null; }

// ---------- PERFIL ----------
function renderPerfil() {
  const p = profile || emptyProfile();
  $("#view-perfil").innerHTML = `
    <h2>Seu perfil</h2>
    <p class="leaf">🔒 Tudo fica <b>somente neste aparelho</b>. Nada é enviado para servidores — seu perfil é privado.</p>
    <div class="import-box">
      <div><b>Quer preencher mais rápido?</b><p>Importe seu currículo do LinkedIn (PDF). O app extrai os dados e você pode editar.</p></div>
      <div class="import-actions">
        <label class="btn ghost">📄 Importar PDF (LinkedIn)<input type="file" id="filePdf" accept="application/pdf" hidden></label>
        <button class="btn ghost" id="btnExemplo">✨ Usar exemplo</button>
      </div>
    </div>
    <div id="pdfStatus" class="pdf-status" style="display:none"></div>

    <form id="formPerfil" class="form">
      <div class="frow">
        <label><span>Nome completo</span><input name="nome" value="${esc(p.nome)}" placeholder="Seu nome"></label>
        <label><span>E-mail de contato</span><input name="email" type="email" value="${esc(p.email)}" placeholder="voce@email.com"></label>
      </div>
      <label><span>Escolaridade</span>
        <select name="escolaridade">${ESCOLARIDADES.map((e) => `<option value="${e.id}" ${p.escolaridade === e.id ? "selected" : ""}>${e.label}</option>`).join("")}</select></label>
      <label><span>Áreas de interesse</span></label>
      <div class="chips">${AREAS.map((a) => `<button type="button" class="chiparea ${(p.interesses||[]).includes(a.id) ? "on" : ""}" data-area="${a.id}">${a.label}</button>`).join("")}</div>
      <div class="frow">
        <label><span>Cidade (sua)</span><input name="cidade" value="${esc(p.cidade)}"></label>
        <label><span>UF</span><input name="uf" value="${esc(p.uf)}" maxlength="2"></label>
      </div>
      <label><span>Pretensão salarial (R$)</span><input name="pretensao" type="number" min="0" step="100" value="${p.pretensao || ""}"></label>
      <div class="frow">
        <label><span>Regime preferido</span>
          <select name="regime">${REGIMES.map((r) => `<option value="${r.id}" ${p.regime === r.id ? "selected" : ""}>${r.label}</option>`).join("")}</select></label>
        <label><span>Disponibilidade</span>
          <select name="disponibilidade">
            <option value="imediata" ${p.disponibilidade === "imediata" ? "selected" : ""}>Imediatamente</option>
            <option value="3m" ${p.disponibilidade === "3m" ? "selected" : ""}>Em até 3 meses</option>
            <option value="6m" ${p.disponibilidade === "6m" ? "selected" : ""}>Em até 6 meses</option>
            <option value="flex" ${p.disponibilidade === "flex" ? "selected" : ""}>Flexível</option>
          </select></label>
      </div>
      <label><span>Vínculo</span>
        <select name="vinculo">
          <option value="estudante" ${p.vinculo === "estudante" ? "selected" : ""}>Estudante</option>
          <option value="graduado" ${p.vinculo === "graduado" ? "selected" : ""}>Graduado</option>
          <option value="pos" ${p.vinculo === "pos" ? "selected" : ""}>Pós-graduando</option>
          <option value="outro" ${p.vinculo === "outro" ? "selected" : ""}>Outro</option>
        </select></label>
      <div class="form-actions">
        <button class="btn primary" type="submit">Salvar perfil</button>
        ${profile ? `<button class="btn ghost" type="button" id="btnReset">Restaurar padrão</button>` : ""}
      </div>
    </form>`;

  // interação com as áreas
  $$(".chiparea").forEach((b) => b.addEventListener("click", () => b.classList.toggle("on")));

  // salvar
  $("#formPerfil").addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const interesses = $$(".chiparea.on").map((b) => b.dataset.area);
    const novo = {
      ...profile,
      nome: fd.get("nome"), email: fd.get("email"),
      escolaridade: fd.get("escolaridade"), interesses,
      cidade: fd.get("cidade") || "Recife", uf: fd.get("uf") || "PE",
      pretensao: Number(fd.get("pretensao")) || 0,
      regime: fd.get("regime"), disponibilidade: fd.get("disponibilidade"), vinculo: fd.get("vinculo"),
    };
    salvarCidade(novo); // infere lat/lng da cidade (Recife-PE default)
    saveProfile(novo);
    window.profile = novo; profile = novo;
    toast("✅ Perfil salvo no aparelho");
    go("home");
  });

  const rb = $("#btnReset");
  if (rb) rb.addEventListener("click", () => { deleteProfile(); location.reload(); });

  if ($("#btnExemplo")) $("#btnExemplo").addEventListener("click", () => {
    const ex = emptyProfile();
    Object.assign(ex, {
      nome: "Maria Clara Bezerra", email: "maria.clara@email.com",
      escolaridade: "superior", interesses: ["administracao", "gestao", "educacao"],
      cidade: "Recife", uf: "PE", pretensao: 5200, regime: "estatutario",
      disponibilidade: "imediata", vinculo: "graduado",
    });
    salvarCidade(ex); saveProfile(ex); profile = ex; window.profile = ex;
    renderPerfil(); go("home"); toast("✨ Perfil de exemplo criado");
  });

  if ($("#filePdf")) $("#filePdf").addEventListener("change", (e) => importarPdf(e.target.files[0]));
}

function importarPdf(file) {
  const st = $("#pdfStatus"); st.style.display = "flex"; st.className = "pdf-status";
  st.innerHTML = `<span class="spin"></span> Lendo PDF…`;
  if (!file) { st.style.display = "none"; return; }
  file.arrayBuffer().then((buf) => getPdfText(buf)).then((texto) => {
    if (!texto) throw new Error("PDF sem texto extraível (pode ser digitalizado).");
    const dados = interpretarCurriculo(texto);
    st.className = "pdf-status ok";
    st.innerHTML = `✅ PDF lido. ${dados.nome ? "Nome: <b>" + esc(dados.nome) + "</b>. " : ""}Confira e edite os campos abaixo.`;
    // aplica no formulário atual sem salvar ainda
    const f = $("#formPerfil");
    if (f && dados.nome) f.querySelector('[name="nome"]').value = dados.nome;
    if (f && dados.escolaridade) f.querySelector('[name="escolaridade"]').value = dados.escolaridade;
    if (f && dados.interesses && dados.interesses.length) {
      $$(".chiparea").forEach((b) => b.classList.toggle("on", dados.interesses.includes(b.dataset.area)));
    }
    if (dados.nome) toast("Dados importados — revise antes de salvar");
  }).catch((err) => {
    st.className = "pdf-status err";
    st.innerHTML = `⚠️ ${esc(err.message || "Não foi possível ler o PDF.")}`;
  });
}

// infere lat/lng de cidades conhecidas (default Recife-PE)
function salvarCidade(perfil) {
  // Geocodifica qualquer cidade/UF (capitais, cidades do acervo, ou capital da UF).
  // Nunca "chuta" Recife: se não conhece a cidade, deixa lat/lng nulos (match fica NEUTRO).
  const g = geoFor(perfil.cidade, perfil.uf);
  perfil.lat = g ? g.lat : null;
  perfil.lng = g ? g.lng : null;
}

// ---------- CONTA ----------
function renderConta() {
  const pg = state.premium;
  $("#view-conta").innerHTML = `
    <h2>Sua conta</h2>
    <div class="tier ${pg ? "premium" : ""}">
      <div class="tier-badge">${pg ? "👑 Premium" : "Power Free"}</div>
      <p>${pg ? "Você tem acesso a todos os recursos." : "Recursos essenciais de graça — faça upgrade quando quiser."}</p>
      <div class="tier-price"><b>R$ 19,90</b><span>/ano</span></div>
    </div>
    <div class="table">
      <div class="trow head"><span>Recurso</span><span>Free</span><span>Premium</span></div>
      <div class="trow"><span>Perfil + PDF</span><span class="ok">✓</span><span class="ok">✓</span></div>
      <div class="trow"><span>Match por compatibilidade</span><span>até 10</span><span class="ok">ilimitado</span></div>
      <div class="trow"><span>Por que apareceu (score)</span><span class="mut">parcial</span><span class="ok">completo</span></div>
      <div class="trow"><span>Filtros avançados (salário, distância, datas)</span><span class="mut">—</span><span class="ok">✓</span></div>
      <div class="trow"><span>Concursos salvos (favoritos)</span><span class="mut">—</span><span class="ok">✓</span></div>
      <div class="trow"><span>Alertas das etapas (edital → inscrição → prova)</span><span class="mut">—</span><span class="ok">✓</span></div>
      <div class="trow"><span>Notificações (semanal/mensal/trimestral)</span><span class="mut">—</span><span class="ok">✓</span></div>
    </div>

    <div class="notif-card">
      <h3>🔔 Notificações dos seus concursos</h3>
      ${pg
        ? `<label class="switch-row"><input type="checkbox" id="notifEnabled" ${sub.notif.enabled ? "checked" : ""}> <span>Receber alertas das etapas</span></label>
           <label class="flabel">Frequência do resumo
             <select id="notifFreq">${FREQ.map((f) => `<option value="${f.id}" ${sub.notif.frequencia === f.id ? "selected" : ""}>${f.label} (a cada ${f.days} dias)</option>`).join("")}</select>
           </label>
           <div class="digest" id="digest"></div>`
        : `<div class="notif-lock">🔒 <b>Notificações são exclusivas do Premium.</b><br><span>Alerta quando sai edital, abre a inscrição, fecha o prazo e chega a prova.</span></div>`}
    </div>

    <div class="form-actions">
      ${pg
        ? `<button class="btn ghost" id="btnDowngrade">Voltar ao Free</button>`
        : `<button class="btn primary" id="btnUpgrade">💰 Assinar Premium — R$ 19,90/ano (PIX)</button>`}
    </div>
    <div class="fine">💳 Upgrade via <b>PIX</b> (pagamento direto, sem loja). Taxa de processamento por transação é o único custo do plano.</div>
    <div class="fine" style="margin-top:8px">📄 Revise os <a href="#" onclick="reverTermos();return false;">Termos de Responsabilidade e de Privacidade</a> · aceito na versão <span id="termsVerTag">${esc((loadTermsAccepted() || {}).version || "—")}</span></div>

    <div class="ajuda-card">
      <div class="ajuda-row">
        <div>
          <b>Encontrou um problema?</b>
          <p>Relate para a equipe e receba um e-mail de confirmação. Ajudamos a melhorar o app.</p>
        </div>
        <button class="btn ghost" id="btnRelatar">🛠️ Relatar problema</button>
      </div>
    </div>`;

  if ($("#btnUpgrade")) $("#btnUpgrade").addEventListener("click", mostrarPix);
  if ($("#btnConfirmarPix")) $("#btnConfirmarPix").addEventListener("click", () => {
    state.premium = true; sub = setPremium(true); closeModal(); renderConta(); toast("👑 Premium ativado. Bem-vindo(a)!");
  });
  if ($("#btnRelatar")) $("#btnRelatar").addEventListener("click", abrirRelato);
  if ($("#btnDowngrade")) $("#btnDowngrade").addEventListener("click", () => {
    state.premium = false; sub = setPremium(false); renderConta(); toast("Voltou ao plano Free.");
  });
  if ($("#notifEnabled")) $("#notifEnabled").addEventListener("change", (e) => {
    sub = setNotif({ enabled: e.target.checked, frequencia: sub.notif.frequencia }, sub);
    if (e.target.checked && "Notification" in window) {
      Notification.requestPermission().then((p) => {
        if (p !== "granted") { sub = setNotif({ enabled: false, frequencia: sub.notif.frequencia }, sub); renderDigest(); toast("🔕 Sem permissão — notificações ficam desativadas."); }
        else {
          // Push em background (se worker configurado). Sem endpoint => só local.
          if (pushSupported()) {
            const userId = profile && profile.email ? profile.email : "anon";
            ativarPush(userId).then((subPush) => {
              setTimeout(() => agendarEventos(userId, eventosParaPush(), subPush), 1500);
            }).catch(() => {});
            toast("🔔 Notificações ativadas (push em background).");
          } else {
            toast("🔔 Notificações ativadas (aparecem com o app aberto).");
          }
        }
      });
    }
    renderDigest();
  });
  if ($("#notifFreq")) $("#notifFreq").addEventListener("change", (e) => {
    sub = setNotif({ enabled: sub.notif.enabled, frequencia: e.target.value }, sub);
    renderDigest();
  });
  if ($("#digest")) renderDigest();
}

// ---------- PIX (assinatura Premium) ----------
function mostrarPix() {
  let payload;
  try { payload = buildPixPayload(PIX_CONFIG); } catch (e) { toast("Não foi possível gerar o PIX: " + esc(e.message)); return; }
  const valor = PIX_CONFIG.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  // Nome do recebedor: usa o nome completo do titular (se definido) senão a marca.
  const nomePix = PIX_CONFIG.nomeRecebedor || PIX_CONFIG.nome;
  // Modo de confirmação: demo => manual; gateway real => automático (webhook).
  const modoDemo = PIX_CONFIG.gateway === "demo";
  const m = $(".modal");
  m.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-card pix-card">
      <div class="m-head">
        <div><span class="m-orgao">CAÇA PROVAS</span><span class="m-esfera">Plano Premium</span></div>
        <button class="m-close" onclick="closeModal()">✕</button>
      </div>
      <h3 class="m-cargo">Assinar Premium — ${valor}/ano</h3>
      <p class="mut" style="font-size:13px;margin:0 0 10px">Pague com <b>PIX</b> no app do seu banco (escaneie o QR ou cole o código). ${modoDemo ? "" : "O acesso é liberado automaticamente após a confirmação do banco."}</p>
      <div class="pix-qr">${pixQrSvg(payload, 220)}</div>
      <p class="mut" style="font-size:12px;text-align:center;margin:8px 0">Recebedor: <b>${esc(nomePix)}</b></p>
      <label class="flabel">Código PIX (copia e cola)
        <textarea id="pixCopia" readonly rows="3">${esc(payload)}</textarea>
      </label>
      <div class="m-actions" style="margin-top:10px">
        <button class="btn ghost" id="btnCopiarPix">📋 Copiar código</button>
        <button class="btn primary" id="btnConfirmarPix">✅ Já paguei — liberar Premium</button>
      </div>
      ${modoDemo
        ? `<p class="m-note">🧪 <b>Piloto:</b> neste momento a liberação do Premium é <b>manual</b> — confirme pelo botão acima depois de pagar (ou nos avise por e-mail). Em produção, o <b>gateway PIX</b> confirma sozinho via webhook.</p>`
        : `<p class="m-note">🔒 <b>Produção:</b> o pagamento é <b>automático</b> — o gateway confirma via webhook e libera o Premium sem ação sua.</p>`}
    </div>`;
  m.style.display = "flex";
  const copia = $("#btnCopiarPix");
  if (copia) copia.addEventListener("click", () => {
    const t = $("#pixCopia");
    const done = () => toast("📋 Código PIX copiado");
    if (navigator.clipboard) { navigator.clipboard.writeText(t.value).then(done).catch(() => { t.select(); document.execCommand("copy"); done(); }); }
    else { t.select(); document.execCommand("copy"); done(); }
  });
  // Em produção, tenta criar a cobrança no backend (QR dinâmico do gateway). Piloto: já mostra o local.
  if (!modoDemo) {
    (async () => {
      let criada;
      try { criada = await criarCobranca(PIX_CONFIG, getSubRef()); } catch { criada = null; }
      if (criada && criada.payload && criada.payload !== payload) {
        const ta = $("#pixCopia"); if (ta) ta.value = criada.payload;
        const qr = $(".pix-qr"); if (qr) qr.innerHTML = pixQrSvg(criada.payload, 220);
      }
    })();
  }
  if ($("#btnConfirmarPix")) $("#btnConfirmarPix").addEventListener("click", async () => {
    // Piloto (gateway demo) => libera manualmente (sem backend).
    if (PIX_CONFIG.gateway === "demo") {
      state.premium = true; sub = setPremium(true); closeModal(); renderConta(); toast("👑 Premium ativado. Bem-vindo(a)!");
      return;
    }
    // Produção => confirma pelo webhook do gateway (backend /api/pix-status).
    const btn = $("#btnConfirmarPix");
    if (btn) { btn.disabled = true; btn.textContent = "Verificando pagamento…"; }
    const r = await consultarConfirmacao(getSubRef());
    if (btn) { btn.disabled = false; btn.textContent = "✅ Já paguei — liberar Premium"; }
    if (r && r.premium) {
      state.premium = true; sub = setPremium(true); closeModal(); renderConta(); toast("✅ Pagamento confirmado. Premium ativado!");
    } else {
      toast("⏳ Ainda não detectamos o pagamento. Se acabou de pagar, aguarde um instante e tente de novo, ou nos avise por e-mail.");
    }
  });
}

// ---------- RELATAR PROBLEMA (contato) ----------
function abrirRelato() {
  const m = $(".modal");
  m.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-card">
      <div class="m-head">
        <div><span class="m-orgao">CAÇA PROVAS</span><span class="m-esfera">Contato · Suporte</span></div>
        <button class="m-close" onclick="closeModal()">✕</button>
      </div>
      <h3 class="m-cargo">🛠️ Relatar um problema</h3>
      <p class="mut" style="font-size:13px;margin:0 0 12px">Conte o que aconteceu. Enviamos seu relato para <b>${esc(FEEDBACK.email)}</b> e você recebe um e-mail automático de confirmação.</p>
      <form id="formRelato" class="form" style="gap:12px">
        <label><span>Tipo de problema</span>
          <select name="tipo">${TIPOS.map((t) => `<option value="${t.id}">${t.label}</option>`).join("")}</select></label>
        <label><span>Descreva o que aconteceu</span>
          <textarea name="descricao" rows="4" required maxlength="1500" placeholder="Ex.: ao importar meu PDF, o nome completo veio errado…"></textarea></label>
        <label><span>Seu e-mail (para receber a confirmação)</span>
          <input name="email" type="email" value="${esc((profile && profile.email) || "")}" placeholder="voce@email.com"></label>
        <div class="m-actions">
          <button class="btn primary" type="submit">📨 Enviar relato</button>
          <button class="btn ghost" type="button" id="btnCancelRelato">Cancelar</button>
        </div>
      </form>
      <p class="m-note">${esc(FEEDBACK.mensagemAuto)}</p>
    </div>`;
  m.style.display = "flex";
  const form = $("#formRelato");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const dados = {
      tipo: fd.get("tipo"), descricao: String(fd.get("descricao") || "").trim(),
      email: String(fd.get("email") || "").trim(),
      contexto: `${navigator.userAgent} · perfil=${profile ? "sim" : "não"} · premium=${state.premium}`,
    };
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = "Enviando…";
    const r = await enviarFeedback(dados);
    saveFeedback({ at: new Date().toISOString(), tipo: dados.tipo });
    if (r.via === "mailto" && r.url) window.open(r.url, "_blank");
    closeModal();
    toast(r.ok ? "✅ Relato enviado. Você receberá uma confirmação por e-mail." : "⚠️ Não foi possível enviar. Tente pelo ícone de e-mail.");
    if (state.view === "conta") renderConta();
  });
  if ($("#btnCancelRelato")) $("#btnCancelRelato").addEventListener("click", closeModal);
}

// Constrói a lista de eventos das etapas dos concursos SALVOS (para push).
function eventosParaPush() {
  const out = [];
  const { items } = buildDigest(CONCURSOS, sub);
  for (const it of items) {
    out.push({
      id: it.c.id, etapa: it.event.k, etapaLabel: it.event.label,
      data: it.event.d, orgao: it.c.orgao, cargo: it.c.cargo,
    });
  }
  return out;
}

function renderDigest() {
  const el = $("#digest");
  if (!el) return;
  if (!sub.notif.enabled) { el.innerHTML = `<p class="mut">Ative as notificações para ver a sua agenda de etapas.</p>`; return; }
  const d = buildDigest(CONCURSOS, sub);
  if (!d.items.length) {
    el.innerHTML = `<p class="mut">Nenhum evento nos próximos <b>${d.windowDays} dias</b> dos seus concursos salvos. Salve um concurso (⭐) para acompanhar aqui.</p>`;
    return;
  }
  el.innerHTML = `<p class="digest-window">📅 Próximos <b>${d.windowDays} dias</b> (resumo ${d.freq.label.toLowerCase()})</p>` +
    d.items.map((it) => `
      <div class="dig-item" data-ver="${it.c.id}">
        <div class="dig-date">${fmtData(it.event.d)}</div>
        <div class="dig-body"><b>${it.event.label}</b><br><span>${it.c.cargo} · ${it.c.orgao}</span></div>
        <span class="dig-days">${it.days === 0 ? "hoje" : "em " + it.days + " d"}</span>
      </div>`).join("");
}

// ---------- helpers ----------
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), 2600);
}

// ---------- porta de consentimento (Termos de Uso) ----------
function renderConsent(termos) {
  const body = $("#consentBody");
  body.innerHTML =
    `<div class="resumo">${esc(termos.resumo)}</div>` +
    termos.clausulas.map((c) => `<h3>${esc(c.t)}</h3>${c.html}`).join("") +
    `<div style="height:10px"></div>`;
  $("#consentVer").textContent = `v${termos.version} · atualizado em ${termos.updatedAt}`;
  $("#consentLegal").textContent = AVISO_LEGAL;
}

function showConsentGate() {
  renderConsent(TERMOS);
  const gate = $("#consent");
  gate.style.display = "flex";
  document.body.classList.add("consent-open");
  // ao reabrir de novo (ex.: novo termo), limpa estado
  const cb = $("#cbAceitar"); cb.checked = false; $("#btnAceitar").disabled = true;

  cb.addEventListener("change", (e) => { $("#btnAceitar").disabled = !e.target.checked; });
  $("#btnAceitar").addEventListener("click", () => {
    if (!$("#cbAceitar").checked) { toast("Marque 'Li e aceito' para continuar"); return; }
    saveTermsAccepted(TERMOS.version);
    closeConsentGate();
    toast("✅ Termos aceitos. Bem-vindo(a)!");
    startApp();
  });
  $("#btnRejeitar").addEventListener("click", () => {
    toast("Para usar o CAÇA PROVAS é necessário aceitar os termos.");
  });
}

function closeConsentGate() {
  $("#consent").style.display = "none";
  document.body.classList.remove("consent-open");
}

// ---------- início do aplicativo (após consentimento) ----------
async function startApp() {
  bindNav();
  go("home");

  // carrega o acervo central (raspagem semanal). Se falhar (offline), mantém o exemplo local.
  const central = await loadCentral();
  if (central && central.concursos && central.concursos.length) {
    CONCURSOS = central.concursos;
    centralMeta = central;
    if (state.view === "home") renderHome();
  }

  // Etapa 3 — alertas por etapa (Premium). Só quando o app está aberto; o envio
  // em background (Web Push/VAPID) fica documentado no README.
  notifyUpcoming(CONCURSOS, sub).catch(() => {});

  // Revalidação da assinatura (produção): se o usuário aparece como Premium mas o
  // backend (fonte da verdade) não confirma, rebaixa para Free. Só roda com gateway
  // real (não demo) e se o usuário já está marcado como premium.
  revalidarPremiumNoApp();

  // Revalida de novo quando o app volta ao primeiro plano (quem deixou a aba aberta),
  // com throttle: só consulta o backend no máximo 1x a cada 30 min por sessão.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    if (Date.now() - lastPixCheck < 30 * 60 * 1000) return;
    revalidarPremiumNoApp();
  });

  // Modo foco: deep-link #conc=<id> (vindo de uma notificação) abre o edital na hora.
  if (location.hash && /^#conc=/.test(location.hash)) {
    const m = location.hash.match(/^#conc=([^&]+)/);
    if (m) { abrirDetalhe(decodeURIComponent(m[1]), location.hash.includes("edit")); }
  }

  // delegação de cliques nos cards (detalhe / abrir edital / salvar)
  document.addEventListener("click", (e) => {
    const v = e.target.closest("[data-ver]"); if (v) { abrirDetalhe(v.dataset.ver); return; }
    const a = e.target.closest("[data-abrir]"); if (a) { abrirDetalhe(a.dataset.abrir, true); return; }
    const s = e.target.closest("[data-salvar]"); if (s) { handleSalvar(s.dataset.salvar); return; }
  });

  // serviço worker (PWA) — só em http/https fora do sandbox
  if ("serviceWorker" in navigator && location.protocol.startsWith("http") && window === window.top) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

function handleSalvar(id) {
  if (!state.premium) { toast("🔒 Salvar concursos é recurso do Premium."); go("conta"); return; }
  sub = toggleSave(id, sub);
  renderHome();
  toast(isSaved(id, sub) ? "⭐ Concurso salvo" : "Removido dos salvos");
}

// Revalida a assinatura Premium contra o backend (fonte da verdade). Se o servidor
// confirmar como NÃO premium (e não for erro de rede), rebaixa para Free. Com throttle.
function revalidarPremiumNoApp() {
  if (PIX_CONFIG.gateway === "demo" || !state.premium) return;
  lastPixCheck = Date.now();
  revalidarPremium(getSubRef(), PIX_CONFIG.statusEndpoint).then((r) => {
    if (r && r.premium === false && !r.offline) {
      state.premium = false; sub = setPremium(false);
      toast("🔒 Sua assinatura não está mais ativa. Você voltou ao plano Free.");
      if (state.view === "conta") renderConta();
      if (state.view === "home") renderHome();
    }
  }).catch(() => {});
}

function boot() {
  const acc = loadTermsAccepted();
  const precisaConsentir = !acc || acc.version !== TERMOS.version;
  if (precisaConsentir) showConsentGate();
  else startApp();
}
document.addEventListener("DOMContentLoaded", boot);
window.__appBooted = false;
window.addEventListener("DOMContentLoaded", () => { window.__appBooted = true; }); // sinal p/ aviso offline

// expor para callbacks globais (onclick)
window.go = go; window.closeModal = closeModal;
// reabrir os termos a partir da tela "Conta" (modo leitura)
window.reverTermos = () => { renderConsent(TERMOS); $("#consent").style.display = "flex"; };
