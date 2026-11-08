// 通信がなくても開けるようにするための仕組み
const CACHE = 'shift-kakeibo-ce2f1a4132';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // ページ本体：通信できれば最新を取り、できなければ保存した分を出す
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req.url, { cache: 'no-cache' }).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put('./index.html', copy)); return res; }).catch(() => caches.match('./index.html')));
    return;
  }
  // 文字のデータとアイコン：保存した分を先に使う
  if (url.origin === location.origin || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res;
    }).catch(() => Response.error())));
  }
});

// ---- ここから push-sw.js ----
// 入力の通知を受け取って出す（build_pwa.py が sw.js の最後に足す）
// サーバー（push-server/）からは中身なしの通知が届く。文面はここで作る。

self.addEventListener('push', e => {
  // iPhone は、届いた通知を必ず画面に出さないと、通知を止めてしまう
  e.waitUntil(self.registration.showNotification('シフト家計簿', {
    body: '今日の収入・支出がまだ入力されていません。忘れないうちに記録しましょう。',
    icon: 'icon-192.png', tag: 'input', data: { url: self.registration.scope },
  }));
});

// 通知を押したら、家計簿を開く（開いていればそれを前に出す）
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of list) {
      if ('focus' in c) { try { await c.focus(); return; } catch (x) {} }
    }
    if (self.clients.openWindow) await self.clients.openWindow(self.registration.scope);
  })());
});
