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

  if (isLoading || (!data && !isError)) {
    return <FullPageLoading />;
  }

  // If there's an error and we are NOT loading, we still show the app 
  // but individual components might need to handle the missing user state
  // or we could show a hard error screen here.
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
          </Route>
        </Routes>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
