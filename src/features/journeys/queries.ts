import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Journey } from '../../types'
import { addJourney, loadJourneys, updateJourney } from './storage'
import { loadAllExpenses } from '../expenses/storage'

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms))
}

export function useJourneysQuery() {
  return useQuery({
    queryKey: ['journeys'],
    queryFn: async (): Promise<Journey[]> => {
      await sleep(200)
      return loadJourneys()
    },
  })
}

export function useJourneyQuery(journeyId: string | undefined) {
  return useQuery({
    queryKey: ['journeys', journeyId],
    enabled: !!journeyId,
    queryFn: async (): Promise<Journey> => {
      await sleep(150)
      const found = loadJourneys().find((j) => j.id === journeyId)
      if (!found) throw new Error('여정을 찾을 수 없어요.')
      return found
    },
  })
}

export function useExpensesQuery(journeyId: string | undefined) {
  return useQuery({
    queryKey: ['expenses', journeyId],
    enabled: !!journeyId,
    queryFn: async () => {
      await sleep(150)
      return loadAllExpenses().filter((e) => e.journeyId === journeyId)
    },
  })
}

export function useAllExpensesQuery() {
  return useQuery({
    queryKey: ['expenses'],
    queryFn: async () => {
      await sleep(150)
      return loadAllExpenses()
    },
  })
}

export function useCreateJourneyMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (journey: Journey) => {
      await sleep(150)
      return addJourney(journey)
    },
    onSuccess: (journeys) => {
      qc.setQueryData(['journeys'], journeys)
    },
  })
}

export function useUpdateJourneyMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string
      patch: Partial<Journey>
    }) => {
      await sleep(150)
      return updateJourney(id, patch)
    },
    onSuccess: (journeys, { id }) => {
      qc.setQueryData(['journeys'], journeys)
      const updated = journeys.find((j) => j.id === id)
      if (updated) qc.setQueryData(['journeys', id], updated)
    },
  })
}

