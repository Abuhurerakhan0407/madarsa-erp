self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }
  const title = typeof payload.title === "string" && payload.title.trim() ? payload.title.trim() : "Ilmgaah update";
  const body = typeof payload.body === "string" && payload.body.trim() ? payload.body.trim() : "You have a new portal notification.";
  const link = typeof payload.link === "string" && payload.link.startsWith("/") ? payload.link : "/portal";
  event.waitUntil(self.registration.showNotification(title, {
    body,
    data: { link },
    tag: typeof payload.tag === "string" && payload.tag.trim() ? payload.tag.slice(0, 120) : undefined,
    renotify: false
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const raw = event.notification?.data?.link;
  let target = new URL("/portal", self.location.origin);
  try {
    const candidate = new URL(typeof raw === "string" ? raw : "/portal", self.location.origin);
    if (candidate.origin === self.location.origin) target = candidate;
  } catch {}
  event.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of clientsList) {
      try {
        if (new URL(client.url).origin === self.location.origin) {
          await client.focus();
          if ("navigate" in client) await client.navigate(target.href);
          return;
        }
      } catch {}
    }
    await self.clients.openWindow(target.href);
  })());
});
