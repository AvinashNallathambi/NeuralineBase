/**
 * Appointment Detail Screen — view & manage a single appointment.
 *
 * Features:
 * - Full appointment info (patient, provider, time, type, reason, notes)
 * - Status badge with color coding
 * - Status transition buttons (Check In, Start, Complete, Cancel, No Show)
 * - Telehealth join button
 * - Group session participants (if applicable)
 * - Edit & Cancel actions
 */
import React, { useState, useCallback } from 'react';
import { ScrollView, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { appointmentsApi, http } from '../../services';
import type { Appointment, AppointmentStatus } from '@neuraline/shared';

import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';
import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import { Heading } from '@/components/ui/heading';
import { Card } from '@/components/ui/card';
import { Badge, BadgeText } from '@/components/ui/badge';
import { Button, ButtonText } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Divider } from '@/components/ui/divider';
import { CustomSpinner } from '../../components/CustomSpinner';
import { Avatar, AvatarFallbackText } from '@/components/ui/avatar';
import { Pressable } from '@/components/ui/pressable';

import {
  STATUS_META,
  TYPE_META,
  STATUS_TRANSITIONS,
  formatTime,
  formatDate,
  formatDuration,
  isPast,
} from './appointmentConstants';

type DetailNavProp = NativeStackNavigationProp<
  { AppointmentDetail: { appointmentId: string }; CreateAppointment: { appointmentId?: string } },
  'AppointmentDetail'
>;

