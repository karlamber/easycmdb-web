/**
 * Which sign-in methods the SPA exposes. Mirrors the API's AUTH_MODE concept:
 *
 *   basic   - Username/password form → HTTP Basic on API calls.
 *   cognito - Cognito hosted UI (OAuth PKCE). Users are managed in the pool.
 *   both    - Show Basic form and SSO when Cognito env vars are present.
 */
export type ClientAuthMode = 'basic' | 'cognito' | 'both';

export function readClientAuthMode(): ClientAuthMode {
  const raw = import.meta.env.VITE_AUTH_MODE;
  if (raw === 'basic' || raw === 'cognito' || raw === 'both') {
    return raw;
  }
  return 'both';
}

export function basicAuthEnabled(mode: ClientAuthMode): boolean {
  return mode === 'basic' || mode === 'both';
}

export function cognitoAuthEnabled(mode: ClientAuthMode): boolean {
  return mode === 'cognito' || mode === 'both';
}
