import { useEffect, useRef, useState, type ReactNode } from 'react';
import { getCurrentUser } from 'aws-amplify/auth';
import { useAuthStore } from '../store/authStore';
import FullPageLoading from './FullPageLoading';

export default function AuthGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const bootstrap = useRef<ReturnType<typeof getCurrentUser> | null>(null);
  const invalidated = useRef(false);

  useEffect(() => {
    let active = true;
    // A newer sign-in, logout or Hub event must win over an older lookup.
    const unsubscribe = useAuthStore.subscribe(() => {
      invalidated.current = true;
    });

    bootstrap.current ??= getCurrentUser();
    bootstrap.current
      .then(() => {
        if (active && !invalidated.current) {
          useAuthStore.getState().setAuthenticated(true);
        }
      })
      .catch(() => {
        if (active && !invalidated.current) useAuthStore.getState().clearLocalAuth();
      })
      .finally(() => {
        if (active) setReady(true);
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return ready ? children : <FullPageLoading />;
}
