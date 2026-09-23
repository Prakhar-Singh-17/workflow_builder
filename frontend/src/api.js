// Thin wrapper around the backend's HTTP API. Requests go to /api/... which
// Vite's dev server proxies to the Express backend (see vite.config.js).

async function request(path, options) {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed with status ${res.status}`);
  }

  return res.json();
}

export function createSession() {
  return request("/session", { method: "POST" });
}

export function sendMessage(sessionId, message) {
  return request("/chat", {
    method: "POST",
    body: JSON.stringify({ sessionId, message }),
  });
}

export function getSession(sessionId) {
  return request(`/session/${sessionId}`);
}

export function resetSession(sessionId) {
  return request(`/session/${sessionId}/reset`, { method: "POST" });
}
