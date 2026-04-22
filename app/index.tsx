import React, { useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius } from "../src/theme";
import { api, ScanResult } from "../src/api/client";
import ResultCard from "../src/components/ResultCard";

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const cam = useRef<CameraView | null>(null);

  async function snap() {
    if (!cam.current) return;
    setBusy(true);
    try {
      const photo = await cam.current.takePictureAsync({ quality: 0.85, skipProcessing: false });
      if (photo?.uri) await scan(photo.uri);
    } catch (e: any) { Alert.alert("Capture failed", e.message); }
    finally { setBusy(false); }
  }

  async function pick() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.9 });
    if (!res.canceled && res.assets[0]) {
      setBusy(true);
      try { await scan(res.assets[0].uri); }
      finally { setBusy(false); }
    }
  }

  async function scan(uri: string) {
    try {
      const r = await api.scan(uri);
      setResult(r);
    } catch (e: any) { Alert.alert("Scan failed", e.message); }
  }

  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={s.h1}>Scan a banknote</Text>
      <Text style={s.sub}>Place the note flat under good light. Six image-processing techniques run on-server.</Text>

      <View style={s.cameraBox}>
        {active && permission?.granted ? (
          <CameraView ref={cam} style={s.camera} facing="back" />
        ) : (
          <View style={[s.camera, { alignItems: "center", justifyContent: "center" }]}>
            <Ionicons name="camera-outline" size={48} color="#94A3B8" />
            <Text style={{ color: "#94A3B8", marginTop: 8 }}>Camera off</Text>
          </View>
        )}
      </View>

      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        {!active ? (
          <TouchableOpacity
            style={s.btn}
            onPress={async () => {
              if (!permission?.granted) {
                const r = await requestPermission();
                if (!r.granted) return;
              }
              setActive(true);
            }}
          >
            <Ionicons name="camera" size={18} color="white" />
            <Text style={s.btnTxt}>Start camera</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity style={s.btn} onPress={snap} disabled={busy}>
              {busy ? <ActivityIndicator color="white" /> : <Ionicons name="scan" size={18} color="white" />}
              <Text style={s.btnTxt}>Capture</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.btnGhost} onPress={() => setActive(false)}>
              <Ionicons name="stop" size={18} color={colors.text} />
              <Text style={[s.btnTxt, { color: colors.text }]}>Stop</Text>
            </TouchableOpacity>
          </>
        )}
        <TouchableOpacity style={s.btnGhost} onPress={pick}>
          <Ionicons name="image" size={18} color={colors.text} />
          <Text style={[s.btnTxt, { color: colors.text }]}>Upload</Text>
        </TouchableOpacity>
      </View>

      {result && <ResultCard r={result} />}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  h1: { fontSize: 22, fontWeight: "800", color: colors.text },
  sub: { color: colors.muted, marginBottom: 8 },
  cameraBox: { aspectRatio: 4 / 3, borderRadius: radius.xl, overflow: "hidden", backgroundColor: "#0F172A" },
  camera: { flex: 1 },
  btn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.brand, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.lg },
  btnGhost: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#E2E8F0", paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.lg },
  btnTxt: { color: "white", fontWeight: "700" },
});
