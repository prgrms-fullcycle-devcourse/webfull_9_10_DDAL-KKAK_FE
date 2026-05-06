import { apiClient } from '@/lib/apiClient';
import type { Journey } from './types';

export async function fetchTrips(): Promise<Journey[]> {
  const { data } = await apiClient.get<Journey[]>('/trips');
  return data;
}

export type CreateTripInput = Omit<Journey, 'id'>;

export async function createTrip(input: CreateTripInput): Promise<Journey> {
  const { data } = await apiClient.post<Journey>('/trips', input);
  return data;
}
