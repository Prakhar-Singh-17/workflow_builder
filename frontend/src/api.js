// Thin wrapper around the backend's HTTP API. In dev, requests go to /api/...
// which Vite's dev server proxies to the Express backend (see
// vite.config.js) — no separate URL needed. In production (e.g. deployed as
// a Render static site), the backend lives on its own domain, so VITE_API_URL
// must be set at build time to the backend's full URL (e.g.
// "https://your-backend.onrender.com/api").
const API_BASE = import.meta.env.VITE_API_URL || "/api";

async function request(path, options) {
  const res = await fetch(`${API_BASE}${path}`, {
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
