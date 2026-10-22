import { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const COLORS = {
  background: "#F7F6F1",
  surface: "#FFFFFF",
  ink: "#173B34",
  muted: "#71817B",
  line: "#E7EAE5",
  green: "#26745D",
  greenLight: "#E9F4EE",
  peach: "#F5E9DC",
  danger: "#A43E35",
};

const DEMO_EMAIL = "meera@nexife.demo";
const DEMO_PASSWORD = "demo123";

type AttendanceRecord = {
  dateKey: string;
  time: string;
};

function getDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function App() {
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [record, setRecord] = useState<AttendanceRecord | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const markedToday = record?.dateKey === getDateKey(now);

  function signIn() {
    if (email.trim().toLowerCase() !== DEMO_EMAIL || password !== DEMO_PASSWORD) {
      setLoginError("Those details don't match the sample account. Check the demo credentials below.");
      return;
    }

    setLoginError("");
    setIsSignedIn(true);
  }

  function markAttendance() {
    const markedAt = new Date();
    setRecord({
      dateKey: getDateKey(markedAt),
      time: formatTime(markedAt),
    });
    setNow(markedAt);
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.page}>
          {isSignedIn ? (
            <>
              <View style={styles.topBar}>
                <Brand />
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setIsSignedIn(false)}
                  style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}
                >
                  <Text style={styles.signOutText}>Sign out</Text>
                </Pressable>
              </View>

              <Text style={styles.dateLabel}>
                {now.toLocaleDateString("en-IN", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </Text>
              <Text style={styles.greeting}>Good morning, Meera</Text>
              <Text style={styles.subtitle}>Your workday, at a glance.</Text>

              <View style={styles.attendanceCard}>
                <View style={styles.attendanceHeader}>
                  <View style={styles.iconCircle}>
                    <Text style={styles.clockIcon}>◷</Text>
                  </View>
                  <View
                    style={[
                      styles.statusPill,
                      markedToday ? styles.statusPillDone : styles.statusPillWaiting,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        markedToday ? styles.statusTextDone : styles.statusTextWaiting,
                      ]}
                    >
                      {markedToday ? "CHECKED IN" : "NOT CHECKED IN"}
                    </Text>
                  </View>
                </View>

                <Text style={styles.cardTitle}>
                  {markedToday ? "You're all set for today." : "Ready to start your day?"}
                </Text>
                <Text style={styles.cardDescription}>
                  {markedToday
                    ? `Your attendance was marked at ${record.time}. Have a great shift!`
                    : "Mark your attendance when you arrive at the salon."}
                </Text>

                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: Boolean(markedToday) }}
                  disabled={Boolean(markedToday)}
                  onPress={markAttendance}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    markedToday && styles.primaryButtonDone,
                    pressed && !markedToday && styles.pressed,
                  ]}
                >
                  <Text style={styles.primaryButtonText}>
                    {markedToday ? `Attendance marked · ${record.time}` : "Mark attendance"}
                  </Text>
                  {!markedToday && <Text style={styles.buttonArrow}>→</Text>}
                </Pressable>
              </View>

              <View style={styles.shiftCard}>
                <View style={styles.sectionHeading}>
                  <Text style={styles.sectionTitle}>Your shift</Text>
                  <Text style={styles.demoLabel}>SAMPLE</Text>
                </View>
                <View style={styles.shiftRow}>
                  <View>
                    <Text style={styles.shiftTime}>9:00 AM – 6:00 PM</Text>
                    <Text style={styles.shiftMeta}>Stylist · Indiranagar</Text>
                  </View>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>MS</Text>
                  </View>
                </View>
              </View>

              <View style={styles.noteCard}>
                <Text style={styles.noteEyebrow}>A LITTLE REMINDER</Text>
                <Text style={styles.noteText}>
                  Take a moment to get settled before your first appointment.
                </Text>
              </View>

              <Text style={styles.footerNote}>DEMO APP · Attendance is not sent to a server</Text>
            </>
          ) : (
            <>
              <View style={styles.loginBrand}>
                <Brand />
              </View>
              <View style={styles.loginHero}>
                <Text style={styles.eyebrow}>YOUR SALON, IN SYNC</Text>
                <Text style={styles.loginTitle}>Good to see you.</Text>
                <Text style={styles.subtitle}>
                  Sign in to check in for your shift.
                </Text>
              </View>

              <View style={styles.formCard}>
                <Text style={styles.fieldLabel}>Email address</Text>
                <TextInput
                  accessibilityLabel="Email address"
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor="#9AA59F"
                  selectionColor={COLORS.green}
                  style={styles.input}
                  value={email}
                />

                <Text style={[styles.fieldLabel, styles.passwordLabel]}>Password</Text>
                <TextInput
                  accessibilityLabel="Password"
                  autoCapitalize="none"
                  onChangeText={setPassword}
                  onSubmitEditing={signIn}
                  placeholder="Enter your password"
                  placeholderTextColor="#9AA59F"
                  secureTextEntry
                  selectionColor={COLORS.green}
                  style={styles.input}
                  value={password}
                />

                {loginError ? (
                  <Text accessibilityRole="alert" style={styles.errorText}>
                    {loginError}
                  </Text>
                ) : null}

                <Pressable
                  accessibilityRole="button"
                  onPress={signIn}
                  style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
                >
                  <Text style={styles.primaryButtonText}>Sign in</Text>
                  <Text style={styles.buttonArrow}>→</Text>
                </Pressable>
              </View>

              <View style={styles.demoCard}>
                <View style={styles.demoCardHeading}>
                  <View style={styles.demoDot} />
                  <Text style={styles.demoCardTitle}>Try the sample account</Text>
                </View>
                <Text style={styles.demoCredentials}>meera@nexife.demo</Text>
                <Text style={styles.demoCredentials}>Password: demo123</Text>
              </View>

              <Text style={styles.footerNote}>SAMPLE ONLY · No real account or data is used</Text>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Brand() {
  return (
    <View style={styles.brand}>
      <View style={styles.brandMark}>
        <Text style={styles.brandMarkText}>n</Text>
      </View>
      <Text style={styles.brandName}>nexife</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 36,
  },
  page: {
    alignSelf: "center",
    maxWidth: 480,
    width: "100%",
  },
  brand: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  brandMark: {
    alignItems: "center",
    backgroundColor: COLORS.ink,
    borderRadius: 12,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  brandMarkText: {
    color: "#FFFFFF",
    fontFamily: "serif",
    fontSize: 27,
    fontWeight: "700",
    lineHeight: 31,
  },
  brandName: {
    color: COLORS.ink,
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.8,
  },
  loginBrand: {
    marginBottom: 64,
    marginTop: 18,
  },
  loginHero: {
    marginBottom: 30,
  },
  eyebrow: {
    color: COLORS.green,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.7,
    marginBottom: 12,
  },
  loginTitle: {
    color: COLORS.ink,
    fontSize: 36,
    fontWeight: "700",
    letterSpacing: -1.5,
    lineHeight: 43,
    marginBottom: 8,
  },
  subtitle: {
    color: COLORS.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  formCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.line,
    borderRadius: 20,
    borderWidth: 1,
    padding: 22,
  },
  fieldLabel: {
    color: COLORS.ink,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
  },
  passwordLabel: {
    marginTop: 20,
  },
  input: {
    backgroundColor: "#FBFCFA",
    borderColor: COLORS.line,
    borderRadius: 12,
    borderWidth: 1,
    color: COLORS.ink,
    fontSize: 15,
    height: 50,
    paddingHorizontal: 14,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: COLORS.ink,
    borderRadius: 13,
    flexDirection: "row",
    height: 54,
    justifyContent: "center",
    marginTop: 24,
    paddingHorizontal: 18,
  },
  primaryButtonDone: {
    backgroundColor: COLORS.green,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
  buttonArrow: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "500",
    marginLeft: -18,
  },
  pressed: {
    opacity: 0.82,
  },
  demoCard: {
    backgroundColor: COLORS.greenLight,
    borderRadius: 16,
    marginTop: 18,
    padding: 18,
  },
  demoCardHeading: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: 10,
  },
  demoDot: {
    backgroundColor: COLORS.green,
    borderRadius: 4,
    height: 8,
    marginRight: 8,
    width: 8,
  },
  demoCardTitle: {
    color: COLORS.ink,
    fontSize: 13,
    fontWeight: "700",
  },
  demoCredentials: {
    color: "#48645B",
    fontSize: 13,
    lineHeight: 20,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 12,
  },
  footerNote: {
    color: "#8B9690",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1.15,
    marginTop: 28,
    textAlign: "center",
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 42,
    marginTop: 8,
  },
  signOut: {
    borderColor: COLORS.line,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  signOutText: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  dateLabel: {
    color: COLORS.green,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.4,
    marginBottom: 9,
  },
  greeting: {
    color: COLORS.ink,
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: -1.2,
    lineHeight: 38,
  },
  attendanceCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.line,
    borderRadius: 22,
    borderWidth: 1,
    marginTop: 28,
    padding: 22,
  },
  attendanceHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 22,
  },
  iconCircle: {
    alignItems: "center",
    backgroundColor: COLORS.greenLight,
    borderRadius: 20,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  clockIcon: {
    color: COLORS.green,
    fontSize: 25,
    lineHeight: 30,
  },
  statusPill: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  statusPillWaiting: {
    backgroundColor: COLORS.peach,
  },
  statusPillDone: {
    backgroundColor: COLORS.greenLight,
  },
  statusText: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  statusTextWaiting: {
    color: "#9B653B",
  },
  statusTextDone: {
    color: COLORS.green,
  },
  cardTitle: {
    color: COLORS.ink,
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.6,
    lineHeight: 28,
  },
  cardDescription: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },
  shiftCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.line,
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 16,
    padding: 20,
  },
  sectionHeading: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  sectionTitle: {
    color: COLORS.ink,
    fontSize: 15,
    fontWeight: "700",
  },
  demoLabel: {
    color: COLORS.green,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
  },
  shiftRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  shiftTime: {
    color: COLORS.ink,
    fontSize: 17,
    fontWeight: "700",
  },
  shiftMeta: {
    color: COLORS.muted,
    fontSize: 13,
    marginTop: 6,
  },
  avatar: {
    alignItems: "center",
    backgroundColor: COLORS.peach,
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  avatarText: {
    color: "#855A3D",
    fontSize: 12,
    fontWeight: "700",
  },
  noteCard: {
    backgroundColor: "#EFEFE6",
    borderRadius: 16,
    marginTop: 16,
    padding: 18,
  },
  noteEyebrow: {
    color: COLORS.green,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.1,
    marginBottom: 8,
  },
  noteText: {
    color: COLORS.ink,
    fontSize: 13,
    lineHeight: 20,
  },
});
