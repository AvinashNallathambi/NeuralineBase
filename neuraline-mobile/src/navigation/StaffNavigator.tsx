/**
 * Staff Navigator — main app for clinicians/admins.
 *
 * On tablets: a Drawer navigator with a wide sidebar.
 * On phones: a Drawer navigator with a standard hamburger menu.
 *
 * This is a scaffold — feature screens will be added incrementally.
 */
import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { DashboardScreen } from '../features/dashboard/DashboardScreen';
import { PatientListScreen } from '../features/patients/PatientListScreen';
import { useIsTablet } from '../hooks/useIsTablet';
import { StaffDrawerContent } from './StaffDrawerContent';

export type StaffDrawerParamList = {
  Dashboard: undefined;
  Patients: undefined;
  // TODO: Appointments, Clinical, Prescriptions, Laboratory, Billing,
  //       Telemedicine, Messaging, Settings, etc.
};

const Drawer = createDrawerNavigator<StaffDrawerParamList>();

export const StaffNavigator: React.FC = () => {
  const isTablet = useIsTablet();

  return (
    <Drawer.Navigator
      drawerContent={(props) => <StaffDrawerContent {...props} />}
      screenOptions={{
        drawerType: isTablet ? 'permanent' : 'front',
        drawerStyle: {
          width: isTablet ? 280 : 300,
        },
        headerShown: true,
      }}
    >
      <Drawer.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ title: 'Dashboard' }}
      />
      <Drawer.Screen
        name="Patients"
        component={PatientListScreen}
        options={{ title: 'Patients' }}
      />
    </Drawer.Navigator>
  );
};
