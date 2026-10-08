import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildLogoutUrl,
  type CognitoConfig,
  decodeJwtPayload,
  handleCallback,
} from '@/auth/cognito';

const baseCfg: CognitoConfig = {
  domain: 'https://example.auth.us-east-1.amazoncognito.com',
  clientId: 'client-id',
  redirectUri: 'http://localhost:9000/auth/callback',
  logoutUri: 'http://localhost:9000/',
  scopes: ['openid', 'email', 'profile'],
};

function base64UrlEncodeJson(payload: Record<string, unknown>): string {
  // Encode like a real Cognito JWT: JSON.stringify -> UTF-8 bytes -> base64url.
  const utf8 = new TextEncoder().encode(JSON.stringify(payload));
  let binary = '';
  for (const b of utf8) binary += String.fromCharCode(b);
  const b64 =
    typeof btoa === 'function'
      ? btoa(binary)
      : Buffer.from(utf8).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function jwt(payload: Record<string, unknown>): string {
  return `header.${base64UrlEncodeJson(payload)}.signature`;
}

describe('decodeJwtPayload', () => {
  it('decodes the payload section of a JWT', () => {
    const token = jwt({
      email: 'jane@example.com',
      'custom:roles': 'argus-admin',
    });
    const claims = decodeJwtPayload(token);
    expect(claims).toEqual({
      email: 'jane@example.com',
      'custom:roles': 'argus-admin',
    });
  });

  it('throws on a malformed JWT', () => {
    expect(() => decodeJwtPayload('not-a-jwt')).toThrow(/Malformed/);
  });

  it('decodes UTF-8 multi-byte characters correctly', () => {
    const token = jwt({ name: 'éléonore' });
    expect(decodeJwtPayload(token)).toEqual({ name: 'éléonore' });
  });
});

describe('buildLogoutUrl', () => {
  it('builds the hosted-UI logout URL with client_id and logout_uri', () => {
    const url = new URL(buildLogoutUrl(baseCfg));
    expect(url.origin + url.pathname).toBe(
      'https://example.auth.us-east-1.amazoncognito.com/logout',
    );
    expect(url.searchParams.get('client_id')).toBe('client-id');
    expect(url.searchParams.get('logout_uri')).toBe(baseCfg.logoutUri);
  });
});

describe('handleCallback', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it('rejects when the OAuth state cannot be matched', async () => {
    sessionStorage.setItem('argus_cognito_pkce_state', 'expected-state');
    sessionStorage.setItem('argus_cognito_pkce_verifier', 'verifier');
    sessionStorage.setItem(
      'argus_cognito_post_login_redirect',
      '/all-applications',
    );
    await expect(
      handleCallback(baseCfg, '?code=abc&state=wrong'),
    ).rejects.toThrow(/state mismatch/);
  });

  it('rejects when the PKCE verifier is missing', async () => {
    sessionStorage.setItem('argus_cognito_pkce_state', 's');
    await expect(handleCallback(baseCfg, '?code=abc&state=s')).rejects.toThrow(
      /PKCE verifier/,
    );
  });

  it('rejects when Cognito returned ?error=', async () => {
    await expect(
      handleCallback(
        baseCfg,
        '?error=access_denied&error_description=user+gave+up',
      ),
    ).rejects.toThrow(/access_denied/);
  });

  it('exchanges the code for tokens and returns decoded claims', async () => {
    sessionStorage.setItem('argus_cognito_pkce_state', 's');
    sessionStorage.setItem('argus_cognito_pkce_verifier', 'v');
    sessionStorage.setItem('argus_cognito_post_login_redirect', '/dashboard');

    const idToken = jwt({
      email: 'jane@example.com',
      'custom:roles': 'argus-admin',
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          id_token: idToken,
          access_token: 'access',
          refresh_token: 'refresh',
          expires_in: 3600,
          token_type: 'Bearer',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const result = await handleCallback(baseCfg, '?code=abc&state=s');

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      'https://example.auth.us-east-1.amazoncognito.com/oauth2/token',
    );
    expect(init.method).toBe('POST');
    expect(String(init.body)).toContain('grant_type=authorization_code');
    expect(String(init.body)).toContain('code_verifier=v');

    expect(result.tokens.idToken).toBe(idToken);
    expect(result.tokens.refreshToken).toBe('refresh');
    expect(result.tokens.expiresAt).toBeGreaterThan(Date.now());
    expect(result.claims).toEqual({
      email: 'jane@example.com',
      'custom:roles': 'argus-admin',
    });
    expect(result.redirectAfter).toBe('/dashboard');

    // PKCE / state / redirect entries cleared after a successful exchange.
    expect(sessionStorage.getItem('argus_cognito_pkce_state')).toBeNull();
    expect(sessionStorage.getItem('argus_cognito_pkce_verifier')).toBeNull();
    expect(
      sessionStorage.getItem('argus_cognito_post_login_redirect'),
    ).toBeNull();
  });

  it('falls back to a safe redirect when post-login target is not a same-origin path', async () => {
    sessionStorage.setItem('argus_cognito_pkce_state', 's');
    sessionStorage.setItem('argus_cognito_pkce_verifier', 'v');
    sessionStorage.setItem(
      'argus_cognito_post_login_redirect',
      'https://evil.example.com/steal',
    );
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          id_token: jwt({ email: 'j@x' }),
          access_token: 'a',
          expires_in: 60,
          token_type: 'Bearer',
        }),
        { status: 200 },
      ),
    );

    const result = await handleCallback(baseCfg, '?code=abc&state=s');
    expect(result.redirectAfter).toBe('/all-applications');
  });
});
