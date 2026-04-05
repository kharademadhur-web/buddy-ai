import { Pressable, StyleSheet, Text, View } from "react-native";
import { clearSession } from "../auth/storage";

export default function IndependentHome() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Independent Doctor</Text>
      <Text style={styles.subtitle}>Next: schedule + queue + consultation</Text>

      <Pressable
        onPress={async () => {
          await clearSession();
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
  button: { backgroundColor: "#ef4444", padding: 12, borderRadius: 12, width: 140 },
  buttonText: { color: "white", fontWeight: "700", textAlign: "center" },
});

