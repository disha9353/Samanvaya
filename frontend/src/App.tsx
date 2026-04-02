import { useTranslation } from 'react-i18next';
import { Routes, Route, Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux'

import type { RootState } from './store/types'

import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import LandingPage from './pages/LandingPage'
import FeedPage from './pages/FeedPage'
import CreateItemPage from './pages/CreateItemPage'
import ItemDetailsPage from './pages/ItemDetailsPage'
import ChatPage from './pages/ChatPage'
import DashboardPage from './pages/DashboardPage'
import WastePickupPage from './pages/WastePickupPage'
import ProfilePage from './pages/ProfilePage'
import WalletPage from './pages/WalletPage'
import AppLayout from './components/layout/AppLayout'
import CampaignsPage from './pages/CampaignsPage'
import CreateCampaignPage from './pages/CreateCampaignPage'
import CampaignDetailsPage from './pages/CampaignDetailsPage'
import AdminPage from './pages/AdminPage'
import ReportSubmissionPage from './pages/ReportSubmissionPage'
import ReportsFeedPage from './pages/ReportsFeedPage'
import NotificationsPage from './pages/NotificationsPage'

function Protected({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const user = useSelector((s: RootState) => s.auth.user)
  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'admin') return <Navigate to="/admin" replace />
  return children
}

function AdminProtected({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const user = useSelector((s: RootState) => s.auth.user)
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'admin') return <Navigate to="/dashboard" replace />
  return children
}

export default function App() {
  const { t } = useTranslation();
  const user = useSelector((s: RootState) => s.auth.user)

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={user?.role === 'admin' ? <Navigate to="/admin" replace /> : <LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route
          path="/feed"
          element={
            <Protected>
              <FeedPage />
            </Protected>
          }
        />
        <Route
          path="/campaigns"
          element={
            <Protected>
              <CampaignsPage />
            </Protected>
          }
        />
        <Route
          path="/campaigns/create"
          element={
            <Protected>
              <CreateCampaignPage />
            </Protected>
          }
        />
        <Route
          path="/campaigns/:id"
          element={
            <Protected>
              <CampaignDetailsPage />
            </Protected>
          }
        />
        <Route
          path="/items/new"
          element={
            <Protected>
              <CreateItemPage />
            </Protected>
          }
        />
        <Route
          path="/items/:id"
          element={
            <Protected>
              <ItemDetailsPage />
            </Protected>
          }
        />
        <Route
          path="/chat"
          element={
            <Protected>
              <ChatPage />
            </Protected>
          }
        />
        <Route
          path="/chat/:otherUserId"
          element={
            <Protected>
              <ChatPage />
            </Protected>
          }
        />
        <Route
          path="/dashboard"
          element={
            <Protected>
              <DashboardPage />
            </Protected>
          }
        />
        <Route
          path="/waste"
          element={
            <Protected>
              <WastePickupPage />
            </Protected>
          }
        />
        <Route
          path="/profile"
          element={
            <Protected>
              <ProfilePage />
            </Protected>
          }
        />
        <Route
          path="/wallet"
          element={
            <Protected>
              <WalletPage />
            </Protected>
          }
        />
        <Route
          path="/admin"
          element={
            <AdminProtected>
              <AdminPage />
            </AdminProtected>
          }
        />
        <Route
          path="/reports/new"
          element={
            <Protected>
              <ReportSubmissionPage />
            </Protected>
          }
        />
        <Route
          path="/reports"
          element={
            <Protected>
              <ReportsFeedPage />
            </Protected>
          }
        />
        <Route
          path="/notifications"
          element={
            <Protected>
              <NotificationsPage />
            </Protected>
          }
        />

        <Route path="*" element={<div className="p-6 text-white/80">{t('auto.not_found', `Not found`)}</div>} />
      </Routes>
    </AppLayout>
  )
}

