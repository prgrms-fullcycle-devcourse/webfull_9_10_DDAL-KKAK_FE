import { Navigate, Route, Routes } from 'react-router-dom';
import { PhoneFrame } from '@/components/layout/PhoneFrame';
import { ScrollToTop } from '@/components/layout/ScrollToTop';
import { ProtectedRoute } from '@/routes/ProtectedRoute';

import { AuthCallbackPage } from '@/pages/AuthCallbackPage';
import { LoginPage } from '@/pages/LoginPage';
import { OnboardingPage } from '@/pages/OnboardingPage';
import { HomePage } from '@/pages/HomePage';
import { JourneyCreatePage } from '@/pages/JourneyCreatePage';
import { JourneyTimelinePage } from '@/pages/JourneyTimelinePage';
import { ScanPage } from '@/pages/ScanPage';
import { OcrPreviewPage } from '@/pages/OcrPreviewPage';
import { ReportPage } from '@/pages/ReportPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { InsightPage } from '@/pages/InsightPage';
import { ExpenseCreatePage } from '@/pages/ExpenseCreatePage';
import { ExpenseEditPage } from '@/pages/ExpenseEditPage';

export default function App() {
  return (
    <div className="min-h-dvh">
      <PhoneFrame>
        <ScrollToTop />
        <Routes>
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/journeys/new" element={<JourneyCreatePage />} />
            <Route path="/journeys/:journeyId/edit" element={<JourneyCreatePage />} />
            <Route path="/journeys/:journeyId" element={<JourneyTimelinePage />} />
            <Route path="/journeys/:journeyId/scan" element={<ScanPage />} />
            <Route path="/journeys/:journeyId/ocr-preview" element={<OcrPreviewPage />} />
            <Route path="/journeys/:journeyId/report" element={<ReportPage />} />
            <Route path="/journeys/:journeyId/insight" element={<InsightPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/journeys/:journeyId/expenses/new" element={<ExpenseCreatePage />} />
            <Route
              path="/journeys/:journeyId/expenses/:expenseId/edit"
              element={<ExpenseEditPage />}
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </PhoneFrame>
    </div>
  );
}
