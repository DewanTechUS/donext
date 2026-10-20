import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';
import { GuestOnly, RequireAuth, ServerOnly } from './components/RequireAuth';
import { PageLoader } from './components/Spinner';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TasksProvider } from './context/TasksContext';
import { ThemeProvider } from './context/ThemeContext';
import { ForgotPasswordPage, LoginPage, ResetPasswordPage, SignupPage } from './pages/AuthPages';
import { NotFoundPage, PrivacyPage, TermsPage } from './pages/LegalPages';

const TasksPage = lazy(() => import('./pages/TasksPage'));
const AccountPage = lazy(() => import('./pages/AccountPage'));
const ListsPage = lazy(() => import('./pages/ListsPage'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const SupportPage = lazy(() => import('./pages/SupportPage'));

const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

/** Signed-in users see their tasks at "/", visitors see the landing page. */
function Home() {
  const { status } = useAuth();
  return status === 'authenticated' ? <TasksPage /> : <LandingPage />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <TasksProvider>
            <BrowserRouter basename={basename}>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route element={<Layout />}>
                    <Route index element={<Home />} />
                    <Route
                      path="lists"
                      element={
                        <ServerOnly>
                          <RequireAuth>
                            <ListsPage />
                          </RequireAuth>
                        </ServerOnly>
                      }
                    />
                    <Route
                      path="account"
                      element={
                        <RequireAuth>
                          <AccountPage />
                        </RequireAuth>
                      }
                    />
                    <Route
                      path="login"
                      element={
                        <GuestOnly>
                          <LoginPage />
                        </GuestOnly>
                      }
                    />
                    <Route
                      path="signup"
                      element={
                        <GuestOnly>
                          <SignupPage />
                        </GuestOnly>
                      }
                    />
                    <Route
                      path="forgot-password"
                      element={
                        <GuestOnly>
                          <ForgotPasswordPage />
                        </GuestOnly>
                      }
                    />
                    <Route
                      path="reset-password"
                      element={
                        <ServerOnly>
                          <ResetPasswordPage />
                        </ServerOnly>
                      }
                    />
                    <Route path="support" element={<SupportPage />} />
                    <Route path="privacy" element={<PrivacyPage />} />
                    <Route path="terms" element={<TermsPage />} />
                    <Route path="*" element={<NotFoundPage />} />
                  </Route>
                </Routes>
              </Suspense>
            </BrowserRouter>
          </TasksProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
