/**
 * Settings Screen
 */
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { AuthService } from '../services/AuthService';

const SettingsScreen = ({ onSignOut }: any) => {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const currentUser = await AuthService.getCurrentUser();
    setUser(currentUser);
  };

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await AuthService.signOut();
          onSignOut();
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      {user && (
        <View style={styles.userCard}>
          <Text style={styles.userName}>{user.displayName || 'User'}</Text>
          <Text style={styles.userEmail}>{user.email}</Text>
        </View>
      )}

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={styles.appName}>✨ Effortless CRM</Text>
        <Text style={styles.version}>Version 1.0.0</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa', padding: 20 },
  userCard: { backgroundColor: '#fff', padding: 20, borderRadius: 12, marginBottom: 20 },
  userName: { fontSize: 20, fontWeight: '700', color: '#202124' },
  userEmail: { fontSize: 14, color: '#5f6368', marginTop: 4 },
  signOutButton: { backgroundColor: '#ff4444', padding: 16, borderRadius: 8, alignItems: 'center' },
  signOutText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  footer: { position: 'absolute', bottom: 40, left: 0, right: 0, alignItems: 'center' },
  appName: { fontSize: 18, fontWeight: '700', color: '#667eea' },
  version: { fontSize: 12, color: '#5f6368', marginTop: 4 },
});

export default SettingsScreen;
