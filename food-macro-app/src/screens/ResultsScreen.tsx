import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, MacroAnalysis, FoodItem } from '../../App';
import { saveMealEntry } from '../services/storage';
import MacroBar from '../components/MacroBar';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type ResultsRouteProp = RouteProp<RootStackParamList, 'Results'>;

const { width } = Dimensions.get('window');

export default function ResultsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ResultsRouteProp>();
  const { imageUri, analysis } = route.params;
  const [isSaving, setIsSaving] = useState(false);

  if (!analysis) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={60} color="#EF4444" />
        <Text style={styles.errorTitle}>Analysis Failed</Text>
        <Text style={styles.errorText}>
          We couldn't analyze this image. Please try again with a clearer photo.
        </Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { foodItems, totalMacros, confidence } = analysis;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const mealName = foodItems.map(item => item.name).join(', ');
      await saveMealEntry({
        name: mealName,
        macros: totalMacros,
        imageUri,
        foodItems,
        timestamp: Date.now(),
      });
      Alert.alert(
        'Saved!',
        'Your meal has been logged successfully.',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('Main'),
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to save meal. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const getConfidenceLabel = (conf: number) => {
    if (conf >= 0.8) return { label: 'High Confidence', color: '#10B981' };
    if (conf >= 0.5) return { label: 'Medium Confidence', color: '#F59E0B' };
    return { label: 'Low Confidence', color: '#EF4444' };
  };

  const confidenceInfo = getConfidenceLabel(confidence);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Food Image */}
      <View style={styles.imageContainer}>
        <Image source={{ uri: imageUri }} style={styles.image} />
        <View style={styles.confidenceBadge}>
          <View style={[styles.confidenceDot, { backgroundColor: confidenceInfo.color }]} />
          <Text style={styles.confidenceText}>{confidenceInfo.label}</Text>
        </View>
      </View>

      {/* Total Macros Summary */}
      <View style={styles.totalMacrosCard}>
        <Text style={styles.sectionTitle}>Nutritional Summary</Text>

        <View style={styles.caloriesRow}>
          <Ionicons name="flame" size={28} color="#10B981" />
          <Text style={styles.caloriesValue}>{totalMacros.calories}</Text>
          <Text style={styles.caloriesLabel}>calories</Text>
        </View>

        <View style={styles.macroBreakdown}>
          <MacroBar
            label="Protein"
            value={totalMacros.protein}
            unit="g"
            color="#3B82F6"
            percentage={(totalMacros.protein * 4) / totalMacros.calories * 100}
          />
          <MacroBar
            label="Carbs"
            value={totalMacros.carbs}
            unit="g"
            color="#F59E0B"
            percentage={(totalMacros.carbs * 4) / totalMacros.calories * 100}
          />
          <MacroBar
            label="Fat"
            value={totalMacros.fat}
            unit="g"
            color="#EF4444"
            percentage={(totalMacros.fat * 9) / totalMacros.calories * 100}
          />
        </View>

        {(totalMacros.fiber || totalMacros.sugar) && (
          <View style={styles.additionalMacros}>
            {totalMacros.fiber && (
              <View style={styles.additionalMacroItem}>
                <Text style={styles.additionalMacroLabel}>Fiber</Text>
                <Text style={styles.additionalMacroValue}>{totalMacros.fiber}g</Text>
              </View>
            )}
            {totalMacros.sugar && (
              <View style={styles.additionalMacroItem}>
                <Text style={styles.additionalMacroLabel}>Sugar</Text>
                <Text style={styles.additionalMacroValue}>{totalMacros.sugar}g</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Food Items Breakdown */}
      <View style={styles.foodItemsContainer}>
        <Text style={styles.sectionTitle}>Detected Items</Text>
        {foodItems.map((item, index) => (
          <FoodItemCard key={index} item={item} />
        ))}
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="camera" size={20} color="#6B7280" />
          <Text style={styles.secondaryButtonText}>Retake Photo</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isSaving}
        >
          <Ionicons name="checkmark-circle" size={20} color="white" />
          <Text style={styles.saveButtonText}>
            {isSaving ? 'Saving...' : 'Log Meal'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

function FoodItemCard({ item }: { item: FoodItem }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <TouchableOpacity
      style={styles.foodItemCard}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.7}
    >
      <View style={styles.foodItemHeader}>
        <View style={styles.foodItemInfo}>
          <Text style={styles.foodItemName}>{item.name}</Text>
          <Text style={styles.foodItemPortion}>{item.portion}</Text>
        </View>
        <View style={styles.foodItemCalories}>
          <Text style={styles.foodItemCaloriesValue}>{item.macros.calories}</Text>
          <Text style={styles.foodItemCaloriesLabel}>cal</Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color="#9CA3AF"
        />
      </View>

      {expanded && (
        <View style={styles.foodItemDetails}>
          <View style={styles.foodItemMacro}>
            <View style={[styles.macroDot, { backgroundColor: '#3B82F6' }]} />
            <Text style={styles.foodItemMacroLabel}>Protein</Text>
            <Text style={styles.foodItemMacroValue}>{item.macros.protein}g</Text>
          </View>
          <View style={styles.foodItemMacro}>
            <View style={[styles.macroDot, { backgroundColor: '#F59E0B' }]} />
            <Text style={styles.foodItemMacroLabel}>Carbs</Text>
            <Text style={styles.foodItemMacroValue}>{item.macros.carbs}g</Text>
          </View>
          <View style={styles.foodItemMacro}>
            <View style={[styles.macroDot, { backgroundColor: '#EF4444' }]} />
            <Text style={styles.foodItemMacroLabel}>Fat</Text>
            <Text style={styles.foodItemMacroValue}>{item.macros.fat}g</Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  imageContainer: {
    position: 'relative',
  },
  image: {
    width: width,
    height: width * 0.6,
  },
  confidenceBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  confidenceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  confidenceText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  totalMacrosCard: {
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  caloriesRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 20,
  },
  caloriesValue: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#1F2937',
    marginLeft: 8,
  },
  caloriesLabel: {
    fontSize: 18,
    color: '#6B7280',
    marginLeft: 6,
  },
  macroBreakdown: {
    gap: 12,
  },
  additionalMacros: {
    flexDirection: 'row',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  additionalMacroItem: {
    flex: 1,
  },
  additionalMacroLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  additionalMacroValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 2,
  },
  foodItemsContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  foodItemCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  foodItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  foodItemInfo: {
    flex: 1,
  },
  foodItemName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
  },
  foodItemPortion: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  foodItemCalories: {
    alignItems: 'flex-end',
    marginRight: 12,
  },
  foodItemCaloriesValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  foodItemCaloriesLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  foodItemDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  foodItemMacro: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  macroDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  foodItemMacroLabel: {
    flex: 1,
    fontSize: 14,
    color: '#6B7280',
  },
  foodItemMacroValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: 'white',
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  secondaryButtonText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  bottomPadding: {
    height: 30,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 20,
    marginBottom: 10,
  },
  errorText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  retryButton: {
    backgroundColor: '#10B981',
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 30,
    marginTop: 30,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
