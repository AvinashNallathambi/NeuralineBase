/**
 * Dashboard Screen — provider home screen (Gluestack UI v5).
 *
 * Shows stat cards and recent activity using react-query.
 */
import React from 'react';
import { RefreshControl, ScrollView, Pressable } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { dashboardApi } from '../../services';
import { useAuthStore } from '../../store';
import type { Activity } from '@neuraline/shared';

import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';
import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import { Heading } from '@/components/ui/heading';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { BadgeText } from '@/components/ui/badge';
import { Divider } from '@/components/ui/divider';
import { CustomSpinner } from '../../components/CustomSpinner';

type DashboardNavProp = NativeStackNavigationProp<
  { Dashboard: undefined; Patients: undefined; Appointments: undefined },
  'Dashboard'
>;

export const DashboardScreen: React.FC = () => {
  const { user } = useAuthStore();
  const navigation = useNavigation<DashboardNavProp>();

  const { data: stats, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => dashboardApi.getStats(),
  });

  if (isLoading) {
    return (
      <Box className="flex-1 justify-center items-center bg-background">
        <CustomSpinner size={48} />
      </Box>
    );
  }

  const statCards = [
    {
      label: "Today's Appointments",
      value: stats?.todayAppointments ?? 0,
      icon: '📅',
      color: 'bg-primary',
    },
    {
      label: 'Pending Lab Results',
      value: stats?.pendingLabResults ?? 0,
      icon: '🧪',
      color: 'bg-warning',
    },
    {
      label: 'Pending Claims',
      value: stats?.pendingClaims ?? 0,
      icon: '📋',
      color: 'bg-info',
    },
    {
      label: 'Revenue Today',
      value: `$${(stats?.revenue?.today ?? 0).toLocaleString()}`,
      icon: '💰',
      color: 'bg-success',
    },
  ];

  return (
    <ScrollView
      className="bg-background"
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
      }
    >
      <VStack className="p-5" space="lg">
        {/* Header */}
        <VStack space="xs">
          <Heading size="xl" className="text-foreground">
            Welcome, {user?.firstName || 'Doctor'}
          </Heading>
          <Text size="sm" className="text-muted-foreground">
            Here's your practice overview for today
          </Text>
        </VStack>

        {/* Stat Cards Grid */}
        <Box className="flex-row flex-wrap gap-3">
          {statCards.map((stat, index) => (
            <Card
              key={index}
              className="flex-1 min-w-[160px] rounded-xl p-4"
              size="default"
            >
              <VStack className="items-center" space="xs">
                <Box className={`w-12 h-12 rounded-full items-center justify-center ${stat.color}`}>
                  <Text className="text-2xl">{stat.icon}</Text>
                </Box>
                <Text className="text-2xl font-bold text-foreground">{stat.value}</Text>
                <Text size="xs" className="text-center text-muted-foreground">
                  {stat.label}
                </Text>
              </VStack>
            </Card>
          ))}
        </Box>

        {/* Quick Navigation */}
        <HStack className="gap-3">
          <Pressable onPress={() => navigation.navigate('Appointments')} className="flex-1">
            <Card className="rounded-xl p-4 items-center" size="default">
              <Text className="text-3xl mb-1">📅</Text>
              <Text className="text-sm font-semibold text-primary">Appointments</Text>
            </Card>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('Patients')} className="flex-1">
            <Card className="rounded-xl p-4 items-center" size="default">
              <Text className="text-3xl mb-1">👥</Text>
              <Text className="text-sm font-semibold text-primary">Patients</Text>
            </Card>
          </Pressable>
        </HStack>

        {/* Recent Activity */}
        <Card className="rounded-xl p-5" size="default">
          <VStack space="sm">
            <Heading size="md" className="text-foreground">Recent Activity</Heading>
            <Divider />
            {stats?.recentActivities && stats.recentActivities.length > 0 ? (
              stats.recentActivities.map((activity: Activity) => (
                <VStack key={activity.id} space="xs" className="py-2">
                  <Text size="sm" className="text-foreground">
                    {activity.description}
                  </Text>
                  <Text size="xs" className="text-muted-foreground">
                    {activity.user} · {new Date(activity.timestamp).toLocaleTimeString()}
                  </Text>
                </VStack>
              ))
            ) : (
              <Text className="text-center text-muted-foreground py-4">
                No recent activity
              </Text>
            )}
          </VStack>
        </Card>
      </VStack>
    </ScrollView>
  );
};
