import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

const API_URL_KEY = "vc_api_url";
const TOKEN_KEY = "vc_token";

// Default fallback — works on Android emulator. Real devices use Settings → Server URL.
const DEFAULT_API = (Constants.expoConfig?.extra as any)?.apiUrl || "http://10.0.2.2:8001";

let _baseUrl: string = DEFAULT_API;

// Load saved URL at startup
SecureStore.getItemAsync(API_URL_KEY).then((v) => {
  if (v) _baseUrl = v;
}).catch(() => {});

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

async function getToken() { try { return await SecureStore.getItemAsync(TOKEN_KEY); } catch { return null; } }
async function setToken(t: string) { try { await SecureStore.setItemAsync(TOKEN_KEY, t); } catch {} }
async function clearToken() { try { await SecureStore.deleteItemAsync(TOKEN_KEY); } catch {} }

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const base = _baseUrl;
  const t = await getToken();
  const headers: Record<string, string> = { ...(init.headers as any) };
  if (t) headers.Authorization = `Bearer ${t}`;
  if (init.body && !(init.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, { ...init, headers });
  } catch (e: any) {
    throw new Error(`Cannot reach server at ${base} — check your Server URL in Settings.`);
  }
  if (!res.ok) {
    let detail = res.statusText;
    try { detail = (await res.json()).detail || detail; } catch {}
    throw new Error(`${res.status} ${detail}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
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
    const form = new URLSearchParams();
    form.set("username", email);
    form.set("password", password);
    const res = await fetch(`${_baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    if (!res.ok) throw new Error(`Login failed (${res.status})`);
    const data = await res.json();
    await setToken(data.access_token);
    return data;
  },

  logout: clearToken,
  isAuthed: async () => !!(await getToken()),

  scan: async (uri: string, hintCurrency?: string): Promise<ScanResult> => {
    const fd = new FormData();
    fd.append("image", { uri, name: `note-${Date.now()}.jpg`, type: "image/jpeg" } as any);
    if (hintCurrency) fd.append("hint_currency", hintCurrency);
    return req<ScanResult>(`/api/scan`, { method: "POST", body: fd });
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
