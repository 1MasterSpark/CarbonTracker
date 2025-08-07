import { useState } from 'react';
import { View, Text, StyleSheet, Button, Switch } from 'react-native';
import { Picker } from '@react-native-picker/picker';

export default function StartTrip() {
  const [selectedCar, setSelectedCar] = useState('Toyota Corolla');
  const [useOBD, setUseOBD] = useState(false);

  const handleStartTrip = () => {
    console.log(`Starting trip with: ${selectedCar}, OBD sensor: ${useOBD}`);
    // You can navigate or trigger trip start logic here
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Start a New Trip</Text>

      <Text style={styles.label}>Select Your Car:</Text>
      <Picker
        selectedValue={selectedCar}
        onValueChange={(itemValue) => setSelectedCar(itemValue)}
        style={styles.picker}
      >
        <Picker.Item label="Toyota Corolla" value="Toyota Corolla" />
        <Picker.Item label="BMW 330i" value="BMW 330i" />
        <Picker.Item label="Golf GTI" value="Golf GTI" />
      </Picker>

      <View style={styles.obdRow}>
        <Text style={styles.label}>Connect to OBD Sensor?</Text>
        <Switch
          value={useOBD}
          onValueChange={(value) => setUseOBD(value)}
        />
      </View>

      <View style={styles.startButton}>
        <Button title="Start Trip" onPress={handleStartTrip} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FBC4C4',
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
  },
  label: {
    fontSize: 18,
    marginBottom: 10,
  },
  picker: {
    height: 50,
    marginBottom: 30,
  },
  obdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 40,
  },
  startButton: {
    alignSelf: 'center',
    width: '60%',
  },
});