import React, { useState } from 'react';
import { StyleSheet, TextInput, Text, Switch, Pressable, Alert } from 'react-native';
import { View } from '@/components/Themed';

export default function SettingsScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [wantsEmails, setWantsEmails] = useState(false);
  const [wantsNotifications, setWantsNotifications] = useState(false);

  const handleUpdate = () => {
    // Simulated logic — in a real app, this would connect to a backend
    if (!name && !email && !newPassword && !oldPassword && !wantsEmails && !wantsNotifications) {
      Alert.alert('Nothing to update!');
      return;
    }

    if ((newPassword && !oldPassword) || (!newPassword && oldPassword)) {
      Alert.alert('To change your password, fill in both old and new passwords.');
      return;
    }

    // Simulate updating the data
    Alert.alert('Profile Updated', `Changes:
    Name: ${name || 'No change'}
    Email: ${email || 'No change'}
    Wants Emails: ${wantsEmails ? 'Yes' : 'No'}
    Wants Notifications: ${wantsNotifications ? 'Yes' : 'No'}
    Password Changed: ${newPassword ? 'Yes' : 'No'}`);
    
    // Reset password fields (optional)
    setNewPassword('');
    setOldPassword('');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>

      <Text style={styles.label}>Name</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Name" />

      <Text style={styles.label}>Email</Text>
      <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="Email" autoCapitalize="none" />

      <Text style={styles.label}>New Password</Text>
      <TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword} placeholder="New Password" secureTextEntry />

      <Text style={styles.label}>Old Password</Text>
      <TextInput style={styles.input} value={oldPassword} onChangeText={setOldPassword} placeholder="Old Password" secureTextEntry />

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Receive Emails</Text>
        <Switch value={wantsEmails} onValueChange={setWantsEmails} />
      </View>

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Receive Notifications</Text>
        <Switch value={wantsNotifications} onValueChange={setWantsNotifications} />
      </View>

      <Pressable style={styles.button} onPress={handleUpdate}>
        <Text style={styles.buttonText}>Update</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f3f3f3',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 30,
    alignSelf: 'center',
  },
  label: {
    marginBottom: 5,
    fontWeight: '600',
  },
  input: {
    height: 40,
    borderColor: '#ccc',
    borderWidth: 1,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 15,
    backgroundColor: 'white',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 10,
  },
  switchLabel: {
    fontSize: 16,
  },
  button: {
    backgroundColor: '#007bff',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 30,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '500',
  },
});