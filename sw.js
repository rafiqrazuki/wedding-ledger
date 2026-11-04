/*
 * Service worker for the Wedding Ledger.
 *
 * It exists for one job: receive a push and show a notification. There is
 * deliberately NO fetch handler and no caching — the app is updated often and
 * a cache here would serve a stale copy with no easy way to clear it.
 */

self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", function (event) {
  var data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = {}; }

  var title = data.title || "Wedding Ledger";
  var options = {
    body: data.body || "",
    icon: "icon-192.png",
    badge: "icon-192.png",
    /* one notification per bucket, so a re-send replaces rather than stacks */
    tag: data.tag || "ledger-reminder",
    renotify: true,
    data: { url: data.url || "./" }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || "./";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        if ("focus" in list[i]) return list[i].focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
