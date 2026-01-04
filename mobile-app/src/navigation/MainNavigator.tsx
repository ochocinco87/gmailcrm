/**
 * Main Navigator
 * Bottom tab navigation for authenticated users
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialIcons';

import PipelinesScreen from '../screens/PipelinesScreen';
import DealsScreen from '../screens/DealsScreen';
import DealDetailScreen from '../screens/DealDetailScreen';
import SettingsScreen from '../screens/SettingsScreen';
import VoiceCommandScreen from '../screens/VoiceCommandScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

interface MainNavigatorProps {
  onSignOut: () => void;
}

// Pipelines Stack
const PipelinesStack = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="PipelinesList"
        component={PipelinesScreen}
        options={{ title: '✨ Effortless' }}
      />
      <Stack.Screen
        name="DealDetail"
        component={DealDetailScreen}
        options={{ title: 'Deal Details' }}
      />
    </Stack.Navigator>
  );
};

// Deals Stack
const DealsStack = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="DealsList"
        component={DealsScreen}
        options={{ title: 'All Deals' }}
      />
      <Stack.Screen
        name="DealDetail"
        component={DealDetailScreen}
        options={{ title: 'Deal Details' }}
      />
    </Stack.Navigator>
  );
};

// Settings Stack
const SettingsStack = ({ onSignOut }: { onSignOut: () => void }) => {
  return (
    <Stack.Navigator>
      <Stack.Screen name="SettingsList">
        {props => <SettingsScreen {...props} onSignOut={onSignOut} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
};

const MainNavigator: React.FC<MainNavigatorProps> = ({ onSignOut }) => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          let iconName = 'home';

          if (route.name === 'Pipelines') {
            iconName = 'dashboard';
          } else if (route.name === 'Deals') {
            iconName = 'business-center';
          } else if (route.name === 'Voice') {
            iconName = 'mic';
          } else if (route.name === 'Settings') {
            iconName = 'settings';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#667eea',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}
    >
      <Tab.Screen name="Pipelines" component={PipelinesStack} />
      <Tab.Screen name="Deals" component={DealsStack} />
      <Tab.Screen name="Voice" component={VoiceCommandScreen} />
      <Tab.Screen name="Settings">
        {props => <SettingsStack {...props} onSignOut={onSignOut} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
};

export default MainNavigator;
