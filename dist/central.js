// central.js — carrega o ACERVO CENTRAL de concursos (raspagem semanal) com fallback
// para os dados de exemplo locais. O acervo é produzido pelo crawler (crawler/).
// Retorna { concursos, generatedAt } ou null se não estiver disponível (offline/PWA).
export async function loadCentral() {
  try {
    const r = await fetch("./concursos.json", { cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const j = await r.json();
    if (!Array.isArray(j.concursos)) throw new Error("formato inesperado");
    return { concursos: j.concursos, generatedAt: j.generatedAt, count: j.count };
  } catch (e) {
    return null;
  }
}

// Tenta revalidar o acervo em background (se o PWA cacheou uma versão antiga).
export function adicionaAoCache(url) {
  if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
    fetch(url, { cache: "no-store" }).catch(() => {});
  }
}
