import { getSessionCorrelationId, parseApiError } from '../http';
import axios from 'axios';
import { describe, expect, it, vi } from 'vitest';

describe('parseApiError', () => {
  it('appends the response x-request-id reference when present', async () => {
    const err = {
      isAxiosError: true,
      message: 'Request failed with status code 500',
      response: {
        status: 500,
        headers: { 'x-request-id': 'req-abc-123' },
        data: { error: 'Internal server error' },
      },
    };
    vi.spyOn(axios, 'isAxiosError').mockReturnValue(true);

    await expect(parseApiError(err)).resolves.toBe(
      'Internal server error (ref: req-abc-123)',
    );
  });

  it('reads requestId from the error body when the header is absent', async () => {
    const err = {
      isAxiosError: true,
      message: 'Request failed with status code 500',
      response: {
        status: 500,
        headers: {},
        data: {
          error: 'Internal server error',
          requestId: 'req-body-456',
        },
      },
    };
    vi.spyOn(axios, 'isAxiosError').mockReturnValue(true);

    await expect(parseApiError(err)).resolves.toBe(
      'Internal server error (ref: req-body-456)',
    );
  });
});

describe('getSessionCorrelationId', () => {
  it('returns a stable UUID for the module session', () => {
    expect(getSessionCorrelationId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(getSessionCorrelationId()).toBe(getSessionCorrelationId());
  });
});
