/**
 * Authentication Navigator
 * Navigation stack for unauthenticated users
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import SignInScreen from '../screens/SignInScreen';

const Stack = createStackNavigator();

interface AuthNavigatorProps {
  onSignIn: () => void;
}

const AuthNavigator: React.FC<AuthNavigatorProps> = ({ onSignIn }) => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="SignIn">
        {props => <SignInScreen {...props} onSignIn={onSignIn} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
};

export default AuthNavigator;
