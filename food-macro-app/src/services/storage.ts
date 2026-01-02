import AsyncStorage from '@react-native-async-storage/async-storage';
import { Macros, FoodItem } from '../../App';

const MEALS_STORAGE_KEY = '@macrosnap_meals';

export type MealEntry = {
  name: string;
  macros: Macros;
  imageUri?: string;
  foodItems: FoodItem[];
  timestamp: number;
};

export async function saveMealEntry(meal: MealEntry): Promise<void> {
  try {
    const existingMeals = await getAllMeals();
    const updatedMeals = [meal, ...existingMeals];
    await AsyncStorage.setItem(MEALS_STORAGE_KEY, JSON.stringify(updatedMeals));
  } catch (error) {
    console.error('Error saving meal entry:', error);
    throw error;
  }
}

export async function getAllMeals(): Promise<MealEntry[]> {
  try {
    const stored = await AsyncStorage.getItem(MEALS_STORAGE_KEY);
    if (stored) {
      const meals = JSON.parse(stored) as MealEntry[];
      // Sort by timestamp, newest first
      return meals.sort((a, b) => b.timestamp - a.timestamp);
    }
    return [];
  } catch (error) {
    console.error('Error getting meals:', error);
    return [];
  }
}

export async function getTodaysMeals(): Promise<MealEntry[]> {
  try {
    const allMeals = await getAllMeals();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.getTime();

    return allMeals.filter((meal) => meal.timestamp >= todayStart);
  } catch (error) {
    console.error('Error getting today\'s meals:', error);
    return [];
  }
}

export async function getMealsByDateRange(
  startDate: Date,
  endDate: Date
): Promise<MealEntry[]> {
  try {
    const allMeals = await getAllMeals();
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    return allMeals.filter(
      (meal) => meal.timestamp >= start.getTime() && meal.timestamp <= end.getTime()
    );
  } catch (error) {
    console.error('Error getting meals by date range:', error);
    return [];
  }
}

export async function deleteMealEntry(timestamp: number): Promise<void> {
  try {
    const allMeals = await getAllMeals();
    const filteredMeals = allMeals.filter((meal) => meal.timestamp !== timestamp);
    await AsyncStorage.setItem(MEALS_STORAGE_KEY, JSON.stringify(filteredMeals));
  } catch (error) {
    console.error('Error deleting meal entry:', error);
    throw error;
  }
}

export async function getDailyStats(date: Date): Promise<{
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  mealCount: number;
}> {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const meals = await getMealsByDateRange(startOfDay, endOfDay);

  return meals.reduce(
    (acc, meal) => ({
      totalCalories: acc.totalCalories + meal.macros.calories,
      totalProtein: acc.totalProtein + meal.macros.protein,
      totalCarbs: acc.totalCarbs + meal.macros.carbs,
      totalFat: acc.totalFat + meal.macros.fat,
      mealCount: acc.mealCount + 1,
    }),
    {
      totalCalories: 0,
      totalProtein: 0,
      totalCarbs: 0,
      totalFat: 0,
      mealCount: 0,
    }
  );
}

export async function getWeeklyStats(): Promise<
  Array<{
    date: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  }>
> {
  const stats = [];
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dailyStats = await getDailyStats(date);

    stats.push({
      date: date.toLocaleDateString('en-US', { weekday: 'short' }),
      calories: dailyStats.totalCalories,
      protein: dailyStats.totalProtein,
      carbs: dailyStats.totalCarbs,
      fat: dailyStats.totalFat,
    });
  }

  return stats;
}
