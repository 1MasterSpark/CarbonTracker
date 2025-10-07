import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
  findNodeHandle,
} from "react-native";
import { LineChart } from "react-native-chart-kit";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const VIN_MAX_LEN = 17;
const USERS_KEY = '@users';
const CURRENT_USER_KEY = '@currentUser';
const USERDATA_KEY = (email: string) => `@userData:${email}`;
const TRIPS_KEY = (email: string) => `@trips:${email}`;

/* ---------- Types ---------- */
type VehicleInfo = {
  make?: string;
  model?: string;
  year?: string;
  body?: string;
  vehicleType?: string;
  engineCylinders?: string;
  displacementL?: string;
  displacementCC?: string;
  fuelTypePrimary?: string;
  fuelTypeSecondary?: string;
  engineModel?: string;
  engineManufacturer?: string;
  engineHP?: string;
  engineKW?: string;
  engineConfiguration?: string;
};

type User = { email: string; password: string };

type StoredVehicle = {
  id: string;
  name: string;
  vin?: string;
  body?: string;
  fuel?: string;
  vehicleType?: string;
  year?: string;
  avgEmissions: { day: number; week: number; month: number };
  trend: number[];
};

type UserData = {
  username?: string;
  vehicles: StoredVehicle[];
  selectedVehicleId?: string;
};

type Rect = { x: number; y: number; w: number; h: number };

/* ---------- Trips ---------- */
type Trip = {
  id: string;
  date: string;        // YYYY-MM-DD
  start: string;       // start location label
  end: string;         // end location label
  duration: number;    // seconds
  distance: number;    // km
  emissions: number;   // gCO2
};

/* ---------- Helpers ---------- */
const num = (v: any, fallback = 0): number => {
  const n = typeof v === 'string' ? Number(v) : v;
  return Number.isFinite(n) ? n : fallback;
};

