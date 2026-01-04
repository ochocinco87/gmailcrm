/**
 * Authentication Service
 * Handles Google OAuth sign-in and user session management
 */

import auth from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

export class AuthService {
  private static initialized = false;

  /**
   * Initialize Google Sign-In
   */
  static async initialize() {
    if (this.initialized) return;

    try {
      await GoogleSignin.configure({
        webClientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com', // From Firebase Console
        offlineAccess: true,
        hostedDomain: '', // Leave empty to allow any domain, or specify your company domain
        forceCodeForRefreshToken: true,
      });

      this.initialized = true;
      console.log('✓ Google Sign-In configured');
    } catch (error) {
      console.error('Error configuring Google Sign-In:', error);
      throw error;
    }
  }

  /**
   * Sign in with Google
   */
  static async signInWithGoogle() {
    try {
      // Ensure initialized
      await this.initialize();

      // Check if device supports Google Play
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

      // Get the user's ID token
      const { idToken, user } = await GoogleSignin.signIn();

      console.log('Google Sign-In successful:', user.email);

      // Create a Google credential with the token
      const googleCredential = auth.GoogleAuthProvider.credential(idToken);

      // Sign in to Firebase with the credential
      const userCredential = await auth().signInWithCredential(googleCredential);

      return {
        user: userCredential.user,
        email: user.email,
        name: user.name,
        photo: user.photo,
      };
    } catch (error) {
      console.error('Error signing in with Google:', error);
      throw error;
    }
  }

  /**
   * Sign out
   */
  static async signOut() {
    try {
      await GoogleSignin.revokeAccess();
      await GoogleSignin.signOut();
      await auth().signOut();
      console.log('✓ User signed out');
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  }

  /**
   * Get current user
   */
  static async getCurrentUser() {
    try {
      const firebaseUser = auth().currentUser;
      if (!firebaseUser) return null;

      const googleUser = await GoogleSignin.getCurrentUser();

      return {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName || googleUser?.user.name,
        photoURL: firebaseUser.photoURL || googleUser?.user.photo,
      };
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  /**
   * Get Firebase ID token (for API calls)
   */
  static async getIdToken() {
    try {
      const user = auth().currentUser;
      if (!user) throw new Error('No user signed in');

      return await user.getIdToken();
    } catch (error) {
      console.error('Error getting ID token:', error);
      throw error;
    }
  }

  /**
   * Check if user is signed in
   */
  static isSignedIn() {
    return auth().currentUser !== null;
  }

  /**
   * Listen for auth state changes
   */
  static onAuthStateChanged(callback: (user: any) => void) {
    return auth().onAuthStateChanged(callback);
  }
}
