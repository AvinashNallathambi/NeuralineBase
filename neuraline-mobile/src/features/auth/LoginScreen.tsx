/**
 * Login Screen — staff authentication (Gluestack UI v5).
 *
 * Flow:
 * 1. POST /auth/login with plain password (dev mode, no RSA encryption)
 * 2. Save token to keychain
 * 3. Hydrate auth store → navigates to StaffApp
 */
import React, { useState, useCallback } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { authApi } from '../../services';
import { saveSecureToken } from '../../services';
import { useAuthStore } from '../../store';

import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';
import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import { Heading } from '@/components/ui/heading';
import { Input, InputField } from '@/components/ui/input';
import { Button, ButtonText } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Card } from '@/components/ui/card';
import { Link } from '@/components/ui/link';

type LoginNavProp = NativeStackNavigationProp<{ Login: undefined; ForgotPassword: undefined }, 'Login'>;

export const LoginScreen: React.FC = () => {
  const navigation = useNavigation<LoginNavProp>();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [email, setEmail] = useState('dr.sarah.chen@neuraline.health');
  const [password, setPassword] = useState('Neuraline@2025');
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
      const response = await authApi.login({
        email,
        password,
        tenantId: tenantId || undefined,
      } as any);

      await saveSecureToken('staff', response.accessToken, response.refreshToken);
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
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="bg-background">
        <VStack className="flex-1 justify-center px-6 py-8" space="md">
          {/* Logo / Brand */}
          <VStack className="items-center mb-6" space="xs">
            <Box className="w-16 h-16 rounded-2xl bg-primary items-center justify-center mb-2">
              <Text className="text-3xl font-bold text-white">N</Text>
            </Box>
            <Heading size="2xl" className="text-primary">Neuraline</Heading>
            <Text size="sm" className="text-muted-foreground">Electronic Medical Records</Text>
          </VStack>

          {/* Login Card */}
          <Card className="p-6 rounded-xl" size="default">
            <VStack space="md">
              <Heading size="lg" className="text-foreground">Sign In</Heading>
              <Text size="sm" className="text-muted-foreground">
                Enter your credentials to access the EMR
              </Text>

              {/* Email */}
              <VStack space="xs">
                <Text size="sm" className="text-foreground font-medium">Email</Text>
                <Input className="rounded-lg" variant="outline">
                  <InputField
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    placeholder="Enter your email"
                    editable={!loading}
                  />
                </Input>
              </VStack>

              {/* Password */}
              <VStack space="xs">
                <Text size="sm" className="text-foreground font-medium">Password</Text>
                <Input className="rounded-lg" variant="outline">
                  <InputField
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    placeholder="Enter your password"
                    editable={!loading}
                  />
                </Input>
              </VStack>

              {/* Tenant ID */}
              <VStack space="xs">
                <Text size="sm" className="text-foreground font-medium">Tenant ID (optional)</Text>
                <Input className="rounded-lg" variant="outline">
                  <InputField
                    value={tenantId}
                    onChangeText={setTenantId}
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder="Enter tenant ID"
                    editable={!loading}
                  />
                </Input>
              </VStack>

              {/* Error */}
              {error && (
                <Box className="bg-destructive/10 rounded-lg px-4 py-3">
                  <Text size="sm" className="text-destructive">{error}</Text>
                </Box>
              )}

              {/* Sign In Button */}
              <Button
                onPress={handleLogin}
                disabled={loading}
                className="mt-2 rounded-lg"
                size="lg"
              >
                {loading ? (
                  <Spinner size="small" color="$white" />
                ) : (
                  <ButtonText>Sign In</ButtonText>
                )}
              </Button>

              {/* Forgot Password */}
              <HStack className="justify-center mt-2">
                <Link
                  onPress={() => navigation.navigate('ForgotPassword')}
                  isDisabled={loading}
                >
                  <Text className="text-primary" size="sm">Forgot Password?</Text>
                </Link>
              </HStack>
            </VStack>
          </Card>

          {/* HIPAA Notice */}
          <Text size="xs" className="text-center text-muted-foreground mt-6 px-4">
            Protected health information is encrypted and never stored on device.
          </Text>
        </VStack>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};