const fmtDuration = (secondsRaw: any): string => {
  const seconds = num(secondsRaw, 0);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

const groupTripsByDate = (trips: Trip[]): Record<string, Trip[]> =>
  trips.reduce((acc, t) => {
    (acc[t.date] ||= []).push(t);
    return acc;
  }, {} as Record<string, Trip[]>);

const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

const normalizeTrips = (arr: any[]): Trip[] =>
  (arr || []).map((t) => ({
    id: String(t.id ?? `t_${Math.random().toString(36).slice(2)}`),
    date: String(t.date ?? ''),
    start: String(t.start ?? 'Unknown'),
    end: String(t.end ?? 'Unknown'),
    duration: num(t.duration, 0),
    distance: num(t.distance, 0),
    emissions: num(t.emissions, 0),
  })).filter(t => t.date);

/* ---------- Main Screen ---------- */
export default function IndexScreen(): JSX.Element {
  const [screen, setScreen] = useState<'landing' | 'decode' | 'login' | 'register' | 'account' | 'vehicles' | 'start' | 'trip'>('landing');

  // Landing “how to” was removed per request; only login visible.
  const [showSteps, setShowSteps] = useState<boolean>(false); // used on Vehicles page

  // VIN decode/register (shared logic — used inside Vehicles modal)
  const [vin, setVin] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [vehicle, setVehicle] = useState<VehicleInfo | null>(null);
  const [color, setColor] = useState<string>("");
  const [success, setSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  // Auth
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [loginError, setLoginError] = useState<string>("");
  const [registerSuccess, setRegisterSuccess] = useState<boolean>(false);

  // Session & user data
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);

  // Trips (persisted per user)
  const [trips, setTrips] = useState<Trip[]>([]);

  // Top-right profile menu & dialogs
  const [profileOpen, setProfileOpen] = useState<boolean>(false);
  const [usernameModal, setUsernameModal] = useState<boolean>(false);
  const [passwordModal, setPasswordModal] = useState<boolean>(false);
  const [newUsername, setNewUsername] = useState<string>("");
  const [oldPassword, setOldPassword] = useState<string>("");
  const [newPassword1, setNewPassword1] = useState<string>("");
  const [newPassword2, setNewPassword2] = useState<string>("");

  // Vehicles page: VIN modal
  const [vinModalOpen, setVinModalOpen] = useState<boolean>(false);

  // Vehicle dropdown modal (Account page quick select)
  const [vehicleDropdownOpen, setVehicleDropdownOpen] = useState<boolean>(false);

  // Tooltip for chart
  const [tooltip, setTooltip] = useState<{ x: number; y: number; value: number; label: string } | null>(null);

  const fadeAnim = useState(new Animated.Value(0))[0];

  // Refs + anchors for anchored modals
  const avatarRef = useRef<View>(null);
  const vehicleBtnRef = useRef<View>(null);

  const [avatarAnchor, setAvatarAnchor] = useState<Rect>({ x: 0, y: 0, w: 0, h: 0 });
  const [vehicleAnchor, setVehicleAnchor] = useState<Rect>({ x: 0, y: 0, w: 0, h: 0 });

  // Defaults for Web
  const screenWidth = Dimensions.get('window').width;
  const defaultAvatarAnchor: Rect = {
    x: Math.max(8, screenWidth - 220 - 16), y: 56, w: 36, h: 36,
  };
  const defaultVehicleAnchor: Rect = {
    x: 16, y: 140, w: screenWidth - 32, h: 48,
  };

  // ---- FIXED TYPE: accept View | null in the ref ----
  const measureInWindowAsync = (ref: React.RefObject<View | null>, fallback: Rect): Promise<Rect> => {
    if (Platform.OS === 'web') return Promise.resolve(fallback);
    return new Promise<Rect>((resolve) => {
      const node = findNodeHandle(ref.current);
      if (!node || !ref.current?.measureInWindow) return resolve(fallback);
      ref.current.measureInWindow((x, y, w, h) => resolve({ x, y, w, h }));
    });
  };

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, [fadeAnim]);

  // Auto-login on app start
  useEffect(() => {
    (async () => {
      try {
        const savedEmail = await AsyncStorage.getItem(CURRENT_USER_KEY);
        if (savedEmail) {
          setCurrentUser(savedEmail);
          await loadUserData(savedEmail);
          await loadTrips(savedEmail);
          setScreen('account'); // show home after autologin
        }
      } catch (e) {
        console.error("Auto-login error:", e);
      }
    })();
  }, []);

  const currentInitial = (userData?.username || currentUser || "?").trim().charAt(0).toUpperCase();

  /* ---------- Storage helpers ---------- */
  const loadUserData = async (emailAddr: string) => {
    try {
      const raw = await AsyncStorage.getItem(USERDATA_KEY(emailAddr));
      if (raw) {
        const parsed: UserData = JSON.parse(raw);
        setUserData(parsed);
      } else {
        // Seed with descriptors for display
        const seed: UserData = {
          username: emailAddr.split("@")[0],
          vehicles: [
            { id: 'v1', name: 'Corolla 1.8L', vin: 'JTNBU40E79SEED001', body: 'Sedan', fuel: 'Petrol', vehicleType: 'Passenger Car', year: '2018', avgEmissions: { day: 95, week: 110, month: 125 }, trend: [120, 118, 115, 112, 110, 108] },
            { id: 'v2', name: 'CR-V 2.4L', vin: '2HKRM4H51EHSEED02', body: 'SUV', fuel: 'Petrol', vehicleType: 'Multipurpose', year: '2016', avgEmissions: { day: 140, week: 165, month: 180 }, trend: [190, 185, 182, 178, 175, 170] },
            { id: 'v3', name: 'Model 3', vin: '5YJ3E1EAXKSSEED03', body: 'Sedan', fuel: 'Electric', vehicleType: 'Passenger Car', year: '2021', avgEmissions: { day: 0, week: 0, month: 0 }, trend: [10, 9, 8, 7, 6, 5] },
          ],
          selectedVehicleId: 'v1',
        };
        await AsyncStorage.setItem(USERDATA_KEY(emailAddr), JSON.stringify(seed));
        setUserData(seed);
      }
    } catch (e) { console.error("loadUserData error:", e); }
  };

  const saveUserData = async (emailAddr: string, data: UserData) => {
    try {
      await AsyncStorage.setItem(USERDATA_KEY(emailAddr), JSON.stringify(data));
      setUserData(data);
    } catch (e) { console.error("saveUserData error:", e); }
  };

  const loadTrips = async (emailAddr: string) => {
    try {
      const raw = await AsyncStorage.getItem(TRIPS_KEY(emailAddr));
      if (raw) {
        const parsed = JSON.parse(raw);
        setTrips(normalizeTrips(parsed));
      } else {
        // Seed some demo trips for the user
        const seedTrips: Trip[] = normalizeTrips([
          { id: "t1", date: "2025-09-18", start: "Melbourne CBD", end: "Geelong", duration: 5400, distance: 75, emissions: 9500 },
          { id: "t2", date: "2025-09-17", start: "Bundoora", end: "Melbourne CBD", duration: 2700, distance: 20, emissions: 2500 },
          { id: "t3", date: "2025-09-15", start: "La Trobe Uni", end: "Airport", duration: 3600, distance: 30, emissions: 4000 },
          { id: "t4", date: "2025-09-15", start: "Airport", end: "Docklands", duration: 2100, distance: 18, emissions: 2100 },
        ]);
        await AsyncStorage.setItem(TRIPS_KEY(emailAddr), JSON.stringify(seedTrips));
        setTrips(seedTrips);
      }
    } catch (e) { console.error("loadTrips error:", e); }
  };

  const saveTrips = async (emailAddr: string, data: Trip[]) => {
    try {
      await AsyncStorage.setItem(TRIPS_KEY(emailAddr), JSON.stringify(normalizeTrips(data)));
      setTrips(normalizeTrips(data));
    } catch (e) { console.error("saveTrips error:", e); }
  };

  /* ---------- VIN decode (used in Vehicles modal) ---------- */
  const sanitizeVin = (text: string) => text.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

  const decodeVin = async () => {
    const v = sanitizeVin(vin);
    setVin(v);
    setSuccess(false);
    setError("");

    if (v.length < 11) { setVehicle(null); setError("Please enter at least 11 characters (full VIN is 17)."); return; }
    if (/[IOQ]/.test(v)) { setVehicle(null); setError("VIN cannot contain I, O, or Q."); return; }

    setLoading(true);
    try {
      const url = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${v}?format=json`;
      const res = await fetch(url);
      const data = await res.json();
      const row = data?.Results?.[0] || {};

      const make = row.Make || "";
      const model = row.Model || "";
      const year = row.ModelYear || "";
      const body = row.BodyClass || "";
      const vehicleType = row.VehicleType || "";
      const engineCylinders = row.EngineCylinders || "";
      const displacementL = row.DisplacementL || "";
      const displacementCC = row.DisplacementCC || "";
      const fuelTypePrimary = row.FuelTypePrimary || "";
      const fuelTypeSecondary = row.FuelTypeSecondary || "";
      const engineModel = row.EngineModel || "";
      const engineManufacturer = row.EngineManufacturer || "";
      const engineHP = row.EngineHP || "";
      const engineKW = row.EngineKW || "";
      const engineConfiguration = row.EngineConfiguration || "";

      if (!make && !model && !year) {
        setVehicle(null);
        setError("Could not decode that VIN. Please check and try again.");
        return;
      }

      setVehicle({
        make, model, year, body, vehicleType,
        engineCylinders, displacementL, displacementCC, fuelTypePrimary, fuelTypeSecondary,
        engineModel, engineManufacturer, engineHP, engineKW, engineConfiguration,
      });
      if (!color) setColor("");
    } catch (e) {
      console.error("VIN decode error:", e);
      setVehicle(null);
      setError("Network error. Please try again.");
    } finally { setLoading(false); }
  };

  const registerVehicle = async () => {
    if (!vehicle) { setError("Decode a valid VIN first."); return; }
    if (!(currentUser && userData)) { Alert.alert("Registration", "Please login first."); return; }

    const newId = `v_${Date.now()}`;
    const displayName = `${vehicle.make || ''} ${vehicle.model || ''}`.trim() || 'My Vehicle';
    const fuel = vehicle.fuelTypePrimary || vehicle.fuelTypeSecondary || '';
    const newVehicle: StoredVehicle = {
      id: newId,
      name: displayName,
      vin,
      body: vehicle.body || undefined,
      fuel: fuel || undefined,
      vehicleType: vehicle.vehicleType || undefined,
      year: vehicle.year || undefined,
      // starter values; you can compute real ones later
      avgEmissions: { day: 120, week: 140, month: 160 },
      trend: [170, 168, 165, 162, 160, 158],
    };

    const updated: UserData = { ...userData, vehicles: [...userData.vehicles, newVehicle], selectedVehicleId: newVehicle.id };
    await saveUserData(currentUser, updated);

    setSuccess(true);
    Alert.alert("Registration", "Vehicle added!");
    // Reset modal fields & close
    setVin("");
    setVehicle(null);
    setError("");
    setVinModalOpen(false);
  };

  /* ---------- Auth ---------- */
  const handleLogin = async () => {
    setLoginError("");
    if (!email || !password) { setLoginError("Please fill in all fields."); return; }
    try {
      const usersData = await AsyncStorage.getItem(USERS_KEY);
      const users: User[] = usersData ? JSON.parse(usersData) : [];
      const user = users.find((u) => u.email === email && u.password === password);
      if (user) {
        await AsyncStorage.setItem(CURRENT_USER_KEY, user.email);
        setCurrentUser(user.email);
        await loadUserData(user.email);
        await loadTrips(user.email);
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setScreen('account');
        setEmail(""); setPassword("");
      } else { setLoginError("Invalid email or password."); }
    } catch (e) { console.error("login error:", e); setLoginError("Error logging in. Please try again."); }
  };

  const handleRegister = async () => {
    setLoginError("");
    if (password !== confirmPassword) { setLoginError("Passwords do not match."); return; }
    if (!email || !password) { setLoginError("Please fill in all fields."); return; }
    try {
      const usersData = await AsyncStorage.getItem(USERS_KEY);
      const users: User[] = usersData ? JSON.parse(usersData) : [];
      if (users.some((u) => u.email === email)) { setLoginError("Email already registered."); return; }
      users.push({ email, password });
      await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
      setRegisterSuccess(true);
      setEmail(""); setPassword(""); setConfirmPassword("");
    } catch (e) { console.error("register error:", e); setLoginError("Error registering. Please try again."); }
  };

  const signOut = async () => {
    await AsyncStorage.removeItem(CURRENT_USER_KEY);
    setCurrentUser(null);
    setUserData(null);
    setTrips([]);
    setScreen('landing');
  };

  /* ---------- Profile actions ---------- */
  const saveUsername = async () => {
    if (!currentUser || !userData) return;
    const updated: UserData = { ...userData, username: newUsername.trim() || userData.username };
    await saveUserData(currentUser, updated);
    setUsernameModal(false);
  };

  const savePassword = async () => {
    if (!currentUser) return;
    if (!oldPassword || !newPassword1 || !newPassword2) { Alert.alert("Password", "Please fill all fields."); return; }
    if (newPassword1 !== newPassword2) { Alert.alert("Password", "New passwords do not match."); return; }
    const usersData = await AsyncStorage.getItem(USERS_KEY);
    const users: User[] = usersData ? JSON.parse(usersData) : [];
    const idx = users.findIndex(u => u.email === currentUser);
    if (idx === -1) { Alert.alert("Password", "User not found."); return; }
    if (users[idx].password !== oldPassword) { Alert.alert("Password", "Old password is incorrect."); return; }
    users[idx].password = newPassword1;
    await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
    setPasswordModal(false);
    Alert.alert("Password", "Password updated.");
  };

  /* ---------- UI helpers ---------- */
  const selectedVehicle = userData?.vehicles.find(v => v.id === userData?.selectedVehicleId) || null;
  const setSelectedVehicle = async (id: string) => {
    if (!currentUser || !userData) return;
    const updated: UserData = { ...userData, selectedVehicleId: id };
    await saveUserData(currentUser, updated);
    setVehicleDropdownOpen(false);
  };

  const emissionColor = (valueRaw: any) => {
    const value = num(valueRaw, 0);
    if (value <= 110) return "#10b981"; // green
    if (value <= 170) return "#f59e0b"; // yellow
    return "#ef4444";                   // red
  };

  const EmissionBox = ({ period, value }: { period: 'Day' | 'Week' | 'Month'; value: any }) => (
    <View style={styles.emissionCard}>
      <Text style={styles.emissionPeriod}>{period}</Text>
      <Text style={[styles.emissionValue, { color: emissionColor(value) }]}>{num(value, 0)}</Text>
      <Text style={styles.emissionUnit}>gCO₂/km</Text>
    </View>
  );

  /* ---------- Chart ---------- */
  const chartWidth = Math.min(screenWidth - 48, 680);
  const vehiclesList = userData?.vehicles || [];
  const maxLen = Math.max(1, ...vehiclesList.map(v => v.trend.length || 0));
  const labels = Array.from({ length: maxLen }, (_, i) => `${i + 1}`);
  const seriesColors = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#14b8a6"];
  const datasets = vehiclesList.map((v, idx) => {
    const data = [...v.trend];
    if (data.length === 0) data.push(0);
    while (data.length < maxLen) data.push(data[data.length - 1]);
    const color = (opacity = 1) => {
      const hex = seriesColors[idx % seriesColors.length];
      const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    };
    return { data, color, strokeWidth: 3, withDots: true };
  });
  const chartData = { labels, datasets, legend: vehiclesList.map(v => v.name) };

  /* ---------- Screens ---------- */

  // Landing (Light green, only "Welcome to CarbonIQ" and Login)
  if (screen === 'landing') {
    return (
      <ScrollView contentContainerStyle={[styles.containerLanding]} keyboardShouldPersistTaps="handled">
        <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
          <Text style={styles.bigWelcome}>Welcome to CarbonIQ</Text>
        </Animated.View>

        <Animated.View style={[styles.inputContainer, { opacity: fadeAnim }]}>
          <TouchableOpacity style={[styles.button, { marginBottom: 12 }]} onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setScreen('login'); }}>
            <Text style={styles.buttonText}>Login</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    );
  }

  if (screen === 'login') {
    return (
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={[styles.button, { backgroundColor: "#6b7280", marginBottom: 20 }]} onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setScreen('landing'); setLoginError(""); setEmail(""); setPassword(""); }}>
          <Text style={styles.buttonText}>← Back</Text>
        </TouchableOpacity>

        <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
          <Text style={styles.title}>Login</Text>
          <Text style={styles.caption}>Enter your credentials to access your account.</Text>
        </Animated.View>

        <Animated.View style={[styles.inputContainer, { opacity: fadeAnim }]}>
          <Text style={styles.label}>Email</Text>
          <TextInput value={email} onChangeText={setEmail} placeholder="Enter your email" placeholderTextColor="#9ca3af" style={styles.input} autoCapitalize="none" keyboardType="email-address" />
          <Text style={styles.label}>Password</Text>
          <TextInput value={password} onChangeText={setPassword} placeholder="Enter your password" placeholderTextColor="#9ca3af" style={styles.input} secureTextEntry />
          <TouchableOpacity style={styles.button} onPress={handleLogin}><Text style={styles.buttonText}>Login</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.button, { backgroundColor: "#a855f7" }]} onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setScreen('register'); setLoginError(""); setEmail(""); setPassword(""); }}>
            <Text style={styles.buttonText}>Create an Account</Text>
          </TouchableOpacity>
          {loginError ? <Text style={styles.error}>{loginError}</Text> : null}
        </Animated.View>
      </ScrollView>
    );
  }

  if (screen === 'register') {
    return (
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={[styles.button, { backgroundColor: "#6b7280", marginBottom: 20 }]} onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setScreen('login'); setLoginError(""); setRegisterSuccess(false); setEmail(""); setPassword(""); setConfirmPassword(""); }}>
          <Text style={styles.buttonText}>← Back</Text>
        </TouchableOpacity>

        <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
          <Text style={styles.title}>Register</Text>
          <Text style={styles.caption}>Create a new account to get started.</Text>
        </Animated.View>

        <Animated.View style={[styles.inputContainer, { opacity: fadeAnim }]}>
          <Text style={styles.label}>Email</Text>
          <TextInput value={email} onChangeText={setEmail} placeholder="Enter your email" placeholderTextColor="#9ca3af" style={styles.input} autoCapitalize="none" keyboardType="email-address" />
          <Text style={styles.label}>Password</Text>
          <TextInput value={password} onChangeText={setPassword} placeholder="Enter your password" placeholderTextColor="#9ca3af" style={styles.input} secureTextEntry />
          <Text style={styles.label}>Confirm Password</Text>
          <TextInput value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirm your password" placeholderTextColor="#9ca3af" style={styles.input} secureTextEntry />
          <TouchableOpacity style={[styles.button, styles.successButton]} onPress={handleRegister}><Text style={styles.buttonText}>Register</Text></TouchableOpacity>
          {loginError ? <Text style={styles.error}>{loginError}</Text> : null}
          {registerSuccess && (
            <View>
              <Text style={styles.success}>Registered! ✅</Text>
              <TouchableOpacity style={[styles.button, { marginTop: 12 }]} onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setScreen('login'); setRegisterSuccess(false); }}>
                <Text style={styles.buttonText}>Back to Login</Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </ScrollView>
    );
  }

  // Start (placeholder)
  if (screen === 'start') {
    const title = 'Start Tracking';
    const caption = 'This will take you to the tracking flow (to be implemented).';

    return (
      <View style={[styles.containerPage, { backgroundColor: "#ffffff" }]}>
        <HeaderBar
          titleLeft="CarbonIQ"
          initial={(userData?.username || currentUser || "?").trim().charAt(0).toUpperCase()}
          onAvatarPress={async () => {
            const rect = await measureInWindowAsync(avatarRef, defaultAvatarAnchor);
            setAvatarAnchor(rect);
            setProfileOpen(true);
          }}
          refEl={avatarRef}
        />
        <AccountMenuModal
          visible={profileOpen}
          anchor={avatarAnchor}
          onClose={() => setProfileOpen(false)}
          onChangeUsername={() => { setProfileOpen(false); setUsernameModal(true); }}
          onChangePassword={() => { setProfileOpen(false); setPasswordModal(true); }}
          onLogout={signOut}
        />
        <View style={{ paddingHorizontal: 24 }}>
          <Text style={styles.pageTitle}>{title}</Text>
          <Text style={styles.caption}>{caption}</Text>
        </View>
        <BottomTabs active="start" setScreen={setScreen} />
        <UsernameModal visible={usernameModal} value={newUsername} onChange={setNewUsername} onClose={() => setUsernameModal(false)} onSave={saveUsername} />
        <PasswordModal
          visible={passwordModal}
          oldPassword={oldPassword} setOldPassword={setOldPassword}
          newPassword1={newPassword1} setNewPassword1={setNewPassword1}
          newPassword2={newPassword2} setNewPassword2={setNewPassword2}
          onClose={() => setPasswordModal(false)} onSave={savePassword}
        />
      </View>
    );
  }

  // TRIPS — Previous trips list
  if (screen === 'trip') {
    // simple stats
    const totalKm = sum(trips.map(t => num(t.distance, 0)));
    const totalCO2 = sum(trips.map(t => num(t.emissions, 0)));
    const grouped = groupTripsByDate(trips);

    return (
      <View style={[styles.containerPage, { backgroundColor: "#ffffff" }]}>
        <HeaderBar
          titleLeft="CarbonIQ"
          initial={(userData?.username || currentUser || "?").trim().charAt(0).toUpperCase()}
          onAvatarPress={async () => {
            const rect = await measureInWindowAsync(avatarRef, defaultAvatarAnchor);
            setAvatarAnchor(rect);
            setProfileOpen(true);
          }}
          refEl={avatarRef}
        />
        <AccountMenuModal
          visible={profileOpen}
          anchor={avatarAnchor}
          onClose={() => setProfileOpen(false)}
          onChangeUsername={() => { setProfileOpen(false); setUsernameModal(true); }}
          onChangePassword={() => { setProfileOpen(false); setPasswordModal(true); }}
          onLogout={signOut}
        />

        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 120 }}>
          <Text style={styles.pageTitle}>Recent Trips</Text>

          {/* Summary */}
          <View style={styles.tripSummaryRow}>
            <View style={styles.tripSummaryCard}>
              <Text style={styles.tripSummaryLabel}>Total Distance</Text>
              <Text style={styles.tripSummaryValue}>{totalKm.toFixed(1)} km</Text>
            </View>
            <View style={styles.tripSummaryCard}>
              <Text style={styles.tripSummaryLabel}>Total Emissions</Text>
              <Text style={styles.tripSummaryValue}>{totalCO2.toFixed(0)} gCO₂</Text>
            </View>
          </View>

          {/* Grouped list by date */}
          {Object.keys(grouped).sort((a, b) => (a < b ? 1 : -1)).map(date => (
            <View key={date} style={{ marginTop: 14 }}>
              <Text style={styles.tripDateHeader}>{date}</Text>
              {grouped[date].map((t) => (
                <TripListItem key={t.id} trip={t} />
              ))}
            </View>
          ))}
        </ScrollView>

        <BottomTabs active="trip" setScreen={setScreen} />

        <UsernameModal visible={usernameModal} value={newUsername} onChange={setNewUsername} onClose={() => setUsernameModal(false)} onSave={saveUsername} />
        <PasswordModal
          visible={passwordModal}
          oldPassword={oldPassword} setOldPassword={setOldPassword}
          newPassword1={newPassword1} setNewPassword1={setNewPassword1}
          newPassword2={newPassword2} setNewPassword2={setNewPassword2}
          onClose={() => setPasswordModal(false)} onSave={savePassword}
        />
      </View>
    );
  }

  // Vehicles page — white bg, black boxes, list + VIN modal + How-to steps
  if (screen === 'vehicles') {
    return (
      <View style={[styles.containerPage, { backgroundColor: "#ffffff" }]}>
        <HeaderBar
          titleLeft="CarbonIQ"
          initial={(userData?.username || currentUser || "?").trim().charAt(0).toUpperCase()}
          onAvatarPress={async () => {
            const rect = await measureInWindowAsync(avatarRef, defaultAvatarAnchor);
            setAvatarAnchor(rect);
            setProfileOpen(true);
          }}
          refEl={avatarRef}
        />
        <AccountMenuModal
          visible={profileOpen}
          anchor={avatarAnchor}
          onClose={() => setProfileOpen(false)}
          onChangeUsername={() => { setProfileOpen(false); setUsernameModal(true); }}
          onChangePassword={() => { setProfileOpen(false); setPasswordModal(true); }}
          onLogout={signOut}
        />

        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 120 }}>
          <Text style={styles.pageTitle}>Your Vehicles</Text>

          {/* Add via VIN + How-to */}
          <View style={{ flexDirection: 'row', marginTop: 8 }}>
            <TouchableOpacity style={[styles.button, { backgroundColor: "#111827", flex: 1, marginRight: 8 }]} onPress={() => setVinModalOpen(true)}>
              <Text style={styles.buttonText}>Add Vehicle via VIN</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, { backgroundColor: "#374151", flex: 1, marginLeft: 8 }]} onPress={() => setShowSteps(s => !s)}>
              <Text style={styles.buttonText}>{showSteps ? "Hide How-To" : "How to register via VIN"}</Text>
            </TouchableOpacity>
          </View>

          {showSteps && (
            <View style={[styles.stepsCard, { backgroundColor: "#0b0f19", borderColor: "#1f2937", marginTop: 12 }]}>
              <Text style={[styles.cardTitle, { color: "#fff" }]}>Find your VIN</Text>
              <Text style={[styles.stepItem, { color: "#e5e7eb" }]}>• Driver’s side dashboard (visible through windshield)</Text>
              <Text style={[styles.stepItem, { color: "#e5e7eb" }]}>• Driver’s door jamb sticker</Text>
              <Text style={[styles.stepItem, { color: "#e5e7eb" }]}>• Registration / insurance documents</Text>
              <Text style={[styles.stepItem, { color: "#e5e7eb" }]}>• 17 characters (A–Z, 0–9), never I, O, or Q</Text>
            </View>
          )}

          {/* Vehicles list as black boxes */}
          <View style={{ marginTop: 16 }}>
            {(userData?.vehicles || []).map(v => (
              <View key={v.id} style={styles.vehicleCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.vehicleTitle}>{v.name}</Text>
                  <Text style={styles.vehicleDesc}>
                    {[
                      v.body ? v.body : null,
                      v.fuel ? v.fuel : null,
                      v.year ? v.year : null,
                    ].filter(Boolean).join(" • ") || "—"}
                  </Text>
                  {v.vin ? <Text style={styles.vehicleVin}>VIN: {v.vin}</Text> : null}
                </View>
                <TouchableOpacity
                  style={[styles.vehicleSelectBtn, (userData?.selectedVehicleId === v.id) && styles.vehicleSelectBtnActive]}
                  onPress={() => setSelectedVehicle(v.id)}
                >
                  <Text style={styles.vehicleSelectText}>
                    {userData?.selectedVehicleId === v.id ? "Selected" : "Select"}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </ScrollView>

        <BottomTabs active="vehicles" setScreen={setScreen} />

        {/* VIN Modal inside Vehicles page */}
        <Modal visible={vinModalOpen} transparent animationType="slide" onRequestClose={() => setVinModalOpen(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => setVinModalOpen(false)}>
            <View style={[styles.modalCard, { width: '92%' }]}>
              <Text style={styles.modalTitle}>Add Vehicle via VIN</Text>

              <Text style={styles.label}>VIN</Text>
              <TextInput
                value={vin}
                onChangeText={(t) => setVin(sanitizeVin(t))}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={VIN_MAX_LEN}
                placeholder="e.g. 1HGCM82633A004352"
                placeholderTextColor="#9ca3af"
                style={styles.modalInput}
              />

              <TouchableOpacity style={[styles.button, { marginBottom: 8 }]} onPress={decodeVin} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Decode VIN</Text>}
              </TouchableOpacity>
              {error ? <Text style={[styles.error, { textAlign: 'left', marginBottom: 8 }]}>{error}</Text> : null}

              {vehicle && (
                <View style={[styles.card, { backgroundColor: "#f9fafb", borderColor: "#e5e7eb", marginTop: 8 }]}>
                  <Text style={[styles.cardTitle, { color: "#111827" }]}>Decoded Vehicle</Text>
                  <Row label="Make" value={vehicle.make} />
                  <Row label="Model" value={vehicle.model} />
                  <Row label="Year" value={vehicle.year} />
                  <Row label="Body" value={vehicle.body} />
                  <Row label="Type" value={vehicle.vehicleType} />
                  <Text style={[styles.cardTitle, { marginTop: 16, color: "#111827" }]}>Engine</Text>
                  <Row label="Fuel (Primary)" value={vehicle.fuelTypePrimary} />
                  <Row label="Fuel (Secondary)" value={vehicle.fuelTypeSecondary} />
                  <Row label="Cylinders" value={vehicle.engineCylinders} />
                  <Row label="Displacement (L)" value={vehicle.displacementL} />
                  <Row label="Engine HP" value={vehicle.engineHP} />
                </View>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: "#6b7280" }]} onPress={() => setVinModalOpen(false)}>
                  <Text style={styles.modalBtnText}>Close</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: "#10b981" }]} onPress={registerVehicle} disabled={!vehicle}>
                  <Text style={styles.modalBtnText}>Add Vehicle</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Pressable>
        </Modal>

        <UsernameModal visible={usernameModal} value={newUsername} onChange={setNewUsername} onClose={() => setUsernameModal(false)} onSave={saveUsername} />
        <PasswordModal
          visible={passwordModal}
          oldPassword={oldPassword} setOldPassword={setOldPassword}
          newPassword1={newPassword1} setNewPassword1={setNewPassword1}
          newPassword2={newPassword2} setNewPassword2={setNewPassword2}
          onClose={() => setPasswordModal(false)} onSave={savePassword}
        />
      </View>
    );
  }

  // ACCOUNT (HOME)
  return (
    <View style={[styles.containerPage, { backgroundColor: "#ffffff" }]}>
      <HeaderBar
        titleLeft="CarbonIQ"
        initial={currentInitial}
        onAvatarPress={async () => {
          const rect = await measureInWindowAsync(avatarRef, defaultAvatarAnchor);
          setAvatarAnchor(rect);
          setProfileOpen(true);
        }}
        refEl={avatarRef}
      />
      <AccountMenuModal
        visible={profileOpen}
        anchor={avatarAnchor}
        onClose={() => setProfileOpen(false)}
        onChangeUsername={() => { setProfileOpen(false); setUsernameModal(true); }}
        onChangePassword={() => { setProfileOpen(false); setPasswordModal(true); }}
        onLogout={signOut}
      />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 160 }}>
        {/* Quick Select */}
        <View style={styles.section}>
          <Text style={styles.quickLabel}>Quick Select</Text>
          <View>
            <TouchableOpacity
              ref={vehicleBtnRef}
              style={styles.dropdownButton}
              onPress={async () => {
                const rect = await measureInWindowAsync(vehicleBtnRef, defaultVehicleAnchor);
                setVehicleAnchor(rect);
                setVehicleDropdownOpen(true);
              }}
            >
              <Text style={styles.dropdownText}>{selectedVehicle ? selectedVehicle.name : "Select a vehicle"}</Text>
              <Text style={styles.dropdownCaret}>▾</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Emissions */}
        <View style={styles.emissionsWrapper}>
          <View style={styles.emissionsHeader}><Text style={styles.emissionsTitle}>Average Emissions</Text></View>
          <View style={styles.emissionsRow}>
            <EmissionBox period="Day" value={selectedVehicle?.avgEmissions.day ?? 0} />
            <EmissionBox period="Week" value={selectedVehicle?.avgEmissions.week ?? 0} />
            <EmissionBox period="Month" value={selectedVehicle?.avgEmissions.month ?? 0} />
          </View>
        </View>

        {/* Trends */}
        <View style={styles.trendsCard}>
          <Text style={styles.cardTitle}>Recent Trends (comparison)</Text>
          <LineChart
            data={chartData}
            width={chartWidth}
            height={260}
            withInnerLines
            withOuterLines
            withShadow={false}
            withDots
            segments={5}
            yAxisInterval={1}
            fromZero={true}
            bezier
            chartConfig={{
              backgroundGradientFrom: "#ffffff",
              backgroundGradientTo: "#ffffff",
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(17, 24, 39, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(55, 65, 81, ${opacity})`,
              propsForDots: { r: "4", strokeWidth: "2", stroke: "#ffffff" },
              propsForBackgroundLines: { stroke: "#e5e7eb" },
            }}
            style={{ borderRadius: 12 }}
            onDataPointClick={({ value, x, y, datasetIndex }) => {
              const label = (userData?.vehicles || [])[datasetIndex]?.name ?? "Vehicle";
              setTooltip({ x, y, value, label });
              setTimeout(() => setTooltip(null), 1800);
            }}
          />

          {tooltip && (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: Math.max(8, Math.min(chartWidth - 120, tooltip.x - 40)),
                top: Math.max(8, tooltip.y + 8),
                backgroundColor: '#111827',
                paddingHorizontal: 8,
                paddingVertical: 6,
                borderRadius: 8,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{tooltip.label}</Text>
              <Text style={{ color: '#fff', fontSize: 10 }}>Value: {tooltip.value}</Text>
            </View>
          )}

          {/* Legend */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>
            {(userData?.vehicles || []).map((v, idx) => (
              <View key={v.id} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12, marginBottom: 8 }}>
                <View style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: seriesColors[idx % seriesColors.length], marginRight: 6 }} />
                <Text style={{ color: '#374151', fontSize: 12 }}>{v.name}</Text>
              </View>
            ))}
          </View>
        </View>

        <TouchableOpacity style={[styles.button, { backgroundColor: "#000000", marginTop: 16 }]} onPress={() => setScreen('start')}>
          <Text style={styles.buttonText}>Start Tracking</Text>
        </TouchableOpacity>
      </ScrollView>

      <BottomTabs active="home" setScreen={setScreen} />

      {/* Modals used on Account page */}
      <VehicleDropdownModal
        visible={vehicleDropdownOpen}
        anchor={vehicleAnchor}
        vehicles={userData?.vehicles || []}
        onClose={() => setVehicleDropdownOpen(false)}
        onSelect={(id) => setSelectedVehicle(id)}
      />
      <UsernameModal visible={usernameModal} value={newUsername} onChange={setNewUsername} onClose={() => setUsernameModal(false)} onSave={saveUsername} />
      <PasswordModal
        visible={passwordModal}
        oldPassword={oldPassword} setOldPassword={setOldPassword}
        newPassword1={newPassword1} setNewPassword1={setNewPassword1}
        newPassword2={newPassword2} setNewPassword2={setNewPassword2}
        onClose={() => setPasswordModal(false)} onSave={savePassword}
      />
    </View>
  );
}

