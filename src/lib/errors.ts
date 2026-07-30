function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (isRecord(error)) {
    const response = error.response;
    if (isRecord(response) && isRecord(response.data)) {
      const apiMessage = response.data.message ?? response.data.error;
      if (typeof apiMessage === 'string' && apiMessage) return apiMessage;
    }

    if (typeof error.message === 'string' && error.message) return error.message;
  }

  return error instanceof Error && error.message ? error.message : fallback;
}

export function getHttpStatus(error: unknown): number | undefined {
  if (!isRecord(error)) return undefined;
  if (typeof error.status === 'number') return error.status;

  const response = error.response;
  return isRecord(response) && typeof response.status === 'number' ? response.status : undefined;
}

export function getStringProperty(value: unknown, property: string): string | undefined {
  if (!isRecord(value)) return undefined;
  const result = value[property];
  return typeof result === 'string' && result ? result : undefined;
}
