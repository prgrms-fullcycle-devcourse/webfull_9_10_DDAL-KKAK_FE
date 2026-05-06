import { apiClient } from '@/lib/apiClient';
import type { Journey } from './types';

export async function fetchTrips(): Promise<Journey[]> {
  const { data } = await apiClient.get<Journey[]>('/trips');
  return data;
}

export async function fetchTrip(tripId: string): Promise<Journey> {
  const { data } = await apiClient.get<Journey>(`/trips/${tripId}`);
  return data;
}

export async function updateTrip(tripId: string, patch: Partial<Journey>): Promise<Journey> {
  const { data } = await apiClient.patch<Journey>(`/trips/${tripId}`, patch);
  return data;
}

export type CreateTripInput = Omit<Journey, 'id'>;

export async function createTrip(input: CreateTripInput): Promise<Journey> {
  const { data } = await apiClient.post<Journey>('/trips', input);
  return data;
}
