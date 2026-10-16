/*
 * Service worker do FluxoLab (gerado por scripts/build-sw.mjs depois do build).
 * Guarda todos os arquivos do site no primeiro acesso: o app abre e simula sem internet.
 * Uma versão nova fica "esperando" até a pessoa clicar em "Recarregar" no aviso.
 */
const VERSION = "__VERSION__";
const PRECACHE = __FILES__;
const CACHE = `fluxolab-${VERSION}`;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("fluxolab-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === "navigate") {
    // Página: a versão guardada (rápida e offline); a atualização chega pelo service worker novo.
    event.respondWith(caches.match("/").then((hit) => hit || fetch(req)));
    return;
  }
  // Web Worker: o script lê parâmetros do próprio endereço (#params=…). Uma resposta "nova"
  // (sem URL própria) faz o worker manter o endereço pedido, com esses parâmetros.
  const fresh = req.destination === "worker" || new URL(req.url).search !== "";
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(
      (hit) =>
        (hit && fresh ? new Response(hit.body, { status: hit.status, statusText: hit.statusText, headers: hit.headers }) : hit) ||
        fetch(req).then((res) => {
          if (res.ok && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
