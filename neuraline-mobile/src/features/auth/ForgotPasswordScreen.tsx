/**
 * Forgot Password Screen — staff password reset request.
 */
import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, TextInput, Button, Card, Title, HelperText } from 'react-native-paper';

import { authApi } from '../../services';
import { colors } from '../../theme';

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
      <View style={styles.container}>
        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.title}>Forgot Password</Title>
            <Text style={styles.subtitle}>
              Enter your email and we'll send you a reset link.
            </Text>

            {sent ? (
              <Text style={styles.successText}>
                If an account exists for {email}, a password reset link has been sent.
              </Text>
            ) : (
              <>
                <TextInput
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={styles.input}
                  disabled={loading}
                />
                <TextInput
                  label="Tenant ID (optional)"
                  value={tenantId}
                  onChangeText={setTenantId}
                  autoCapitalize="none"
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
                  onPress={handleSubmit}
                  disabled={loading}
                  style={styles.button}
                >
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </Button>
              </>
            )}
          </Card.Content>
        </Card>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.background,
  },
  card: {
    borderRadius: 12,
    padding: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
  },
  subtitle: {
    color: colors.textSecondary,
    marginBottom: 24,
  },
  input: {
    marginBottom: 12,
  },
  button: {
    marginTop: 8,
    paddingVertical: 6,
  },
  successText: {
    color: colors.success,
    fontSize: 14,
    lineHeight: 20,
    marginVertical: 16,
  },
});
