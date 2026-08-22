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
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Pressable as RNPressable,
  Keyboard,
  Modal,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
  FadeInDown,
  FadeOutUp,
} from 'react-native-reanimated';
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
import { CustomSpinner } from '../../components/CustomSpinner';
import { Badge, BadgeText } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectItemText } from '@/components/ui/select';
import { Pressable } from '@/components/ui/pressable';
import { Divider } from '@/components/ui/divider';

import { Calendar } from 'react-native-calendars';
import type { DateData } from 'react-native-calendars';

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
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isPatientDropdownOpen, setIsPatientDropdownOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [selectedProviderName, setSelectedProviderName] = useState('');
  const [providerSearch, setProviderSearch] = useState('');
  const [isProviderDropdownOpen, setIsProviderDropdownOpen] = useState(false);
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

  // Debounce patient search (500ms) to avoid rapid REST API calls on every keystroke
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(patientSearch);
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [patientSearch]);

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

  // Patient search (uses debounced value to avoid rapid REST calls)
  const { data: patientResults } = useQuery({
    queryKey: ['patients', 'search', debouncedSearch],
    queryFn: () =>
      patientsApi.list({
        search: debouncedSearch || undefined,
        page: 1,
        limit: 10,
        sortBy: 'lastName',
        sortOrder: 'ASC',
      }),
    enabled: debouncedSearch.length > 1,
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

  // Fetch providers from /users endpoint and filter by role.
  // We use /users (not /providers) because availability records are keyed
  // by the User entity UUID, and /providers returns hardcoded IDs (usr-001)
  // that don't match. Filtering by role='doctor' or 'super_admin' gives us
  // the correct UUIDs that work with the slots API.
  const { data: providers } = useQuery({
    queryKey: ['providers', 'users'],
    queryFn: async () => {
      const res = await http.get('/users');
      const all = res.data?.data || res.data || [];
      return all.filter(
        (u: any) => u.role === 'doctor' || u.role === 'super_admin',
      );
    },
  });

  // Pre-load recent patients so the list isn't empty before searching
  const { data: recentPatients } = useQuery({
    queryKey: ['patients', 'recent'],
    queryFn: () =>
      patientsApi.list({
        page: 1,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'DESC',
      }),
    enabled: !isEditing,
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
            <Card className="rounded-xl p-4" size="default" style={{ elevation: 50, zIndex: 50 }}>
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
                    <Pressable onPress={() => { setSelectedPatient(null); setPatientSearch(''); setDebouncedSearch(''); setIsPatientDropdownOpen(false); }}>
                      <Text className="text-destructive">Change</Text>
                    </Pressable>
                  </HStack>
                ) : (
                  <View>
                    <Input className="rounded-lg" variant="outline">
                      <InputField
                        placeholder="Search patient by name or MRN..."
                        value={patientSearch}
                        onChangeText={(text) => {
                          setPatientSearch(text);
                          if (!isPatientDropdownOpen) setIsPatientDropdownOpen(true);
                        }}
                        onFocus={() => setIsPatientDropdownOpen(true)}
                        autoCapitalize="none"
                      />
                    </Input>

                    {/* Animated autocomplete dropdown — floats over content below */}
                    {isPatientDropdownOpen && (
                      <Animated.View
                        entering={FadeInDown.duration(200).springify().damping(15).stiffness(200)}
                        exiting={FadeOutUp.duration(150)}
                        style={styles.dropdown}
                      >
                        {debouncedSearch.length > 1 && patientResults?.data ? (
                          <FlatList
                            data={patientResults.data.slice(0, 10)}
                            keyExtractor={(item) => item.id}
                            scrollEnabled={true}
                            nestedScrollEnabled={true}
                            ListEmptyComponent={
                              <Text size="sm" className="text-muted-foreground px-3 py-2">
                                No patients found
                              </Text>
                            }
                            renderItem={({ item: p }) => (
                              <TouchableOpacity
                                onPress={() => {
                                  setSelectedPatient(p);
                                  setPatientSearch('');
                                  setDebouncedSearch('');
                                  setIsPatientDropdownOpen(false);
                                  Keyboard.dismiss();
                                }}
                                style={styles.dropdownItem}
                                activeOpacity={0.6}
                              >
                                <Text className="text-foreground" size="sm">
                                  {p.firstName} {p.lastName}
                                </Text>
                                <Text size="xs" className="text-muted-foreground">
                                  MRN: {p.mrn} · DOB: {new Date(p.dateOfBirth).toLocaleDateString()}
                                </Text>
                              </TouchableOpacity>
                            )}
                          />
                        ) : patientSearch.length <= 1 && recentPatients?.data ? (
                          <ScrollView style={styles.dropdownScroll} nestedScrollEnabled={true}>
                            <Text size="xs" className="text-muted-foreground font-medium px-3 pt-2 pb-1">
                              Recent Patients
                            </Text>
                            {recentPatients.data.slice(0, 10).map((p: Patient) => (
                              <TouchableOpacity
                                key={p.id}
                                onPress={() => {
                                  setSelectedPatient(p);
                                  setIsPatientDropdownOpen(false);
                                  Keyboard.dismiss();
                                }}
                                style={styles.dropdownItem}
                                activeOpacity={0.6}
                              >
                                <Text className="text-foreground" size="sm">
                                  {p.firstName} {p.lastName}
                                </Text>
                                <Text size="xs" className="text-muted-foreground">
                                  MRN: {p.mrn} · DOB: {new Date(p.dateOfBirth).toLocaleDateString()}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        ) : null}
                      </Animated.View>
                    )}
                  </View>
                )}
              </VStack>
            </Card>
          )}

          {/* Provider selection — searchable dropdown by name */}
          <Card className="rounded-xl p-4" size="default" style={{ elevation: 40, zIndex: 40 }}>
            <VStack space="sm">
              <Text size="sm" className="text-foreground font-medium">Provider *</Text>
              {selectedProviderId ? (
                <HStack className="items-center justify-between">
                  <VStack space="xs">
                    <Text className="text-foreground">
                      {selectedProviderName}
                    </Text>
                    {providers?.find((p: any) => p.id === selectedProviderId)?.department && (
                      <Text size="xs" className="text-muted-foreground">
                        {providers.find((p: any) => p.id === selectedProviderId).department}
                      </Text>
                    )}
                  </VStack>
                  <Pressable onPress={() => { setSelectedProviderId(''); setSelectedProviderName(''); setProviderSearch(''); setSelectedSlot(null); setIsProviderDropdownOpen(false); }}>
                    <Text className="text-destructive">Change</Text>
                  </Pressable>
                </HStack>
              ) : (
                <View>
                  <Input className="rounded-lg" variant="outline">
                    <InputField
                      placeholder="Search provider by name..."
                      value={providerSearch}
                      onChangeText={setProviderSearch}
                      onFocus={() => setIsProviderDropdownOpen(true)}
                      autoCapitalize="none"
                    />
                  </Input>

                  {/* Animated provider dropdown */}
                  {isProviderDropdownOpen && (
                    <Animated.View
                      entering={FadeInDown.duration(200).springify().damping(15).stiffness(200)}
                      exiting={FadeOutUp.duration(150)}
                      style={styles.dropdown}
                    >
                      {providers && providers.length > 0 ? (
                        <FlatList
                          data={providers.filter((prov: any) => {
                            if (!providerSearch) return true;
                            const fullName = `${prov.firstName} ${prov.lastName}`.toLowerCase();
                            return fullName.includes(providerSearch.toLowerCase());
                          })}
                          keyExtractor={(item) => item.id}
                          scrollEnabled={true}
                          nestedScrollEnabled={true}
                          ListEmptyComponent={
                            <Text size="sm" className="text-muted-foreground px-3 py-2">
                              No providers found
                            </Text>
                          }
                          renderItem={({ item: prov }) => (
                            <TouchableOpacity
                              onPress={() => {
                                setSelectedProviderId(prov.id);
                                setSelectedProviderName(`${prov.firstName} ${prov.lastName}`);
                                setProviderSearch('');
                                setIsProviderDropdownOpen(false);
                                setSelectedSlot(null);
                                Keyboard.dismiss();
                              }}
                              style={styles.dropdownItem}
                              activeOpacity={0.6}
                            >
                              <Text className="text-foreground" size="sm">
                                {prov.firstName} {prov.lastName}
                              </Text>
                              {prov.department && (
                                <Text size="xs" className="text-muted-foreground">
                                  {prov.department}
                                  {prov.role === 'super_admin' ? ' · Provider' : ''}
                                </Text>
                              )}
                            </TouchableOpacity>
                          )}
                        />
                      ) : (
                        <Text size="sm" className="text-muted-foreground px-3 py-2">
                          Loading providers...
                        </Text>
                      )}
                    </Animated.View>
                  )}
                </View>
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
                  {slotsLoading && <CustomSpinner size={20} />}
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
            {saving ? <CustomSpinner size={20} color="#ffffff" /> : (
              <ButtonText>{isEditing ? 'Update Appointment' : 'Create Appointment'}</ButtonText>
            )}
          </Button>
        </VStack>
      </ScrollView>

      {/* Date Picker Modal */}
      <Modal
        visible={showDatePicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <Box className="flex-1 justify-center items-center bg-black/50 p-6">
          <Box className="bg-background rounded-2xl p-4 w-full">
            <HStack className="justify-between items-center mb-3">
              <Heading size="md" className="text-foreground">Select Date</Heading>
              <Pressable onPress={() => setShowDatePicker(false)}>
                <Text className="text-primary font-medium">Close</Text>
              </Pressable>
            </HStack>
            <Calendar
              current={toDateString(selectedDate)}
              onDayPress={(day: DateData) => {
                const date = new Date(day.year, day.month - 1, day.day);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (date >= today) {
                  onDateConfirm({ date });
                  setShowDatePicker(false);
                }
              }}
              minDate={toDateString(new Date())}
              markedDates={{
                [toDateString(selectedDate)]: { selected: true, selectedColor: '#0D7C8A' },
              }}
              theme={{
                todayTextColor: '#0D7C8A',
                selectedDayBackgroundColor: '#0D7C8A',
                selectedDayTextColor: '#ffffff',
                arrowColor: '#0D7C8A',
                monthTextColor: '#1a2b3c',
                calendarBackground: '#ffffff',
              }}
            />
          </Box>
        </Box>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: -10000,
    left: -10000,
    right: -10000,
    bottom: -10000,
    zIndex: 998,
    elevation: 998,
    backgroundColor: 'transparent',
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    zIndex: 999,
    elevation: 999,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    marginTop: 2,
    maxHeight: 350,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  dropdownScroll: {
    maxHeight: 350,
  },
  dropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f5f5f5',
  },
});
