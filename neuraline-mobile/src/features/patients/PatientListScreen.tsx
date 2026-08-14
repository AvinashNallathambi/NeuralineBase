/**
 * Patient List Screen — searchable patient roster.
 *
 * Uses react-query for data fetching with search + pagination.
 * On tablets: 2-column card grid. On phones: single column list.
 *
 * TODO: Add master-detail navigation (tap a patient → PatientDetailScreen)
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
} from 'react-native';
import {
  Text,
  Searchbar,
  Card,
  Avatar,
  Chip,
  ActivityIndicator,
  FAB,
} from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';

import { patientsApi } from '../../services';
import { colors, spacing } from '../../theme';
import type { Patient } from '@neuraline/shared';

export const PatientListScreen: React.FC = () => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['patients', { search, page }],
    queryFn: () =>
      patientsApi.list({
        search: search || undefined,
        page,
        limit: 20,
        sortBy: 'lastName',
        sortOrder: 'ASC',
      }),
  });

  const handleSearch = useCallback((query: string) => {
    setSearch(query);
    setPage(1);
  }, []);

  const renderItem = ({ item }: { item: Patient }) => (
    <Card style={styles.patientCard}>
      <Card.Content style={styles.cardContent}>
        <Avatar.Text
          size={48}
          label={`${item.firstName[0]}${item.lastName[0]}`}
          color="#fff"
          style={{ backgroundColor: colors.primary }}
        />
        <View style={styles.patientInfo}>
          <Text style={styles.patientName}>
            {item.firstName} {item.lastName}
          </Text>
          <Text style={styles.patientDetails}>
            MRN: {item.mrn} · DOB: {new Date(item.dateOfBirth).toLocaleDateString()}
          </Text>
          <View style={styles.chipRow}>
            <Chip
              mode="flat"
              compact
              style={[
                styles.statusChip,
                item.status === 'active'
                  ? styles.statusActive
                  : styles.statusInactive,
              ]}
            >
              {item.status}
            </Chip>
            {item.gender && (
              <Chip mode="flat" compact style={styles.genderChip}>
                {item.gender}
              </Chip>
            )}
          </View>
        </View>
      </Card.Content>
    </Card>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Searchbar
        placeholder="Search patients by name, MRN, or DOB..."
        onChangeText={handleSearch}
        value={search}
        style={styles.searchbar}
      />

      <FlatList
        data={data?.data || []}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No patients found</Text>
          </View>
        }
      />

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => {
          // TODO: navigate to NewPatientScreen
        }}
        color="#fff"
      />
    </View>
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
  searchbar: {
    margin: spacing.md,
    borderRadius: 8,
  },
  listContainer: {
    paddingHorizontal: spacing.md,
    paddingBottom: 80,
  },
  patientCard: {
    marginBottom: spacing.sm,
    borderRadius: 12,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  patientInfo: {
    marginLeft: spacing.md,
    flex: 1,
  },
  patientName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  patientDetails: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  statusChip: {
    height: 24,
  },
  statusActive: {
    backgroundColor: 'rgba(82, 196, 26, 0.15)',
  },
  statusInactive: {
    backgroundColor: 'rgba(100, 116, 139, 0.15)',
  },
  genderChip: {
    height: 24,
    backgroundColor: 'rgba(13, 124, 138, 0.1)',
  },
  emptyContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  fab: {
    position: 'absolute',
    margin: spacing.md,
    right: 0,
    bottom: 0,
    backgroundColor: colors.primary,
  },
});
