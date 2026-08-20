/**
 * Auth Navigator — Login, BiometricUnlock, ForgotPassword.
 *
 * Shown when the user is not authenticated.
 */
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import type { RootStackParamList } from '../services';

import { LoginScreen } from '../features/auth/LoginScreen';
import { BiometricUnlockScreen } from '../features/auth/BiometricUnlockScreen';
import { ForgotPasswordScreen } from '../features/auth/ForgotPasswordScreen';

const Stack = createStackNavigator<RootStackParamList>();

export const AuthNavigator: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="BiometricUnlock" component={BiometricUnlockScreen} />
      <Stack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
        options={{ headerShown: true, title: 'Forgot Password' }}
      />
    </Stack.Navigator>
  );
};
