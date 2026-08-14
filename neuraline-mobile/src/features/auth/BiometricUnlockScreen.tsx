/**
 * Biometric Unlock Screen — Face ID / Touch ID / fingerprint gate.
 *
 * Shown when the user returns to the app after backgrounding.
 * The keychain token is only restored after successful biometric auth.
 */
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Text, Button, ActivityIndicator } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { biometricPrompt, checkBiometricAvailability, getStoredAuth } from '../../services';
import { useAuthStore } from '../../store';
import { colors } from '../../theme';
import type { User, Tenant } from '@neuraline/shared';

const PLACEHOLDER_USER: User = {
  id: '', email: '', firstName: '', lastName: '',
  role: 'doctor', tenantId: '', mfaEnabled: false,
  isActive: true, createdAt: '', updatedAt: '',
};

const PLACEHOLDER_TENANT: Tenant = {
  id: '', name: 'Neuraline', slug: '', address: '', phone: '', email: '',
  subscription: 'basic', isActive: true,
};

export const BiometricUnlockScreen: React.FC = () => {
  const { setAuth, logout } = useAuthStore();
  const [checking, setChecking] = useState(true);
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    const init = async () => {
      const result = await checkBiometricAvailability();
      setAvailable(result.available);
      setChecking(false);

      if (result.available) {
        await handleUnlock();
      }
    };
    init();
  }, []);

  const handleUnlock = async () => {
    const success = await biometricPrompt('Authenticate to unlock Neuraline');
    if (!success) {
      Alert.alert('Authentication Failed', 'Please try again or sign in manually.');
      return;
    }

    const stored = await getStoredAuth('staff');
    if (stored?.token) {
      // Re-hydrate the auth store from keychain
      // TODO: validate token with authApi.me() for fresh user/tenant
      setAuth(PLACEHOLDER_USER, stored.token, PLACEHOLDER_TENANT, stored.refreshToken);
    } else {
      logout();
    }
  };

  if (checking) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Icon name="fingerprint" size={80} color={colors.primary} />
      <Text style={styles.title}>Biometric Unlock</Text>
      <Text style={styles.subtitle}>
        Authenticate with {available ? 'Face ID / Touch ID' : 'your passcode'} to continue
      </Text>

      <Button
        mode="contained"
        onPress={handleUnlock}
        style={styles.button}
      >
        Unlock
      </Button>

      <Button
        mode="text"
        onPress={() => logout()}
        textColor={colors.error}
      >
        Sign in manually
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  button: {
    paddingHorizontal: 32,
    marginBottom: 16,
  },
});
