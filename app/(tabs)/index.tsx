import users from './users.json';
import { useState } from 'react';
import { StyleSheet, TextInput, Button, Text, Alert } from 'react-native';
import { View } from '@/components/Themed';
import { useRouter } from 'expo-router';

export default function TabOneScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handleLogin = () => {
    const found = users.find(u => u.email === email && u.password === password);
    if (found) {
      router.push('/(tabs)/homepage');
    } else {
      Alert.alert("Login Failed", "Invalid email or password");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign Up or Log In</Text>

      <Text style={styles.normal}>Email</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={setEmail}
      />

      <Text style={styles.normal}>Password</Text>
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        onChangeText={setPassword} 
      />

      <Text style={styles.createAccount}>Create Account</Text>

      <Button title="Login" onPress={handleLogin} />

      <View style={styles.separator} lightColor="#eee" darkColor="rgba(255,255,255,0.1)" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#f0f0f0',
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  input: {
    height: 40,
    width: '100%',
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 5,
    paddingLeft: 10,
    marginBottom: 15,
  },
  separator: {
    marginVertical: 30,
    height: 1,
    width: '80%',
  },
  normal: {
    width: '100%',
    textAlign: 'left',
    marginBottom: 5,
  },
  createAccount: {
    color: 'blue',
    width: '100%',
    textAlign: 'left',
    textDecorationLine: 'underline',
    fontSize: 14,
    marginTop: 10,
  },
});