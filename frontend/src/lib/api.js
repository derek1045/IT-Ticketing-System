const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

export function getStoredToken() {
  return localStorage.getItem("authToken");
}

export function setStoredToken(token) {
  if (token) localStorage.setItem("authToken", token);
  else localStorage.removeItem("authToken");
}

export async function apiFetch(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const skipAuth = path === "/auth/login";
  const token = getStoredToken();
  if (token && !skipAuth) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (
    options.body &&
    typeof options.body === "string" &&
    !headers["Content-Type"]
  ) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  return res;
}
