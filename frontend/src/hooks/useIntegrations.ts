import { useEffect, useState, useCallback } from 'react';
import { integrationService, type Integration } from '../services/integrationService';

export interface UseIntegrationsResult {
  integrations: Integration[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  isEnabled: (key: string) => boolean;
}

export function useIntegrations(): UseIntegrationsResult {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await integrationService.findAll();
      setIntegrations(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const isEnabled = useCallback(
    (key: string) => integrations.some((i) => i.key === key && i.enabled),
    [integrations],
  );

  return { integrations, loading, error, refetch, isEnabled };
}
