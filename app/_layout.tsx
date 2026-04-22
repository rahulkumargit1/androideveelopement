import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";

const NAV = "#162e51";
const ACTIVE = "#ffbc78";
const INACTIVE = "#8a96b2";

export default function Layout() {
  return (
    <>
      <StatusBar style="light" backgroundColor={NAV} />
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: NAV },
          headerTintColor: "#fff",
          headerTitleStyle: { fontWeight: "700" },
          tabBarStyle: { backgroundColor: NAV, borderTopColor: "#243657" },
          tabBarActiveTintColor: ACTIVE,
          tabBarInactiveTintColor: INACTIVE,
          tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Scan",
            tabBarIcon: ({ color, size }) => <Ionicons name="scan" size={size} color={color} />,
            headerTitle: "VeriCash — Scan",
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: "History",
            tabBarIcon: ({ color, size }) => <Ionicons name="time-outline" size={size} color={color} />,
            headerTitle: "Scan History",
          }}
        />
        <Tabs.Screen
          name="members"
          options={{
            title: "Team",
            tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" size={size} color={color} />,
            headerTitle: "Project Team",
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Settings",
            tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" size={size} color={color} />,
            headerTitle: "Settings",
          }}
        />
      </Tabs>
    </>
  );
}
