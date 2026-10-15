import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getCurrentUser, signOut } from 'aws-amplify/auth';
import { useAuthStore } from '../store/authStore';
import MainLayout from './MainLayout';

vi.mock('aws-amplify/auth', () => ({ getCurrentUser: vi.fn(), signOut: vi.fn() }));

const noSession = new Error('User needs to be authenticated to call this API.');
const user = { username: 'test-user', userId: 'test-user-id' };

/**
 * The system E2E locates this control by its accessible name, which must stay exactly `Logout`.
 * Testing Library matches a string name exactly by default, mirroring Playwright's `exact: true`.
 */
function logoutControl(): HTMLElement {
  return screen.getByRole('button', { name: 'Logout' });
}

function renderLayout() {
  return render(
    <MemoryRouter>
      <MainLayout />
    </MemoryRouter>,
  );
}

describe('MainLayout logout control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ isAuthenticated: true, isSigningOut: false, logoutError: null });
  });
  afterEach(cleanup);

  it('awaits the sign-out promise with a pending state while the accessible name stays Logout', async () => {
    let finishSignOut!: () => void;
    vi.mocked(signOut).mockReturnValue(new Promise<void>((resolve) => { finishSignOut = resolve; }));
    vi.mocked(getCurrentUser).mockRejectedValue(noSession);
    renderLayout();

    expect(logoutControl().hasAttribute('disabled')).toBe(false);

    await act(async () => { logoutControl().click(); });

    expect(logoutControl().textContent).toBe('Logout');
    expect(logoutControl().hasAttribute('disabled')).toBe(true);
    expect(logoutControl().getAttribute('aria-busy')).toBe('true');

    await act(async () => { finishSignOut(); });

    expect(logoutControl().hasAttribute('disabled')).toBe(false);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('surfaces a failed sign-out and keeps the session instead of claiming a completed logout', async () => {
    vi.mocked(signOut).mockRejectedValue(new Error('SDK sign-out failed'));
    vi.mocked(getCurrentUser).mockResolvedValue(user);
    renderLayout();

    await act(async () => { logoutControl().click(); });

    expect(screen.getByRole('alert').textContent).toContain('still signed in');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(logoutControl().hasAttribute('disabled')).toBe(false);
  });
});
