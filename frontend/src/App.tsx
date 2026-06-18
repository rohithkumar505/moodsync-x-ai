import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import AppLayout from './components/AppLayout';
import HomePage, { NotFoundRedirect } from './components/HomePage';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegistrationPage = lazy(() => import('./pages/RegistrationPage'));
const MoodSyncPage = lazy(() => import('./pages/MoodSyncPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const JournalPage = lazy(() => import('./pages/JournalPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const EmotionDNAPage = lazy(() => import('./pages/EmotionDNAPage'));
const PlaylistsPage = lazy(() => import('./pages/PlaylistsPage'));
const MusicLibraryPage = lazy(() => import('./pages/MusicLibraryPage'));
const AchievementsPage = lazy(() => import('./pages/AchievementsPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const AdminLayout = lazy(() => import('./components/AdminLayout'));
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'));
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'));
const AdminUserDetailPage = lazy(() => import('./pages/admin/AdminUserDetailPage'));
const AdminActivityPage = lazy(() => import('./pages/admin/AdminActivityPage'));

function PageLoader() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div className="glass px-6 py-4 text-sm text-white/70">Loading…</div>
    </div>
  );
}

function LazyPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route
            path="/login"
            element={
              <LazyPage>
                <LoginPage />
              </LazyPage>
            }
          />
          <Route
            path="/register"
            element={
              <LazyPage>
                <RegistrationPage />
              </LazyPage>
            }
          />
          <Route
            path="/admin"
            element={
              <LazyPage>
                <AdminLayout />
              </LazyPage>
            }
          >
            <Route
              index
              element={
                <LazyPage>
                  <AdminDashboardPage />
                </LazyPage>
              }
            />
            <Route
              path="users"
              element={
                <LazyPage>
                  <AdminUsersPage />
                </LazyPage>
              }
            />
            <Route
              path="users/:id"
              element={
                <LazyPage>
                  <AdminUserDetailPage />
                </LazyPage>
              }
            />
            <Route
              path="activity"
              element={
                <LazyPage>
                  <AdminActivityPage />
                </LazyPage>
              }
            />
          </Route>
          <Route element={<AppLayout />}>
            <Route
              path="/mood-sync"
              element={
                <LazyPage>
                  <MoodSyncPage />
                </LazyPage>
              }
            />
            <Route
              path="/dashboard"
              element={
                <LazyPage>
                  <DashboardPage />
                </LazyPage>
              }
            />
            <Route
              path="/check-in"
              element={
                <LazyPage>
                  <MoodSyncPage />
                </LazyPage>
              }
            />
            <Route
              path="/history"
              element={
                <LazyPage>
                  <HistoryPage />
                </LazyPage>
              }
            />
            <Route
              path="/journal"
              element={
                <LazyPage>
                  <JournalPage />
                </LazyPage>
              }
            />
            <Route
              path="/analytics"
              element={
                <LazyPage>
                  <AnalyticsPage />
                </LazyPage>
              }
            />
            <Route
              path="/emotion-dna"
              element={
                <LazyPage>
                  <EmotionDNAPage />
                </LazyPage>
              }
            />
            <Route
              path="/playlists"
              element={
                <LazyPage>
                  <PlaylistsPage />
                </LazyPage>
              }
            />
            <Route
              path="/music"
              element={
                <LazyPage>
                  <MusicLibraryPage />
                </LazyPage>
              }
            />
            <Route
              path="/achievements"
              element={
                <LazyPage>
                  <AchievementsPage />
                </LazyPage>
              }
            />
            <Route
              path="/reports"
              element={
                <LazyPage>
                  <ReportsPage />
                </LazyPage>
              }
            />
            <Route
              path="/profile"
              element={
                <LazyPage>
                  <ProfilePage />
                </LazyPage>
              }
            />
          </Route>
          <Route path="*" element={<NotFoundRedirect />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
