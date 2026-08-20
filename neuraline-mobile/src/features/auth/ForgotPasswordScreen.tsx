/**
 * Forgot Password Screen — staff password reset request (Gluestack UI v5).
 */
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';

import { authApi } from '../../services';

import { VStack } from '@/components/ui/vstack';
import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import { Heading } from '@/components/ui/heading';
import { Input, InputField } from '@/components/ui/input';
import { Button, ButtonText } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export const ForgotPasswordScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!email) {
      setError('Email is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await authApi.forgotPassword(email, tenantId || undefined);
      setSent(true);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <Box className="flex-1 justify-center bg-background p-6">
        <Card className="rounded-xl p-6" size="default">
          <VStack space="md">
            <Heading size="lg" className="text-foreground">Forgot Password</Heading>
            <Text size="sm" className="text-muted-foreground">
              Enter your email and we'll send you a reset link.
            </Text>

            {sent ? (
              <Box className="bg-success/10 rounded-lg px-4 py-4 mt-2">
                <Text className="text-success" size="sm">
                  If an account exists for {email}, a password reset link has been sent.
                </Text>
              </Box>
            ) : (
              <VStack space="md">
                <VStack space="xs">
                  <Text size="sm" className="text-foreground font-medium">Email</Text>
                  <Input className="rounded-lg" variant="outline">
                    <InputField
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      placeholder="Enter your email"
                      editable={!loading}
                    />
                  </Input>
                </VStack>

                <VStack space="xs">
                  <Text size="sm" className="text-foreground font-medium">Tenant ID (optional)</Text>
                  <Input className="rounded-lg" variant="outline">
                    <InputField
                      value={tenantId}
                      onChangeText={setTenantId}
                      autoCapitalize="none"
                      placeholder="Enter tenant ID"
                      editable={!loading}
                    />
                  </Input>
                </VStack>

                {error && (
                  <Box className="bg-destructive/10 rounded-lg px-4 py-3">
                    <Text size="sm" className="text-destructive">{error}</Text>
                  </Box>
                )}

                <Button
                  onPress={handleSubmit}
                  disabled={loading}
                  className="rounded-lg"
                  size="lg"
                >
                  <ButtonText>{loading ? 'Sending...' : 'Send Reset Link'}</ButtonText>
                </Button>
              </VStack>
            )}
          </VStack>
        </Card>
      </Box>
    </KeyboardAvoidingView>
  );
};
