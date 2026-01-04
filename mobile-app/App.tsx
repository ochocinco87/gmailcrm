/**
 * Effortless CRM Mobile App
 * Main application component
 */

import React, { useEffect, useState } from 'react';
import { StatusBar, View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import AuthNavigator from './src/navigation/AuthNavigator';
import MainNavigator from './src/navigation/MainNavigator';
import { AuthService } from './src/services/AuthService';
import { FirebaseService } from './src/services/FirebaseService';

const App = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Initialize Firebase
      await FirebaseService.initialize();

      // Check if user is already signed in
      const user = await AuthService.getCurrentUser();
      setIsAuthenticated(!!user);
    } catch (error) {
      console.error('Error initializing app:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuthChange = (authenticated: boolean) => {
    setIsAuthenticated(authenticated);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <NavigationContainer>
        {isAuthenticated ? (
          <MainNavigator onSignOut={() => handleAuthChange(false)} />
        ) : (
          <AuthNavigator onSignIn={() => handleAuthChange(true)} />
        )}
      </NavigationContainer>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
});

export default App;