export const AppointmentDetailScreen: React.FC = () => {
  const navigation = useNavigation<DetailNavProp>();
  const route = useRoute<any>();
  const queryClient = useQueryClient();
  const appointmentId = route.params?.appointmentId;

  const [actionLoading, setActionLoading] = useState(false);

  // Fetch appointment details
  const { data: appointment, isLoading } = useQuery({
    queryKey: ['appointment', appointmentId],
    queryFn: () => appointmentsApi.getById(appointmentId),
    enabled: !!appointmentId,
  });

  // Status update mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AppointmentStatus }) =>
      appointmentsApi.update(id, { status } as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment', appointmentId] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });

  const handleStatusChange = useCallback(
    (newStatus: AppointmentStatus) => {
      if (!appointment) return;

      const confirmAction = (label: string, onConfirm: () => void) => {
        Alert.alert(
          'Confirm Action',
          `Are you sure you want to mark this appointment as "${label}"?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Confirm', onPress: onConfirm },
          ],
        );
      };

      const meta = STATUS_META[newStatus];
      const isDestructive = newStatus === 'cancelled' || newStatus === 'no_show';

      const doUpdate = async () => {
        setActionLoading(true);
        try {
          await updateStatusMutation.mutateAsync({ id: appointment.id, status: newStatus });
        } catch (err: any) {
          Alert.alert('Error', err?.response?.data?.message || 'Failed to update status');
        } finally {
          setActionLoading(false);
        }
      };

      if (isDestructive) {
        confirmAction(meta.label, doUpdate);
      } else {
        doUpdate();
      }
    },
    [appointment, updateStatusMutation],
  );

  const handleCancel = useCallback(() => {
    if (!appointment) return;
    Alert.alert('Cancel Appointment', 'This will cancel the appointment. This action cannot be undone.', [
      { text: 'Keep Appointment', style: 'cancel' },
      {
        text: 'Cancel Appointment',
        style: 'destructive',
        onPress: async () => {
          setActionLoading(true);
          try {
            await appointmentsApi.cancel(appointment.id);
            queryClient.invalidateQueries({ queryKey: ['appointments'] });
            queryClient.invalidateQueries({ queryKey: ['appointment', appointmentId] });
            navigation.goBack();
          } catch (err: any) {
            Alert.alert('Error', err?.response?.data?.message || 'Failed to cancel');
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  }, [appointment, appointmentId, navigation, queryClient]);

  if (isLoading || !appointment) {
    return (
      <Box className="flex-1 justify-center items-center bg-background">
        <CustomSpinner size={48} />
      </Box>
    );
  }

  const statusMeta = STATUS_META[appointment.status];
  const typeMeta = TYPE_META[appointment.type];
  const availableTransitions = STATUS_TRANSITIONS[appointment.status] || [];
  const past = isPast(appointment.endTime);

  // Group transition buttons by type
  const primaryTransitions = availableTransitions.filter(
    (s) => s !== 'cancelled' && s !== 'no_show',
  );
  const destructiveTransitions = availableTransitions.filter(
    (s) => s === 'cancelled' || s === 'no_show',
  );

  return (
    <ScrollView className="bg-background">
      <VStack className="p-4" space="md">
        {/* Status header card */}
        <Card className="rounded-xl p-5" size="default">
          <VStack space="sm">
            <HStack className="justify-between items-start" space="md">
              <VStack className="flex-1" space="xs">
                <Heading size="lg" className="text-foreground">
                  {appointment.patientName || 'Unknown Patient'}
                </Heading>
                <Text size="sm" className="text-muted-foreground">
                  {appointment.providerName}
                </Text>
              </VStack>
              <Badge variant="solid" className={`${statusMeta.bgClass} border-0`}>
                <BadgeText className={statusMeta.textClass}>{statusMeta.label}</BadgeText>
              </Badge>
            </HStack>

            <HStack className="gap-2 mt-1">
              <Badge variant="solid" className={`${typeMeta.bgClass} border-0`}>
                <BadgeText className={typeMeta.textClass}>{typeMeta.label}</BadgeText>
              </Badge>
              {appointment.isTelehealth && (
                <Badge variant="solid" className="bg-cyan-100 border-0">
                  <BadgeText className="text-cyan-700">Telehealth</BadgeText>
                </Badge>
              )}
            </HStack>
          </VStack>
        </Card>

        {/* Date & Time card */}
        <Card className="rounded-xl p-5" size="default">
          <VStack space="sm">
            <HStack className="justify-between items-center">
              <Text size="sm" className="text-muted-foreground">Date</Text>
              <Text className="text-foreground font-medium">{formatDate(appointment.startTime)}</Text>
            </HStack>
            <Divider />
            <HStack className="justify-between items-center">
              <Text size="sm" className="text-muted-foreground">Time</Text>
              <Text className="text-foreground font-medium">
                {formatTime(appointment.startTime)} - {formatTime(appointment.endTime)}
              </Text>
            </HStack>
            <Divider />
            <HStack className="justify-between items-center">
              <Text size="sm" className="text-muted-foreground">Duration</Text>
              <Text className="text-foreground font-medium">
                {formatDuration(appointment.startTime, appointment.endTime)}
              </Text>
            </HStack>
          </VStack>
        </Card>

        {/* Patient & Provider card */}
        <Card className="rounded-xl p-5" size="default">
          <VStack space="md">
            <HStack className="items-center" space="md">
              <Avatar size="md" className="bg-primary">
                <AvatarFallbackText className="text-white">
                  {(appointment.patientName || '?').split(' ').map((n) => n[0]).join('').slice(0, 2)}
                </AvatarFallbackText>
              </Avatar>
              <VStack space="xs">
                <Text size="sm" className="text-muted-foreground">Patient</Text>
                <Text className="text-foreground font-medium">
                  {appointment.patientName || 'Not assigned'}
                </Text>
              </VStack>
            </HStack>
            <Divider />
            <HStack className="items-center" space="md">
              <Avatar size="md" className="bg-primaryDark">
                <AvatarFallbackText className="text-white">
                  {(appointment.providerName || '?').split(' ').map((n) => n[0]).join('').slice(0, 2)}
                </AvatarFallbackText>
              </Avatar>
              <VStack space="xs">
                <Text size="sm" className="text-muted-foreground">Provider</Text>
                <Text className="text-foreground font-medium">{appointment.providerName}</Text>
              </VStack>
            </HStack>
          </VStack>
        </Card>

        {/* Reason for visit */}
        {appointment.reason ? (
          <Card className="rounded-xl p-5" size="default">
            <VStack space="xs">
              <Text size="sm" className="text-muted-foreground">Reason for Visit</Text>
              <Text className="text-foreground">{appointment.reason}</Text>
            </VStack>
          </Card>
        ) : null}

        {/* Notes */}
        {appointment.notes ? (
          <Card className="rounded-xl p-5" size="default">
            <VStack space="xs">
              <Text size="sm" className="text-muted-foreground">Notes</Text>
              <Text className="text-foreground">{appointment.notes}</Text>
            </VStack>
          </Card>
        ) : null}

        {/* Telehealth join */}
        {appointment.isTelehealth && appointment.status !== 'completed' && appointment.status !== 'cancelled' && (
          <Button className="rounded-lg bg-cyan-600" size="lg">
            <ButtonText>Join Video Visit</ButtonText>
          </Button>
        )}

        {/* Group session participants */}
        {appointment.isGroup && appointment.groupParticipants && appointment.groupParticipants.length > 0 && (
          <Card className="rounded-xl p-5" size="default">
            <VStack space="sm">
              <HStack className="justify-between items-center">
                <Heading size="sm" className="text-foreground">Participants</Heading>
                <Badge variant="solid" className="bg-primary/10 border-0">
                  <BadgeText className="text-primary">
                    {appointment.groupParticipants.length}
                    {appointment.maxParticipants ? `/${appointment.maxParticipants}` : ''}
                  </BadgeText>
                </Badge>
              </HStack>
              <Divider />
              {appointment.groupParticipants.map((p, idx) => (
                <HStack key={idx} className="items-center justify-between">
                  <Text className="text-foreground">{p.patientName}</Text>
                  <Badge variant="solid" className={p.attended ? 'bg-success/15 border-0' : 'bg-muted/30 border-0'}>
                    <BadgeText className={p.attended ? 'text-success' : 'text-muted-foreground'}>
                      {p.attended ? 'Attended' : 'Pending'}
                    </BadgeText>
                  </Badge>
                </HStack>
              ))}
            </VStack>
          </Card>
        )}

        {/* Status action buttons */}
        {availableTransitions.length > 0 && !past && (
          <Card className="rounded-xl p-5" size="default">
            <VStack space="sm">
              <Heading size="sm" className="text-foreground">Actions</Heading>
              <Divider />

              {/* Primary transitions */}
              {primaryTransitions.map((status) => {
                const meta = STATUS_META[status];
                const buttonClass =
                  status === 'completed'
                    ? 'bg-success'
                    : status === 'in_progress'
                      ? 'bg-warning'
                      : status === 'checked_in'
                        ? 'bg-primary'
                        : 'bg-primary';
                return (
                  <Button
                    key={status}
                    onPress={() => handleStatusChange(status)}
                    disabled={actionLoading}
                    className={`rounded-lg ${buttonClass}`}
                    size="md"
                  >
                    <ButtonText>{meta.label}</ButtonText>
                  </Button>
                );
              })}

              {/* Destructive transitions */}
              {destructiveTransitions.length > 0 && (
                <HStack className="gap-2 mt-1">
                  {destructiveTransitions.map((status) => {
                    const meta = STATUS_META[status];
                    return (
                      <Button
                        key={status}
                        onPress={() => handleStatusChange(status)}
                        disabled={actionLoading}
                        variant="outline"
                        className="flex-1 rounded-lg border-destructive"
                        size="md"
                      >
                        <ButtonText className="text-destructive">{meta.label}</ButtonText>
                      </Button>
                    );
                  })}
                </HStack>
              )}
            </VStack>
          </Card>
        )}

        {/* Edit & Cancel buttons */}
        <HStack className="gap-3" space="md">
          <Button
            onPress={() => navigation.navigate('CreateAppointment', { appointmentId: appointment.id })}
            variant="outline"
            className="flex-1 rounded-lg border-primary"
            size="md"
          >
            <ButtonText className="text-primary">Edit</ButtonText>
          </Button>
          {appointment.status !== 'cancelled' && appointment.status !== 'completed' && (
            <Button
              onPress={handleCancel}
              disabled={actionLoading}
              variant="outline"
              className="flex-1 rounded-lg border-destructive"
              size="md"
            >
              <ButtonText className="text-destructive">Cancel Appt</ButtonText>
            </Button>
          )}
        </HStack>
      </VStack>
    </ScrollView>
  );
};
