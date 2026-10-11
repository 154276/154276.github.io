// 学びの星: ブラウザ標準のネットワーク読み込みを使用し、更新をキャッシュで妨げない。
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
