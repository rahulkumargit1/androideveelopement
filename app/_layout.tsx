import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import {
  View, Text, StyleSheet, Animated, Easing,
  StatusBar as RNStatusBar, Platform,
} from "react-native";
import { useRef, useState, useEffect } from "react";

const NAV      = "#162e51";
const GOLD     = "#ffbc78";
const ACTIVE   = "#ffbc78";
const INACTIVE = "#8a96b2";

const SB_H = Platform.OS === "android" ? (RNStatusBar.currentHeight ?? 24) : 0;

/* ── 2-second animated splash screen ───────────────────────────────────── */
function SplashScreen({ onDone }: { onDone: () => void }) {
  const scale   = useRef(new Animated.Value(0.7)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const barW    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade + scale in logo
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1, duration: 400, useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.timing(scale, {
        toValue: 1, duration: 500, useNativeDriver: true,
        easing: Easing.out(Easing.back(1.4)),
      }),
    ]).start();

    // Progress bar fills over 1.8 s
    Animated.timing(barW, {
      toValue: 1, duration: 1800, useNativeDriver: false,
      easing: Easing.inOut(Easing.ease),
    }).start();

    // Dismiss after 2 s
    const t = setTimeout(onDone, 2000);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={sp.root}>
      <StatusBar style="light" backgroundColor={NAV} translucent={false} />

      {/* Logo mark */}
      <Animated.View style={[sp.logoWrap, { opacity, transform: [{ scale }] }]}>
        <View style={sp.circle}>
          <Ionicons name="star" size={48} color={GOLD} />
        </View>
        <Text style={sp.wordmark}>VeriCash</Text>
        <Text style={sp.subtitle}>Office of Currency Authentication</Text>
      </Animated.View>

      {/* Progress bar */}
      <View style={sp.barTrack}>
        <Animated.View
          style={[sp.barFill, {
            width: barW.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
          }]}
        />
      </View>

      <Text style={sp.version}>v1.0.0  ·  7-technique pipeline</Text>
    </View>
  );
}

const sp = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: NAV,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: SB_H,
  },
  logoWrap: { alignItems: "center", marginBottom: 60 },
  circle: {
    width: 96, height: 96,
    borderRadius: 48,
    backgroundColor: "#1a4480",
    borderWidth: 3,
    borderColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  wordmark: {
    color: "#ffffff",
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  subtitle: {
    color: "#8a96b2",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  barTrack: {
    width: "60%",
    height: 3,
    backgroundColor: "#243657",
    borderRadius: 99,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    backgroundColor: GOLD,
    borderRadius: 99,
  },
  version: {
    position: "absolute",
    bottom: 40,
    color: "#3d5275",
    fontSize: 11,
    letterSpacing: 0.5,
  },
});

/* ── Logo title: star + wordmark (Scan tab header) ──────────────────────── */
function LogoTitle() {
  return (
    <View style={logo.row}>
      <View style={logo.circle}>
        <Ionicons name="star" size={16} color={GOLD} />
      </View>
      <Text style={logo.wordmark}>VeriCash</Text>
    </View>
  );
}

const logo = StyleSheet.create({
  row:    { flexDirection: "row", alignItems: "center", gap: 9 },
  circle: {
    width: 34, height: 34,
    borderRadius: 17,
    backgroundColor: "#1a4480",
    borderWidth: 1.5,
    borderColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
  },
  wordmark: { color: "#fff", fontSize: 20, fontWeight: "800", letterSpacing: 0.2 },
});

/* ── Gold government strip ───────────────────────────────────────────────── */
function GovStrip() {
  return (
    <View style={strip.wrap}>
      <Text style={strip.text}>VeriCash · Office of Currency Authentication</Text>
    </View>
  );
}

const strip = StyleSheet.create({
  wrap: {
    backgroundColor: GOLD,
    paddingTop: SB_H + 4,
    paddingBottom: 5,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  text: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
    color: NAV,
    textTransform: "uppercase",
  },
});

/* ── Root layout ─────────────────────────────────────────────────────────── */
export default function Layout() {
  const [ready, setReady] = useState(false);

  if (!ready) {
    return <SplashScreen onDone={() => setReady(true)} />;
  }

  return (
    <>
      <StatusBar style="dark" backgroundColor={GOLD} translucent />
      <GovStrip />
      <Tabs
        screenOptions={{
          headerStyle:              { backgroundColor: NAV, height: 62 },
          headerTintColor:          "#fff",
          headerTitleStyle:         { fontWeight: "700", fontSize: 16, letterSpacing: 0.2 },
          headerShadowVisible:      false,
          headerTitleContainerStyle: { paddingTop: 6 },
          tabBarStyle: {
            backgroundColor: NAV,
            borderTopColor:  "#243657",
            borderTopWidth:  1,
            paddingTop:      4,
            height:          60,
          },
          tabBarActiveTintColor:   ACTIVE,
          tabBarInactiveTintColor: INACTIVE,
          tabBarLabelStyle: { fontSize: 11, fontWeight: "600", marginBottom: 4 },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Scan",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="scan-outline" size={size} color={color} />
            ),
            headerTitle:      () => <LogoTitle />,
            headerTitleAlign: "left",
            headerLeftContainerStyle: { paddingLeft: 0 },
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: "History",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="time-outline" size={size} color={color} />
            ),
            headerTitle: "Audit Log",
          }}
        />
        <Tabs.Screen
          name="members"
          options={{
            title: "Team",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="people-outline" size={size} color={color} />
            ),
            headerTitle: "Project Team",
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Settings",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="settings-outline" size={size} color={color} />
            ),
            headerTitle: "Settings",
          }}
        />
      </Tabs>
    </>
  );
}
