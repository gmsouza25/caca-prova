// Service Worker — CAÇA PROVAS (cache do shell + base com atualização semanal)
const CACHE = "caca-prova-v4";
const SHELL = ["./", "./index.html", "./styles.css", "./app.js", "./config.js", "./data.js", "./match.js", "./profile.js", "./central.js", "./termos.js", "./premium.js", "./pix.js", "./feedback.js", "./push.js", "./manifest.webmanifest", "./icon.svg", "./icon-192.png", "./icon-512.png", "./lib/qrcode.js", "./lib/pdfjs/pdf.min.js", "./lib/pdfjs/pdf.worker.min.js"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Clique em uma notificação: abre/foca o app e leva direto ao edital (modo foco).
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "./index.html";
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("navigate" in c) { c.navigate(url); return c.focus(); }
      }
      return clients.openWindow(url);
    })
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (url.origin !== location.origin) return;
  // Estratégia rede-primeiro: garante dados atuais (raspagem semanal) e
  // mantém uma cópia em cache para funcionar offline.
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res && res.status === 200 && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((cached) => cached || caches.match("./index.html")))
  );
});
