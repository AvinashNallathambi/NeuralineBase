import React from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe, type Stripe } from '@stripe/stripe-js';

// Load Stripe with publishable key from env (falls back to test key for dev)
const stripePublishableKey =
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_mock';

let stripePromise: Promise<Stripe | null> | null = null;

function getStripe() {
  if (!stripePromise) {
    stripePromise = loadStripe(stripePublishableKey).catch((err) => {
      console.error('Failed to load Stripe:', err);
      return null;
    });
  }
  return stripePromise;
}

interface StripeProviderProps {
  clientSecret: string;
  children: React.ReactNode;
}

/**
 * Wraps children in Stripe Elements context using a SetupIntent client secret.
 * Used by the UpdatePaymentMethodModal to render Stripe Payment Element.
 */
export const StripeSetupProvider: React.FC<StripeProviderProps> = ({
  clientSecret,
  children,
}) => {
  const options = {
    clientSecret,
    appearance: {
      theme: 'stripe' as const,
      variables: {
        colorPrimary: '#0D7C8A',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      },
    },
  };

  return (
    <Elements stripe={getStripe()} options={options}>
      {children}
    </Elements>
  );
};

export default StripeSetupProvider;
