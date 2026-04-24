import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { View, Text, StyleSheet, StatusBar as RNStatusBar, Platform } from "react-native";

const NAV = "#162e51";
const GOLD = "#ffbc78";
const ACTIVE = "#ffbc78";
const INACTIVE = "#8a96b2";

// Height of the Android status bar (0 on iOS — tabs handle safe area)
const SB_H = Platform.OS === "android" ? (RNStatusBar.currentHeight ?? 24) : 0;

/** Gold government banner — extends behind the translucent status bar on Android */
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
    paddingTop: SB_H + 4,   // push text below the status bar icons
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

export default function Layout() {
  return (
    <>
      {/* translucent=true lets gold strip bleed through status bar area */}
      <StatusBar style="dark" backgroundColor={GOLD} translucent />
      <GovStrip />
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: NAV },
          headerTintColor: "#fff",
          headerTitleStyle: { fontWeight: "700", fontSize: 16, letterSpacing: 0.2 },
          headerShadowVisible: false,
          tabBarStyle: {
            backgroundColor: NAV,
            borderTopColor: "#243657",
            borderTopWidth: 1,
            paddingTop: 4,
            height: 60,
          },
          tabBarActiveTintColor: ACTIVE,
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
            headerTitle: "VeriCash",
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
