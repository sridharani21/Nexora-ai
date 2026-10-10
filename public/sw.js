self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }
  const title = typeof payload.title === "string" ? payload.title.slice(0, 100) : "Nexora placement reminder";
  const body = typeof payload.body === "string" ? payload.body.slice(0, 240) : "Open Nexora to review your placement preparation.";
  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: "/favicon.ico",
    data: { url: typeof payload.url === "string" ? payload.url : "/placement-prep/journey" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const requestedUrl = new URL(event.notification.data?.url || "/placement-prep/journey", self.location.origin);
  const targetUrl = requestedUrl.origin === self.location.origin ? requestedUrl.href : new URL("/placement-prep/journey", self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    const existing = clients.find((client) => new URL(client.url).origin === self.location.origin);
    return existing ? existing.navigate(targetUrl).then(() => existing.focus()) : self.clients.openWindow(targetUrl);
  }));
});
