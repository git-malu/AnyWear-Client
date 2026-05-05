import { fetchAuthSession } from 'aws-amplify/auth';

type SseEventCallback<T = any> = (data: T) => void;

interface SseConnection {
  close: () => void;
}

/**
 * Opens an SSE connection to the given URL (relative to API base).
 * Automatically injects the Bearer token via Authorization header.
 * Returns a close() function for cleanup.
 */
export function connectSse<T = any>(
  path: string,
  onEvent: SseEventCallback<T>,
): SseConnection {
  let aborted = false;
  const abortController = new AbortController();

  async function run() {
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.accessToken?.toString();
      if (!token) {
        console.error('[SSE] No auth token available');
        return;
      }

      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
      const url = `${baseUrl}${path}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: abortController.signal,
      });

      if (!response.ok) {
        console.error(`[SSE] Connection failed: ${response.status}`);
        return;
      }

      if (!response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (!aborted) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const content = trimmed.slice(6).trim();
            if (!content) continue;
            try {
              const data = JSON.parse(content) as T;
              onEvent(data);
            } catch {
              // skip non-JSON lines
            }
          }
        }
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.error('[SSE] Stream error:', err);
      }
    }
  }

  run();

  return {
    close: () => {
      aborted = true;
      abortController.abort();
    },
  };
}
