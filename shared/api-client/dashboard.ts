/**
 * Dashboard API client — pure functions, no platform dependencies.
 */
import type { AxiosInstance } from 'axios';
import type { DashboardStats } from '../types';

export class DashboardApi {
  constructor(private http: AxiosInstance) {}

  getStats(): Promise<DashboardStats> {
    return this.http.get('/dashboard/stats').then((r) => r.data);
  }
}
