import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to CarbonIQ</Text>
      <Text style={styles.subtitle}>Track journeys, estimate CO₂, and view analytics.</Text>

      <View style={styles.buttonCol}>
        

        <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push('/analytics')}>
          <Text style={styles.secondaryText}>Analytics</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.hint}>Tip: go to Start to record a new trip and see live telemetry.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 18, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 18, textAlign: 'center' },
  buttonCol: { width: '100%', maxWidth: 420, gap: 12 },
  primaryBtn: {
    backgroundColor: '#1f6feb',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  secondaryBtn: {
    borderColor: '#ccc',
    borderWidth: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryText: { color: '#222' },
  hint: { marginTop: 18, color: '#666', fontSize: 13, textAlign: 'center' },
});
