import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { getAllMeals, deleteMealEntry, MealEntry } from '../services/storage';

type GroupedMeals = {
  [date: string]: MealEntry[];
};

export default function HistoryScreen() {
  const navigation = useNavigation();
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [groupedMeals, setGroupedMeals] = useState<GroupedMeals>({});

  useEffect(() => {
    loadMeals();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadMeals();
    });
    return unsubscribe;
  }, [navigation]);

  const loadMeals = async () => {
    const allMeals = await getAllMeals();
    setMeals(allMeals);

    // Group meals by date
    const grouped = allMeals.reduce((acc: GroupedMeals, meal) => {
      const date = new Date(meal.timestamp).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      });
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(meal);
      return acc;
    }, {});

    setGroupedMeals(grouped);
  };

  const handleDelete = (meal: MealEntry) => {
    Alert.alert(
      'Delete Meal',
      `Are you sure you want to delete "${meal.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteMealEntry(meal.timestamp);
            loadMeals();
          },
        },
      ]
    );
  };

  const getDayTotals = (dayMeals: MealEntry[]) => {
    return dayMeals.reduce(
      (acc, meal) => ({
        calories: acc.calories + meal.macros.calories,
        protein: acc.protein + meal.macros.protein,
        carbs: acc.carbs + meal.macros.carbs,
        fat: acc.fat + meal.macros.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  };

  if (meals.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="restaurant-outline" size={80} color="#D1D5DB" />
        <Text style={styles.emptyTitle}>No Meals Logged</Text>
        <Text style={styles.emptyText}>
          Start snapping photos of your food to track your nutrition journey!
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {Object.entries(groupedMeals).map(([date, dayMeals]) => {
        const totals = getDayTotals(dayMeals);
        const isToday = date === new Date().toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        });

        return (
          <View key={date} style={styles.daySection}>
            <View style={styles.dayHeader}>
              <View>
                <Text style={styles.dayDate}>
                  {isToday ? 'Today' : date}
                </Text>
                <Text style={styles.dayTotals}>
                  {totals.calories} cal · {totals.protein}g P · {totals.carbs}g C · {totals.fat}g F
                </Text>
              </View>
            </View>

            {dayMeals.map((meal, index) => (
              <TouchableOpacity
                key={index}
                style={styles.mealCard}
                onLongPress={() => handleDelete(meal)}
                activeOpacity={0.7}
              >
                {meal.imageUri && (
                  <Image
                    source={{ uri: meal.imageUri }}
                    style={styles.mealImage}
                  />
                )}
                <View style={styles.mealContent}>
                  <View style={styles.mealHeader}>
                    <Text style={styles.mealName} numberOfLines={2}>
                      {meal.name}
                    </Text>
                    <Text style={styles.mealTime}>
                      {new Date(meal.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>

                  <View style={styles.mealMacros}>
                    <View style={styles.macroItem}>
                      <Ionicons name="flame" size={14} color="#10B981" />
                      <Text style={styles.macroValue}>{meal.macros.calories}</Text>
                    </View>
                    <View style={styles.macroItem}>
                      <View style={[styles.macroDot, { backgroundColor: '#3B82F6' }]} />
                      <Text style={styles.macroValue}>{meal.macros.protein}g</Text>
                    </View>
                    <View style={styles.macroItem}>
                      <View style={[styles.macroDot, { backgroundColor: '#F59E0B' }]} />
                      <Text style={styles.macroValue}>{meal.macros.carbs}g</Text>
                    </View>
                    <View style={styles.macroItem}>
                      <View style={[styles.macroDot, { backgroundColor: '#EF4444' }]} />
                      <Text style={styles.macroValue}>{meal.macros.fat}g</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        );
      })}

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 20,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  daySection: {
    marginTop: 20,
  },
  dayHeader: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  dayDate: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  dayTotals: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  mealCard: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  mealImage: {
    width: '100%',
    height: 120,
  },
  mealContent: {
    padding: 14,
  },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  mealName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
    flex: 1,
    marginRight: 10,
  },
  mealTime: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  mealMacros: {
    flexDirection: 'row',
    gap: 16,
  },
  macroItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  macroDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  macroValue: {
    fontSize: 14,
    color: '#4B5563',
    fontWeight: '500',
  },
  bottomPadding: {
    height: 30,
  },
});
