import { apiFetch } from '@/lib/api';

export interface ReportData {
  tripId: string;
  generatedAt: string;
  statistics: {
    totalAmountKrw: number;
    mostSpentCategory: string;
    dailyAverageKrw: number;
    expenseCount: number;
  };
  report: {
    title: string;
    consumptionStyle: string;
    totalAnalysis: string;
    categoryInsights: Array<{
      category: string;
      amount: number;
      insight: string;
    }>;
    suggestions: string[];
  };
}

export async function getReport(journeyId: string): Promise<ReportData> {
  return apiFetch<ReportData>(`/trips/${journeyId}/report`);
}
