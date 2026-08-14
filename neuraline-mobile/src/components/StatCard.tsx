/**
 * StatCard — reusable stat display card for dashboards.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors, spacing, borderRadius } from '../theme';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: string;
  color?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon,
  color = colors.primary,
}) => {
  return (
    <Card style={styles.card}>
      <Card.Content style={styles.content}>
        <Icon name={icon} size={32} color={color} />
        <Text style={styles.value}>{value}</Text>
        <Text style={styles.label}>{label}</Text>
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 160,
    borderRadius: borderRadius.lg,
  },
  content: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  value: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.sm,
  },
  label: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
