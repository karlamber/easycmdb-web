import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '@/api/http';

import {
  resetAuthStore,
  selectAuthorizationHeader,
  selectCanManageApplications,
  selectDisplayUser,
  selectIsAdmin,
  selectIsAppEditor,
  selectIsLoggedIn,
  selectRole,
  useAuthStore,
} from '@/stores/auth';

import { resetCognitoConfigCache } from '@/auth/cognito';

const ADMIN_MARKER = 'admin';
const APP_EDIT_MARKER = 'app-edit';

function authState() {
  return useAuthStore.getState();
}

describe('useAuthStore - cognito session', () => {
  beforeEach(() => {
    resetAuthStore();
    sessionStorage.clear();
    resetCognitoConfigCache();
    vi.stubEnv('VITE_ADMIN_ROLE_CLAIM_VALUE', ADMIN_MARKER);
    vi.stubEnv('VITE_APP_EDIT_ROLE_CLAIM_VALUE', APP_EDIT_MARKER);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    resetCognitoConfigCache();
  });

  it('setCognitoSession stores claims + refresh token, exposes Bearer header', () => {
    authState().setCognitoSession(
      {
        idToken: 'id-token',
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + 3_600_000,
      },
      { email: 'jane@example.com', 'custom:roles': ADMIN_MARKER },
    );
    const state = authState();
    expect(selectIsLoggedIn(state)).toBe(true);
    expect(selectIsAdmin(state)).toBe(true);
    expect(selectAuthorizationHeader(state)).toBe('Bearer id-token');
    expect(sessionStorage.getItem('argus_cognito_refresh_token')).toBe(
      'refresh-token',
    );
    expect(sessionStorage.getItem('argus_cognito_claims')).toContain(
      'jane@example.com',
    );
  });

  it('isAdmin is false when claims have no admin role token', () => {
    authState().setCognitoSession(
      {
        idToken: 'id',
        accessToken: 'a',
        expiresAt: Date.now() + 60_000,
      },
      { email: 'viewer@x', 'custom:roles': 'argus-viewer' },
    );
    const state = authState();
    expect(selectIsAdmin(state)).toBe(false);
    expect(selectIsAppEditor(state)).toBe(false);
    expect(selectCanManageApplications(state)).toBe(false);
    expect(selectRole(state)).toBe('viewer');
  });

  it('promotes to app_editor when only the app-edit claim is present', () => {
    authState().setCognitoSession(
      {
        idToken: 'id',
        accessToken: 'a',
        expiresAt: Date.now() + 60_000,
      },
      { email: 'app-owner@x', 'custom:roles': APP_EDIT_MARKER },
    );
    const state = authState();
    expect(selectIsAdmin(state)).toBe(false);
    expect(selectIsAppEditor(state)).toBe(true);
    expect(selectCanManageApplications(state)).toBe(true);
    expect(selectRole(state)).toBe('app_editor');
  });

  it('canManageApplications is also true for admins (admin is a superset)', () => {
    authState().setCognitoSession(
      {
        idToken: 'id',
        accessToken: 'a',
        expiresAt: Date.now() + 60_000,
      },
      { email: 'jane@x', 'custom:roles': ADMIN_MARKER },
    );
    const state = authState();
    expect(selectCanManageApplications(state)).toBe(true);
    expect(selectIsAppEditor(state)).toBe(false);
    expect(selectRole(state)).toBe('admin');
  });

  it('prefers admin over app_editor when both tokens are present', () => {
    authState().setCognitoSession(
      {
        idToken: 'id',
        accessToken: 'a',
        expiresAt: Date.now() + 60_000,
      },
      {
        email: 'jane@x',
        'custom:roles': `${APP_EDIT_MARKER} ${ADMIN_MARKER}`,
      },
    );
    expect(selectRole(authState())).toBe('admin');
  });

  it('honors VITE_APP_EDIT_ROLE_CLAIM_VALUE override for the app-edit marker', () => {
    vi.stubEnv('VITE_APP_EDIT_ROLE_CLAIM_VALUE', 'argus-application-owner');
    authState().setCognitoSession(
      {
        idToken: 'id',
        accessToken: 'a',
        expiresAt: Date.now() + 60_000,
      },
      { email: 'owner@x', 'custom:roles': 'argus-application-owner' },
    );
    expect(selectIsAppEditor(authState())).toBe(true);
  });

  it('defaults the app-edit marker to "app-edit" when no env var is set', () => {
    vi.stubEnv('VITE_APP_EDIT_ROLE_CLAIM_VALUE', '');
    authState().setCognitoSession(
      {
        idToken: 'id',
        accessToken: 'a',
        expiresAt: Date.now() + 60_000,
      },
      { email: 'owner@x', 'custom:roles': 'app-edit' },
    );
    expect(selectIsAppEditor(authState())).toBe(true);
  });

  it('honors VITE_ADMIN_ROLE_CLAIM_VALUE override for the admin marker', () => {
    vi.stubEnv('VITE_ADMIN_ROLE_CLAIM_VALUE', 'platform-owner');
    authState().setCognitoSession(
      {
        idToken: 'id',
        accessToken: 'a',
        expiresAt: Date.now() + 60_000,
      },
      { email: 'owner@x', 'custom:roles': 'platform-owner' },
    );
    expect(selectIsAdmin(authState())).toBe(true);
  });

  it('defaults the admin marker to "admin" when no env var is set', () => {
    vi.stubEnv('VITE_ADMIN_ROLE_CLAIM_VALUE', '');
    authState().setCognitoSession(
      {
        idToken: 'id',
        accessToken: 'a',
        expiresAt: Date.now() + 60_000,
      },
      { email: 'admin@x', 'custom:roles': 'admin' },
    );
    expect(selectIsAdmin(authState())).toBe(true);
  });

  it('displayUser prefers given+sur claims, then email', () => {
    authState().setCognitoSession(
      {
        idToken: 'id',
        accessToken: 'a',
        expiresAt: Date.now() + 60_000,
      },
      {
        email: 'jane@example.com',
        'custom:givenname': 'Jane',
        'custom:surname': 'Doe',
      },
    );
    expect(selectDisplayUser(authState())).toBe('Jane Doe');
  });

  it('displayUser falls back to email when no name claims are present', () => {
    authState().setCognitoSession(
      {
        idToken: 'id',
        accessToken: 'a',
        expiresAt: Date.now() + 60_000,
      },
      { email: 'jane@example.com' },
    );
    expect(selectDisplayUser(authState())).toBe('jane@example.com');
  });

  it('displayUser falls back to "Signed in" when only an opaque sub is present', () => {
    authState().setCognitoSession(
      {
        idToken: 'id',
        accessToken: 'a',
        expiresAt: Date.now() + 60_000,
      },
      { sub: 'h4fkYkX5prSuZRvw-WZkox9de6ELFX-AdZI37mKIDiE' },
    );
    expect(selectDisplayUser(authState())).toBe('Signed in');
  });

  it('hydrateFromSession restores a cognito session from sessionStorage', () => {
    sessionStorage.setItem(
      'argus_cognito_claims',
      JSON.stringify({ email: 'restored@example.com' }),
    );
    sessionStorage.setItem('argus_cognito_refresh_token', 'rt');
    authState().hydrateFromSession();
    const state = authState();
    expect(selectIsLoggedIn(state)).toBe(true);
    expect(state.refreshToken).toBe('rt');
    expect(state.claims).toEqual({ email: 'restored@example.com' });
  });

  it('hydrateFromSession leaves the store logged-out when no cognito keys are present', () => {
    authState().hydrateFromSession();
    const state = authState();
    expect(selectIsLoggedIn(state)).toBe(false);
    expect(state.hydrated).toBe(true);
  });

  it('shouldRefreshSoon returns true when expiry is inside the leeway', () => {
    authState().setCognitoSession(
      {
        idToken: 'id',
        accessToken: 'a',
        expiresAt: Date.now() + 1_000,
      },
      { email: 'j@x' },
    );
    expect(authState().shouldRefreshSoon()).toBe(true);
  });

  it('shouldRefreshSoon returns false for a fresh token', () => {
    authState().setCognitoSession(
      {
        idToken: 'id',
        accessToken: 'a',
        expiresAt: Date.now() + 600_000,
      },
      { email: 'j@x' },
    );
    expect(authState().shouldRefreshSoon()).toBe(false);
  });

  it('shouldRefreshSoon returns false when the store is logged out', () => {
    expect(authState().shouldRefreshSoon()).toBe(false);
  });

  it('clearSession drops tokens without redirecting', () => {
    const assignSpy = vi
      .spyOn(window.location, 'assign')
      .mockImplementation(() => undefined);

    authState().setCognitoSession(
      {
        idToken: 'id',
        accessToken: 'a',
        refreshToken: 'rt',
        expiresAt: Date.now() + 60_000,
      },
      { email: 'j@x' },
    );
    authState().clearSession();

    const state = authState();
    expect(selectIsLoggedIn(state)).toBe(false);
    expect(selectAuthorizationHeader(state)).toBeNull();
    expect(sessionStorage.getItem('argus_cognito_refresh_token')).toBeNull();
    expect(sessionStorage.getItem('argus_cognito_claims')).toBeNull();
    expect(assignSpy).not.toHaveBeenCalled();
  });

  it('logout navigates to the hosted UI /logout URL when configured', () => {
    vi.stubEnv(
      'VITE_COGNITO_DOMAIN',
      'https://example.auth.us-east-1.amazoncognito.com',
    );
    vi.stubEnv('VITE_COGNITO_CLIENT_ID', 'cid');
    vi.stubEnv(
      'VITE_COGNITO_REDIRECT_URI',
      'http://localhost:9000/auth/callback',
    );
    vi.stubEnv('VITE_COGNITO_LOGOUT_URI', 'http://localhost:9000/login');
    const assignSpy = vi
      .spyOn(window.location, 'assign')
      .mockImplementation(() => undefined);

    authState().setCognitoSession(
      {
        idToken: 'id',
        accessToken: 'a',
        expiresAt: Date.now() + 60_000,
      },
      { email: 'j@x' },
    );
    authState().logout();
    expect(assignSpy).toHaveBeenCalledOnce();
    expect(assignSpy.mock.calls[0][0]).toContain(
      'https://example.auth.us-east-1.amazoncognito.com/logout',
    );
  });

  it('logout still clears local state when Cognito config is missing', () => {
    const assignSpy = vi
      .spyOn(window.location, 'assign')
      .mockImplementation(() => undefined);
    authState().setCognitoSession(
      {
        idToken: 'id',
        accessToken: 'a',
        refreshToken: 'rt',
        expiresAt: Date.now() + 60_000,
      },
      { email: 'j@x' },
    );
    authState().logout();
    expect(selectIsLoggedIn(authState())).toBe(false);
    expect(assignSpy).not.toHaveBeenCalled();
  });
});

