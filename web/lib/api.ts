// Typed API client for the VeriCash backend.
const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";
const TOKEN_KEY = "vc_token";

export type Verdict = "authentic" | "suspicious" | "counterfeit";
export type Role = "admin" | "inspector" | "viewer";

export interface UserOut {
  id: number;
  email: string;
  full_name: string;
  role: Role;
}
export interface ScanResult {
  id?: number;
  currency: string;
  denomination: string;
  authenticity_score: number;
  confidence: number;
  verdict: Verdict;
  demonetized?: boolean;
  breakdown: Record<string, any>;
  created_at?: string;
}
export interface TeamMember {
  id?: number;
  name: string;
  role: string;
  github?: string | null;
  photo_url?: string | null;
  contribution?: string | null;
  order_index?: number;
}
export interface CurrencyConfig {
  id?: number;
  code: string;
  name: string;
  enabled: boolean;
  denominations: string[];
  accuracy?: number;
}
export interface Setting { key: string; value: any; }
export interface TokenOut { access_token: string; token_type: string; user: UserOut; }
export interface UserAdminUpdate { full_name?: string; role?: string; password?: string; }
export interface ForgotPasswordResponse { message: string; demo_code: string | null; }

function token(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}
function setStoredToken(t: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, t);
}
function clearToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const t = token();
  const headers: Record<string, string> = { ...(init.headers as any) };
  if (t) headers["Authorization"] = `Bearer ${t}`;
  if (init.body && !(init.body instanceof FormData) && !(init.body instanceof URLSearchParams)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers });
  } catch (e: any) {
    throw new ApiError(0, `Network error reaching ${BASE} — is the backend running?`);
  }
  if (!res.ok) {
    let detail = res.statusText || `HTTP ${res.status}`;
    try {
      const j = await res.json();
      detail = j.detail || j.message || detail;
      if (Array.isArray(j.detail)) {
        detail = j.detail.map((d: any) => d.msg || JSON.stringify(d)).join("; ");
      }
    } catch {}
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  apiBase: BASE,

  // ---- auth ----
  register: async (email: string, password: string, full_name?: string) => {
    const data = await request<TokenOut>(`/api/auth/register`, {
      method: "POST",
      body: JSON.stringify({ email, password, full_name }),
    });
    setStoredToken(data.access_token);
    if (typeof window !== "undefined") window.dispatchEvent(new Event("vc-auth-changed"));
    return data;
  },
  login: async (email: string, password: string) => {
    const form = new URLSearchParams();
    form.set("username", email);
    form.set("password", password);
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    if (!res.ok) {
      let detail = `Login failed (${res.status})`;
      try { detail = (await res.json()).detail || detail; } catch {}
      throw new ApiError(res.status, detail);
    }
    const data = (await res.json()) as TokenOut;
    setStoredToken(data.access_token);
    if (typeof window !== "undefined") window.dispatchEvent(new Event("vc-auth-changed"));
    return data;
  },
  me: () => request<UserOut>(`/api/auth/me`),
  updateProfile: (data: { full_name?: string }) =>
    request<UserOut>(`/api/auth/me`, { method: "PUT", body: JSON.stringify(data) }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<void>(`/api/auth/me/password`, {
      method: "PUT",
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    }),
  forgotPassword: (email: string) =>
    request<ForgotPasswordResponse>(`/api/auth/forgot-password`, {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  resetPassword: (email: string, code: string, newPassword: string) =>
    request<void>(`/api/auth/reset-password`, {
      method: "POST",
      body: JSON.stringify({ email, code, new_password: newPassword }),
    }),
  listUsers: () => request<UserOut[]>(`/api/auth/users`),
  updateUser: (id: number, data: UserAdminUpdate) =>
    request<UserOut>(`/api/auth/users/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteUser: (id: number) =>
    request<void>(`/api/auth/users/${id}`, { method: "DELETE" }),
  logout: () => {
    clearToken();
    if (typeof window !== "undefined") window.dispatchEvent(new Event("vc-auth-changed"));
  },
  isAuthed: () => !!token(),

  // ---- scan ----
  scan: (file: File | Blob, hintCurrency?: string) => {
    const fd = new FormData();
    fd.append("image", file, (file as File).name || "scan.jpg");
    if (hintCurrency) fd.append("hint_currency", hintCurrency);
    return request<ScanResult>(`/api/scan`, { method: "POST", body: fd });
  },
  scanBatch: (files: File[], hintCurrency?: string) => {
    const fd = new FormData();
    files.forEach((f) => fd.append("images", f, f.name));
    if (hintCurrency) fd.append("hint_currency", hintCurrency);
    return request<ScanResult[]>(`/api/scan/batch`, { method: "POST", body: fd });
  },
  history: (limit = 50) => request<ScanResult[]>(`/api/scan/history?limit=${limit}`),
  stats: () => request<any>(`/api/scan/stats`),
  exportCsvUrl: () => `${BASE}/api/scan/export`,
  clearHistory: () => request<{ deleted: number }>(`/api/scan/history`, { method: "DELETE" }),

  // ---- members ----
  members: () => request<TeamMember[]>(`/api/members`),
  upsertMember: (m: TeamMember) =>
    request<TeamMember>(`/api/members${m.id ? `/${m.id}` : ""}`, {
      method: m.id ? "PUT" : "POST",
      body: JSON.stringify(m),
    }),
  deleteMember: (id: number) => request<void>(`/api/members/${id}`, { method: "DELETE" }),

  // ---- currencies ----
  currencies: () => request<CurrencyConfig[]>(`/api/currencies`),
  upsertCurrency: (c: CurrencyConfig) =>
    request<CurrencyConfig>(`/api/currencies`, { method: "POST", body: JSON.stringify(c) }),
  deleteCurrency: (code: string) =>
    request<void>(`/api/currencies/${encodeURIComponent(code)}`, { method: "DELETE" }),

  // ---- settings ----
  settings: () => request<Setting[]>(`/api/settings`),
  setSetting: (key: string, value: any) =>
    request<Setting>(`/api/settings/${encodeURIComponent(key)}`, {
      method: "PUT",
      body: JSON.stringify({ value }),
    }),
};
