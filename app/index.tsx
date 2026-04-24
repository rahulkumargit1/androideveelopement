import React, { useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
  Pressable,
  SafeAreaView,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { api, ScanResult, CurrencyConfig } from "../src/api/client";
import ResultCard from "../src/components/ResultCard";

/* ── Design tokens ───────────────────────────────────────────────── */
const T = {
  bg:            "#f9f8f6",
  card:          "#ffffff",
  cardBorder:    "#dcdee0",
  navy:          "#162e51",
  navyMid:       "#1a4480",
  blue:          "#2378c3",
  gold:          "#ffbc78",
  text:          "#1b1b1b",
  textSecondary: "#565c65",
  textMuted:     "#71767a",
};

const SCAN_STEPS = [
  "Applying image enhancement…",
  "Running histogram analysis…",
  "Performing spatial filtering…",
  "Transforming to frequency domain…",
  "Detecting morphological features…",
  "Analysing colour spaces (Lab)…",
  "Aggregating ensemble scores…",
];

const FALLBACK_CURRENCIES: CurrencyConfig[] = [
  { code: "auto", name: "Auto-detect", enabled: true, denominations: [] },
  { code: "INR",  name: "Indian Rupee", enabled: true, denominations: [] },
  { code: "USD",  name: "US Dollar",    enabled: true, denominations: [] },
  { code: "EUR",  name: "Euro",         enabled: true, denominations: [] },
  { code: "GBP",  name: "British Pound", enabled: true, denominations: [] },
  { code: "JPY",  name: "Japanese Yen", enabled: true, denominations: [] },
  { code: "AED",  name: "UAE Dirham",   enabled: true, denominations: [] },
];

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [active, setActive]       = useState(false);
  const [busy, setBusy]           = useState(false);
  const [scanStep, setScanStep]   = useState("");
  const [result, setResult]       = useState<ScanResult | null>(null);
  const cam = useRef<CameraView | null>(null);

  // Currency selector state
  const [currencies, setCurrencies]   = useState<CurrencyConfig[]>(FALLBACK_CURRENCIES);
  const [selected, setSelected]       = useState<CurrencyConfig>(FALLBACK_CURRENCIES[0]);
  const [pickerOpen, setPickerOpen]   = useState(false);

  useEffect(() => {
    api.currencies()
      .then((list) => {
        const enabled = list.filter((c) => c.enabled);
        if (enabled.length > 0) {
          const withAuto = [
            { code: "auto", name: "Auto-detect", enabled: true, denominations: [] },
            ...enabled,
          ];
          setCurrencies(withAuto);
          setSelected(withAuto[0]);
        }
      })
      .catch(() => {/* keep fallback */});
  }, []);

  async function snap() {
    if (!cam.current) return;
    setBusy(true);
    startStepCycle();
    try {
      const photo = await cam.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: false,
      });
      if (photo?.uri) await runScan(photo.uri);
    } catch (e: any) {
      Alert.alert("Capture failed", e.message);
    } finally {
      setBusy(false);
      setScanStep("");
    }
  }

  async function pick() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    });
    if (!res.canceled && res.assets[0]) {
      setBusy(true);
      startStepCycle();
      try {
        await runScan(res.assets[0].uri);
      } finally {
        setBusy(false);
        setScanStep("");
      }
    }
  }

  function startStepCycle() {
    let i = 0;
    setScanStep(SCAN_STEPS[0]);
    const iv = setInterval(() => {
      i = (i + 1) % SCAN_STEPS.length;
      setScanStep(SCAN_STEPS[i]);
    }, 900);
    // Store so we can clear it
    (startStepCycle as any)._iv = iv;
  }

  async function runScan(uri: string) {
    try {
      const hint = selected.code === "auto" ? undefined : selected.code;
      const r = await api.scan(uri, hint);
      setResult(r);
    } catch (e: any) {
      Alert.alert("Scan failed", e.message);
    } finally {
      clearInterval((startStepCycle as any)._iv);
    }
  }

  return (
    <SafeAreaView style={s.safeArea}>
    <ScrollView
      style={s.page}
      contentContainerStyle={s.pageContent}
      keyboardShouldPersistTaps="handled"
    >
      {/* ── Hero ───────────────────────────────────────────── */}
      <View style={s.hero}>
        <Text style={s.heroEyebrow}>Currency Authentication Bureau</Text>
        <Text style={s.heroTitle}>Scan a banknote</Text>
        <Text style={s.heroDesc}>
          Place the note flat under good lighting. Six image-processing
          techniques run server-side and produce an authenticity verdict.
        </Text>
        <View style={s.chipRow}>
          <View style={s.goldChip}>
            <Ionicons name="layers-outline" size={12} color="#5c410a" />
            <Text style={s.goldChipText}>7 techniques</Text>
          </View>
          <View style={s.goldChip}>
            <Ionicons name="color-palette-outline" size={12} color="#5c410a" />
            <Text style={s.goldChipText}>CIE Lab fingerprints</Text>
          </View>
        </View>
      </View>

      {/* ── Camera card ────────────────────────────────────── */}
      <View style={s.card}>
        <View style={s.cameraBox}>
          {active && permission?.granted ? (
            <CameraView ref={cam} style={s.cameraFill} facing="back" />
          ) : (
            <View style={[s.cameraFill, s.cameraPlaceholder]}>
              <Ionicons name="camera-outline" size={52} color="#8a96b2" />
              <Text style={s.cameraPlaceholderText}>Camera preview</Text>
            </View>
          )}
        </View>

        {/* Currency selector */}
        <View style={s.selectorSection}>
          <Text style={s.selectorLabel}>Currency hint</Text>
          <TouchableOpacity
            style={s.selector}
            onPress={() => setPickerOpen(true)}
            activeOpacity={0.7}
          >
            <Text style={s.selectorValue}>
              {selected.code === "auto"
                ? "Auto-detect"
                : `${selected.code} — ${selected.name}`}
            </Text>
            <Ionicons name="chevron-down" size={16} color={T.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Action buttons */}
        <View style={s.actions}>
          {!active ? (
            <TouchableOpacity
              style={s.btnPrimary}
              activeOpacity={0.85}
              onPress={async () => {
                if (!permission?.granted) {
                  const r = await requestPermission();
                  if (!r.granted) return;
                }
                setActive(true);
              }}
            >
              <Ionicons name="camera" size={18} color="#fff" />
              <Text style={s.btnPrimaryText}>Start camera</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                style={[s.btnPrimary, busy && s.btnDisabled]}
                onPress={snap}
                disabled={busy}
                activeOpacity={0.85}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Ionicons name="scan" size={18} color="#fff" />
                )}
                <Text style={s.btnPrimaryText}>
                  {busy ? "Scanning…" : "Capture & scan"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.btnSecondary}
                onPress={() => setActive(false)}
                activeOpacity={0.85}
              >
                <Ionicons name="stop-circle-outline" size={18} color={T.navyMid} />
                <Text style={s.btnSecondaryText}>Stop camera</Text>
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity
            style={s.btnSecondary}
            onPress={pick}
            activeOpacity={0.85}
          >
            <Ionicons name="image-outline" size={18} color={T.navyMid} />
            <Text style={s.btnSecondaryText}>Upload image</Text>
          </TouchableOpacity>
        </View>

        {/* Scanning progress */}
        {busy && (
          <View style={s.scanProgress}>
            <ActivityIndicator color={T.navyMid} size="small" />
            <Text style={s.scanStep}>{scanStep}</Text>
          </View>
        )}
      </View>

      {/* ── Result ─────────────────────────────────────────── */}
      {result && (
        <View style={s.resultSection}>
          <Text style={s.sectionEyebrow}>Analysis result</Text>
          <ResultCard r={result} />
        </View>
      )}

      {/* ── Currency picker modal ───────────────────────────── */}
      <Modal
        visible={pickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerOpen(false)}
      >
        <Pressable style={s.modalBackdrop} onPress={() => setPickerOpen(false)} />
        <View style={s.modalSheet}>
          <View style={s.modalHandle} />
          <Text style={s.modalTitle}>Select currency</Text>
          <FlatList
            data={currencies}
            keyExtractor={(c) => c.code}
            ItemSeparatorComponent={() => <View style={s.divider} />}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  s.modalItem,
                  item.code === selected.code && s.modalItemActive,
                ]}
                onPress={() => {
                  setSelected(item);
                  setPickerOpen(false);
                }}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    s.modalItemText,
                    item.code === selected.code && s.modalItemTextActive,
                  ]}
                >
                  {item.code === "auto" ? "Auto-detect" : `${item.code} — ${item.name}`}
                </Text>
                {item.code === selected.code && (
                  <Ionicons name="checkmark" size={18} color={T.navyMid} />
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea:    { flex: 1, backgroundColor: T.navy },
  page:        { flex: 1, backgroundColor: T.bg },
  pageContent: { paddingBottom: 48 },

  /* Hero */
  hero: {
    backgroundColor: T.navy,
    paddingTop: 28,
    paddingBottom: 28,
    paddingHorizontal: 20,
  },
  heroEyebrow: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "#8a96b2",
    marginBottom: 6,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  heroDesc: {
    fontSize: 14,
    color: "#c5cee0",
    lineHeight: 20,
    marginBottom: 14,
  },
  chipRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  goldChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#fff7e6",
    borderWidth: 1,
    borderColor: "#c2850c",
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  goldChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#5c410a",
    letterSpacing: 0.2,
  },

  /* Camera card */
  card: {
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.cardBorder,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 4,
    overflow: "hidden",
  },
  cameraBox: {
    aspectRatio: 4 / 3,
    backgroundColor: "#0b1b3b",
    overflow: "hidden",
  },
  cameraFill: { flex: 1 },
  cameraPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  cameraPlaceholderText: { color: "#8a96b2", fontSize: 13 },

  /* Selector */
  selectorSection: { padding: 16, borderBottomWidth: 1, borderBottomColor: T.cardBorder },
  selectorLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: T.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  selector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 40,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#c9c9c9",
    borderRadius: 3,
    backgroundColor: T.card,
  },
  selectorValue: { fontSize: 15, color: T.text, flex: 1 },

  /* Buttons */
  actions: {
    padding: 16,
    gap: 10,
  },
  btnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 44,
    backgroundColor: T.navyMid,
    borderRadius: 3,
  },
  btnPrimaryText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 15,
  },
  btnSecondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 44,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: T.navyMid,
    borderRadius: 3,
  },
  btnSecondaryText: {
    color: T.navyMid,
    fontWeight: "600",
    fontSize: 15,
  },
  btnDisabled: { opacity: 0.6 },

  /* Scan progress */
  scanProgress: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#eff6fb",
    borderTopWidth: 1,
    borderTopColor: "#d9e8f6",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  scanStep: { fontSize: 13, color: T.navyMid, fontWeight: "500", flex: 1 },

  /* Result section */
  resultSection: { paddingHorizontal: 16, paddingTop: 20 },
  sectionEyebrow: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: T.textMuted,
    marginBottom: 8,
  },

  /* Modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(11,27,59,0.55)",
  },
  modalSheet: {
    backgroundColor: T.card,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    maxHeight: "60%",
    paddingBottom: 32,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#dcdee0",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: T.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: T.cardBorder,
  },
  modalItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  modalItemActive: { backgroundColor: "#eff6fb" },
  modalItemText: { fontSize: 15, color: T.text },
  modalItemTextActive: { color: T.navyMid, fontWeight: "600" },
  divider: { height: 1, backgroundColor: T.cardBorder, marginHorizontal: 0 },
});
