import React, { useEffect, useState } from "react";
import {
  ScrollView, View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, Switch, ActivityIndicator,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import { api, CurrencyConfig, UserOut } from "../src/api/client";
import { colors, radius } from "../src/theme";

const API_URL_KEY = "vc_api_url";

export default function SettingsScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        keyboardShouldPersistTaps="handled"
      >
        <ServerSection />
        <AccountSection />
        <DetectionSection />
        <CurrenciesSection />
        <AboutSection />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Server URL section ────────────────────────────────────────────────────────
function ServerSection() {
  const [url, setUrl] = useState("");
  const [saved, setSaved] = useState("");
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const v = await SecureStore.getItemAsync(API_URL_KEY);
        const val = v || api.apiBase;
        setUrl(val);
        setSaved(val);
      } catch {
        setUrl(api.apiBase);
        setSaved(api.apiBase);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  async function save() {
    const trimmed = url.trim().replace(/\/$/, ""); // strip trailing slash
    await SecureStore.setItemAsync(API_URL_KEY, trimmed);
    setSaved(trimmed);
    api.setBaseUrl(trimmed);
    Alert.alert("Saved", trimmed ? `Server set to:\n${trimmed}` : "Cleared. Using default.");
  }

  async function test() {
    const target = url.trim().replace(/\/$/, "") || saved;
    if (!target) { Alert.alert("Enter a server URL first"); return; }
    setTesting(true);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(`${target}/`, { signal: controller.signal });
      const text = await res.text();
      let preview: string;
      try {
        const data = JSON.parse(text);
        preview = JSON.stringify(data).slice(0, 120);
      } catch {
        // localtunnel shows an HTML interstitial on first visit
        preview = text.slice(0, 120).replace(/<[^>]+>/g, "").trim() || "(non-JSON response)";
      }
      Alert.alert(res.ok ? "Connected ✓" : `HTTP ${res.status}`, `${target}\n\n${preview}`);
    } catch (e: any) {
      Alert.alert("Connection failed", `${target}\n\n${e.message}`);
    } finally {
      clearTimeout(timer);
      setTesting(false);
    }
  }

  return (
    <View style={s.card}>
      <Text style={s.h2}>
        <Ionicons name="server-outline" size={15} /> Server URL
      </Text>
      <Text style={s.note}>
        Enter your VeriCash backend URL. For local WiFi use your machine's IP
        (e.g. http://192.168.1.10:8001). For cloud use your AWS/ngrok URL.
      </Text>
      {loading ? <ActivityIndicator color={colors.brand} /> : (
        <>
          <TextInput
            value={url}
            onChangeText={setUrl}
            placeholder="https://api.yourserver.com  or  http://192.168.x.x:8001"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={s.input}
          />
          {saved ? (
            <View style={s.savedRow}>
              <Ionicons name="checkmark-circle" size={13} color={colors.success} />
              <Text style={{ color: colors.success, fontSize: 12, flex: 1 }} numberOfLines={1}>
                Active: {saved}
              </Text>
            </View>
          ) : null}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
            <TouchableOpacity style={[s.btn, { flex: 1 }]} onPress={save}>
              <Ionicons name="save-outline" size={15} color="white" />
              <Text style={s.btnTxt}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btnGhost, { flex: 1 }]} onPress={test} disabled={testing}>
              {testing
                ? <ActivityIndicator color={colors.brand} size="small" />
                : <Ionicons name="wifi" size={15} color={colors.brand} />}
              <Text style={[s.btnTxt, { color: colors.brand }]}>Test</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

// ── Account section ───────────────────────────────────────────────────────────
const ROLE_COLORS: Record<string, string> = {
  admin:     "#162e51",
  inspector: "#2378c3",
  viewer:    "#565c65",
};
const ROLE_LABELS: Record<string, string> = {
  admin:     "Admin",
  inspector: "Inspector",
  viewer:    "Viewer (read-only)",
};

function AccountSection() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [user, setUser] = useState<UserOut | null>(null);
  const [loading, setLoading] = useState(true);

  // On mount — check if already signed in and fetch profile
  useEffect(() => {
    api.isAuthed().then(async (yes) => {
      if (yes) {
        try { setUser(await api.me()); } catch { /* token expired — ignore */ }
      }
      setLoading(false);
    });
  }, []);

  async function submit() {
    const trimmedEmail = email.trim();
    const trimmedPw    = pw.trim();
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      Alert.alert("Invalid email", "Please enter a valid email address.");
      return;
    }
    if (!trimmedPw) {
      Alert.alert("Password required", "Please enter a password.");
      return;
    }
    if (mode === "register" && trimmedPw.length < 6) {
      Alert.alert("Password too short", "Password must be at least 6 characters.");
      return;
    }
    try {
      if (mode === "register") {
        await api.register(trimmedEmail, trimmedPw, name.trim() || undefined);
      }
      await api.login(trimmedEmail, trimmedPw);
      // Fetch profile to show role
      const profile = await api.me();
      setUser(profile);
      Alert.alert(
        "Signed in",
        `Welcome, ${profile.full_name}!\nRole: ${ROLE_LABELS[profile.role] ?? profile.role}`,
      );
    } catch (e: any) {
      Alert.alert("Sign in failed", e.message);
    }
  }

  async function logout() {
    await api.logout();
    setUser(null);
  }

  if (loading) {
    return (
      <View style={s.card}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  return (
    <View style={s.card}>
      <Text style={s.h2}><Ionicons name="person-outline" size={15} /> Account</Text>

      {user ? (
        /* ── Signed-in state ── */
        <View style={{ gap: 10 }}>
          {/* User info tile */}
          <View style={{
            backgroundColor: colors.sunken, borderRadius: 8,
            padding: 12, borderWidth: 1, borderColor: colors.border,
          }}>
            <Text style={{ fontWeight: "700", color: colors.text, fontSize: 15 }}>
              {user.full_name}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
              {user.email}
            </Text>
            <View style={{
              marginTop: 8, alignSelf: "flex-start",
              backgroundColor: ROLE_COLORS[user.role] ?? "#565c65",
              paddingHorizontal: 10, paddingVertical: 3, borderRadius: 99,
            }}>
              <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>
                {ROLE_LABELS[user.role] ?? user.role}
              </Text>
            </View>
          </View>

          {user.role === "viewer" && (
            <View style={{ backgroundColor: "#fff8e1", borderRadius: 6, padding: 10,
              borderWidth: 1, borderColor: "#ffe082" }}>
              <Text style={{ color: "#5c410a", fontSize: 12 }}>
                Viewer accounts can only read history — scanning requires an Inspector or Admin account.
              </Text>
            </View>
          )}

          <TouchableOpacity style={s.btnGhost} onPress={logout}>
            <Ionicons name="log-out-outline" size={15} color={colors.text} />
            <Text style={[s.btnTxt, { color: colors.text }]}>Sign out</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* ── Sign-in / register form ── */
        <>
          {mode === "register" && <Field label="Full name (optional)" v={name} on={setName} />}
          <Field label="Email" v={email} on={setEmail} />
          <Field label="Password" v={pw} on={setPw} secure />
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
            <TouchableOpacity onPress={() => setMode(mode === "login" ? "register" : "login")}>
              <Text style={{ color: colors.brand }}>
                {mode === "login" ? "Need an account?" : "Already have one?"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.btn} onPress={submit}>
              <Text style={s.btnTxt}>{mode === "login" ? "Sign in" : "Register"}</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.note}>
            The first account registered on this server becomes Admin.
            Others are Inspector by default.
          </Text>
        </>
      )}
    </View>
  );
}

// ── Detection thresholds ──────────────────────────────────────────────────────
function DetectionSection() {
  const [auth, setAuth] = useState("0.60");
  const [susp, setSusp] = useState("0.38");

  useEffect(() => {
    api.settings().then((rows) => {
      rows.forEach((r) => {
        if (r.key === "authentic_threshold") setAuth(String(r.value));
        if (r.key === "suspicious_threshold") setSusp(String(r.value));
      });
    }).catch(() => {});
  }, []);

  async function save() {
    const authVal = Number(auth);
    const suspVal = Number(susp);
    if (isNaN(authVal) || isNaN(suspVal) || authVal < 0 || authVal > 1 || suspVal < 0 || suspVal > 1) {
      Alert.alert("Invalid", "Thresholds must be numbers between 0 and 1.");
      return;
    }
    try {
      await api.setSetting("authentic_threshold", authVal);
      await api.setSetting("suspicious_threshold", suspVal);
      Alert.alert("Saved", "Thresholds updated.");
    } catch (e: any) { Alert.alert("Error", e.message); }
  }

  return (
    <View style={s.card}>
      <Text style={s.h2}><Ionicons name="options-outline" size={15} /> Detection Thresholds</Text>
      <Field label="Authentic ≥" v={auth} on={setAuth} />
      <Field label="Suspicious ≥" v={susp} on={setSusp} />
      <TouchableOpacity style={[s.btn, { alignSelf: "flex-end" }]} onPress={save}>
        <Text style={s.btnTxt}>Save</Text>
      </TouchableOpacity>
      <Text style={s.note}>Admin only. Affects the authenticity verdict threshold.</Text>
    </View>
  );
}

// ── Currencies toggle ─────────────────────────────────────────────────────────
function CurrenciesSection() {
  const [items, setItems] = useState<CurrencyConfig[]>([]);

  useEffect(() => { api.currencies().then(setItems).catch(() => {}); }, []);

  async function toggle(c: CurrencyConfig) {
    try {
      const next = { ...c, enabled: !c.enabled };
      await api.upsertCurrency(next);
      setItems(items.map((x) => (x.code === c.code ? next : x)));
    } catch (e: any) { Alert.alert("Error", e.message); }
  }

  return (
    <View style={s.card}>
      <Text style={s.h2}><Ionicons name="cash-outline" size={15} /> Currencies</Text>
      {items.map((c) => (
        <View key={c.code} style={s.currRow}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: "600", color: colors.text }}>{c.code} — {c.name}</Text>
            <Text style={{ color: colors.muted, fontSize: 11 }} numberOfLines={1}>
              {c.denominations.join(", ")}
            </Text>
          </View>
          <Switch value={c.enabled} onValueChange={() => toggle(c)} />
        </View>
      ))}
      {items.length === 0 && (
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          Sign in and connect to server to load currencies.
        </Text>
      )}
    </View>
  );
}

