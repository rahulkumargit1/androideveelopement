import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

const API_URL_KEY = "vc_api_url";
const TOKEN_KEY = "vc_token";

// Default backend URL — HTTPS via nip.io (Let's Encrypt cert, port 443).
// Override via Settings → Server URL (stored in SecureStore).
const DEFAULT_API = (Constants.expoConfig?.extra as any)?.apiUrl || "https://54.162.220.67.nip.io";

let _baseUrl: string = DEFAULT_API;

// URLs that are no longer valid — auto-cleared on startup so users don't
// get stuck after a deployment migration (e.g. localtunnel → EC2).
const STALE_URL_PATTERNS = ["loca.lt", "ngrok.io", "localhost", "10.0.2.2"];

function _isStale(url: string): boolean {
  return STALE_URL_PATTERNS.some((p) => url.includes(p));
}

// Load saved URL at startup — clear stale/dev URLs automatically
const _urlReady: Promise<void> = SecureStore.getItemAsync(API_URL_KEY)
  .then((v) => {
    if (v && _isStale(v)) {
      // Stale URL (localtunnel / ngrok / emulator) — reset to production default
      return SecureStore.setItemAsync(API_URL_KEY, DEFAULT_API);
    }
    if (v) _baseUrl = v;
  })
  .catch(() => {});

const DEFAULT_TIMEOUT_MS = 15000;
const SCAN_TIMEOUT_MS = 120000; // 2 min — ML inference can be slow on first run

export type Verdict = "authentic" | "suspicious" | "counterfeit";

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
  id?: number; name: string; role: string;
  github?: string | null; photo_url?: string | null;
  contribution?: string | null; order_index?: number;
}
export interface CurrencyConfig {
  id?: number; code: string; name: string;
  enabled: boolean; denominations: string[]; accuracy?: number | null;
}
export interface Setting { key: string; value: any; }
export interface UserOut {
  id: number;
  email: string;
  full_name: string;
  role: "admin" | "inspector" | "viewer";
}

async function getToken() { try { return await SecureStore.getItemAsync(TOKEN_KEY); } catch { return null; } }
async function setToken(t: string) { try { await SecureStore.setItemAsync(TOKEN_KEY, t); } catch {} }
async function clearToken() { try { await SecureStore.deleteItemAsync(TOKEN_KEY); } catch {} }

async function req<T>(path: string, init: RequestInit = {}, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  await _urlReady;
  const base = _baseUrl;
  const t = await getToken();
  const headers: Record<string, string> = { ...(init.headers as any) };
  if (t) headers.Authorization = `Bearer ${t}`;
  if (init.body && !(init.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }
  // Bypass localtunnel HTML interstitial that appears for new IPs
  headers["bypass-tunnel-reminder"] = "true";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, { ...init, headers, signal: controller.signal });
  } catch (e: any) {
    if (e?.name === "AbortError") {
      throw new Error(`Request timed out after ${Math.round(timeoutMs / 1000)}s at ${base}`);
    }
    throw new Error(`Cannot reach server at ${base} — check your Server URL in Settings.`);
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const text = await res.text();
      try {
        const parsed = JSON.parse(text);
        if (typeof parsed.detail === "string") {
          detail = parsed.detail;
        } else if (Array.isArray(parsed.detail)) {
          // Pydantic validation errors — extract the human-readable msg fields
          detail = parsed.detail
            .map((d: any) => {
              const field = Array.isArray(d.loc) ? d.loc[d.loc.length - 1] : "";
              return field ? `${field}: ${d.msg}` : (d.msg || JSON.stringify(d));
            })
            .join("; ");
        } else if (parsed.detail) {
          detail = String(parsed.detail);
        }
      } catch { /* HTML/non-JSON response */ }
    } catch {}
    throw new Error(`${res.status} ${detail}`);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Invalid JSON response from ${base}${path}`);
  }
}

export const api = {
  get apiBase() { return _baseUrl; },

  setBaseUrl(url: string) {
    _baseUrl = url || DEFAULT_API;
  },

  register: async (email: string, password: string, full_name?: string) => {
    const data: any = await req(`/api/auth/register`, {
      method: "POST",
      body: JSON.stringify({ email, password, full_name }),
    });
    await setToken(data.access_token);
    return data;
  },

  login: async (email: string, password: string) => {
    await _urlReady;
    const form = new URLSearchParams();
    form.set("username", email);
    form.set("password", password);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    try {
      const res = await fetch(`${_baseUrl}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "bypass-tunnel-reminder": "true",
        },
        body: form.toString(),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        let detail = res.statusText;
        try { detail = JSON.parse(text).detail || detail; } catch {}
        throw new Error(`Login failed: ${res.status} ${detail}`);
      }
      const data = await res.json();
      await setToken(data.access_token);
      return data;
    } catch (e: any) {
      if (e?.name === "AbortError") throw new Error(`Login timed out at ${_baseUrl}`);
      throw e;
    } finally {
      clearTimeout(timer);
    }
  },

  logout: clearToken,
  isAuthed: async () => !!(await getToken()),
  me: () => req<UserOut>(`/api/auth/me`),

  scan: async (uri: string, hintCurrency?: string): Promise<ScanResult> => {
    const fd = new FormData();
    fd.append("image", { uri, name: `note-${Date.now()}.jpg`, type: "image/jpeg" } as any);
    if (hintCurrency) fd.append("hint_currency", hintCurrency);
    return req<ScanResult>(`/api/scan`, { method: "POST", body: fd }, SCAN_TIMEOUT_MS);
  },

  history: (limit = 25) => req<ScanResult[]>(`/api/scan/history?limit=${limit}`),
  clearHistory: () => req<{ deleted: number }>(`/api/scan/history`, { method: "DELETE" }),
  stats: () => req<any>(`/api/scan/stats`),
  members: () => req<TeamMember[]>(`/api/members`),
  upsertMember: (m: TeamMember) =>
    req<TeamMember>(`/api/members${m.id ? `/${m.id}` : ""}`, {
      method: m.id ? "PUT" : "POST",
      body: JSON.stringify(m),
    }),
  deleteMember: (id: number) => req<void>(`/api/members/${id}`, { method: "DELETE" }),
  currencies: () => req<CurrencyConfig[]>(`/api/currencies`),
  upsertCurrency: (c: CurrencyConfig) =>
    req<CurrencyConfig>(`/api/currencies`, { method: "POST", body: JSON.stringify(c) }),
  deleteCurrency: (code: string) =>
    req<void>(`/api/currencies/${code}`, { method: "DELETE" }),
  settings: () => req<Setting[]>(`/api/settings`),
  setSetting: (key: string, value: any) =>
    req<Setting>(`/api/settings/${encodeURIComponent(key)}`, {
      method: "PUT",
      body: JSON.stringify({ value }),
    }),
};
