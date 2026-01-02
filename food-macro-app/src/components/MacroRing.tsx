import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

type MacroRingProps = {
  current: number;
  goal: number;
  size: number;
  strokeWidth: number;
  color: string;
  label: string;
};

export default function MacroRing({
  current,
  goal,
  size,
  strokeWidth,
  color,
  label,
}: MacroRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percentage = Math.min(current / goal, 1);
  const strokeDashoffset = circumference - percentage * circumference;

  const remaining = Math.max(goal - current, 0);
  const isOverGoal = current > goal;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {/* Background circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#E5E7EB"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={isOverGoal ? '#EF4444' : color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>

      <View style={styles.content}>
        <Text style={styles.currentValue}>{current.toLocaleString()}</Text>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.remaining, isOverGoal && styles.overGoal]}>
          {isOverGoal ? `+${(current - goal).toLocaleString()} over` : `${remaining.toLocaleString()} left`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    position: 'absolute',
    alignItems: 'center',
  },
  currentValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  label: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 2,
  },
  remaining: {
    fontSize: 14,
    color: '#10B981',
    marginTop: 4,
    fontWeight: '500',
  },
  overGoal: {
    color: '#EF4444',
  },
});
