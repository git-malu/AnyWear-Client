import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Hub } from 'aws-amplify/utils';
import { useGetUsersMe } from './api/endpoints/users/users';
import FullPageLoading from './components/FullPageLoading';
import AuthLayout from './layouts/AuthLayout';
import MainLayout from './layouts/MainLayout';
import RegisterPage from './pages/auth/RegisterPage';
import VerifyEmailPage from './pages/auth/VerifyEmailPage';
import LoginPage from './pages/auth/LoginPage';
import WardrobePage from './pages/wardrobe/WardrobePage';
import DashboardPage from './pages/dashboard/DashboardPage';
import SettingsPage from './pages/settings/SettingsPage';

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { isLoading, isError, data } = useGetUsersMe({
    query: {
      enabled: isAuthenticated,
      retry: (failureCount, error: any) => {
        // Only retry a few times if it's a 404, giving the dev-fallback time to work
        if (error?.response?.status === 404) return failureCount < 2;
        return failureCount < 1;
      }
    }
  });

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (isLoading) {
    return <FullPageLoading />;
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 text-center">
          <h2 className="text-3xl font-extrabold text-gray-900">Profile Sync Failed</h2>
          <p className="mt-2 text-sm text-gray-600">
            We couldn't synchronize your profile with our local database. 
            This usually happens in dev environments when AWS permissions are restricted.
          </p>
          <div className="mt-5">
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// Global listener for Amplify Hub authentication events
export function AuthListener() {
  const clearLocalAuth = useAuthStore((state) => state.clearLocalAuth);

  useEffect(() => {
    const unsubscribe = Hub.listen('auth', ({ payload }) => {
      if (payload.event === 'signedOut' || payload.event === 'tokenRefresh_failure') {
        clearLocalAuth();
      }
    });

    return () => unsubscribe();
  }, [clearLocalAuth]);

  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthListener />
      <Router>
        <Routes>
          {/* Auth Routes */}
          <Route element={<AuthLayout />}>
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/verify" element={<VerifyEmailPage />} />
            <Route path="/login" element={<LoginPage />} />
          </Route>

          {/* Protected Routes */}
          <Route
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/wardrobe" element={<WardrobePage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
