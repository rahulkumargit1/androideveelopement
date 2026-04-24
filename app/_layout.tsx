import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { View, Text, StyleSheet } from "react-native";

const NAV = "#162e51";
const ACTIVE = "#ffbc78";
const INACTIVE = "#8a96b2";

/** Thin gold-strip banner at very top — mirrors web .gov-strip */
function GovStrip() {
  return (
    <View style={strip.wrap}>
      <Text style={strip.text}>VeriCash · Office of Currency Authentication</Text>
    </View>
  );
}

const strip = StyleSheet.create({
  wrap: {
    backgroundColor: "#ffbc78",
    paddingVertical: 4,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  text: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
    color: "#162e51",
    textTransform: "uppercase",
  },
});

export default function Layout() {
  return (
    <>
      <StatusBar style="light" backgroundColor={NAV} />
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
