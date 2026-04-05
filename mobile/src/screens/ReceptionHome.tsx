import { Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { clearSession } from "../auth/storage";
import type { RootStackParamList } from "../navigation/AppNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "ReceptionHome">;

export default function ReceptionHome({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Reception</Text>
      <Text style={styles.subtitle}>Next: appointments + check-in + billing</Text>

      <Pressable onPress={() => navigation.navigate("ReceptionAppointments")} style={styles.primary}>
        <Text style={styles.primaryText}>Open appointments</Text>
      </Pressable>

      <View style={{ height: 12 }} />

      <Pressable
        onPress={async () => {
          await clearSession();
          navigation.replace("Login");
        }}
        style={styles.button}
      >
        <Text style={styles.buttonText}>Logout</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: "center" },
  title: { fontSize: 28, fontWeight: "800", marginBottom: 8 },
  subtitle: { color: "#6b7280", marginBottom: 24 },
  primary: { backgroundColor: "#2563eb", padding: 12, borderRadius: 12, width: 200 },
  primaryText: { color: "white", fontWeight: "900", textAlign: "center" },
  button: { backgroundColor: "#ef4444", padding: 12, borderRadius: 12, width: 140 },
  buttonText: { color: "white", fontWeight: "700", textAlign: "center" },
});

