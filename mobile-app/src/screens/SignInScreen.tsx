/**
 * Sign In Screen
 * Google OAuth sign-in for domain-based authentication
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { AuthService } from '../services/AuthService';

interface SignInScreenProps {
  onSignIn: () => void;
}

const SignInScreen: React.FC<SignInScreenProps> = ({ onSignIn }) => {
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);

      const result = await AuthService.signInWithGoogle();

      console.log('✓ Signed in as:', result.email);
      Alert.alert('Welcome!', `Signed in as ${result.email}`);

      onSignIn();
    } catch (error: any) {
      console.error('Sign-in error:', error);

      let message = 'Failed to sign in. Please try again.';
      if (error.code === 'statusCodes.SIGN_IN_CANCELLED') {
        message = 'Sign-in cancelled';
      } else if (error.code === 'statusCodes.IN_PROGRESS') {
        message = 'Sign-in already in progress';
      }

      Alert.alert('Sign In Error', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={['#667eea', '#764ba2']}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <View style={styles.content}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Text style={styles.logoIcon}>✨</Text>
          <Text style={styles.logoText}>Effortless</Text>
          <Text style={styles.subtitle}>Voice-Powered CRM</Text>
        </View>

        {/* Features */}
        <View style={styles.features}>
          <FeatureItem icon="🎤" text="Voice Commands" />
          <FeatureItem icon="📊" text="Visual Pipelines" />
          <FeatureItem icon="👥" text="Team Collaboration" />
          <FeatureItem icon="📧" text="Email Linking" />
        </View>

        {/* Sign In Button */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogleSignIn}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#667eea" />
            ) : (
              <>
                <Text style={styles.googleIcon}>G</Text>
                <Text style={styles.googleButtonText}>Sign in with Google</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.disclaimer}>
            Sign in with your company Google account to access your team's CRM data
          </Text>
        </View>
      </View>
    </LinearGradient>
  );
};

const FeatureItem: React.FC<{ icon: string; text: string }> = ({ icon, text }) => {
  return (
    <View style={styles.featureItem}>
      <Text style={styles.featureIcon}>{icon}</Text>
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    paddingVertical: 60,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 60,
  },
  logoIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  logoText: {
    fontSize: 42,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  features: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    marginVertical: 40,
  },
  featureItem: {
    alignItems: 'center',
    width: '45%',
    marginBottom: 24,
  },
  featureIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  featureText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '600',
  },
  buttonContainer: {
    alignItems: 'center',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  googleIcon: {
    fontSize: 24,
    fontWeight: '700',
    color: '#667eea',
    marginRight: 12,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#202124',
  },
  disclaimer: {
    marginTop: 24,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default SignInScreen;
