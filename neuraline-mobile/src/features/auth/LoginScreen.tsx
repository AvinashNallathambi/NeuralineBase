/**
 * Login Screen — staff authentication.
 *
 * Mirrors the web app's LoginPage.tsx flow:
 * 1. Fetch RSA public key from /auth/public-key
 * 2. Encrypt password with RSA-OAEP (react-native-quick-crypto)
 * 3. POST /auth/login with encrypted password
 * 4. On success: save token to keychain, hydrate auth store
 *
 * HIPAA: Password is encrypted before leaving the device. No PHI
 * is stored. Token goes to Keychain (not AsyncStorage).
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import {
  Text,
  TextInput,
  Button,
  Card,
  Title,
  Paragraph,
  ActivityIndicator,
  HelperText,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { authApi } from '../../services';
import { encryptPassword } from '../../services';
import { saveSecureToken } from '../../services';
import { useAuthStore } from '../../store';
import { colors } from '../../theme';

type LoginNavProp = NativeStackNavigationProp<{ Login: undefined; ForgotPassword: undefined }, 'Login'>;

export const LoginScreen: React.FC = () => {
  const navigation = useNavigation<LoginNavProp>();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = useCallback(async () => {
    if (!email || !password) {
      setError('Email and password are required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Step 1: Fetch RSA public key
      const { publicKey } = await authApi.getPublicKey();

      // Step 2: Encrypt password with RSA-OAEP
      const encryptedPassword = encryptPassword(password, publicKey);

      // Step 3: Login
      const response = await authApi.login({
        email,
        password: encryptedPassword,
        tenantId: tenantId || undefined,
      });

      // Step 4: Save token to keychain
      await saveSecureToken('staff', response.accessToken, response.refreshToken);

      // Step 5: Hydrate auth store (navigates to StaffApp automatically)
      setAuth(response.user, response.accessToken, response.tenant, response.refreshToken);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Login failed';
      setError(typeof msg === 'string' ? msg : 'Login failed');
    } finally {
      setLoading(false);
    }
  }, [email, password, tenantId, setAuth]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.container}>
          <View style={styles.logoContainer}>
            <Text style={styles.appName}>Neuraline</Text>
            <Text style={styles.tagline}>Electronic Medical Records</Text>
          </View>

          <Card style={styles.card}>
            <Card.Content>
              <Title style={styles.title}>Sign In</Title>
              <Paragraph style={styles.subtitle}>
                Enter your credentials to access the EMR
              </Paragraph>

              <TextInput
                label="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                style={styles.input}
                disabled={loading}
              />

              <TextInput
                label="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                style={styles.input}
                disabled={loading}
              />

              <TextInput
                label="Tenant ID (optional)"
                value={tenantId}
                onChangeText={setTenantId}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
                disabled={loading}
              />

              {error && (
                <HelperText type="error" visible={!!error}>
                  {error}
                </HelperText>
              )}

              <Button
                mode="contained"
                onPress={handleLogin}
                disabled={loading}
                style={styles.loginButton}
              >
                {loading ? <ActivityIndicator color="#fff" /> : 'Sign In'}
              </Button>

              <Button
                mode="text"
                onPress={() => navigation.navigate('ForgotPassword')}
                disabled={loading}
              >
                Forgot Password?
              </Button>
            </Card.Content>
          </Card>

          <Text style={styles.hipaaNotice}>
            Protected health information is encrypted and never stored on device.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.background,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  appName: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.primary,
  },
  tagline: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  card: {
    borderRadius: 12,
    padding: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 4,
  },
  subtitle: {
    color: colors.textSecondary,
    marginBottom: 24,
  },
  input: {
    marginBottom: 12,
  },
  loginButton: {
    marginTop: 8,
    marginBottom: 8,
    paddingVertical: 6,
  },
  hipaaNotice: {
    textAlign: 'center',
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 24,
    paddingHorizontal: 16,
  },
});
