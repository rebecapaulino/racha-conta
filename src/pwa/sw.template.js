/* Service worker do Racha Conta: guarda o app no aparelho para abrir sem internet.
   __VERSION__ é trocado a cada build (ver src/app/sw.js/route.ts). */

const CACHE = 'racha-conta-__VERSION__';
// Fora do prefixo "racha-conta-": a limpeza de versões antigas não apaga.
const OCR_CACHE = 'rc-ocr-tesseract-7.0.0';
const SHELL = ['/manifest.webmanifest', '/favicon.svg', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png', '/apple-touch-icon.png'];
// Sinal fraco no bar: se a rede não responder logo, abre a versão guardada.
const NETWORK_TIMEOUT = 3500;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const page = await fetch('/', { cache: 'no-store' });
      const html = await page.clone().text();
      await cache.put('/', page);
      const assets = new Set([...html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g)].map((m) => m[1]));
      // As fontes vêm de dentro dos arquivos de estilo.
      for (const css of [...assets].filter((a) => a.endsWith('.css'))) {
        const text = await (await fetch(css)).text();
        for (const m of text.matchAll(/url\(["']?([^"')]+\.woff2?)["']?\)/g)) {
          assets.add(new URL(m[1], self.location.origin + css).pathname);
        }
      }
      await cache.addAll([...SHELL, ...assets]);
    })(),
  );
});

// A página pede para trocar de versão quando a pessoa toca em "Atualizar".
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('racha-conta-') && k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    // Página: tenta a rede (versão mais nova); sem rede ou lenta, usa a guardada.
    event.respondWith(
      (async () => {
        const cached = caches.open(CACHE).then((c) => c.match('/'));
        try {
          const res = await Promise.race([
            fetch(req),
            new Promise((_, reject) => setTimeout(() => reject(new Error('lento')), NETWORK_TIMEOUT)),
          ]);
          return res;
        } catch {
          return (await cached) || fetch(req);
        }
      })(),
    );
    return;
  }

  // Leitor da nota fiscal (~5 MB): guardado num espaço próprio, que não é apagado a cada
  // versão do app, para não baixar de novo. Troque o nome quando o tesseract.js mudar de versão.
  if (url.pathname.startsWith('/ocr/')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(OCR_CACHE);
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      })(),
    );
    return;
  }

  // Arquivos do app (nomes mudam a cada versão) e ícones: guardado primeiro.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/') || SHELL.includes(url.pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      })(),
    );
  }
});
