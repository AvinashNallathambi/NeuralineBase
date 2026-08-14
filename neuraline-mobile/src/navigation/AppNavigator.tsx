/**
 * App Navigator — root navigator that decides:
 * - AuthNavigator (Login / BiometricUnlock) when not authenticated
 * - StaffNavigator (main app) when authenticated
 *
 * On app cold start, attempts to restore the session from the keychain.
 */
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { ActivityIndicator, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../services';
import { navigationRef } from '../services';
import { getStoredAuth } from '../services';
import { useAuthStore } from '../store';
import { useSessionTimeout } from '../services';

import { AuthNavigator } from './AuthNavigator';
import { StaffNavigator } from './StaffNavigator';
import type { User, Tenant } from '@neuraline/shared';

const RootStack = createNativeStackNavigator<RootStackParamList>();

const LoadingScreen: React.FC = () => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <ActivityIndicator size="large" color="#0D7C8A" />
  </View>
);

// Placeholder user/tenant — real implementation calls authApi.me()
const PLACEHOLDER_USER: User = {
  id: '', email: '', firstName: '', lastName: '',
  role: 'doctor', tenantId: '', mfaEnabled: false,
  isActive: true, createdAt: '', updatedAt: '',
};

const PLACEHOLDER_TENANT: Tenant = {
  id: '', name: 'Neuraline', slug: '', address: '', phone: '', email: '',
  subscription: 'basic', isActive: true,
};

export const AppNavigator: React.FC = () => {
  const { isAuthenticated, isLoading, setAuth, setLoading } = useAuthStore();

  // Session timeout — clears in-memory state when app is backgrounded too long
  useSessionTimeout();

  // Restore session from keychain on cold start
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const stored = await getStoredAuth('staff');
        if (stored?.token) {
          // We have a token — hydrate the store.
          // TODO: call authApi.me() to validate and get fresh user/tenant
          setAuth(
            PLACEHOLDER_USER,
            stored.token,
            PLACEHOLDER_TENANT,
            stored.refreshToken,
          );
        } else {
          setLoading(false);
        }
      } catch {
        setLoading(false);
      }
    };

    restoreSession();
  }, [setAuth, setLoading]);

  if (isLoading) {
    return (
      <NavigationContainer ref={navigationRef}>
        <RootStack.Navigator screenOptions={{ headerShown: false }}>
          <RootStack.Screen name="Loading" component={LoadingScreen} />
        </RootStack.Navigator>
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <RootStack.Screen name="StaffApp" component={StaffNavigator} />
        ) : (
          <RootStack.Screen name="Auth" component={AuthNavigator} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
};
