import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Dimensions,
  Modal,
  ActivityIndicator,
  Pressable,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { LineChart } from "react-native-chart-kit";
import { Picker } from "@react-native-picker/picker";
import AsyncStorage from "@react-native-async-storage/async-storage";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const VIN_MAX_LEN = 17;

const Tab = createBottomTabNavigator();

const STORAGE_KEY = "@CarbonIQ_LocalData";

interface Vehicle {
  id: string;
  name: string;
  vin: string;
  body: string;
  fuel: string;
  vehicleType: string;
  year: number;
  trend: number[];
  ownerId: string;
}

interface UserData {
  id: string;
  username: string;
  email: string;
  vehicles: Vehicle[];
}

interface StoredUser extends UserData {
  password: string;
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLocalData = async () => {
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEY);
      if (json) {
        const data = JSON.parse(json);
        setCurrentUserId(data.id);
        setUserData(data);
        setLoggedIn(true);
      }
    } catch (err) {
      setError("Failed to load local data");
    } finally {
      setIsLoading(false);
    }
  };

  const saveLocalData = async (data: UserData) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      setError("Failed to save data locally");
    }
  };

  useEffect(() => {
    loadLocalData();
  }, []);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#111827" />
        <Text style={styles.subTitle}>Loading...</Text>
      </SafeAreaView>
    );
  }

  if (!loggedIn) return <AuthScreen onLogin={setLoggedIn} setUserData={setUserData} saveLocalData={saveLocalData} />;

  return (
    <SafeAreaView style={styles.safe}>
      {error && <Text style={styles.error}>{error}</Text>}
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarStyle: { paddingBottom: 6, height: 65, borderTopWidth: 0, elevation: 0, shadowOpacity: 0 },
            tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
            tabBarActiveTintColor: "#111827",
            tabBarInactiveTintColor: "#9ca3af",
          }}
        >
          <Tab.Screen name="Account">
            {() => (
              <AccountScreen
                userData={userData}
                setUserData={setUserData}
                currentUserId={currentUserId!}
                saveLocalData={saveLocalData}
                onLogout={() => {
                  AsyncStorage.removeItem(STORAGE_KEY);
                  setLoggedIn(false);
                  setUserData(null);
                  setCurrentUserId(null);
                }}
              />
            )}
          </Tab.Screen>
          <Tab.Screen name="Vehicles">
            {() => (
              <VehiclesScreen
                userData={userData}
                setUserData={setUserData}
                currentUserId={currentUserId!}
                saveLocalData={saveLocalData}
              />
            )}
          </Tab.Screen>
          <Tab.Screen name="Start" component={StartScreen} />
          <Tab.Screen name="Trips" component={TripsScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaView>
  );
}

