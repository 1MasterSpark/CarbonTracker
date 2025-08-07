import { StyleSheet, TextInput, Text, Pressable } from 'react-native';
import { View } from '@/components/Themed';
import { useRouter } from 'expo-router';

export default function Homepage() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome back, Mark!</Text>

      <Pressable style={[styles.button, { backgroundColor: 'blue' }]}>
        <Text style={[styles.buttonText, { color: 'white' }]}>Connect to Wifi</Text>
      </Pressable>

      <Pressable style={[styles.button, { backgroundColor: 'black' }]} onPress={() => router.push('/(tabs)/start_trip')}>
        <Text style={[styles.buttonText, { color: 'white' }]}>Start Trip</Text>
      </Pressable>

      <Pressable style={styles.button} onPress={() => router.push('/(tabs)/cars')}>
        <Text style={styles.buttonText}>My Cars</Text>
      </Pressable>

      <Pressable style={styles.button} onPress={() => router.push('/(tabs)/trips')}>
        <Text style={styles.buttonText}>My Trips</Text>
      </Pressable>

      <Pressable style={styles.button} onPress={() => router.push('/(tabs)/settings')}>
        <Text style={styles.buttonText}>Settings</Text>
      </Pressable>

      <View style={styles.separator} lightColor="#eee" darkColor="rgba(255,255,255,0.1)" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FBC4C4',
    padding: 20,
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    marginBottom: 40,
  },
  button: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 10,
    marginBottom: 15,
    width: '80%',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  buttonText: {
    color: '#333',
    fontSize: 18,
    fontWeight: '500',
    textTransform: 'none',
  },
});