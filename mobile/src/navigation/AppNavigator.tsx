import { useEffect, useState } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, Text, View } from "react-native";
import LoginScreen from "../screens/LoginScreen";
import DoctorHome from "../screens/DoctorHome";
import ReceptionHome from "../screens/ReceptionHome";
import IndependentHome from "../screens/IndependentHome";
import { getUser, type MobileUser } from "../auth/storage";
import ReceptionAppointmentsScreen from "../screens/reception/ReceptionAppointmentsScreen";
import ReceptionNewAppointmentScreen from "../screens/reception/ReceptionNewAppointmentScreen";
import ReceptionCheckInScreen from "../screens/reception/ReceptionCheckInScreen";
import ReceptionBillingScreen from "../screens/reception/ReceptionBillingScreen";
import DoctorQueueScreen from "../screens/doctor/DoctorQueueScreen";
import DoctorConsultationScreen from "../screens/doctor/DoctorConsultationScreen";
import DoctorPatientHistoryScreen from "../screens/doctor/DoctorPatientHistoryScreen";

export type RootStackParamList = {
  Login: undefined;
  DoctorHome: undefined;
  ReceptionHome: undefined;
  IndependentHome: undefined;
  ReceptionAppointments: undefined;
  ReceptionNewAppointment: undefined;
  ReceptionCheckIn: { appointmentId: string; patientId: string };
  ReceptionBilling: { appointmentId: string; patientId: string };
  DoctorQueue: undefined;
  DoctorConsultation: { appointmentId: string; patientId: string };
  DoctorPatientHistory: { patientId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const [user, setUser] = useState<MobileUser | null>(null);
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    (async () => {
      setUser(await getUser());
      setBooted(true);
    })();
  }, []);

  if (!booted) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
        <Text style={{ marginTop: 12, color: "#6b7280" }}>Loading…</Text>
      </View>
    );
  }

  const initialRouteName: keyof RootStackParamList = !user
    ? "Login"
    : user.role === "doctor"
      ? "DoctorHome"
      : user.role === "receptionist"
        ? "ReceptionHome"
        : "IndependentHome";

  return (
    <Stack.Navigator initialRouteName={initialRouteName}>
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen name="DoctorHome" component={DoctorHome} options={{ title: "Doctor" }} />
      <Stack.Screen name="ReceptionHome" component={ReceptionHome} options={{ title: "Reception" }} />
      <Stack.Screen
        name="IndependentHome"
        component={IndependentHome}
        options={{ title: "Independent Doctor" }}
      />

      {/* Reception flow */}
      <Stack.Screen
        name="ReceptionAppointments"
        component={ReceptionAppointmentsScreen}
        options={{ title: "Appointments" }}
      />
      <Stack.Screen
        name="ReceptionNewAppointment"
        component={ReceptionNewAppointmentScreen}
        options={{ title: "New Appointment" }}
      />
      <Stack.Screen
        name="ReceptionCheckIn"
        component={ReceptionCheckInScreen}
        options={{ title: "Check-in" }}
      />
      <Stack.Screen
        name="ReceptionBilling"
        component={ReceptionBillingScreen}
        options={{ title: "Billing" }}
      />

      {/* Doctor flow */}
      <Stack.Screen name="DoctorQueue" component={DoctorQueueScreen} options={{ title: "Queue" }} />
      <Stack.Screen
        name="DoctorConsultation"
        component={DoctorConsultationScreen}
        options={{ title: "Consultation" }}
      />
      <Stack.Screen
        name="DoctorPatientHistory"
        component={DoctorPatientHistoryScreen}
        options={{ title: "Patient history" }}
      />
    </Stack.Navigator>
  );
}

