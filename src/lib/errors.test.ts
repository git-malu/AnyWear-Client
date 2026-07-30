import { describe, expect, it } from 'vitest';
import { getErrorMessage, getHttpStatus, getStringProperty } from './errors';

describe('error helpers', () => {
  it('prefers structured API error messages', () => {
    const error = { response: { status: 422, data: { message: 'Invalid image' } } };

    expect(getErrorMessage(error, 'fallback')).toBe('Invalid image');
    expect(getHttpStatus(error)).toBe(422);
  });

  it('falls back for unstructured values', () => {
    expect(getErrorMessage('failure', 'fallback')).toBe('fallback');
    expect(getHttpStatus('failure')).toBeUndefined();
  });

  it('reads only non-empty string properties', () => {
    expect(getStringProperty({ uploadUrl: 'https://upload.example' }, 'uploadUrl')).toBe('https://upload.example');
    expect(getStringProperty({ uploadUrl: 42 }, 'uploadUrl')).toBeUndefined();
  });
});
