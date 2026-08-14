/**
 * @neuraline/shared/api-client — platform-agnostic HTTP client factory.
 *
 * This module creates a bare axios instance with NO interceptors. Each app
 * (web, React Native) wraps it with its own token-storage and redirect logic.
 */
import axios, { type AxiosInstance } from 'axios';

export interface ApiClientConfig {
  baseURL: string;
  timeout?: number;
}

export function createApiClient(config: ApiClientConfig): AxiosInstance {
  return axios.create({
    baseURL: config.baseURL,
    timeout: config.timeout ?? 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export { axios };
