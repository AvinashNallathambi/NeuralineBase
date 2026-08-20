/**
 * Create / Edit Appointment Screen — form with slot picker.
 *
 * Features:
 * - Patient search & select
 * - Provider select
 * - Appointment type select
 * - Date picker (react-native-paper-dates calendar)
 * - Time slot picker (fetched from provider availability API)
 * - Telehealth toggle
 * - Reminders toggle
 * - Reason for visit
 * - Notes
 * - Create or update (if editing existing appointment)
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';

import { appointmentsApi, patientsApi, http } from '../../services';
import type { Appointment, AppointmentType, Patient } from '@neuraline/shared';

import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';
import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import { Heading } from '@/components/ui/heading';
import { Input, InputField } from '@/components/ui/input';
import { Button, ButtonText } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Badge, BadgeText } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectItemText } from '@/components/ui/select';
import { Pressable } from '@/components/ui/pressable';
import { Divider } from '@/components/ui/divider';

import { DatePickerModal } from 'react-native-paper-dates';

import {
  APPOINTMENT_TYPES,
  TYPE_META,
  formatTime,
  toDateString,
} from './appointmentConstants';

// ── Types ────────────────────────────────────────────────────────────────────

interface TimeSlot {
  start: string;
  end: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export const CreateAppointmentScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const queryClient = useQueryClient();

  const editingId = route.params?.appointmentId;
  const isEditing = !!editingId;

  // Form state
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [selectedProviderName, setSelectedProviderName] = useState('');
  const [appointmentType, setAppointmentType] = useState<AppointmentType>('consultation');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [isTelehealth, setIsTelehealth] = useState(false);
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [reasonForVisit, setReasonForVisit] = useState('');
  const [notes, setNotes] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If editing, load existing appointment
  const { data: existingAppointment } = useQuery({
    queryKey: ['appointment', editingId],
    queryFn: () => appointmentsApi.getById(editingId!),
    enabled: !!editingId,
  });

  // Populate form when editing
  useEffect(() => {
    if (existingAppointment) {
      setSelectedProviderId(existingAppointment.providerId);
      setSelectedProviderName(existingAppointment.providerName);
      setAppointmentType(existingAppointment.type);
      setSelectedDate(new Date(existingAppointment.startTime));
      setSelectedSlot({
        start: existingAppointment.startTime,
        end: existingAppointment.endTime,
      });
      setIsTelehealth(existingAppointment.isTelehealth);
      setRemindersEnabled(existingAppointment.remindersEnabled ?? true);
      setReasonForVisit(existingAppointment.reason || '');
      setNotes(existingAppointment.notes || '');
    }
  }, [existingAppointment]);

  // Patient search
  const { data: patientResults } = useQuery({
    queryKey: ['patients', 'search', patientSearch],
    queryFn: () =>
      patientsApi.list({
        search: patientSearch || undefined,
        page: 1,
        limit: 10,
        sortBy: 'lastName',
        sortOrder: 'ASC',
      }),
    enabled: patientSearch.length > 1,
  });

  // Fetch available slots when provider + date are selected
  const { data: availableSlots, isLoading: slotsLoading } = useQuery({
    queryKey: ['availability', 'slots', selectedProviderId, toDateString(selectedDate), appointmentType],
    queryFn: async () => {
      const res = await http.get(
        `/appointments/availability/${selectedProviderId}/slots`,
        {
          params: {
            date: selectedDate.toISOString(),
            appointmentType,
          },
        },
      );
      return res.data as TimeSlot[];
    },
    enabled: !!selectedProviderId && !!selectedDate && !isEditing,
  });

  // Fetch providers (staff users) - using the backend users endpoint
  const { data: providers } = useQuery({
    queryKey: ['providers'],
    queryFn: async () => {
      const res = await http.get('/users', { params: { role: 'doctor' } });
      return res.data?.data || res.data || [];
    },
  });

  // Create/update mutation
  const handleSave = useCallback(async () => {
    setError(null);

    if (!selectedProviderId) {
      setError('Please select a provider');
      return;
    }
    if (!selectedSlot) {
      setError('Please select a time slot');
      return;
    }
    if (!isEditing && !selectedPatient) {
      setError('Please select a patient');
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        patientId: selectedPatient?.id || existingAppointment?.patientId,
        providerId: selectedProviderId,
        appointmentType,
        startTime: selectedSlot.start,
        endTime: selectedSlot.end,
        reasonForVisit,
        notes,
        isTelehealth,
        remindersEnabled,
        location: isTelehealth
          ? { type: 'telehealth' }
          : { type: 'in_person' },
      };

      if (isEditing) {
        await appointmentsApi.update(editingId, payload);
      } else {
        await appointmentsApi.create(payload);
      }

      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointment', editingId] });
      navigation.goBack();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to save appointment';
      setError(typeof msg === 'string' ? msg : 'Failed to save appointment');
    } finally {
      setSaving(false);
    }
  }, [
    selectedPatient,
    selectedProviderId,
    selectedSlot,
    appointmentType,
    reasonForVisit,
    notes,
    isTelehealth,
    remindersEnabled,
    isEditing,
    editingId,
    existingAppointment,
    navigation,
    queryClient,
  ]);

  const onDateConfirm = useCallback(
    (params: { date: Date }) => {
      setShowDatePicker(false);
      if (params.date) {
        setSelectedDate(params.date);
        setSelectedSlot(null); // Reset slot when date changes
      }
    },
    [],
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView className="bg-background">
        <VStack className="p-4" space="md">
          <Heading size="lg" className="text-foreground">
            {isEditing ? 'Edit Appointment' : 'New Appointment'}
          </Heading>

          {/* Patient selection (skip if editing) */}
          {!isEditing && (
            <Card className="rounded-xl p-4" size="default">
              <VStack space="sm">
                <Text size="sm" className="text-foreground font-medium">Patient *</Text>
                {selectedPatient ? (
                  <HStack className="items-center justify-between">
                    <VStack space="xs">
                      <Text className="text-foreground">
                        {selectedPatient.firstName} {selectedPatient.lastName}
                      </Text>
                      <Text size="xs" className="text-muted-foreground">
                        MRN: {selectedPatient.mrn}
                      </Text>
                    </VStack>
                    <Pressable onPress={() => { setSelectedPatient(null); setPatientSearch(''); }}>
                      <Text className="text-destructive">Change</Text>
                    </Pressable>
                  </HStack>
                ) : (
                  <VStack space="sm">
                    <Input className="rounded-lg" variant="outline">
                      <InputField
                        placeholder="Search patient by name or MRN..."
                        value={patientSearch}
                        onChangeText={setPatientSearch}
                        autoCapitalize="none"
                      />
                    </Input>
                    {patientSearch.length > 1 && patientResults?.data && (
                      <VStack space="xs">
                        {patientResults.data.slice(0, 5).map((p: Patient) => (
                          <Pressable
                            key={p.id}
                            onPress={() => { setSelectedPatient(p); setPatientSearch(''); }}
                            className="px-3 py-2 rounded-lg bg-muted/30"
                          >
                            <Text className="text-foreground">
                              {p.firstName} {p.lastName}
                            </Text>
                            <Text size="xs" className="text-muted-foreground">
                              MRN: {p.mrn} · DOB: {new Date(p.dateOfBirth).toLocaleDateString()}
                            </Text>
                          </Pressable>
                        ))}
                        {patientResults.data.length === 0 && (
                          <Text size="sm" className="text-muted-foreground">No patients found</Text>
                        )}
                      </VStack>
                    )}
                  </VStack>
                )}
              </VStack>
            </Card>
          )}

          {/* Provider selection */}
          <Card className="rounded-xl p-4" size="default">
            <VStack space="sm">
              <Text size="sm" className="text-foreground font-medium">Provider *</Text>
              {providers && Array.isArray(providers) && providers.length > 0 ? (
                <VStack space="xs">
                  {providers.map((prov: any) => (
                    <Pressable
                      key={prov.id}
                      onPress={() => {
                        setSelectedProviderId(prov.id);
                        setSelectedProviderName(`${prov.firstName} ${prov.lastName}`);
                        setSelectedSlot(null);
                      }}
                      className={`px-3 py-2.5 rounded-lg border ${
                        selectedProviderId === prov.id
                          ? 'border-primary bg-primary/10'
                          : 'border-border bg-transparent'
                      }`}
                    >
                      <Text
                        className={
                          selectedProviderId === prov.id
                            ? 'text-primary font-medium'
                            : 'text-foreground'
                        }
                      >
                        {prov.firstName} {prov.lastName}
                      </Text>
                      {prov.specialization && (
                        <Text size="xs" className="text-muted-foreground">
                          {prov.specialization}
                        </Text>
                      )}
                    </Pressable>
                  ))}
                </VStack>
              ) : (
                <Input className="rounded-lg" variant="outline">
                  <InputField
                    placeholder="Enter provider ID"
                    value={selectedProviderId}
                    onChangeText={(text) => {
                      setSelectedProviderId(text);
                      setSelectedSlot(null);
                    }}
                    autoCapitalize="none"
                  />
                </Input>
              )}
            </VStack>
          </Card>

          {/* Appointment type */}
          <Card className="rounded-xl p-4" size="default">
            <VStack space="sm">
              <Text size="sm" className="text-foreground font-medium">Appointment Type</Text>
              <HStack className="flex-wrap gap-2">
                {APPOINTMENT_TYPES.filter((t) => !t.startsWith('group')).map((type) => {
                  const meta = TYPE_META[type];
                  const isSelected = appointmentType === type;
                  return (
                    <Pressable
                      key={type}
                      onPress={() => setAppointmentType(type)}
                      className={`px-3 py-2 rounded-lg border ${
                        isSelected ? 'border-primary bg-primary/10' : 'border-border'
                      }`}
                    >
                      <Text
                        size="sm"
                        className={isSelected ? 'text-primary font-medium' : 'text-foreground'}
                      >
                        {meta.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </HStack>
            </VStack>
          </Card>

          {/* Date selection */}
          <Card className="rounded-xl p-4" size="default">
            <VStack space="sm">
              <Text size="sm" className="text-foreground font-medium">Date</Text>
              <Pressable
                onPress={() => setShowDatePicker(true)}
                className="px-3 py-3 rounded-lg border border-border"
              >
                <HStack className="justify-between items-center">
                  <Text className="text-foreground">
                    {selectedDate.toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </Text>
                  <Text className="text-primary">Change</Text>
                </HStack>
              </Pressable>
            </VStack>
          </Card>

          {/* Time slot picker */}
          {!isEditing && selectedProviderId && (
            <Card className="rounded-xl p-4" size="default">
              <VStack space="sm">
                <HStack className="justify-between items-center">
                  <Text size="sm" className="text-foreground font-medium">Available Time Slots</Text>
                  {slotsLoading && <Spinner size="small" color="$primary" />}
                </HStack>

                {!slotsLoading && availableSlots && availableSlots.length > 0 ? (
                  <HStack className="flex-wrap gap-2">
                    {availableSlots.map((slot, idx) => {
                      const isSelected =
                        selectedSlot?.start === slot.start;
                      return (
                        <Pressable
                          key={idx}
                          onPress={() => setSelectedSlot(slot)}
                          className={`px-4 py-2.5 rounded-lg border ${
                            isSelected ? 'border-primary bg-primary' : 'border-border'
                          }`}
                        >
                          <Text
                            className={isSelected ? 'text-white font-medium' : 'text-foreground'}
                          >
                            {formatTime(slot.start)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </HStack>
                ) : !slotsLoading && availableSlots && availableSlots.length === 0 ? (
                  <Box className="bg-warning/10 rounded-lg px-4 py-3">
                    <Text size="sm" className="text-warning">
                      No available slots for this provider on the selected date.
                      The provider may not have availability set for this day.
                    </Text>
                  </Box>
                ) : !selectedProviderId ? (
                  <Text size="sm" className="text-muted-foreground">
                    Select a provider to see available time slots
                  </Text>
                ) : null}
              </VStack>
            </Card>
          )}

          {/* Selected time display (for editing) */}
          {isEditing && selectedSlot && (
            <Card className="rounded-xl p-4" size="default">
              <HStack className="justify-between items-center">
                <Text size="sm" className="text-muted-foreground">Current Time</Text>
                <Text className="text-foreground font-medium">
                  {formatTime(selectedSlot.start)} - {formatTime(selectedSlot.end)}
                </Text>
              </HStack>
            </Card>
          )}

          {/* Toggles */}
          <Card className="rounded-xl p-4" size="default">
            <VStack space="md">
              <HStack className="justify-between items-center">
                <VStack space="xs">
                  <Text className="text-foreground font-medium">Telehealth Visit</Text>
                  <Text size="xs" className="text-muted-foreground">Video appointment</Text>
                </VStack>
                <Switch
                  value={isTelehealth}
                  onValueChange={setIsTelehealth}
                  trackColor={{ false: '#e2e8f0', true: '#0D7C8A' }}
                />
              </HStack>
              <Divider />
              <HStack className="justify-between items-center">
                <VStack space="xs">
                  <Text className="text-foreground font-medium">Send Reminders</Text>
                  <Text size="xs" className="text-muted-foreground">Email/SMS to patient</Text>
                </VStack>
                <Switch
                  value={remindersEnabled}
                  onValueChange={setRemindersEnabled}
                  trackColor={{ false: '#e2e8f0', true: '#0D7C8A' }}
                />
              </HStack>
            </VStack>
          </Card>

          {/* Reason for visit */}
          <Card className="rounded-xl p-4" size="default">
            <VStack space="sm">
              <Text size="sm" className="text-foreground font-medium">Reason for Visit</Text>
              <Input className="rounded-lg" variant="outline">
                <InputField
                  placeholder="Chief complaint or reason..."
                  value={reasonForVisit}
                  onChangeText={setReasonForVisit}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </Input>
            </VStack>
          </Card>

          {/* Notes */}
          <Card className="rounded-xl p-4" size="default">
            <VStack space="sm">
              <Text size="sm" className="text-foreground font-medium">Notes (optional)</Text>
              <Input className="rounded-lg" variant="outline">
                <InputField
                  placeholder="Internal notes..."
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </Input>
            </VStack>
          </Card>

          {/* Error */}
          {error && (
            <Box className="bg-destructive/10 rounded-lg px-4 py-3">
              <Text size="sm" className="text-destructive">{error}</Text>
            </Box>
          )}

          {/* Save button */}
          <Button
            onPress={handleSave}
            disabled={saving}
            className="rounded-lg"
            size="lg"
          >
            {saving ? <Spinner size="small" color="$white" /> : (
              <ButtonText>{isEditing ? 'Update Appointment' : 'Create Appointment'}</ButtonText>
            )}
          </Button>
        </VStack>
      </ScrollView>

      {/* Date Picker Modal */}
      <DatePickerModal
        locale="en"
        mode="single"
        visible={showDatePicker}
        onDismiss={() => setShowDatePicker(false)}
        date={selectedDate}
        onConfirm={onDateConfirm}
        validRange={{
          startDate: new Date(),
        }}
      />
    </KeyboardAvoidingView>
  );
};
