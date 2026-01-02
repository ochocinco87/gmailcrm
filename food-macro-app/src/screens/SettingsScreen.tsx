import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SETTINGS_KEY = '@macrosnap_settings';
const API_KEY_STORAGE = '@macrosnap_api_key';

type Settings = {
  dailyCalorieGoal: number;
  dailyProteinGoal: number;
  dailyCarbsGoal: number;
  dailyFatGoal: number;
  notifications: boolean;
  darkMode: boolean;
};

const defaultSettings: Settings = {
  dailyCalorieGoal: 2000,
  dailyProteinGoal: 150,
  dailyCarbsGoal: 200,
  dailyFatGoal: 65,
  notifications: true,
  darkMode: false,
};

export default function SettingsScreen() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [editingGoals, setEditingGoals] = useState(false);

  useEffect(() => {
    loadSettings();
    loadApiKey();
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(SETTINGS_KEY);
      if (stored) {
        setSettings(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const loadApiKey = async () => {
    try {
      const key = await AsyncStorage.getItem(API_KEY_STORAGE);
      if (key) {
        setApiKey(key);
      }
    } catch (error) {
      console.error('Error loading API key:', error);
    }
  };

  const saveSettings = async (newSettings: Settings) => {
    try {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
      setSettings(newSettings);
      Alert.alert('Success', 'Settings saved successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to save settings');
    }
  };

  const saveApiKey = async () => {
    try {
      await AsyncStorage.setItem(API_KEY_STORAGE, apiKey);
      Alert.alert('Success', 'API key saved successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to save API key');
    }
  };

  const clearAllData = () => {
    Alert.alert(
      'Clear All Data',
      'This will delete all your meal history and settings. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.clear();
              setSettings(defaultSettings);
              setApiKey('');
              Alert.alert('Success', 'All data has been cleared.');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear data');
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* API Configuration */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>AI Configuration</Text>
        <View style={styles.card}>
          <Text style={styles.label}>OpenAI API Key</Text>
          <Text style={styles.helperText}>
            Required for food recognition. Get your key from platform.openai.com
          </Text>
          <View style={styles.apiKeyInput}>
            <TextInput
              style={styles.input}
              value={apiKey}
              onChangeText={setApiKey}
              placeholder="sk-..."
              secureTextEntry={!showApiKey}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowApiKey(!showApiKey)}
            >
              <Ionicons
                name={showApiKey ? 'eye-off' : 'eye'}
                size={20}
                color="#6B7280"
              />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.saveButton} onPress={saveApiKey}>
            <Text style={styles.saveButtonText}>Save API Key</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Daily Goals */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Daily Goals</Text>
          <TouchableOpacity onPress={() => setEditingGoals(!editingGoals)}>
            <Text style={styles.editButton}>
              {editingGoals ? 'Done' : 'Edit'}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.card}>
          <GoalInput
            label="Calories"
            value={settings.dailyCalorieGoal}
            unit="cal"
            editing={editingGoals}
            onChange={(val) =>
              setSettings({ ...settings, dailyCalorieGoal: val })
            }
            color="#10B981"
          />
          <GoalInput
            label="Protein"
            value={settings.dailyProteinGoal}
            unit="g"
            editing={editingGoals}
            onChange={(val) =>
              setSettings({ ...settings, dailyProteinGoal: val })
            }
            color="#3B82F6"
          />
          <GoalInput
            label="Carbohydrates"
            value={settings.dailyCarbsGoal}
            unit="g"
            editing={editingGoals}
            onChange={(val) =>
              setSettings({ ...settings, dailyCarbsGoal: val })
            }
            color="#F59E0B"
          />
          <GoalInput
            label="Fat"
            value={settings.dailyFatGoal}
            unit="g"
            editing={editingGoals}
            onChange={(val) => setSettings({ ...settings, dailyFatGoal: val })}
            color="#EF4444"
          />
          {editingGoals && (
            <TouchableOpacity
              style={styles.saveGoalsButton}
              onPress={() => {
                saveSettings(settings);
                setEditingGoals(false);
              }}
            >
              <Text style={styles.saveButtonText}>Save Goals</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Preferences */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        <View style={styles.card}>
          <View style={styles.preferenceRow}>
            <View style={styles.preferenceInfo}>
              <Text style={styles.preferenceName}>Push Notifications</Text>
              <Text style={styles.preferenceDesc}>
                Reminder to log your meals
              </Text>
            </View>
            <Switch
              value={settings.notifications}
              onValueChange={(val) =>
                setSettings({ ...settings, notifications: val })
              }
              trackColor={{ false: '#E5E7EB', true: '#10B981' }}
            />
          </View>
        </View>
      </View>

      {/* About */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.card}>
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Version</Text>
            <Text style={styles.aboutValue}>1.0.0</Text>
          </View>
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Powered by</Text>
            <Text style={styles.aboutValue}>OpenAI GPT-4 Vision</Text>
          </View>
        </View>
      </View>

      {/* Danger Zone */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: '#EF4444' }]}>
          Danger Zone
        </Text>
        <TouchableOpacity style={styles.dangerButton} onPress={clearAllData}>
          <Ionicons name="trash-outline" size={20} color="#EF4444" />
          <Text style={styles.dangerButtonText}>Clear All Data</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

function GoalInput({
  label,
  value,
  unit,
  editing,
  onChange,
  color,
}: {
  label: string;
  value: number;
  unit: string;
  editing: boolean;
  onChange: (val: number) => void;
  color: string;
}) {
  return (
    <View style={styles.goalRow}>
      <View style={styles.goalInfo}>
        <View style={[styles.goalDot, { backgroundColor: color }]} />
        <Text style={styles.goalLabel}>{label}</Text>
      </View>
      {editing ? (
        <View style={styles.goalInputContainer}>
          <TextInput
            style={styles.goalInput}
            value={value.toString()}
            onChangeText={(text) => {
              const num = parseInt(text) || 0;
              onChange(num);
            }}
            keyboardType="numeric"
          />
          <Text style={styles.goalUnit}>{unit}</Text>
        </View>
      ) : (
        <Text style={styles.goalValue}>
          {value} {unit}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  editButton: {
    fontSize: 16,
    fontWeight: '500',
    color: '#10B981',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 4,
  },
  helperText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  apiKeyInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
  },
  eyeButton: {
    padding: 8,
  },
  saveButton: {
    backgroundColor: '#10B981',
    borderRadius: 8,
    paddingVertical: 12,
    marginTop: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  goalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  goalInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  goalDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  goalLabel: {
    fontSize: 16,
    color: '#1F2937',
  },
  goalValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
  },
  goalInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  goalInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    textAlign: 'right',
    width: 80,
    color: '#1F2937',
  },
  goalUnit: {
    marginLeft: 6,
    fontSize: 14,
    color: '#6B7280',
  },
  saveGoalsButton: {
    backgroundColor: '#10B981',
    borderRadius: 8,
    paddingVertical: 12,
    marginTop: 16,
    alignItems: 'center',
  },
  preferenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  preferenceInfo: {
    flex: 1,
  },
  preferenceName: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '500',
  },
  preferenceDesc: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  aboutLabel: {
    fontSize: 16,
    color: '#6B7280',
  },
  aboutValue: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '500',
  },
  dangerButton: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  dangerButtonText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  bottomPadding: {
    height: 40,
  },
});