/* ---------- Small Components ---------- */

function Row({ label, value }: { label: string; value?: string }): JSX.Element {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value || "—"}</Text>
    </View>
  );
}

// ---- FIXED TYPE: refEl accepts RefObject<View | null> ----
function HeaderBar({
  titleLeft, initial, onAvatarPress, refEl,
}: {
  titleLeft: string;
  initial: string;
  onAvatarPress: () => void;
  refEl: React.RefObject<View | null>;
}) {
  return (
    <View style={styles.headerBar}>
      <Text style={styles.appName}>{titleLeft}</Text>
      <View style={{ flex: 1 }} />
      <TouchableOpacity ref={refEl} style={styles.avatar} onPress={onAvatarPress}>
        <Text style={styles.avatarText}>{initial}</Text>
      </TouchableOpacity>
    </View>
  );
}

function AccountMenuModal({
  visible, anchor, onClose, onChangeUsername, onChangePassword, onLogout,
}: {
  visible: boolean;
  anchor: Rect;
  onClose: () => void;
  onChangeUsername: () => void;
  onChangePassword: () => void;
  onLogout: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalFullOverlay} onPress={onClose}>
        <View
          pointerEvents="box-none"
          style={[
            styles.menuFloatWrap,
            { top: Math.max(8, anchor.y + anchor.h + 6), left: Math.max(8, anchor.x), right: 16 },
          ]}
        >
          <View style={styles.menuCard}>
            <TouchableOpacity style={styles.menuItem} onPress={onChangeUsername}><Text style={styles.menuItemText}>Change username</Text></TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={onChangePassword}><Text style={styles.menuItemText}>Change password</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.menuItem, { borderBottomWidth: 0 }]} onPress={onLogout}><Text style={[styles.menuItemText, { color: "#ef4444" }]}>Logout</Text></TouchableOpacity>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

