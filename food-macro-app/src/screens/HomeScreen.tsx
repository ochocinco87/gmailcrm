import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, Macros } from '../../App';
import { getTodaysMeals, MealEntry } from '../services/storage';
import MacroRing from '../components/MacroRing';
import DailyGoalCard from '../components/DailyGoalCard';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [todaysMeals, setTodaysMeals] = useState<MealEntry[]>([]);
  const [todaysTotals, setTodaysTotals] = useState<Macros>({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  });

  // Default daily goals (can be customized in settings)
  const dailyGoals: Macros = {
    calories: 2000,
    protein: 150,
    carbs: 200,
    fat: 65,
  };

  useEffect(() => {
    loadTodaysMeals();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadTodaysMeals();
    });
    return unsubscribe;
  }, [navigation]);

  const loadTodaysMeals = async () => {
    const meals = await getTodaysMeals();
    setTodaysMeals(meals);

    const totals = meals.reduce(
      (acc, meal) => ({
        calories: acc.calories + meal.macros.calories,
        protein: acc.protein + meal.macros.protein,
        carbs: acc.carbs + meal.macros.carbs,
        fat: acc.fat + meal.macros.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
    setTodaysTotals(totals);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.greeting}>{getGreeting()}</Text>
        <Text style={styles.subtitle}>Track your nutrition with a snap</Text>
      </View>

      {/* Calorie Ring */}
      <View style={styles.ringContainer}>
        <MacroRing
          current={todaysTotals.calories}
          goal={dailyGoals.calories}
          size={width * 0.55}
          strokeWidth={20}
          color="#10B981"
          label="Calories"
        />
      </View>

      {/* Macro Cards */}
      <View style={styles.macroCardsContainer}>
        <DailyGoalCard
          label="Protein"
          current={todaysTotals.protein}
          goal={dailyGoals.protein}
          unit="g"
          color="#3B82F6"
        />
        <DailyGoalCard
          label="Carbs"
          current={todaysTotals.carbs}
          goal={dailyGoals.carbs}
          unit="g"
          color="#F59E0B"
        />
        <DailyGoalCard
          label="Fat"
          current={todaysTotals.fat}
          goal={dailyGoals.fat}
          unit="g"
          color="#EF4444"
        />
      </View>

      {/* Recent Meals */}
      {todaysMeals.length > 0 && (
        <View style={styles.recentMealsContainer}>
          <Text style={styles.sectionTitle}>Today's Meals</Text>
          {todaysMeals.slice(0, 3).map((meal, index) => (
            <View key={index} style={styles.mealCard}>
              <View style={styles.mealInfo}>
                <Text style={styles.mealName}>{meal.name}</Text>
                <Text style={styles.mealTime}>
                  {new Date(meal.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
              <View style={styles.mealMacros}>
                <Text style={styles.mealCalories}>{meal.macros.calories} cal</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Scan Button */}
      <TouchableOpacity
        style={styles.scanButton}
        onPress={() => navigation.navigate('Camera')}
        activeOpacity={0.8}
      >
        <Ionicons name="camera" size={28} color="white" />
        <Text style={styles.scanButtonText}>Snap Your Food</Text>
      </TouchableOpacity>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 4,
  },
  ringContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  macroCardsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  recentMealsContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  mealCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  mealInfo: {
    flex: 1,
  },
  mealName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
  },
  mealTime: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  mealMacros: {
    alignItems: 'flex-end',
  },
  mealCalories: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10B981',
  },
  scanButton: {
    backgroundColor: '#10B981',
    marginHorizontal: 20,
    borderRadius: 16,
    paddingVertical: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  scanButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 10,
  },
  bottomPadding: {
    height: 30,
  },
});
