import React, { useEffect, useState } from "react";
import { ScrollView, View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Switch } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api, CurrencyConfig } from "../src/api/client";
import { colors, radius } from "../src/theme";

export default function SettingsScreen() {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <AccountSection />
      <DetectionSection />
      <CurrenciesSection />
      <AboutSection />
    </ScrollView>
  );
}

function AccountSection() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [authed, setAuthed] = useState(false);
  useEffect(() => { api.isAuthed().then(setAuthed); }, []);

  async function submit() {
    try {
      if (mode === "register") await api.register(email, pw, name);
      await api.login(email, pw);
      setAuthed(true);
      Alert.alert("Success", "Signed in.");
    } catch (e: any) { Alert.alert("Error", e.message); }
  }
  async function logout() { await api.logout(); setAuthed(false); }

  return (
    <View style={s.card}>
      <Text style={s.h2}>Account</Text>
      {authed ? (
        <TouchableOpacity style={s.btnGhost} onPress={logout}>
          <Ionicons name="log-out-outline" size={18} color={colors.text} />
          <Text style={[s.btnTxt, { color: colors.text }]}>Sign out</Text>
        </TouchableOpacity>
      ) : (
        <>
          {mode === "register" && <Field label="Full name" v={name} on={setName} />}
          <Field label="Email" v={email} on={setEmail} />
          <Field label="Password" v={pw} on={setPw} secure />
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
            <TouchableOpacity onPress={() => setMode(mode === "login" ? "register" : "login")}>
              <Text style={{ color: colors.brand }}>{mode === "login" ? "Need an account?" : "Already have one?"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.btn} onPress={submit}>
              <Text style={s.btnTxt}>{mode === "login" ? "Sign in" : "Register"}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

function DetectionSection() {
  const [auth, setAuth] = useState("0.75");
  const [susp, setSusp] = useState("0.5");

  useEffect(() => {
    api.settings().then((rows) => {
      rows.forEach((r) => {
        if (r.key === "authentic_threshold") setAuth(String(r.value));
        if (r.key === "suspicious_threshold") setSusp(String(r.value));
      });
    }).catch(() => {});
  }, []);

  async function save() {
    try {
      await api.setSetting("authentic_threshold", Number(auth));
      await api.setSetting("suspicious_threshold", Number(susp));
      Alert.alert("Saved", "Thresholds updated.");
    } catch (e: any) { Alert.alert("Error", e.message); }
  }

  return (
    <View style={s.card}>
      <Text style={s.h2}>Detection thresholds</Text>
      <Field label="Authentic ≥" v={auth} on={setAuth} />
      <Field label="Suspicious ≥" v={susp} on={setSusp} />
      <TouchableOpacity style={[s.btn, { alignSelf: "flex-end" }]} onPress={save}>
        <Text style={s.btnTxt}>Save</Text>
      </TouchableOpacity>
      <Text style={s.note}>Admin only. Tighter thresholds reduce false positives but may flag genuine notes.</Text>
    </View>
  );
}

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
      <Text style={s.h2}>Currencies</Text>
      {items.map((c) => (
        <View key={c.code} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8, borderTopWidth: 1, borderColor: colors.border }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: "600", color: colors.text }}>{c.code} — {c.name}</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>{c.denominations.join(", ")}</Text>
          </View>
          <Switch value={c.enabled} onValueChange={() => toggle(c)} />
        </View>
      ))}
    </View>
  );
}

function AboutSection() {
  return (
    <View style={s.card}>
      <Text style={s.h2}>About</Text>
      <Text style={{ color: colors.muted }}>VeriCash v0.1.0 · API: {api.apiBase}</Text>
      <Text style={[s.note, { marginTop: 8 }]}>For academic / inspector use. Not a legal authentication of currency.</Text>
    </View>
  );
}

function Field({ label, v, on, secure }: { label: string; v: string; on: (s: string) => void; secure?: boolean }) {
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={{ fontSize: 11, color: colors.muted }}>{label}</Text>
      <TextInput
        value={v}
        onChangeText={on}
        secureTextEntry={secure}
        autoCapitalize="none"
        style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, color: colors.text, marginTop: 2 }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.card, padding: 14, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border },
  h2: { fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: 8 },
  btn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.brand, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.lg },
  btnGhost: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#E2E8F0", paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.lg, alignSelf: "flex-start" },
  btnTxt: { color: "white", fontWeight: "700" },
  note: { color: colors.muted, fontSize: 11, marginTop: 6 },
});
