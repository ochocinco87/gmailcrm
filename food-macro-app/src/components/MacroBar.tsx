import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

type MacroBarProps = {
  label: string;
  value: number;
  unit: string;
  color: string;
  percentage: number;
};

export default function MacroBar({
  label,
  value,
  unit,
  color,
  percentage,
}: MacroBarProps) {
  // Clamp percentage between 0 and 100
  const clampedPercentage = Math.min(Math.max(percentage, 0), 100);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.labelContainer}>
          <View style={[styles.dot, { backgroundColor: color }]} />
          <Text style={styles.label}>{label}</Text>
        </View>
        <Text style={styles.value}>
          {value}{unit} <Text style={styles.percentage}>({Math.round(clampedPercentage)}%)</Text>
        </Text>
      </View>
      <View style={styles.barBackground}>
        <View
          style={[
            styles.barFill,
            {
              width: `${clampedPercentage}%`,
              backgroundColor: color,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  label: {
    fontSize: 15,
    color: '#4B5563',
    fontWeight: '500',
  },
  value: {
    fontSize: 15,
    color: '#1F2937',
    fontWeight: '600',
  },
  percentage: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '400',
  },
  barBackground: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
});
