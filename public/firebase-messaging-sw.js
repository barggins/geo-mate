/* Firebase Cloud Messaging service worker.
   This file must be served from the site root. It uses the compat builds
   so the SW can boot without bundling. Configuration is injected at runtime
   by the main app via postMessage to avoid hardcoding secrets here. */
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

let messaging = null;

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "FCM_INIT" && data.config && !messaging) {
    try {
      firebase.initializeApp(data.config);
      messaging = firebase.messaging();
      messaging.onBackgroundMessage((payload) => {
        const title = payload.notification?.title || "LiftClub";
        const options = {
          body: payload.notification?.body || "",
          icon: "/favicon.ico",
          data: payload.data || {},
        };
        self.registration.showNotification(title, options);
      });
    } catch (_) {}
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification.data?.link || "/dashboard";
  event.waitUntil(clients.openWindow(link));
});
