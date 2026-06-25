// Native browser notifications — 100% free, no third party, no service worker push.
// Works while the site is open in at least one tab.

export function isBrowserNotifySupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function browserNotifyPermission(): NotificationPermission | "unsupported" {
  if (!isBrowserNotifySupported()) return "unsupported";
  return Notification.permission;
}

export async function requestBrowserNotifyPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!isBrowserNotifySupported()) return "unsupported";
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission;
  }
  return await Notification.requestPermission();
}

export function showBrowserNotification(
  title: string,
  opts: { body?: string; link?: string; tag?: string } = {},
) {
  if (!isBrowserNotifySupported() || Notification.permission !== "granted") return;
  try {
    const n = new Notification(title, {
      body: opts.body,
      tag: opts.tag,
      icon: "/favicon.ico",
    });
    if (opts.link) {
      n.onclick = () => {
        window.focus();
        window.location.href = opts.link!;
        n.close();
      };
    }
  } catch {
    // Some browsers throw if called outside a user gesture; fail silently.
  }
}
