/**
 * Patient List Screen — searchable patient roster (Gluestack UI v5).
 *
 * Uses react-query for data fetching with search + pagination.
 */
import React, { useState, useCallback } from 'react';
import {
  FlatList,
  RefreshControl,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { patientsApi } from '../../services';
import type { Patient } from '@neuraline/shared';

import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';
import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import { Input, InputField, InputIcon, InputSlot } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallbackText } from '@/components/ui/avatar';
import { Badge, BadgeText } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Fab, FabIcon } from '@/components/ui/fab';
import { Icon } from '@/components/ui/icon';

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
    <Card className="mb-2 rounded-xl p-4" size="default">
      <HStack className="items-center" space="md">
        <Avatar size="md" className="bg-primary">
          <AvatarFallbackText className="text-white">
            {item.firstName[0]}{item.lastName[0]}
          </AvatarFallbackText>
        </Avatar>

        <VStack className="flex-1" space="xs">
          <Text className="font-semibold text-foreground">
            {item.firstName} {item.lastName}
          </Text>
          <Text size="xs" className="text-muted-foreground">
            MRN: {item.mrn} · DOB: {new Date(item.dateOfBirth).toLocaleDateString()}
          </Text>
          <HStack className="gap-1.5 mt-1">
            <Badge
              variant="solid"
              className={
                item.status === 'active'
                  ? 'bg-success/15 border-0'
                  : 'bg-muted/30 border-0'
              }
            >
              <BadgeText className={item.status === 'active' ? 'text-success' : 'text-muted-foreground'}>
                {item.status}
              </BadgeText>
            </Badge>
            {item.gender && (
              <Badge variant="solid" className="bg-primary/10 border-0">
                <BadgeText className="text-primary">{item.gender}</BadgeText>
              </Badge>
            )}
          </HStack>
        </VStack>
      </HStack>
    </Card>
  );

  if (isLoading) {
    return (
      <Box className="flex-1 justify-center items-center bg-background">
        <Spinner size="large" color="$primary" />
      </Box>
    );
  }

  return (
    <Box className="flex-1 bg-background">
      {/* Search Bar */}
      <Box className="p-4">
        <Input className="rounded-lg" variant="outline">
          <InputSlot className="pl-3">
            <InputIcon as={SearchIcon} className="text-muted-foreground" />
          </InputSlot>
          <InputField
            placeholder="Search patients by name, MRN, or DOB..."
            value={search}
            onChangeText={handleSearch}
            className="pl-2"
          />
        </Input>
      </Box>

      {/* Patient List */}
      <FlatList
        data={data?.data || []}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 80 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
        ListEmptyComponent={
          <VStack className="items-center py-10" space="xs">
            <Text className="text-muted-foreground">No patients found</Text>
          </VStack>
        }
      />

      {/* FAB - Add Patient */}
      <Fab
        size="lg"
        placement="bottom right"
        className="bg-primary rounded-full"
        onPress={() => {
          // TODO: navigate to NewPatientScreen
        }}
      >
        <FabIcon as={PlusIcon} color="$white" />
      </Fab>
    </Box>
  );
};

// Simple icon placeholders (using text since we don't have icon library set up for Gluestack yet)
const SearchIcon = () => <Text className="text-muted-foreground">🔍</Text>;
const PlusIcon = () => <Text className="text-white text-xl">+</Text>;
