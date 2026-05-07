import { apiFetch } from '@/lib/api';
import type { Journey } from './types';

export async function fetchTrips(): Promise<Journey[]> {
  return apiFetch<Journey[]>('/trips');
}

export async function fetchTrip(tripId: string): Promise<Journey> {
  return apiFetch<Journey>(`/trips/${tripId}`);
}

export type CreateTripInput = Omit<Journey, 'id'>;

export async function createTrip(input: CreateTripInput): Promise<Journey> {
  return apiFetch<Journey>('/trips', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateTrip(tripId: string, patch: Partial<Journey>): Promise<Journey> {
  return apiFetch<Journey>(`/trips/${tripId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function deleteTrip(tripId: string): Promise<void> {
  return apiFetch<void>(`/trips/${tripId}`, { method: 'DELETE' });
}
