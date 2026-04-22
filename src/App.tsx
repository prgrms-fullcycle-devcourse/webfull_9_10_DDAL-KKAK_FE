import { Navigate, Route, Routes } from 'react-router-dom'
import { PhoneFrame } from './components/PhoneFrame'
import { LoginPage } from './pages/LoginPage'
import { HomePage } from './pages/HomePage'
import { JourneyCreatePage } from './pages/JourneyCreatePage'
import { JourneyTimelinePage } from './pages/JourneyTimelinePage'
import { ScanPage } from './pages/ScanPage'
import { OcrPreviewPage } from './pages/OcrPreviewPage'
import { ReportPage } from './pages/ReportPage'
import { SettingsPage } from './pages/SettingsPage'
import { InsightPage } from './pages/InsightPage'
import { RequireAuth } from './features/auth/RequireAuth'

export default function App() {
  return (
    <div className="min-h-dvh">
      <PhoneFrame>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/"
            element={
              <RequireAuth>
                <HomePage />
              </RequireAuth>
            }
          />
          <Route
            path="/journeys/new"
            element={
              <RequireAuth>
                <JourneyCreatePage />
              </RequireAuth>
            }
          />
          <Route
            path="/journeys/:journeyId/edit"
            element={
              <RequireAuth>
                <JourneyCreatePage />
              </RequireAuth>
            }
          />
          <Route
            path="/journeys/:journeyId"
            element={
              <RequireAuth>
                <JourneyTimelinePage />
              </RequireAuth>
            }
          />
          <Route
            path="/journeys/:journeyId/scan"
            element={
              <RequireAuth>
                <ScanPage />
              </RequireAuth>
            }
          />
          <Route
            path="/journeys/:journeyId/ocr-preview"
            element={
              <RequireAuth>
                <OcrPreviewPage />
              </RequireAuth>
            }
          />
          <Route
            path="/journeys/:journeyId/report"
            element={
              <RequireAuth>
                <ReportPage />
              </RequireAuth>
            }
          />
          <Route
            path="/journeys/:journeyId/insight"
            element={
              <RequireAuth>
                <InsightPage />
              </RequireAuth>
            }
          />
          <Route
            path="/settings"
            element={
              <RequireAuth>
                <SettingsPage />
              </RequireAuth>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </PhoneFrame>
    </div>
  )
}