/* -------------------- AUTH -------------------- */
function AuthScreen({ onLogin, setUserData, saveLocalData }: any) {
  const USERS_KEY = "@CarbonIQ_Users";
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async () => {
    if (!email || !password) return setError("Email and password are required.");
    setError(null);

    try {
      const json = await AsyncStorage.getItem(USERS_KEY);
      const allUsers: StoredUser[] = json ? JSON.parse(json) : [];

      if (isRegister) {
        if (!username) return setError("Username is required for registration.");
        const existingUser = allUsers.find((u) => u.email === email);
        if (existingUser) return setError("An account with this email already exists.");

        const userId = Date.now().toString();
        const newUser: UserData = {
          id: userId,
          username,
          email,
          vehicles: [],
        };

        const newStoredUser: StoredUser = { ...newUser, password };
        const updatedUsers: StoredUser[] = [...allUsers, newStoredUser];

        await AsyncStorage.setItem(USERS_KEY, JSON.stringify(updatedUsers));
        await saveLocalData(newUser);
        setUserData(newUser);
        onLogin(true);
      } else {
        const existingUser = allUsers.find((u) => u.email === email);
        if (!existingUser) return setError("Account not found. Please sign up first.");
        if (existingUser.password !== password) return setError("Incorrect password.");

        const currentUser: UserData = {
          id: existingUser.id,
          username: existingUser.username,
          email: existingUser.email,
          vehicles: existingUser.vehicles || [],
        };

        await saveLocalData(currentUser);
        setUserData(currentUser);
        onLogin(true);
      }
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
  };

  return (
    <SafeAreaView style={styles.authContainer}>
      <View style={styles.authCard}>
        <Text style={styles.appTitle}>CarbonIQ</Text>
        <Text style={styles.authTitle}>{isRegister ? "Create Account" : "Welcome Back"}</Text>
        <Text style={styles.authSub}>
          {isRegister ? "Sign up to track your emissions" : "Login to continue"}
        </Text>
        {error && <Text style={styles.error}>{error}</Text>}

        {isRegister && (
          <TextInput
            placeholder="Username"
            value={username}
            onChangeText={setUsername}
            style={styles.input}
            autoCapitalize="none"
          />
        )}
        <TextInput
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          style={styles.input}
          secureTextEntry
        />

        <TouchableOpacity style={styles.button} onPress={handleAuth}>
          <Text style={styles.buttonText}>{isRegister ? "Register" : "Login"}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setIsRegister(!isRegister)}>
          <Text style={styles.authToggle}>
            {isRegister ? "Already have an account? Login" : "New here? Create an account"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

/* -------------------- ACCOUNT -------------------- */
function AccountScreen({ userData, setUserData, currentUserId, saveLocalData, onLogout }: any) {
  const screenWidth = Dimensions.get("window").width;
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const colors = [
    (opacity = 1) => `rgba(239, 68, 68, ${opacity})`,
    (opacity = 1) => `rgba(34, 197, 94, ${opacity})`,
    (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
    (opacity = 1) => `rgba(234, 179, 8, ${opacity})`,
    (opacity = 1) => `rgba(168, 85, 247, ${opacity})`,
  ];

  useEffect(() => {
    if (userData?.vehicles?.length > 0) {
      setSelectedVehicle("all");
    }
  }, [userData]);

  const chartData = {
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    datasets:
      userData?.vehicles?.length > 0 && selectedVehicle
        ? selectedVehicle === "all"
          ? userData.vehicles.map((v: any, index: number) => ({
              data: v.trend || [0, 0, 0, 0, 0],
              color: colors[index % colors.length],
              strokeWidth: 2,
            }))
          : userData.vehicles
              .filter((v: any) => v.id === selectedVehicle)
              .map((v: any, index: number) => ({
                data: v.trend || [0, 0, 0, 0, 0],
                color: colors[index % colors.length],
                strokeWidth: 2,
              }))
        : [{ data: [0, 0, 0, 0, 0], color: (opacity = 1) => `rgba(156, 163, 175, ${opacity})`, strokeWidth: 2 }],
    legend:
      userData?.vehicles?.length > 0 && selectedVehicle
        ? selectedVehicle === "all"
          ? userData.vehicles.map((v: any) => v.name)
          : userData.vehicles
              .filter((v: any) => v.id === selectedVehicle)
              .map((v: any) => v.name)
        : ["No Vehicles Added"],
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <View style={styles.header}>
          <Text style={styles.appTitle}>CarbonIQ</Text>
          <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
            <Text style={{ color: "#ef4444", fontWeight: "700" }}>Logout</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.pageTitle}>Welcome back, {userData?.username || "User"}</Text>

        <View style={styles.blackCard}>
          <Text style={styles.sectionTitle}>Average Emissions</Text>
          <View style={styles.row}>
            <EmissionBox label="Day" value={120} />
            <EmissionBox label="Week" value={140} />
            <EmissionBox label="Month" value={160} />
          </View>
        </View>

        <View style={styles.chartCard}>
          <Text style={styles.sectionTitle}>Emission Trends (gCO₂/km)</Text>
          {userData?.vehicles?.length > 1 && (
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedVehicle}
                onValueChange={(itemValue) => setSelectedVehicle(itemValue)}
                style={styles.picker}
                itemStyle={styles.pickerItem}
              >
                <Picker.Item label="All Vehicles" value="all" />
                {userData.vehicles.map((v: any) => (
                  <Picker.Item key={v.id} label={v.name} value={v.id} />
                ))}
              </Picker>
            </View>
          )}
          <LineChart
            data={chartData}
            width={screenWidth - 60}   // ← fixed overflow
            height={240}
            yAxisSuffix="g"
            yAxisInterval={1}
            chartConfig={{
              backgroundColor: "#ffffff",
              backgroundGradientFrom: "#f9fafb",
              backgroundGradientTo: "#f9fafb",
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(17, 24, 39, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(55, 65, 81, ${opacity})`,
              propsForDots: {
                r: "4",
                strokeWidth: "2",
              },
              propsForBackgroundLines: {
                strokeDasharray: "",
              },
            }}
            bezier
            withInnerLines={true}
            withOuterLines={true}
            withShadow={true}
            withVerticalLabels={true}
            withHorizontalLabels={true}
            style={{ borderRadius: 16, overflow: "hidden" }}   // ← extra safety
          />
          <Text style={styles.chartSub}>
            {selectedVehicle === "all"
              ? "Track all vehicles' emission trends over the week."
              : "Track your vehicle's emission trends over the week."}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* -------------------- VEHICLES -------------------- */
function VehiclesScreen({ userData, setUserData, currentUserId, saveLocalData }: any) {
  const [vin, setVin] = useState("");
  const [vehicle, setVehicle] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [vinModal, setVinModal] = useState(false);
  const [howModal, setHowModal] = useState(false);

  const decodeVin = async () => {
    const v = vin.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (v.length < 11) return setError("VIN must be at least 11 characters.");
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${v}?format=json`);
      const data = await res.json();
      const r = data?.Results?.[0] || {};
      const info = {
        make: r.Make || "Unknown",
        model: r.Model || "Unknown",
        year: r.ModelYear || 0,
        body: r.BodyClass || "Unknown",
        vehicleType: r.VehicleType || "Unknown",
        fuelTypePrimary: r.FuelTypePrimary || "Unknown",
      };
      if (!info.make || info.make === "Unknown") {
        setError("Could not decode VIN");
        setVehicle(null);
      } else {
        setVehicle(info);
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
      setVehicle(null);
    } finally {
      setLoading(false);
    }
  };

  const generateRandomTrend = () => {
    const base = 170;
    return Array.from({ length: 5 }, (_, i) => base - Math.floor(Math.random() * 10) * (i + 1));
  };

  const registerVehicle = async () => {
    if (!vehicle || !userData) return;
    const newVehicleId = Date.now().toString();
    const newV: Vehicle = {
      id: newVehicleId,
      name: `${vehicle.make} ${vehicle.model}`,
      vin,
      body: vehicle.body,
      fuel: vehicle.fuelTypePrimary,
      vehicleType: vehicle.vehicleType,
      year: vehicle.year,
      trend: generateRandomTrend(),
      ownerId: currentUserId,
    };

    const updatedUser = {
      ...userData,
      vehicles: [...userData.vehicles, newV],
    };

    setUserData(updatedUser);
    await saveLocalData(updatedUser);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setVin("");
    setVehicle(null);
    setVinModal(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
        <Text style={styles.pageTitle}>My Vehicles</Text>
        <Text style={styles.pageSub}>Add and manage your vehicles to track emissions accurately.</Text>
        <TouchableOpacity style={styles.button} onPress={() => setVinModal(true)}>
          <Text style={styles.buttonText}>Add Vehicle via VIN</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => setHowModal(true)}>
          <Text style={styles.secondaryButtonText}>How to Find Your VIN</Text>
        </TouchableOpacity>

        {userData?.vehicles?.length === 0 && (
          <Text style={styles.noDataText}>No vehicles added yet. Add one to get started!</Text>
        )}

        {(userData?.vehicles || []).map((v: any) => (
          <View key={v.id} style={styles.vehicleCard}>
            <Text style={styles.vehicleTitle}>{v.name}</Text>
            <Text style={styles.vehicleSub}>
              {v.body} • {v.fuel} • {v.year}
            </Text>
            <Text style={styles.vehicleVin}>VIN: {v.vin}</Text>
          </View>
        ))}

        <Modal visible={vinModal} transparent animationType="slide" onRequestClose={() => setVinModal(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => setVinModal(false)}>
            <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
              <Text style={styles.modalTitle}>Add Vehicle via VIN</Text>
              <Text style={styles.modalSub}>Enter your 17-digit VIN to automatically detect vehicle details.</Text>
              <TextInput
                value={vin}
                onChangeText={setVin}
                placeholder="Enter VIN (e.g., 1HGCM82633A004352)"
                style={styles.modalInput}
                maxLength={VIN_MAX_LEN}
                autoCapitalize="characters"
              />
              <TouchableOpacity style={styles.button} onPress={decodeVin} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Decode VIN</Text>}
              </TouchableOpacity>
              {error && <Text style={styles.error}>{error}</Text>}
              {vehicle && (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Decoded Vehicle Details</Text>
                  <Text style={styles.cardText}>Make: {vehicle.make}</Text>
                  <Text style={styles.cardText}>Model: {vehicle.model}</Text>
                  <Text style={styles.cardText}>Year: {vehicle.year}</Text>
                  <Text style={styles.cardText}>Body: {vehicle.body}</Text>
                  <Text style={styles.cardText}>Fuel Type: {vehicle.fuelTypePrimary}</Text>
                  <Text style={styles.cardText}>Vehicle Type: {vehicle.vehicleType}</Text>
                  <TouchableOpacity style={[styles.button, { marginTop: 16 }]} onPress={registerVehicle}>
                    <Text style={styles.buttonText}>Add This Vehicle</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </Pressable>
        </Modal>

        <Modal visible={howModal} transparent animationType="fade" onRequestClose={() => setHowModal(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => setHowModal(false)}>
            <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
              <Text style={styles.modalTitle}>How to Find Your VIN</Text>
              <Text style={styles.modalSub}>
                Your Vehicle Identification Number (VIN) is a unique 17-digit code for your car.
              </Text>
              <Text style={styles.instructionText}>
                • Look on the driver's side dashboard near the windshield.
              </Text>
              <Text style={styles.instructionText}>
                • Check the driver's side door jamb sticker.
              </Text>
              <Text style={styles.instructionText}>
                • Find it on your vehicle title, registration, or insurance documents.
              </Text>
              <Text style={styles.instructionText}>
                • For motorcycles or other vehicles, check the frame or engine block.
              </Text>
              <Text style={styles.modalSub}>
                To add: Enter the VIN above, tap "Decode VIN", review details, then "Add Vehicle".
              </Text>
              <TouchableOpacity style={styles.button} onPress={() => setHowModal(false)}>
                <Text style={styles.buttonText}>Got It</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

/* -------------------- OTHER SCREENS -------------------- */
function StartScreen() {
  return (
    <SafeAreaView style={styles.center}>
      <Text style={styles.title}>Start Tracking</Text>
      <Text style={styles.subTitle}>Begin a new trip to monitor your emissions.</Text>
    </SafeAreaView>
  );
}

function TripsScreen() {
  return (
    <SafeAreaView style={styles.center}>
      <Text style={styles.title}>Your Trips</Text>
      <Text style={styles.subTitle}>View your past trips and emission data here.</Text>
    </SafeAreaView>
  );
}

/* -------------------- SMALL COMPONENTS -------------------- */
const EmissionBox = ({ label, value }: any) => (
  <View style={styles.emissionBox}>
    <Text style={styles.emissionLabel}>{label}</Text>
    <Text style={styles.emissionValue}>{value}</Text>
    <Text style={styles.emissionUnit}>gCO₂/km</Text>
  </View>
);

/* -------------------- STYLES -------------------- */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  authContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: "#f9fafb" },
  authCard: { width: "100%", maxWidth: 400, backgroundColor: "#fff", borderRadius: 16, padding: 24, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 8, elevation: 5 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  title: { fontSize: 26, fontWeight: "800", marginBottom: 20, textAlign: "center", color: "#111827" },
  subTitle: { fontSize: 16, color: "#6b7280", textAlign: "center", marginHorizontal: 20 },
  input: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, width: "100%", padding: 12, marginVertical: 8, backgroundColor: "#fff" },
  button: { backgroundColor: "#111827", paddingVertical: 14, borderRadius: 10, width: "100%", alignItems: "center", marginVertical: 8 },
  buttonText: { color: "#fff", fontWeight: "700" },
  secondaryButton: { borderWidth: 1, borderColor: "#111827", backgroundColor: "#fff", paddingVertical: 14, borderRadius: 10, width: "100%", alignItems: "center", marginVertical: 8 },
  secondaryButtonText: { color: "#111827", fontWeight: "700" },
  logoutButton: { padding: 8 },
  appTitle: { fontSize: 28, fontWeight: "800", color: "#111827", textAlign: "center", marginBottom: 16 },
  authTitle: { fontSize: 24, fontWeight: "700", textAlign: "center", marginBottom: 4 },
  authSub: { fontSize: 14, color: "#6b7280", textAlign: "center", marginBottom: 24 },
  authToggle: { color: "#3b82f6", marginTop: 16, textAlign: "center", fontWeight: "500" },
  pageTitle: { fontSize: 24, fontWeight: "800", marginVertical: 10, color: "#111827" },
  pageSub: { fontSize: 14, color: "#6b7280", marginBottom: 16 },
  blackCard: { backgroundColor: "#111827", borderRadius: 16, padding: 16, marginBottom: 20, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  sectionTitle: { color: "#fff", fontWeight: "700", fontSize: 16, marginBottom: 8 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  emissionBox: { flex: 1, backgroundColor: "#1f2937", borderRadius: 12, marginHorizontal: 6, padding: 12, alignItems: "center" },
  emissionLabel: { color: "#9ca3af", fontWeight: "700", fontSize: 12 },
  emissionValue: { fontSize: 20, fontWeight: "800", color: "#10b981" },
  emissionUnit: { color: "#9ca3af", fontSize: 12 },
  chartCard: { backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#e5e7eb", shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
  chartSub: { fontSize: 12, color: "#6b7280", textAlign: "center", marginTop: 8 },
  vehicleCard: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 12, padding: 16, marginVertical: 8, backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  vehicleTitle: { fontWeight: "700", fontSize: 16, color: "#111827" },
  vehicleSub: { color: "#6b7280", fontSize: 14, marginTop: 4 },
  vehicleVin: { color: "#9ca3af", fontSize: 12, marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  modalCard: { backgroundColor: "#fff", padding: 24, borderRadius: 16, width: "100%", maxWidth: 360, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 },
  modalTitle: { fontSize: 20, fontWeight: "800", marginBottom: 12, textAlign: "center", color: "#111827" },
  modalSub: { fontSize: 14, color: "#6b7280", textAlign: "center", marginBottom: 16 },
  modalInput: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, padding: 12, color: "#111827", marginBottom: 16, backgroundColor: "#f9fafb" },
  error: { color: "#ef4444", textAlign: "center", marginTop: 6, marginBottom: 10 },
  card: { backgroundColor: "#f9fafb", borderRadius: 12, padding: 16, marginTop: 16, borderWidth: 1, borderColor: "#e5e7eb" },
  cardTitle: { fontWeight: "700", fontSize: 16, marginBottom: 8, color: "#111827" },
  cardText: { fontSize: 14, color: "#374151", marginBottom: 4 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  noDataText: { textAlign: "center", color: "#6b7280", fontSize: 16, marginVertical: 24 },
  instructionText: { fontSize: 14, color: "#374151", marginBottom: 8 },
  pickerContainer: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    marginBottom: 16,
    backgroundColor: "#f9fafb",
    overflow: "hidden",
  },
  picker: {
    height: 44,
    color: "#111827",
    width: "100%",
  },
  pickerItem: {
    fontSize: 16,
    color: "#111827",
    fontWeight: "500",
  },
});