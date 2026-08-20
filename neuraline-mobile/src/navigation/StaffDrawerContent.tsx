/**
 * Staff Drawer Content — sidebar menu for the staff app.
 *
 * Mirrors the web app's MainLayout sidebar (frontend/src/layouts/MainLayout.tsx).
 * Shows navigation items + user info + logout.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { DrawerContentScrollView, DrawerItem } from '@react-navigation/drawer';
import { Text, Avatar, Divider, Button } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import { useAuthStore } from '../store';
import { clearSecureToken } from '../services';

const MENU_ITEMS = [
  { label: 'Dashboard', icon: 'view-dashboard', route: 'Dashboard' },
  { label: 'Patients', icon: 'account-group', route: 'Patients' },
  { label: 'Appointments', icon: 'calendar', route: 'Appointments' },
  // TODO: add remaining modules as screens are built
  // { label: 'Clinical', icon: 'file-document-edit', route: 'Clinical' },
  // { label: 'Prescriptions', icon: 'pill', route: 'Prescriptions' },
  // { label: 'Laboratory', icon: 'test-tube', route: 'Laboratory' },
  // { label: 'Billing', icon: 'currency-usd', route: 'Billing' },
  // { label: 'Telemedicine', icon: 'video', route: 'Telemedicine' },
  // { label: 'Messaging', icon: 'message', route: 'Messaging' },
  // { label: 'Settings', icon: 'cog', route: 'Settings' },
];

export const StaffDrawerContent: React.FC<DrawerContentComponentProps> = ({
  navigation,
}) => {
  const { user, tenant, logout } = useAuthStore();

  const handleLogout = async () => {
    await clearSecureToken('staff');
    logout();
    navigation.closeDrawer();
  };

  return (
    <DrawerContentScrollView>
      {/* Header: tenant + user */}
      <View style={styles.header}>
        <Avatar.Text
          size={48}
          label={user ? `${user.firstName[0]}${user.lastName[0]}` : 'N'}
          color="#fff"
          style={{ backgroundColor: '#0D7C8A' }}
        />
        <Text variant="titleMedium" style={styles.userName}>
          {user ? `${user.firstName} ${user.lastName}` : 'Neuraline'}
        </Text>
        <Text variant="bodySmall" style={styles.tenantName}>
          {tenant?.name || ''}
        </Text>
      </View>

      <Divider />

      {/* Menu items */}
      <View style={styles.menuContainer}>
        {MENU_ITEMS.map((item) => (
          <DrawerItem
            key={item.route}
            label={item.label}
            icon={({ size, color }) => (
              <Icon name={item.icon} size={size} color={color} />
            )}
            onPress={() => navigation.navigate(item.route as never)}
          />
        ))}
      </View>

      <Divider />

      {/* Logout */}
      <View style={styles.logoutContainer}>
        <Button
          mode="text"
          icon="logout"
          onPress={handleLogout}
          textColor="#ff4d4f"
        >
          Logout
        </Button>
      </View>
    </DrawerContentScrollView>
  );
};

const styles = StyleSheet.create({
  header: {
    padding: 16,
    alignItems: 'center',
  },
  userName: {
    marginTop: 8,
    fontWeight: '600',
  },
  tenantName: {
    color: '#64748b',
  },
  menuContainer: {
    paddingTop: 8,
  },
  logoutContainer: {
    padding: 16,
  },
});
