/**
 * Cognito hosted-UI OAuth 2.0 Authorization Code + PKCE flow.
 *
 * Hand-rolled rather than pulled from `oidc-client-ts` / `amazon-cognito-
 * identity-js` because the flow is ~120 LOC of Web Crypto and two HTTP calls,
 * and adding either library would more than double the auth bundle.
 *
 * Storage:
 * - PKCE verifier + state + post-login redirect: sessionStorage, single-use.
 * - Refresh token + decoded claims: sessionStorage, so an SPA reload does not
 *   force a Cognito round-trip.
 * - Access/ID tokens: in-memory only; re-derived from the refresh token.
 *
 * Bearer choice (ID token, not access token):
 * `useAuthStore.authorizationHeader` sends `Bearer ${idToken}`. The API
 * Gateway JWT authorizer is configured with the app client ID as `audience`
 * (the ID token's `aud` matches; Cognito access tokens use a resource server
 * as audience, which we do not define), and the Lambda reads `email` +
 * `custom:roles` / `cognito:groups` from claims (access tokens carry none of
 * those). Migration path if a second resource server ever needs its own
 * audience: define a Cognito resource server with scopes, switch this header
 * to the access token, and teach the Lambda to fall back to `username`.
 */

/**
 * Cognito ID-token claims narrowed to the fields the SPA actually reads.
 * `[key: string]: unknown` keeps the standard JWT claims (`iss`, `aud`,
 * `exp`, …) addressable without bloating the typed surface.
 */
export type JwtClaims = {
  email?: string;
  'cognito:username'?: string;
  'cognito:groups'?: string | string[];
  'custom:roles'?: string | string[];
  'custom:givenname'?: string;
  'custom:surname'?: string;
  given_name?: string;
  family_name?: string;
  username?: string;
  sub?: string;
  [key: string]: unknown;
};

export type CognitoConfig = {
  domain: string;
  clientId: string;
  redirectUri: string;
  logoutUri: string;
  scopes: string[];
  idpIdentifier?: string;
};

export type TokenSet = {
  idToken: string;
  accessToken: string;
  refreshToken?: string;
  /** UNIX ms when the access/ID token expires. Drives proactive refresh. */
  expiresAt: number;
};

export type CognitoLoginResult = {
  tokens: TokenSet;
  claims: JwtClaims;
};

const PKCE_VERIFIER_KEY = 'argus_cognito_pkce_verifier';
const PKCE_STATE_KEY = 'argus_cognito_pkce_state';
const POST_LOGIN_REDIRECT_KEY = 'argus_cognito_post_login_redirect';

/**
 * Default post-login route. `LoginPage` and `handleCallback` both read this
 * so the two sides cannot drift.
 */
export const DEFAULT_POST_LOGIN_REDIRECT = '/all-applications';

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function randomBytes(byteCount: number): Uint8Array {
  const arr = new Uint8Array(byteCount);
  crypto.getRandomValues(arr);
  return arr;
}

// Memoized: the result is fully derived from build-time env constants.
// Tests that stub env vars must call `resetCognitoConfigCache()` in
// beforeEach to drop the cached value.
let cachedConfig: CognitoConfig | null | undefined;

export function resetCognitoConfigCache(): void {
  cachedConfig = undefined;
}

export function readCognitoConfig(): CognitoConfig | null {
  if (cachedConfig !== undefined) return cachedConfig;

  const domain = import.meta.env.VITE_COGNITO_DOMAIN;
  const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
  const redirectUri = import.meta.env.VITE_COGNITO_REDIRECT_URI;
  const logoutUri = import.meta.env.VITE_COGNITO_LOGOUT_URI;
  if (!domain || !clientId || !redirectUri || !logoutUri) {
    cachedConfig = null;
    return cachedConfig;
  }
  const scopes = (import.meta.env.VITE_COGNITO_SCOPES ?? 'openid email profile')
    .split(/\s+/)
    .filter((s) => s.length > 0);
  cachedConfig = {
    domain: domain.replace(/\/+$/, ''),
    clientId,
    redirectUri,
    logoutUri,
    scopes,
    idpIdentifier: import.meta.env.VITE_COGNITO_IDP_IDENTIFIER,
  };
  return cachedConfig;
}

async function pkceChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

function safeRedirect(target: string): string {
  if (!target) return DEFAULT_POST_LOGIN_REDIRECT;
  // Same-origin paths only - guards against open-redirect via `?redirect=`.
  if (target.startsWith('/') && !target.startsWith('//')) {
    return target;
  }
  return DEFAULT_POST_LOGIN_REDIRECT;
}

/**
 * Kick off the Cognito hosted-UI login flow. The returned Promise never
 * resolves: the browser navigates away mid-call.
 */
