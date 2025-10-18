import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Platform,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapView, { Polyline, Marker, PROVIDER_GOOGLE } from 'react-native-maps';

type Coord = { latitude: number; longitude: number };
type Trip = {
  route: Coord[];
  distance: string;
  emissions: string;
  timestamp: string;
  // optional fields that may exist in some saved trips
  carName?: string;
  carType?: string;
};

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export default function TripsScreen() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [periodFilter, setPeriodFilter] = useState<'all' | '7' | '30'>('all');
  const [sortOrder, setSortOrder] = useState<'new' | 'old'>('new');
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('TRIPS');
        const data: Trip[] = raw ? JSON.parse(raw) : [];
        setTrips(data);
      } catch (err) {
        console.warn('Failed to load trips', err);
        setTrips([]);
      }
    })();
  }, []);

  // Derived: filtered + searched + sorted trips
  const displayTrips = useMemo(() => {
    const now = new Date();
    const filteredByPeriod = trips.filter((t) => {
      if (periodFilter === 'all') return true;
      const days = periodFilter === '7' ? 7 : 30;
      const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      return new Date(t.timestamp) >= cutoff;
    });

    const query = searchQuery.trim().toLowerCase();
    const searched = filteredByPeriod.filter((t) => {
      if (!query) return true;
      const dateText = new Date(t.timestamp).toLocaleString('en-AU', { dateStyle: 'short', timeStyle: 'short' });
      return (
        dateText.toLowerCase().includes(query) ||
        (t.distance || '').toString().toLowerCase().includes(query) ||
        (t.emissions || '').toString().toLowerCase().includes(query) ||
        (t.carName || '').toLowerCase().includes(query)
      );
    });

    const sorted = searched.sort((a, b) => {
      const da = new Date(a.timestamp).getTime();
      const db = new Date(b.timestamp).getTime();
      return sortOrder === 'new' ? db - da : da - db;
    });

    return sorted;
  }, [trips, searchQuery, periodFilter, sortOrder]);

  const openTripModal = (t: Trip) => {
    setSelectedTrip(t);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setSelectedTrip(null);
  };

  // helper for map initial region
  const regionForTrip = (t: Trip) => {
    const first = t.route?.[0];
    const mid = t.route?.[Math.max(0, Math.floor(t.route.length / 2))];
    const coord = first || mid || { latitude: 37.78825, longitude: -122.4324 };
    return {
      latitude: coord.latitude,
      longitude: coord.longitude,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    };
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Saved Trips</Text>

      {/* Filters / Search */}
      <View style={styles.controlsRow}>
        <View style={styles.leftControls}>
          <TouchableOpacity
            style={[styles.filterChip, periodFilter === 'all' && styles.filterChipActive]}
            onPress={() => setPeriodFilter('all')}
          >
            <Text style={[styles.filterChipText, periodFilter === 'all' && styles.filterChipTextActive]}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, periodFilter === '7' && styles.filterChipActive]}
            onPress={() => setPeriodFilter('7')}
          >
            <Text style={[styles.filterChipText, periodFilter === '7' && styles.filterChipTextActive]}>7d</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, periodFilter === '30' && styles.filterChipActive]}
            onPress={() => setPeriodFilter('30')}
          >
            <Text style={[styles.filterChipText, periodFilter === '30' && styles.filterChipTextActive]}>30d</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.rightControls}>
          <TouchableOpacity
            style={styles.sortBtn}
            onPress={() => setSortOrder((s) => (s === 'new' ? 'old' : 'new'))}
          >
            <Text style={styles.sortText}>{sortOrder === 'new' ? 'Newest' : 'Oldest'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          placeholder="Search by date, CO₂, distance or car..."
          placeholderTextColor="#999"
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <TouchableOpacity
          style={styles.clearBtn}
          onPress={() => {
            setSearchQuery('');
          }}
        >
          <Text style={styles.clearText}>Clear</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {displayTrips.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No trips recorded yet — start a journey to populate this list.</Text>
          </View>
        ) : (
          displayTrips.map((trip, idx) => {
            const start = trip.route?.[0];
            const end = trip.route?.[trip.route.length - 1];
            return (
              <View key={idx} style={styles.card}>
                <TouchableOpacity style={styles.mapPreview} onPress={() => openTripModal(trip)}>
                  <MapView
                    provider={PROVIDER_GOOGLE}
                    style={styles.map}
                    initialRegion={regionForTrip(trip)}
                    scrollEnabled={false}
                    zoomEnabled={false}
                  >
                    {trip.route && trip.route.length > 1 && (
                      <Polyline coordinates={trip.route} strokeWidth={4} strokeColor="#4B5563" />
                    )}
                    {start && <Marker coordinate={start} pinColor="black" />}
                    {end && <Marker coordinate={end} pinColor="red" />}
                  </MapView>
                </TouchableOpacity>

                <View style={styles.info}>
                  <Text style={styles.title}>
                    {new Date(trip.timestamp).toLocaleString('en-AU', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </Text>

                  <View style={styles.row}>
                    <View style={styles.stat}>
                      <Text style={styles.statValue}>{trip.emissions}</Text>
                      <Text style={styles.statLabel}>CO₂ kg</Text>
                    </View>

                    <View style={styles.stat}>
                      <Text style={styles.statValue}>{trip.distance}</Text>
                      <Text style={styles.statLabel}>Distance km</Text>
                    </View>

                    <View style={styles.stat}>
                      <Text style={styles.statValue}>{trip.carName ?? trip.carType ?? '—'}</Text>
                      <Text style={styles.statLabel}>Car</Text>
                    </View>
                  </View>
                </View>

                <TouchableOpacity style={styles.moreBtn} onPress={() => openTripModal(trip)}>
                  <Text style={styles.moreText}>⋮</Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Modal: full trip view */}
      <Modal visible={modalVisible} animationType="slide" onRequestClose={closeModal} transparent={Platform.OS === 'ios' ? true : false}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Trip Details</Text>
              <TouchableOpacity onPress={closeModal}>
                <Text style={styles.modalClose}>Close</Text>
              </TouchableOpacity>
            </View>

            {selectedTrip ? (
              <>
                <MapView
                  provider={PROVIDER_GOOGLE}
                  style={styles.modalMap}
                  initialRegion={regionForTrip(selectedTrip)}
                >
                  {selectedTrip.route && selectedTrip.route.length > 1 && (
                    <Polyline coordinates={selectedTrip.route} strokeWidth={5} strokeColor="#2a9d8f" />
                  )}
                  {selectedTrip.route[0] && <Marker coordinate={selectedTrip.route[0]} pinColor="black" />}
                  {selectedTrip.route[selectedTrip.route.length - 1] && (
                    <Marker coordinate={selectedTrip.route[selectedTrip.route.length - 1]} pinColor="red" />
                  )}
                </MapView>

                <View style={styles.modalDetails}>
                  <Text style={styles.modalLabel}>When</Text>
                  <Text style={styles.modalText}>
                    {new Date(selectedTrip.timestamp).toLocaleString('en-AU', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </Text>

                  <View style={styles.detailRow}>
                    <View>
                      <Text style={styles.modalLabel}>CO₂</Text>
                      <Text style={styles.modalText}>{selectedTrip.emissions} kg</Text>
                    </View>
                    <View>
                      <Text style={styles.modalLabel}>Distance</Text>
                      <Text style={styles.modalText}>{selectedTrip.distance} km</Text>
                    </View>
                    <View>
                      <Text style={styles.modalLabel}>Car</Text>
                      <Text style={styles.modalText}>{selectedTrip.carName ?? selectedTrip.carType ?? '—'}</Text>
                    </View>
                  </View>
                </View>
              </>
            ) : (
              <Text style={{ padding: 20 }}>No trip selected</Text>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f6f7' },
  header: { fontSize: 22, fontWeight: '800', color: '#111', marginTop: 12, marginLeft: 12, marginBottom: 8 },

  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    marginBottom: 8,
    alignItems: 'center',
  },
  leftControls: { flexDirection: 'row', gap: 8 },
  rightControls: {},
  filterChip: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterChipActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  filterChipText: { color: '#374151', fontWeight: '600' },
  filterChipTextActive: { color: '#fff' },

  sortBtn: {
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sortText: { color: '#374151', fontWeight: '700' },

  searchRow: { flexDirection: 'row', paddingHorizontal: 12, gap: 8, marginBottom: 12, alignItems: 'center' },
  searchInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#e6e7eb',
  },
  clearBtn: {
    marginLeft: 4,
    backgroundColor: '#111827',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  clearText: { color: '#fff', fontWeight: '700' },

  emptyBox: { padding: 24, alignItems: 'center' },
  emptyText: { color: '#6b7280' },

  card: {
    flexDirection: 'row',
    marginHorizontal: 12,
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    elevation: 3,
  },
  mapPreview: { width: 120, height: 120, overflow: 'hidden' },
  map: { flex: 1 },

  info: { flex: 1, padding: 10 },
  title: { fontSize: 14, fontWeight: '700', marginBottom: 8, color: '#111' },

  row: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 14, fontWeight: '700', color: '#111' },
  statLabel: { fontSize: 12, color: '#6b7280' },

  moreBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  moreText: { fontSize: 20, color: '#6b7280', fontWeight: '700' },

  // Modal styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: Platform.OS === 'ios' ? 'rgba(0,0,0,0.35)' : '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: SCREEN_W - 24,
    maxHeight: SCREEN_H - 80,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 6,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 12, alignItems: 'center' },
  modalTitle: { fontWeight: '800', fontSize: 18 },
  modalClose: { color: '#ef4444', fontWeight: '700' },

  modalMap: { width: '100%', height: 260 },
  modalDetails: { padding: 12 },
  modalLabel: { color: '#6b7280', fontSize: 12 },
  modalText: { fontSize: 16, fontWeight: '700', marginBottom: 8 },

  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 6 },
});