function VehicleDropdownModal({
  visible, anchor, vehicles, onClose, onSelect,
}: {
  visible: boolean;
  anchor: Rect;
  vehicles: StoredVehicle[];
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalFullOverlay} onPress={onClose}>
        <View
          pointerEvents="box-none"
          style={[
            styles.dropdownFloatWrap,
            { top: Math.max(8, anchor.y + anchor.h + 6), left: 16, right: 16 },
          ]}
        >
          <View style={styles.dropdownCard}>
            <ScrollView style={{ maxHeight: 260 }}>
              {vehicles.map((v) => (
                <TouchableOpacity key={v.id} style={styles.dropdownItem} onPress={() => onSelect(v.id)}>
                  <Text style={styles.dropdownItemText}>{v.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

function UsernameModal({
  visible, value, onChange, onClose, onSave,
}: { visible: boolean; value: string; onChange: (v: string) => void; onClose: () => void; onSave: () => void; }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Change username</Text>
          <TextInput value={value} onChangeText={onChange} placeholder="Enter new username" placeholderTextColor="#9ca3af" style={styles.modalInput} />
          <View style={styles.modalActions}>
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: "#6b7280" }]} onPress={onClose}><Text style={styles.modalBtnText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: "#10b981" }]} onPress={onSave}><Text style={styles.modalBtnText}>Save</Text></TouchableOpacity>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

function PasswordModal({
  visible, oldPassword, setOldPassword, newPassword1, setNewPassword1, newPassword2, setNewPassword2, onClose, onSave,
}: {
  visible: boolean;
  oldPassword: string; setOldPassword: (v: string) => void;
  newPassword1: string; setNewPassword1: (v: string) => void;
  newPassword2: string; setNewPassword2: (v: string) => void;
  onClose: () => void; onSave: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Change password</Text>
          <TextInput value={oldPassword} onChangeText={setOldPassword} placeholder="Old password" placeholderTextColor="#9ca3af" style={styles.modalInput} secureTextEntry />
          <TextInput value={newPassword1} onChangeText={setNewPassword1} placeholder="New password" placeholderTextColor="#9ca3af" style={styles.modalInput} secureTextEntry />
          <TextInput value={newPassword2} onChangeText={setNewPassword2} placeholder="Confirm new password" placeholderTextColor="#9ca3af" style={styles.modalInput} secureTextEntry />
          <View style={styles.modalActions}>
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: "#6b7280" }]} onPress={onClose}><Text style={styles.modalBtnText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: "#10b981" }]} onPress={onSave}><Text style={styles.modalBtnText}>Save</Text></TouchableOpacity>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

