import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchAuthSession, signIn, signOut } from 'aws-amplify/auth';
import { useAuthStore } from '../../store/authStore';
import LoginPage from './LoginPage';

vi.mock('aws-amplify/auth', () => ({ signIn: vi.fn(), signOut: vi.fn(), fetchAuthSession: vi.fn() }));

const session = { tokens: { accessToken: { toString: () => 'token' } } } as Awaited<ReturnType<typeof fetchAuthSession>>;

function submitLogin() {
  const view = render(<MemoryRouter><LoginPage /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@anywear.local' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'test-password' } });
  fireEvent.submit(screen.getByRole('button', { name: 'Sign in' }).closest('form')!);
  return view;
}

describe('LoginPage session callbacks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().clearLocalAuth();
    vi.mocked(signIn).mockResolvedValue({ isSignedIn: true, nextStep: { signInStep: 'DONE' } });
  });
  afterEach(cleanup);

  it('does not sign out merely by mounting the login route', () => {
    render(<MemoryRouter><LoginPage /></MemoryRouter>);
    expect(signOut).not.toHaveBeenCalled();
  });

  it('does not restore authentication if the session is cleared during token resolution', async () => {
    let resolveSession!: (value: typeof session) => void;
    vi.mocked(fetchAuthSession).mockReturnValue(new Promise(resolve => { resolveSession = resolve; }));
    submitLogin();
    await vi.waitFor(() => expect(fetchAuthSession).toHaveBeenCalledTimes(1));
    act(() => useAuthStore.getState().clearLocalAuth());
    await act(async () => resolveSession(session));
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(screen.getByText('Your session ended. Please sign in again.')).toBeTruthy();
  });

  it('ignores a token response after the login page unmounts', async () => {
    let resolveSession!: (value: typeof session) => void;
    vi.mocked(fetchAuthSession).mockReturnValue(new Promise(resolve => { resolveSession = resolve; }));
    const view = submitLogin();
    await vi.waitFor(() => expect(fetchAuthSession).toHaveBeenCalledTimes(1));
    view.unmount();
    await act(async () => resolveSession(session));
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});
