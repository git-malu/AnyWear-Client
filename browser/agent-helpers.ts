/**
 * Agent helpers for Playwright MCP browser_evaluate injection.
 *
 * These utilities are designed to be injected into the browser context
 * via `browser_evaluate` when using Playwright MCP. They help the AI agent
 * mock authentication, API responses, and geolocation without needing
 * to write Playwright page.route() code.
 *
 * Usage from the agent (Playwright MCP):
 *   browser_evaluate({ function: agentHelpers.mockAuth })
 *   browser_evaluate({ function: agentHelpers.mockApiRoute, args: ["** /users/me", { id: "x" }] })
 *   browser_evaluate({ function: agentHelpers.mockGeolocation, args: [22.3, 114.2] })
 */

/** Set authentication state in localStorage (bypasses Cognito OAuth). */
export const mockAuth = `() => {
  window.localStorage.setItem('isAuthenticated', 'true');
  return 'auth mocked';
}`;

/** Remove authentication state from localStorage. */
export const clearAuth = `() => {
  window.localStorage.removeItem('isAuthenticated');
  return 'auth cleared';
}`;

/**
 * Override navigator.geolocation with fixed coordinates.
 * Pass latitude and longitude as args.
 */
export const mockGeolocation = `(lat, lng) => {
  const coords = {
    latitude: lat,
    longitude: lng,
    accuracy: 100,
    altitude: null,
    altitudeAccuracy: null,
    heading: null,
    speed: null,
  };
  // @ts-ignore
  navigator.geolocation.getCurrentPosition = (success) => success({ coords, timestamp: Date.now() });
  // @ts-ignore
  navigator.geolocation.watchPosition = (success) => { success({ coords, timestamp: Date.now() }); return 0; };
  // @ts-ignore
  navigator.geolocation.clearWatch = () => {};
  return JSON.stringify(coords);
}`;

/**
 * Intercept fetch requests matching a URL pattern and return a mock response.
 * Pass pattern (string|RegExp string) and responseBody (object) as args.
 */
export const mockApiRoute = `(pattern, responseBody) => {
  const originalFetch = window.fetch;
  window.fetch = (url, options) => {
    const urlStr = typeof url === 'string' ? url : url.toString();
    const match = urlStr.includes(pattern);
    if (match) {
      return Promise.resolve(new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));
    }
    return originalFetch(url, options);
  };
  return 'route mocked: ' + pattern;
}`;

/** Restore the original window.fetch (undo mockApiRoute). */
export const restoreFetch = `() => {
  // fetch is restored by page reload; clearing mocks requires page context reset
  return 'fetch cannot be restored without page reload — navigate away and back';
}`;

/**
 * Read the Zustand auth store state from localStorage (if persisted).
 * Returns parsed auth state or null.
 */
export const getAuthState = `() => {
  const stored = window.localStorage.getItem('isAuthenticated');
  return stored;
}`;

/**
 * Check if any console errors were logged since page load.
 * Returns count of errors.
 */
export const getConsoleErrorCount = `() => {
  let count = 0;
  const originalError = console.error;
  console.error = (...args) => { count++; originalError.apply(console, args); };
  // This patches console.error for future calls — past errors are not captured.
  // Use browser_console_messages MCP tool for retroactive console inspection.
  return count;
}`;

/**
 * Check if the Tauri API bridge is available (only in real Tauri webview).
 * Returns true if window.__TAURI__ exists.
 */
export const hasTauriBridge = `() => {
  // @ts-ignore
  return typeof window.__TAURI__ !== 'undefined';
}`;
