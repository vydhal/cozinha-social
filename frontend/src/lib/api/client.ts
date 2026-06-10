const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "/api";

function getToken(): string | null {
  try {
    const raw = localStorage.getItem("mdb-auth");
    return raw ? (JSON.parse(raw)?.state?.token ?? null) : null;
  } catch {
    return null;
  }
}

function getRefreshToken(): string | null {
  try {
    const raw = localStorage.getItem("mdb-auth");
    return raw ? (JSON.parse(raw)?.state?.refreshToken ?? null) : null;
  } catch {
    return null;
  }
}

async function refreshAccessToken(): Promise<string | null> {
  const rt = getRefreshToken();
  if (!rt) return null;
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: rt }),
    });
    if (!res.ok) return null;
    const { data } = await res.json();
    const raw = localStorage.getItem("mdb-auth");
    if (raw) {
      const parsed = JSON.parse(raw);
      parsed.state.token = data.token;
      localStorage.setItem("mdb-auth", JSON.stringify(parsed));
    }
    return data.token;
  } catch {
    return null;
  }
}

export class ApiError extends Error {
  constructor(
    public message: string,
    public status: number,
    public code?: string,
    public details?: Array<{ field: string; message: string }>,
  ) {
    super(message);
  }
}

export function formatApiError(e: unknown): string {
  if (e instanceof ApiError && e.details?.length) {
    return e.details.map(d => `• ${d.message}`).join("\n");
  }
  if (e instanceof ApiError) return e.message;
  return "Erro inesperado";
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.body && !(options.body instanceof FormData)
      ? { "Content-Type": "application/json" }
      : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string>),
  };

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (res.status === 401 && retry) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return request<T>(path, options, false);
    }
    localStorage.removeItem("mdb-auth");
    window.location.href = "/login";
    throw new ApiError("Sessão expirada", 401);
  }

  if (res.status === 204) return undefined as T;

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(
      json.error ?? "Erro inesperado",
      res.status,
      json.code,
      json.details,
    );
  }

  return json.data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  upload: <T>(path: string, formData: FormData) =>
    request<T>(path, { method: "POST", body: formData }),
};

export function wsUrl(path: string): string {
  const base = (import.meta.env.VITE_API_URL as string | undefined) ?? "/api";
  const isAbsolute = base.startsWith("http");
  const wsBase = isAbsolute
    ? base.replace(/^http/, "ws")
    : `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}${base}`;
  return `${wsBase}${path}`;
}