describe('useAuthStore - basic session', () => {
  beforeEach(() => {
    resetAuthStore();
    sessionStorage.clear();
    vi.stubEnv('VITE_AUTH_MODE', 'basic');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('loginWithBasic stores credentials and exposes Basic authorization header', async () => {
    const getSpy = vi.spyOn(api, 'get').mockResolvedValue({
      data: { user: 'viewer', role: 'viewer' },
    });

    await authState().loginWithBasic('viewer', 'viewer-pw');

    const state = authState();
    expect(selectIsLoggedIn(state)).toBe(true);
    expect(state.authKind).toBe('basic');
    expect(selectRole(state)).toBe('viewer');
    expect(selectAuthorizationHeader(state)).toBe(
      `Basic ${btoa('viewer:viewer-pw')}`,
    );
    expect(sessionStorage.getItem('argus_basic_user')).toBe('viewer');
    getSpy.mockRestore();
  });

  it('hydrateFromSession restores a basic session from sessionStorage', () => {
    sessionStorage.setItem('argus_basic_user', 'admin');
    sessionStorage.setItem('argus_basic_password', 'secret');
    sessionStorage.setItem('argus_basic_role', 'admin');
    authState().hydrateFromSession();
    const state = authState();
    expect(selectIsLoggedIn(state)).toBe(true);
    expect(state.authKind).toBe('basic');
    expect(selectIsAdmin(state)).toBe(true);
    expect(selectDisplayUser(state)).toBe('admin');
  });

  it('logout clears basic session without Cognito redirect', () => {
    const assignSpy = vi
      .spyOn(window.location, 'assign')
      .mockImplementation(() => undefined);
    useAuthStore.setState({
      authKind: 'basic',
      basicUser: 'viewer',
      basicPassword: 'pw',
      basicRole: 'viewer',
      hydrated: true,
    });
    sessionStorage.setItem('argus_basic_user', 'viewer');
    sessionStorage.setItem('argus_basic_password', 'pw');
    sessionStorage.setItem('argus_basic_role', 'viewer');
    authState().logout();
    expect(selectIsLoggedIn(authState())).toBe(false);
    expect(assignSpy).not.toHaveBeenCalled();
  });
});
