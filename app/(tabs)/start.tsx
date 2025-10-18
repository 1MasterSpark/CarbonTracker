// app/(tabs)/start.tsx
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

type Coord = { latitude: number; longitude: number };
type Trip = { route: Coord[]; distance: string; emissions: string; timestamp: string };

interface Car {
  id: string;
  name: string;
  model: string;
  fuelType: string;
  engineType: string;
}

const { height: WINDOW_HEIGHT } = Dimensions.get('window');
const MAP_HEIGHT = Math.round(WINDOW_HEIGHT * 0.42); // map height fixed so panel is visible

export default function StartScreen() {
  const router = useRouter();

  // --- demo cars (replace with your real vehicles later) ---
  const demoCars: Car[] = [
    { id: 'c1', name: 'Honda Civic', model: 'Civic 2018', fuelType: 'Gasoline', engineType: '1.5L Turbo' },
    { id: 'c2', name: 'Toyota Corolla', model: 'Corolla 2020', fuelType: 'Petrol', engineType: '1.8L' },
    { id: 'c3', name: 'Ford Ranger', model: 'Ranger 2019', fuelType: 'Diesel', engineType: '2.0L' },
  ];

  // --- state ---
  const [cars] = useState<Car[]>(demoCars);
  const [selectedCar, setSelectedCar] = useState<Car | null>(demoCars[0] ?? null);
  const [location, setLocation] = useState<Coord | null>(null);
  const [route, setRoute] = useState<Coord[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const [distance, setDistance] = useState<number>(0);
  const [emissions, setEmissions] = useState<number>(0);
  const [speed, setSpeed] = useState<number>(0);
  const [maf, setMaf] = useState<number>(0);
  const [rpm, setRpm] = useState<number>(0);
  const [engineLoad, setEngineLoad] = useState<number>(0);
  const [throttle, setThrottle] = useState<number>(0);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [carModalVisible, setCarModalVisible] = useState(false);
  const [obdEnabled, setObdEnabled] = useState<boolean>(false);
  const [lastTrip, setLastTrip] = useState<Trip | null>(null);
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const telemetryRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- get permission & initial location ---
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission required', 'Location permission is required for tracking.');
          setLoadingLocation(false);
          return;
        }
        const loc = await Location.getCurrentPositionAsync({});
        setLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      } catch (e) {
        console.warn('location error', e);
      } finally {
        setLoadingLocation(false);
      }
    })();

    return () => {
      // cleanup
      if (watchRef.current?.remove) watchRef.current.remove();
      if (telemetryRef.current) clearInterval(telemetryRef.current);
    };
  }, []);

  // haversine distance (km)
  const toRad = (v: number) => (v * Math.PI) / 180;
  const haversine = (c1: Coord, c2: Coord) => {
    const R = 6371;
    const dLat = toRad(c2.latitude - c1.latitude);
    const dLon = toRad(c2.longitude - c1.longitude);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(c1.latitude)) * Math.cos(toRad(c2.latitude)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  // start recording
  const startTrip = async () => {
    if (!selectedCar) {
      Alert.alert('Select car', 'Please choose a car before starting a journey.');
      return;
    }

    setIsTracking(true);
    setRoute([]);
    setDistance(0);
    setEmissions(0);
    setSpeed(0);
    setRpm(0);
    setMaf(0);
    setEngineLoad(0);
    setThrottle(0);

    // telemetry simulation updates once per second
    telemetryRef.current = setInterval(() => {
      // speed between 20 - 80 km/h with small random variation
      setSpeed((s) => Math.max(0, +(s + (Math.random() - 0.45) * 3).toFixed(1) || 30));
      // rpm roughly linked to speed
      setRpm((r) => Math.round(800 + (Math.random() * 3000)));
      // MAF random plausible value
      setMaf((m) => +(2 + Math.random() * 40).toFixed(2));
      setEngineLoad((el) => +(10 + Math.random() * 80).toFixed(1));
      setThrottle((t) => +(Math.max(0, Math.random() * 60)).toFixed(1));
      // quick emission bump tied to speed: small coefficient
      setEmissions((e) => +(e + (Math.random() * 0.002 + 0.001) * (speed / 50 || 1)).toFixed(3));
    }, 1000);

    // watch position
    try {
      watchRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 1000, distanceInterval: 2 },
        (loc) => {
          const coords: Coord = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          setRoute((prev) => {
            if (prev.length > 0) {
              const last = prev[prev.length - 1];
              const d = haversine(last, coords);
              setDistance((prevDist) => +(prevDist + d).toFixed(3));
              // emissions also roughly scale with added distance
              setEmissions((prevEm) => +(prevEm + d * 0.18).toFixed(3));
            }
            return [...prev, coords];
          });
          setLocation(coords);
        }
      );
    } catch (err) {
      console.warn('watchPosition error', err);
      Alert.alert('Error', 'Unable to start location tracking.');
      // stop telemetry if location can't run
      if (telemetryRef.current) clearInterval(telemetryRef.current);
      setIsTracking(false);
    }
  };

  // stop recording and save trip
  const stopTrip = async () => {
    if (watchRef.current?.remove) watchRef.current.remove();
    if (telemetryRef.current) clearInterval(telemetryRef.current);
    setIsTracking(false);

    const trip: Trip = {
      route,
      distance: distance.toFixed(2),
      emissions: emissions.toFixed(2),
      timestamp: new Date().toISOString(),
    };

    try {
      const raw = await AsyncStorage.getItem('TRIPS');
      const existing: Trip[] = raw ? JSON.parse(raw) : [];
      const updated = [trip, ...existing];
      await AsyncStorage.setItem('TRIPS', JSON.stringify(updated));
      setLastTrip(trip);
      Alert.alert('Trip saved', `Distance: ${trip.distance} km\nCO₂: ${trip.emissions} kg`);
      // optional: auto open analytics (if available)
      // router.push('/analytics');
    } catch (e) {
      console.warn('save trip fail', e);
      Alert.alert('Error', 'Failed to save trip data locally.');
    }
  };

  // helper: render car item in modal
  const renderCarItem = ({ item }: { item: Car }) => (
    <TouchableOpacity
      style={styles.carItem}
      onPress={() => {
        setSelectedCar(item);
        setCarModalVisible(false);
      }}
    >
      <Text style={styles.carItemTitle}>{item.name}</Text>
      <Text style={styles.carItemSub}>{item.model}</Text>
    </TouchableOpacity>
  );

  if (loadingLocation) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 10 }}>Getting location permission...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={[styles.map, { height: MAP_HEIGHT }]}
        initialRegion={{
          latitude: location?.latitude || -37.6822,
          longitude: location?.longitude || 144.5808,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
      >
        {route.map((c, i) => (
          <Marker key={i} coordinate={c} />
        ))}
        {route.length > 1 && <Polyline coordinates={route} strokeWidth={4} strokeColor="#2a9d8f" />}
      </MapView>

      <ScrollView style={styles.panel} contentContainerStyle={{ paddingBottom: 20 }}>
        {/* Car select row */}
        <View style={styles.row}>
          <View>
            <Text style={styles.label}>Car</Text>
            <TouchableOpacity
              style={styles.selectBox}
              onPress={() => setCarModalVisible(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.selectText}>{selectedCar ? selectedCar.name : 'Select car'}</Text>
              <Text style={styles.selectSub}>{selectedCar ? selectedCar.model : ''}</Text>
            </TouchableOpacity>
          </View>

          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.label}>OBD</Text>
            <TouchableOpacity
              style={[styles.obdBtn, obdEnabled ? styles.obdOn : styles.obdOff]}
              onPress={() => setObdEnabled((p) => !p)}
            >
              <Text style={styles.obdBtnText}>{obdEnabled ? 'Connected' : 'Off'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Car details */}
        {selectedCar && (
          <View style={styles.infoBox}>
            <Text style={styles.infoLine}>
              <Text style={styles.infoLabel}>Model: </Text>
              {selectedCar.model}
            </Text>
            <Text style={styles.infoLine}>
              <Text style={styles.infoLabel}>Fuel type: </Text>
              {selectedCar.fuelType}
            </Text>
            <Text style={styles.infoLine}>
              <Text style={styles.infoLabel}>Engine: </Text>
              {selectedCar.engineType}
            </Text>
          </View>
        )}

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Distance</Text>
            <Text style={styles.statValue}>{distance.toFixed(2)} km</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>CO₂</Text>
            <Text style={styles.statValue}>{emissions.toFixed(3)} kg</Text>
          </View>
        </View>

        {/* Telemetry when recording */}
        {isTracking && (
          <View style={styles.telemetry}>
            <Text style={styles.teleTitle}>Live telemetry</Text>
            <View style={styles.teleRow}>
              <Text style={styles.teleLabel}>Speed</Text>
              <Text style={styles.teleValue}>{speed.toFixed(1)} km/h</Text>
            </View>
            <View style={styles.teleRow}>
              <Text style={styles.teleLabel}>MAF</Text>
              <Text style={styles.teleValue}>{maf.toFixed(2)} g/s</Text>
            </View>
            <View style={styles.teleRow}>
              <Text style={styles.teleLabel}>Engine Load</Text>
              <Text style={styles.teleValue}>{engineLoad.toFixed(0)} %</Text>
            </View>
            <View style={styles.teleRow}>
              <Text style={styles.teleLabel}>RPM</Text>
              <Text style={styles.teleValue}>{rpm}</Text>
            </View>
            <View style={styles.teleRow}>
              <Text style={styles.teleLabel}>Throttle</Text>
              <Text style={styles.teleValue}>{throttle.toFixed(0)} %</Text>
            </View>
          </View>
        )}

        {/* Controls */}
        <View style={styles.controls}>
          <TouchableOpacity
            onPress={startTrip}
            disabled={isTracking}
            style={[styles.controlBtn, isTracking ? styles.disabledBtn : styles.startBtn]}
          >
            <Text style={styles.controlBtnText}>{isTracking ? 'Recording…' : 'Start Journey'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={stopTrip}
            disabled={!isTracking}
            style={[styles.controlBtn, !isTracking ? styles.disabledBtn : styles.stopBtn]}
          >
            <Text style={styles.controlBtnText}>Stop & Save</Text>
          </TouchableOpacity>
        </View>

        {/* Last trip summary */}
        {lastTrip && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Last Trip</Text>
            <Text>Distance: {lastTrip.distance} km</Text>
            <Text>CO₂: {lastTrip.emissions} kg</Text>
            <Text>Time: {new Date(lastTrip.timestamp).toLocaleString()}</Text>
          </View>
        )}
      </ScrollView>

      {/* Car selection modal */}
      <Modal visible={carModalVisible} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Car</Text>
            <FlatList
              data={cars}
              keyExtractor={(it) => it.id}
              renderItem={renderCarItem}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            />
            <TouchableOpacity style={styles.modalClose} onPress={() => setCarModalVisible(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f3f7' },
  map: { width: '100%' },
  panel: {
    paddingHorizontal: 14,
    paddingTop: 12,
    backgroundColor: 'transparent',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  label: { fontSize: 14, color: '#333', marginBottom: 6, fontWeight: '600' },
  selectBox: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    width: 220,
    borderColor: '#ddd',
    borderWidth: 1,
  },
  selectText: { fontSize: 16, fontWeight: '700', color: '#111' },
  selectSub: { fontSize: 12, color: '#666' },
  obdBtn: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, marginTop: 6 },
  obdOn: { backgroundColor: '#2ecc71' },
  obdOff: { backgroundColor: '#e0e0e0' },
  obdBtnText: { color: '#fff', fontWeight: '700' },
  infoBox: { backgroundColor: '#fff', padding: 12, borderRadius: 10, marginBottom: 12, borderColor: '#eee', borderWidth: 1 },
  infoLine: { color: '#333', marginBottom: 6 },
  infoLabel: { fontWeight: '700' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: '#fff', padding: 12, borderRadius: 10, alignItems: 'center', marginHorizontal: 4, borderColor: '#eee', borderWidth: 1 },
  statLabel: { color: '#666', marginBottom: 6 },
  statValue: { fontSize: 18, fontWeight: '800' },
  telemetry: { backgroundColor: '#fff', padding: 12, borderRadius: 10, borderColor: '#eee', borderWidth: 1, marginBottom: 12 },
  teleTitle: { fontWeight: '800', marginBottom: 8 },
  teleRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  teleLabel: { color: '#666' },
  teleValue: { fontWeight: '700', color: '#0b7' },
  controls: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  controlBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginHorizontal: 6 },
  startBtn: { backgroundColor: '#0b3954' },
  stopBtn: { backgroundColor: '#c62828' },
  disabledBtn: { backgroundColor: '#bdbdbd' },
  controlBtnText: { color: '#fff', fontWeight: '800' },
  card: { backgroundColor: '#fff', padding: 12, borderRadius: 10, marginTop: 12, borderColor: '#eee', borderWidth: 1 },
  cardTitle: { fontWeight: '800', marginBottom: 6 },
  // modal styles
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, maxHeight: '70%' },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 12 },
  carItem: { paddingVertical: 12, paddingHorizontal: 8, borderRadius: 8, backgroundColor: '#fafafa' },
  carItemTitle: { fontWeight: '700' },
  carItemSub: { color: '#666', marginTop: 4 },
  modalClose: { marginTop: 12, alignItems: 'center' },
  modalCloseText: { color: '#0b3954', fontWeight: '700' },
});
