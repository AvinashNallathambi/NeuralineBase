/**
 * Staff Navigator — main app for clinicians/admins.
 *
 * Uses a stack navigator for local testing (drawer requires reanimated JSI).
 */
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { DashboardScreen } from '../features/dashboard/DashboardScreen';
import { PatientListScreen } from '../features/patients/PatientListScreen';
import { AppointmentsScreen } from '../features/appointments/AppointmentsScreen';
import { AppointmentDetailScreen } from '../features/appointments/AppointmentDetailScreen';
import { CreateAppointmentScreen } from '../features/appointments/CreateAppointmentScreen';

export type StaffDrawerParamList = {
  Dashboard: undefined;
  Patients: undefined;
  Appointments: undefined;
  AppointmentDetail: { appointmentId: string };
  CreateAppointment: { appointmentId?: string } | undefined;
};

const Stack = createStackNavigator<StaffDrawerParamList>();

export const StaffNavigator: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: true }}>
      <Stack.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ title: 'Dashboard' }}
      />
      <Stack.Screen
        name="Patients"
        component={PatientListScreen}
        options={{ title: 'Patients' }}
      />
      <Stack.Screen
        name="Appointments"
        component={AppointmentsScreen}
        options={{ title: 'Appointments' }}
      />
      <Stack.Screen
        name="AppointmentDetail"
        component={AppointmentDetailScreen}
        options={{ title: 'Appointment Details' }}
      />
      <Stack.Screen
        name="CreateAppointment"
        component={CreateAppointmentScreen}
        options={{ title: 'New Appointment' }}
      />
    </Stack.Navigator>
  );
};
