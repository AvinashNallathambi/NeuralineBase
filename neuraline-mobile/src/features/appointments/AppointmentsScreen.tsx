/**
 * Appointments Screen — calendar agenda view with day list.
 *
 * Features:
 * - Month calendar with appointment dot indicators
 * - Tap a day to see appointments for that date
 * - Filter by status
 * - Pull to refresh
 * - FAB to create new appointment
 * - Tap appointment to view details
 *
 * Responsive: calendar + list on phone, side-by-side on tablet.
 */
import React, { useState, useMemo, useCallback } from "react";
import {
  FlatList,
  RefreshControl,
  Dimensions,
  useWindowDimensions,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { http } from "../../services";
import type { Appointment, AppointmentStatus } from "@neuraline/shared";

import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Heading } from "@/components/ui/heading";
import { Card } from "@/components/ui/card";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Pressable } from "@/components/ui/pressable";
import { Button, ButtonText } from "@/components/ui/button";
import { CustomSpinner } from "../../components/CustomSpinner";

import { Calendar } from "react-native-calendars";
import type { DateData, MarkedDates } from "react-native-calendars";

import {
  STATUS_META,
  TYPE_META,
  formatTime,
  formatDate,
  toDateString,
  isToday,
} from "./appointmentConstants";

// ── Types ────────────────────────────────────────────────────────────────────

type AppointmentsNavProp = NativeStackNavigationProp<
  {
    Appointments: undefined;
    AppointmentDetail: { appointmentId: string };
    CreateAppointment: undefined;
  },
  "Appointments"
>;

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Fetch appointments for a date range (used for calendar month view) */
const fetchMonthAppointments = async (year: number, month: number) => {
  const startDate = new Date(year, month - 1, 1).toISOString();
  const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();
  const res = await http.get("/appointments", {
    params: { startDate, endDate, limit: 200 },
  });
  return res.data?.data || [];
};

/** Fetch appointments for a specific day */
const fetchDayAppointments = async (date: Date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  const res = await http.get("/appointments", {
    params: {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      limit: 100,
    },
  });
  return res.data?.data || [];
};

// ── Component ────────────────────────────────────────────────────────────────

