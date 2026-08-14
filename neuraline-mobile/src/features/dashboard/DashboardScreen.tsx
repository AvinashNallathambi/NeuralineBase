/**
 * Dashboard Screen — provider home screen.
 *
 * Shows stats cards (today's appointments, pending labs, pending claims,
 * revenue) and recent activity. Uses react-query for data fetching.
 *
 * On tablets: cards in a 2x2 or 4x1 grid depending on width.
 * On phones: cards in a single column.
 */
import React from 'react';
import { View, StyleSheet, RefreshControl, ScrollView } from 'react-native';
import { Text, Card, Title, Paragraph, ActivityIndicator } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { dashboardApi } from '../../services';
import { useAuthStore } from '../../store';
import { colors, spacing } from '../../theme';
import type { Activity } from '@neuraline/shared';

export const DashboardScreen: React.FC = () => {
  const { user } = useAuthStore();

  const { data: stats, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => dashboardApi.getStats(),
  });

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const statCards = [
    {
      label: 'Today\'s Appointments',
      value: stats?.todayAppointments ?? 0,
      icon: 'calendar-clock',
      color: colors.primary,
    },
    {
      label: 'Pending Lab Results',
      value: stats?.pendingLabResults ?? 0,
      icon: 'test-tube',
      color: colors.warning,
    },
    {
      label: 'Pending Claims',
      value: stats?.pendingClaims ?? 0,
      icon: 'file-document',
      color: colors.info,
    },
    {
      label: 'Revenue Today',
      value: `$${(stats?.revenue?.today ?? 0).toLocaleString()}`,
      icon: 'currency-usd',
      color: colors.success,
    },
  ];

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
      }
    >
      <View style={styles.header}>
        <Title style={styles.title}>
          Welcome, {user?.firstName || 'Doctor'}
        </Title>
        <Paragraph style={styles.subtitle}>
          Here's your practice overview for today
        </Paragraph>
      </View>

      <View style={styles.statsGrid}>
        {statCards.map((stat, index) => (
          <Card key={index} style={styles.statCard}>
            <Card.Content style={styles.statContent}>
              <Icon name={stat.icon} size={32} color={stat.color} />
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </Card.Content>
          </Card>
        ))}
      </View>

      {/* Recent Activity */}
      <Card style={styles.activityCard}>
        <Card.Content>
          <Title style={styles.sectionTitle}>Recent Activity</Title>
          {stats?.recentActivities && stats.recentActivities.length > 0 ? (
            stats.recentActivities.map((activity: Activity) => (
              <View key={activity.id} style={styles.activityItem}>
                <Text style={styles.activityDescription}>{activity.description}</Text>
                <Text style={styles.activityMeta}>
                  {activity.user} · {new Date(activity.timestamp).toLocaleTimeString()}
                </Text>
              </View>
            ))
          ) : (
            <Paragraph style={styles.emptyText}>No recent activity</Paragraph>
          )}
        </Card.Content>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
  },
  subtitle: {
    color: colors.textSecondary,
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    minWidth: 160,
    borderRadius: 12,
  },
  statContent: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.sm,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  activityCard: {
    margin: spacing.lg,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  activityItem: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  activityDescription: {
    fontSize: 14,
    color: colors.text,
  },
  activityMeta: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  emptyText: {
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
});
