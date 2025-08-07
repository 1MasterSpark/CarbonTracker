import { StyleSheet, Text, Pressable } from 'react-native';
import { View } from '@/components/Themed';
import { useRouter } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';

export default function Cars() {
  const router = useRouter();

  const cars = ['Toyota Corolla', 'BMW 330i', 'Golf GTI'];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Cars</Text>

      {cars.map((car, index) => (
        <View style={styles.carRow} key={index}>
          <Text style={styles.carText}>{car}</Text>
          <Pressable onPress={() => console.log(`Delete ${car}`)}>
            <FontAwesome name="trash" size={20} color="red" />
          </Pressable>
        </View>
      ))}

      <Pressable style={[styles.button, { backgroundColor: 'black' }]}>
        <Text style={[styles.buttonText, { color: 'white' }]}>Add New Car</Text>
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
  carRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginBottom: 15,
    width: '80%',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  carText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#333',
  },  
});