// ── About ─────────────────────────────────────────────────────────────────────
function AboutSection() {
  return (
    <View style={[s.card, { marginBottom: 32 }]}>
      <Text style={s.h2}><Ionicons name="information-circle-outline" size={15} /> About</Text>
      <Text style={{ color: colors.muted, lineHeight: 20 }}>
        VeriCash v1.0.0{"\n"}
        7-technique image-processing pipeline{"\n"}
        CIE Lab colour-fingerprint classifier{"\n"}
        MobileNetV2 denomination recognition
      </Text>
      <Text style={[s.note, { marginTop: 8 }]}>
        Academic / inspector use only. Not a legal authentication of currency.
      </Text>
    </View>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function Field({ label, v, on, secure }: { label: string; v: string; on: (s: string) => void; secure?: boolean }) {
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={{ fontSize: 11, color: colors.muted, marginBottom: 2 }}>{label}</Text>
      <TextInput
        value={v}
        onChangeText={on}
        secureTextEntry={secure}
        autoCapitalize="none"
        style={s.input}
      />
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.card, padding: 14,
    borderRadius: radius.xl, borderWidth: 1,
    borderColor: colors.border, marginBottom: 12,
  },
  h2: { fontSize: 15, fontWeight: "700", color: colors.text, marginBottom: 10 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 9,
    color: colors.text, backgroundColor: "#f8f9fc", fontSize: 13,
  },
  savedRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
  btn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, backgroundColor: colors.brand,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.lg,
  },
  btnGhost: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, backgroundColor: colors.sunken,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
  },
  btnTxt: { color: "white", fontWeight: "700", fontSize: 13 },
  note: { color: colors.muted, fontSize: 11, marginTop: 6, lineHeight: 16 },
  currRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 8, borderTopWidth: 1, borderColor: colors.border,
  },
});
