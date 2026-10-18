import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';

/**
 * Auth header source, registered at bootstrap by main.tsx. Keeping this as a
 * callback (rather than importing the Zustand store here) lets the store stay
 * the only place that knows about Zustand/React, and side-steps the import
 * cycle that would otherwise arise once stores grow to depend on the api/.
 */
let getAuthorizationValue: () => string | null = () => null;

/**
 * Optional 401 handler. Returning `true` retries the original request once
 * with the freshly-minted Authorization header; `false` propagates the 401.
 */
let on401: () => Promise<boolean> = async () => false;

/**
 * `crypto.randomUUID` exists only in a secure context (localhost or HTTPS).
 * A hosts-file name served over HTTP is not one, so fall back there.
 */
function newRequestId(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Stable per-tab ID so support can tie multiple API calls to one session. */
const sessionCorrelationId = newRequestId();

export function registerAuthorizationGetter(fn: () => string | null): void {
  getAuthorizationValue = fn;
}

export function register401Handler(fn: () => Promise<boolean>): void {
  on401 = fn;
}

type RetriableConfig = AxiosRequestConfig & { _argusRetried?: boolean };

function createClient(): AxiosInstance {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
  const client = axios.create({
    baseURL: apiBaseUrl,
    headers: { Accept: 'application/json' },
  });

  client.interceptors.request.use((config) => {
    config.headers['X-Correlation-Id'] = sessionCorrelationId;
    config.headers['X-Request-Id'] = newRequestId();

    const value = getAuthorizationValue();
    if (value) {
      config.headers.Authorization = value;
    }
    return config;
  });

  // Single-shot retry on 401: let the handler attempt a refresh-token
  // exchange before we propagate. Without this, every tab reload would force
  // a full Cognito hosted-UI round-trip.
  client.interceptors.response.use(undefined, async (error) => {
    if (!axios.isAxiosError(error) || error.response?.status !== 401) {
      return Promise.reject(error);
    }
    const original = error.config as RetriableConfig | undefined;
    if (!original || original._argusRetried) {
      return Promise.reject(error);
    }
    const recovered = await on401();
    if (!recovered) {
      return Promise.reject(error);
    }
    original._argusRetried = true;
    return client.request(original);
  });

  return client;
}

export const api = createClient();

function requestIdFromResponse(err: unknown): string | undefined {
  if (!axios.isAxiosError(err)) {
    return undefined;
  }
  const header =
    err.response?.headers['x-request-id'] ??
    err.response?.headers['X-Request-Id'];
  if (typeof header === 'string' && header.trim()) {
    return header.trim();
  }
  const body = err.response?.data as { requestId?: string } | undefined;
  if (typeof body?.requestId === 'string' && body.requestId.trim()) {
    return body.requestId.trim();
  }
  return undefined;
}

function withRequestReference(message: string, requestId?: string): string {
  if (!requestId) {
    return message;
  }
  return `${message} (ref: ${requestId})`;
}

export async function parseApiError(err: unknown): Promise<string> {
  const requestId = requestIdFromResponse(err);

  if (axios.isAxiosError(err)) {
    const data = err.response?.data as
      { error?: string; message?: string } | undefined;
    if (data?.error) {
      return withRequestReference(data.error, requestId);
    }
    if (data?.message) {
      return withRequestReference(data.message, requestId);
    }
    if (err.response?.status === 401) {
      return withRequestReference('Unauthorized', requestId);
    }
    return withRequestReference(err.message, requestId);
  }
  return err instanceof Error ? err.message : 'Unexpected error';
}

/** Exposed for tests — the stable session correlation ID. */
export function getSessionCorrelationId(): string {
  return sessionCorrelationId;
}