export const AppointmentsScreen: React.FC = () => {
  const navigation = useNavigation<AppointmentsNavProp>();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const today = useMemo(() => new Date(), []);
  const [selectedDate, setSelectedDate] = useState(today);
  const [calendarMonth, setCalendarMonth] = useState({
    year: today.getFullYear(),
    month: today.getMonth() + 1,
  });
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | "all">(
    "all",
  );

  // Fetch appointments for the current calendar month (for dot indicators)
  const {
    data: monthAppointments,
    refetch: refetchMonth,
    isRefetching: refetchingMonth,
  } = useQuery({
    queryKey: ["appointments", "month", calendarMonth],
    queryFn: () =>
      fetchMonthAppointments(calendarMonth.year, calendarMonth.month),
  });

  // Fetch appointments for the selected day
  const {
    data: dayAppointments,
    isLoading: dayLoading,
    refetch: refetchDay,
    isRefetching: refetchingDay,
  } = useQuery({
    queryKey: ["appointments", "day", toDateString(selectedDate)],
    queryFn: () => fetchDayAppointments(selectedDate),
  });

  // Build calendar marked dates (dots for days with appointments)
  const markedDates = useMemo<MarkedDates>(() => {
    const marked: MarkedDates = {};
    const selectedKey = toDateString(selectedDate);

    // Mark selected day
    marked[selectedKey] = {
      selected: true,
      selectedColor: "#0D7C8A",
    };

    // Add dots for days with appointments
    if (monthAppointments) {
      const byDay: Record<string, Set<string>> = {};
      for (const apt of monthAppointments as Appointment[]) {
        const dayKey = toDateString(new Date(apt.startTime));
        if (!byDay[dayKey]) byDay[dayKey] = new Set();
        byDay[dayKey].add(apt.status);
      }
      for (const [dayKey, statuses] of Object.entries(byDay)) {
        if (marked[dayKey]) {
          // Merge dots with selected state
          marked[dayKey] = {
            ...marked[dayKey],
            dots: Array.from(statuses)
              .slice(0, 4)
              .map((s) => ({
                key: s,
                color:
                  STATUS_META[s as AppointmentStatus]?.dotColor || "#0D7C8A",
              })),
          };
        } else {
          marked[dayKey] = {
            dots: Array.from(statuses)
              .slice(0, 4)
              .map((s) => ({
                key: s,
                color:
                  STATUS_META[s as AppointmentStatus]?.dotColor || "#0D7C8A",
              })),
          };
        }
      }
    }

    return marked;
  }, [monthAppointments, selectedDate]);

  // Filter day appointments by status
  const filteredAppointments = useMemo(() => {
    if (!dayAppointments) return [];
    const sorted = [...(dayAppointments as Appointment[])].sort(
      (a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );
    if (statusFilter === "all") return sorted;
    return sorted.filter((a) => a.status === statusFilter);
  }, [dayAppointments, statusFilter]);

  const handleDayPress = useCallback((day: DateData) => {
    setSelectedDate(new Date(day.year, day.month - 1, day.day));
  }, []);

  const handleMonthChange = useCallback((month: DateData) => {
    setCalendarMonth({ year: month.year, month: month.month });
  }, []);

  const onRefresh = useCallback(() => {
    refetchMonth();
    refetchDay();
  }, [refetchMonth, refetchDay]);

  // ── Appointment card ───────────────────────────────────────────────────────

  const renderAppointment = ({ item }: { item: Appointment }) => {
    const statusMeta = STATUS_META[item.status];
    const typeMeta = TYPE_META[item.type];

    return (
      <Pressable
        onPress={() =>
          navigation.navigate("AppointmentDetail", { appointmentId: item.id })
        }
      >
        <Card className="mb-2 rounded-xl p-4" size="default">
          <HStack className="items-center" space="md">
            {/* Time column */}
            <VStack className="items-center w-16" space="xs">
              <Text className="font-bold text-foreground text-sm">
                {formatTime(item.startTime)}
              </Text>
              <Text size="xs" className="text-muted-foreground">
                {formatTime(item.endTime)}
              </Text>
            </VStack>

            {/* Vertical divider */}
            <Box className="w-px h-12 bg-border" />

            {/* Content */}
            <VStack className="flex-1" space="xs">
              <Text className="font-semibold text-foreground" numberOfLines={1}>
                {item.patientName || "Unknown Patient"}
              </Text>
              <Text
                size="xs"
                className="text-muted-foreground"
                numberOfLines={1}
              >
                {typeMeta.label} · {item.providerName}
              </Text>
              <HStack className="gap-1.5 mt-0.5">
                <Badge
                  variant="solid"
                  className={`${statusMeta.bgClass} border-0`}
                >
                  <BadgeText className={statusMeta.textClass}>
                    {statusMeta.label}
                  </BadgeText>
                </Badge>
                {item.isTelehealth && (
                  <Badge variant="solid" className="bg-cyan-100 border-0">
                    <BadgeText className="text-cyan-700">Video</BadgeText>
                  </Badge>
                )}
              </HStack>
            </VStack>
          </HStack>
        </Card>
      </Pressable>
    );
  };

  // ── Status filter chips ────────────────────────────────────────────────────

  const statusChips: Array<{ key: AppointmentStatus | "all"; label: string }> =
    [
      { key: "all", label: "All" },
      ...APPOINTMENT_STATUS_FILTERABLE.map((s) => ({
        key: s,
        label: STATUS_META[s].label,
      })),
    ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Box className="flex-1 bg-background">
      {/* Calendar */}
      <Calendar
        current={toDateString(selectedDate)}
        onDayPress={handleDayPress}
        onMonthChange={handleMonthChange}
        markedDates={markedDates}
        markingType="multi-dot"
        theme={{
          todayTextColor: "#0D7C8A",
          selectedDayBackgroundColor: "#0D7C8A",
          selectedDayTextColor: "#ffffff",
          dotColor: "#0D7C8A",
          arrowColor: "#0D7C8A",
          monthTextColor: "#1a2b3c",
          textDayFontSize: 14,
          textMonthFontSize: 16,
          textDayHeaderFontSize: 12,
          calendarBackground: "#ffffff",
          textDisabledColor: "#d1d5db",
        }}
        style={{
          borderBottomWidth: 1,
          borderBottomColor: "#e2e8f0",
        }}
      />

      {/* Status filter chips */}
      <FlatList
        horizontal
        data={statusChips}
        keyExtractor={(item) => item.key}
        showsHorizontalScrollIndicator={false}
        style={{ maxHeight: 48 }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingVertical: 8,
          alignItems: "center",
        }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setStatusFilter(item.key)}
            className={`self-start mr-2 px-3 py-1.5 rounded-full ${
              statusFilter === item.key ? "bg-primary" : "bg-muted/50"
            }`}
          >
            <Text
              size="sm"
              className={
                statusFilter === item.key
                  ? "text-white"
                  : "text-muted-foreground"
              }
            >
              {item.label}
            </Text>
          </Pressable>
        )}
      />

      {/* Day header */}
      <HStack className="px-4 pb-2 justify-between items-center">
        <Heading size="md" className="text-foreground">
          {isToday(toDateString(selectedDate))
            ? "Today's Schedule"
            : selectedDate.toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
        </Heading>
        <Text size="sm" className="text-muted-foreground">
          {filteredAppointments.length}{" "}
          {filteredAppointments.length === 1 ? "appt" : "appts"}
        </Text>
      </HStack>

      {/* Appointment list */}
      {dayLoading ? (
        <Box className="flex-1 justify-center items-center">
          <CustomSpinner size={48} />
        </Box>
      ) : (
        <FlatList
          data={filteredAppointments}
          keyExtractor={(item) => item.id}
          renderItem={renderAppointment}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 80 }}
          refreshControl={
            <RefreshControl
              refreshing={refetchingDay || refetchingMonth}
              onRefresh={onRefresh}
            />
          }
          ListEmptyComponent={
            <VStack className="items-center py-16" space="sm">
              <Text className="text-muted-foreground text-lg">
                No appointments
              </Text>
              <Text size="sm" className="text-muted-foreground">
                {isToday(selectedDate.toISOString())
                  ? "You have no appointments scheduled for today"
                  : "No appointments scheduled for this date"}
              </Text>
            </VStack>
          }
        />
      )}

      {/* New Appointment button — bottom right, same style as Create Appointment button */}
      <View
        style={{
          position: "absolute",
          bottom: 24,
          right: 20,
          left: 20,
          zIndex: 100,
          elevation: 100,
        }}
      >
        <Button
          onPress={() => navigation.navigate("CreateAppointment")}
          size="lg"
          className="rounded-lg"
        >
          <ButtonText>New Appointment</ButtonText>
        </Button>
      </View>
    </Box>
  );
};

// Subset of statuses that make sense as filters
const APPOINTMENT_STATUS_FILTERABLE: AppointmentStatus[] = [
  "scheduled",
  "confirmed",
  "checked_in",
  "in_progress",
  "completed",
  "cancelled",
  "no_show",
];