function TripListItem({ trip }: { trip: Trip }) {
  const dist = num(trip.distance, 0);
  const co2 = num(trip.emissions, 0);
  return (
    <View style={styles.tripCard}>
      <View style={{ flex: 1 }}>
        <Text style={styles.tripTitle}>{trip.start} → {trip.end}</Text>
        <Text style={styles.tripSubtitle}>
          {fmtDuration(trip.duration)} • {dist.toFixed(1)} km • {co2.toFixed(0)} gCO₂
        </Text>
      </View>
    </View>
  );
}

function BottomTabs({ active, setScreen }: { active?: 'home' | 'vehicles' | 'start' | 'trip'; setScreen: (s: any) => void }) {
  return (
    <View style={styles.tabBar}>
      <TouchableOpacity style={[styles.tabButton, active === 'vehicles' && styles.tabActive]} onPress={() => setScreen('vehicles')}>
        <Text style={styles.tabText}>Vehicles</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.tabButton, active === 'home' && styles.tabActive]} onPress={() => setScreen('account')}>
        <Text style={styles.tabText}>Home</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.tabButton, active === 'start' && styles.tabActive]} onPress={() => setScreen('start')}>
        <Text style={styles.tabText}>Start</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.tabButton, active === 'trip' && styles.tabActive]} onPress={() => setScreen('trip')}>
        <Text style={styles.tabText}>Trip</Text>
      </TouchableOpacity>
    </View>
  );
}