export async function beginLogin(
  cfg: CognitoConfig,
  redirectAfter: string,
): Promise<never> {
  const verifier = base64UrlEncode(randomBytes(64));
  const state = base64UrlEncode(randomBytes(16));
  const challenge = await pkceChallenge(verifier);

  sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);
  sessionStorage.setItem(PKCE_STATE_KEY, state);
  sessionStorage.setItem(POST_LOGIN_REDIRECT_KEY, safeRedirect(redirectAfter));

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    scope: cfg.scopes.join(' '),
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  if (cfg.idpIdentifier) {
    params.set('identity_provider', cfg.idpIdentifier);
  }
  window.location.assign(`${cfg.domain}/oauth2/authorize?${params}`);
  return new Promise<never>(() => undefined);
}

/**
 * Decode a JWT payload without verifying the signature. Signature validation
 * is the API Gateway authorizer's job (or Cognito's, on the HTTPS/PKCE token
 * exchange) - we only need the claims for UI state.
 */
export function decodeJwtPayload(token: string): JwtClaims {
  const parts = token.split('.');
  if (parts.length < 2) {
    throw new Error('Malformed JWT');
  }
  const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const padded = payload.padEnd(
    payload.length + ((4 - (payload.length % 4)) % 4),
    '=',
  );
  // JWT payloads are UTF-8; `atob` yields Latin-1 chars whose code units are
  // the raw bytes. Route through TextDecoder so multi-byte glyphs in display
  // names don't mojibake.
  const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
  const json = new TextDecoder('utf-8').decode(bytes);
  return JSON.parse(json) as JwtClaims;
}

type TokenResponse = {
  id_token: string;
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
};

async function postTokenRequest(
  cfg: CognitoConfig,
  body: URLSearchParams,
): Promise<TokenSet> {
  const response = await fetch(`${cfg.domain}/oauth2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(
      `Cognito token endpoint failed (${response.status}): ${detail}`,
    );
  }
  const data = (await response.json()) as TokenResponse;
  return {
    idToken: data.id_token,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

/**
 * Process the `?code=&state=` query string at /auth/callback. Throws on
 * state mismatch or any Cognito error. Returns the decoded ID-token claims
 * plus the post-login redirect target chosen at `beginLogin` time.
 */
export async function handleCallback(
  cfg: CognitoConfig,
  search: string,
): Promise<CognitoLoginResult & { redirectAfter: string }> {
  const params = new URLSearchParams(
    search.startsWith('?') ? search.slice(1) : search,
  );
  const errParam = params.get('error');
  if (errParam) {
    const description = params.get('error_description') ?? '';
    throw new Error(`Cognito returned ${errParam}: ${description}`);
  }
  const code = params.get('code');
  const returnedState = params.get('state');
  const expectedState = sessionStorage.getItem(PKCE_STATE_KEY);
  const verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);
  const redirectAfter = safeRedirect(
    sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY) ??
      DEFAULT_POST_LOGIN_REDIRECT,
  );

  sessionStorage.removeItem(PKCE_STATE_KEY);
  sessionStorage.removeItem(PKCE_VERIFIER_KEY);
  sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY);

  if (!code) {
    throw new Error('Missing authorization code in callback');
  }
  if (!returnedState || !expectedState || returnedState !== expectedState) {
    throw new Error('OAuth state mismatch - possible CSRF');
  }
  if (!verifier) {
    throw new Error(
      'Missing PKCE verifier - login not initiated from this tab',
    );
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: cfg.clientId,
    code,
    redirect_uri: cfg.redirectUri,
    code_verifier: verifier,
  });
  const tokens = await postTokenRequest(cfg, body);
  const claims = decodeJwtPayload(tokens.idToken);
  return { tokens, claims, redirectAfter };
}

/**
 * Trade a refresh token for a fresh access/ID-token pair. Cognito does NOT
 * issue a new refresh token on the refresh grant, so we carry the existing
 * one forward on the returned set.
 */
export async function refreshTokens(
  cfg: CognitoConfig,
  refreshToken: string,
): Promise<TokenSet> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: cfg.clientId,
    refresh_token: refreshToken,
  });
  const fresh = await postTokenRequest(cfg, body);
  return { ...fresh, refreshToken: fresh.refreshToken ?? refreshToken };
}

/**
 * Cognito hosted-UI logout URL. Caller navigates to it; Cognito then
 * redirects back to `cfg.logoutUri`.
 */
export function buildLogoutUrl(cfg: CognitoConfig): string {
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    logout_uri: cfg.logoutUri,
  });
  return `${cfg.domain}/logout?${params}`;
}
