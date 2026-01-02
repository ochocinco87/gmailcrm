import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';

type DailyGoalCardProps = {
  label: string;
  current: number;
  goal: number;
  unit: string;
  color: string;
};

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 60) / 3;

export default function DailyGoalCard({
  label,
  current,
  goal,
  unit,
  color,
}: DailyGoalCardProps) {
  const percentage = Math.min((current / goal) * 100, 100);
  const isOverGoal = current > goal;

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={[styles.indicator, { backgroundColor: color }]} />
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.value, isOverGoal && styles.overGoal]}>
          {current}
          <Text style={styles.unit}>{unit}</Text>
        </Text>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progress,
              {
                width: `${percentage}%`,
                backgroundColor: isOverGoal ? '#EF4444' : color,
              },
            ]}
          />
        </View>
        <Text style={styles.goal}>of {goal}{unit}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  indicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginBottom: 6,
  },
  label: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  value: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  unit: {
    fontSize: 12,
    fontWeight: '500',
  },
  overGoal: {
    color: '#EF4444',
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    marginTop: 8,
    marginBottom: 4,
    overflow: 'hidden',
  },
  progress: {
    height: '100%',
    borderRadius: 2,
  },
  goal: {
    fontSize: 10,
    color: '#9CA3AF',
  },
});