/* ---------------- Styles ---------------- */
const styles = StyleSheet.create({
  // Landing (light green)
  containerLanding: { padding: 24, backgroundColor: "#e6f4ea", minHeight: "100%", justifyContent: 'center' },
  bigWelcome: { fontSize: 28, fontWeight: "800", color: "#065f46", textAlign: 'center', marginBottom: 24 },

  // Generic containers
  container: { padding: 24, backgroundColor: "#fff1f8", minHeight: "100%" },
  containerPage: { flex: 1, backgroundColor: "#ffffff" },

  // Headers / titles
  header: { marginBottom: 24 },
  title: { fontSize: 32, fontWeight: "800", color: "#831843", letterSpacing: -0.5 },
  caption: { fontSize: 16, color: "#9d174d", marginTop: 8, lineHeight: 24 },
  pageTitle: { fontSize: 28, fontWeight: "800", color: "#111827", marginTop: 16, marginBottom: 8 },

  // Inputs / buttons
  inputContainer: { marginBottom: 16, alignSelf: 'stretch' },
  label: { fontSize: 16, fontWeight: "600", color: "#111827", marginBottom: 8 },
  input: {
    backgroundColor: "#f9fafb", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, color: "#111827", marginBottom: 16, borderWidth: 1, borderColor: "#e5e7eb",
  },
  button: {
    backgroundColor: "#ec4899", borderRadius: 12, paddingVertical: 16, alignItems: "center", justifyContent: "center",
    marginBottom: 16, shadowColor: "#ec4899", shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  successButton: { backgroundColor: "#10b981", shadowColor: "#10b981" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700", letterSpacing: 0.5 },
  error: { fontSize: 14, color: "#dc2626", marginBottom: 12, textAlign: "center" },
  success: { fontSize: 16, color: "#10b981", fontWeight: "600", textAlign: "center", marginTop: 16 },

  // Cards / rows
  card: {
    backgroundColor: "#fce7f3", borderRadius: 16, padding: 20, marginTop: 16, borderWidth: 1, borderColor: "#f9a8d4",
    shadowColor: "#831843", shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4,
  },
  cardTitle: { fontSize: 20, fontWeight: "700", color: "#831843", marginBottom: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  rowLabel: { fontSize: 14, fontWeight: "600", color: "#374151" },
  rowValue: { fontSize: 14, fontWeight: "500", color: "#111827" },

  // Steps card
  stepsCard: { borderRadius: 14, padding: 16, borderWidth: 1 },

  // HeaderBar
  headerBar: {
    height: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center',
    borderBottomColor: '#e5e7eb', borderBottomWidth: StyleSheet.hairlineWidth, backgroundColor: '#ffffff',
  },
  appName: { fontSize: 20, fontWeight: '800', color: '#111827' },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#ffffff', fontWeight: '800' },

  // Account: Quick Select
  section: { marginTop: 16 },
  quickLabel: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 8 },
  dropdownButton: {
    backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center',
  },
  dropdownText: { flex: 1, color: '#111827', fontWeight: '600' },
  dropdownCaret: { color: '#6b7280', marginLeft: 8 },

  // Emissions section (black box)
  emissionsWrapper: { backgroundColor: '#000000', borderRadius: 16, padding: 16, marginTop: 20 },
  emissionsHeader: { marginBottom: 8 },
  emissionsTitle: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  emissionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  emissionCard: { flex: 1, backgroundColor: '#0a0a0a', borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#1f2937', marginHorizontal: 4 },
  emissionPeriod: { color: '#9ca3af', fontWeight: '700', marginBottom: 6 },
  emissionValue: { fontSize: 20, fontWeight: '800' },
  emissionUnit: { color: '#9ca3af', fontSize: 12, marginTop: 4 },

  // Trends
  trendsCard: { backgroundColor: '#f9fafb', borderRadius: 16, padding: 16, marginTop: 20, borderWidth: 1, borderColor: '#e5e7eb' },

  // Vehicles list
  vehicleCard: {
    backgroundColor: '#0b0b0b', borderRadius: 14, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#1f2937', flexDirection: 'row', alignItems: 'center',
  },
  vehicleTitle: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
  vehicleDesc: { color: '#d1d5db', marginTop: 4 },
  vehicleVin: { color: '#9ca3af', marginTop: 2, fontSize: 12 },
  vehicleSelectBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#111827', marginLeft: 12 },
  vehicleSelectBtnActive: { backgroundColor: '#10b981' },
  vehicleSelectText: { color: '#ffffff', fontWeight: '700', fontSize: 12 },

  // Tabs
  tabBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: 64, backgroundColor: '#111827',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#1f2937',
  },
  tabButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  tabActive: { backgroundColor: '#374151' },
  tabText: { color: '#ffffff', fontWeight: '700' },

  // ---------- Modal overlays and cards ----------
  modalFullOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.12)' },

  // Account menu modal positioner
  menuFloatWrap: { position: 'absolute', alignItems: 'flex-end' },
  menuCard: {
    width: 220, backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb',
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 12,
  },
  menuItem: { paddingVertical: 12, paddingHorizontal: 14, borderBottomColor: '#f3f4f6', borderBottomWidth: 1 },
  menuItemText: { color: '#111827', fontWeight: '600' },

  // Dropdown modal positioner
  dropdownFloatWrap: { position: 'absolute' },
  dropdownCard: {
    backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb',
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 12,
  },
  dropdownItem: { paddingVertical: 12, paddingHorizontal: 14, borderBottomColor: '#f3f4f6', borderBottomWidth: 1 },
  dropdownItemText: { color: '#111827', fontWeight: '500' },

  // Simple modal cards (username/password/VIN)
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },
  modalCard: { width: '86%', backgroundColor: '#ffffff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#e5e7eb' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 12 },
  modalInput: { backgroundColor: '#f9fafb', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, borderWidth: 1, borderColor: '#e5e7eb', color: '#111827', marginBottom: 10 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
  modalBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, marginLeft: 8 },
  modalBtnText: { color: '#ffffff', fontWeight: '700' },

  // Trips
  tripSummaryRow: { flexDirection: 'row', marginTop: 4 },
  tripSummaryCard: { flex: 1, backgroundColor: '#f9fafb', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', padding: 14, marginRight: 8 },
  tripSummaryLabel: { color: '#6b7280', fontSize: 12, fontWeight: '700' },
  tripSummaryValue: { color: '#111827', fontSize: 18, fontWeight: '800', marginTop: 2 },

  tripDateHeader: { marginTop: 12, marginBottom: 6, color: '#374151', fontWeight: '800' },
  tripCard: {
    backgroundColor: "#ffffff", borderRadius: 12, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: "#e5e7eb", shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 2
  },
  tripTitle: { fontSize: 15, fontWeight: '800', color: '#111827' },
  tripSubtitle: { fontSize: 12, color: '#4b5563', marginTop: 4 },
});
