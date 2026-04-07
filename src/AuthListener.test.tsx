import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { AuthListener } from './App';
import { useAuthStore } from './store/authStore';
import { Hub } from 'aws-amplify/utils';

// Mock Hub
vi.mock('aws-amplify/utils', () => ({
  Hub: {
    listen: vi.fn(),
  },
}));

// Mock the Zustand store explicitly to prevent real implementation details
vi.mock('./store/authStore', () => ({
  useAuthStore: vi.fn(),
}));

describe('AuthListener', () => {
  let mockClearLocalAuth: ReturnType<typeof vi.fn>;
  
  beforeEach(() => {
    vi.clearAllMocks();
    mockClearLocalAuth = vi.fn();
    
    // Setup Zustand mock
    (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector: any) => {
      const state = { clearLocalAuth: mockClearLocalAuth };
      return selector(state);
    });
  });

  it('registers a Hub listener on mount', () => {
    const mockUnsubscribe = vi.fn();
    (Hub.listen as ReturnType<typeof vi.fn>).mockReturnValue(mockUnsubscribe);

    const { unmount } = render(<AuthListener />);

    expect(Hub.listen).toHaveBeenCalledWith('auth', expect.any(Function));

    unmount();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('calls clearLocalAuth when signedOut event is received', () => {
    let capturedCallback: any;
    (Hub.listen as ReturnType<typeof vi.fn>).mockImplementation((channel, callback) => {
      if (channel === 'auth') {
        capturedCallback = callback;
      }
      return vi.fn();
    });

    render(<AuthListener />);

    // Simulate Amplify Hub event
    capturedCallback({
      payload: { event: 'signedOut' }
    });

    expect(mockClearLocalAuth).toHaveBeenCalledTimes(1);
  });

  it('calls clearLocalAuth when tokenRefresh_failure event is received', () => {
    let capturedCallback: any;
    (Hub.listen as ReturnType<typeof vi.fn>).mockImplementation((channel, callback) => {
      if (channel === 'auth') {
        capturedCallback = callback;
      }
      return vi.fn();
    });

    render(<AuthListener />);

    // Simulate Amplify Hub event
    capturedCallback({
      payload: { event: 'tokenRefresh_failure' }
    });

    expect(mockClearLocalAuth).toHaveBeenCalledTimes(1);
  });

  it('does not call clearLocalAuth for other events', () => {
    let capturedCallback: any;
    (Hub.listen as ReturnType<typeof vi.fn>).mockImplementation((channel, callback) => {
      if (channel === 'auth') {
        capturedCallback = callback;
      }
      return vi.fn();
    });

    render(<AuthListener />);

    // Simulate other Amplify Hub events
    capturedCallback({
      payload: { event: 'signedIn' }
    });
    
    capturedCallback({
      payload: { event: 'configured' }
    });

    expect(mockClearLocalAuth).not.toHaveBeenCalled();
  });
});
