import { apiClient } from '@/lib/apiClient';
import type { Journey } from './types';

export async function fetchTrips(): Promise<Journey[]> {
  const { data } = await apiClient.get<Journey[]>('/trips');
  return data;
}
