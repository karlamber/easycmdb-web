import { create } from 'zustand';

import { api } from '@/api/http';

import {
  clearStoredBasicSession,
  encodeBasicAuthorization,
  persistBasicSession,
  readStoredBasicSession,
} from '@/auth/basic';
import type { CognitoConfig, JwtClaims, TokenSet } from '@/auth/cognito';
import {
  buildLogoutUrl,
  readCognitoConfig,
  refreshTokens as refreshCognitoTokens,
} from '@/auth/cognito';
import { cognitoAuthEnabled, readClientAuthMode } from '@/auth/mode';

const COGNITO_CLAIMS_KEY = 'argus_cognito_claims';
const COGNITO_REFRESH_KEY = 'argus_cognito_refresh_token';

/**
 * Internal role tokens. Must stay in sync with the API's AuthRole.
 */
export type AuthRole = 'admin' | 'app_editor' | 'viewer';

/** Buffer subtracted from token expiry when deciding whether to refresh. */
const REFRESH_LEEWAY_MS = 60_000;

const FALLBACK_DISPLAY_USER = 'Signed in';

function isAuthRole(value: string): value is AuthRole {
  return value === 'admin' || value === 'app_editor' || value === 'viewer';
}

function readStringArrayClaim(
  claims: JwtClaims,
  name: 'custom:roles' | 'cognito:groups',
): string[] {
  const value = claims[name];
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === 'string');
  }
  if (typeof value === 'string' && value.length > 0) {
    const trimmed = value.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      return trimmed
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }
    return trimmed.split(/[,\s]+/).filter((s) => s.length > 0);
  }
  return [];
}

function adminRoleClaimValue(): string {
  const configured = import.meta.env.VITE_ADMIN_ROLE_CLAIM_VALUE;
  return typeof configured === 'string' && configured.length > 0
    ? configured
    : 'admin';
}

function appEditorRoleClaimValue(): string {
  const configured = import.meta.env.VITE_APP_EDIT_ROLE_CLAIM_VALUE;
  return typeof configured === 'string' && configured.length > 0
    ? configured
    : 'app-edit';
}

function roleFromClaims(claims: JwtClaims | null): AuthRole | '' {
  if (!claims) return '';
  const tokens = [
    ...readStringArrayClaim(claims, 'custom:roles'),
    ...readStringArrayClaim(claims, 'cognito:groups'),
  ];
  if (tokens.includes(adminRoleClaimValue())) return 'admin';
  if (tokens.includes(appEditorRoleClaimValue())) return 'app_editor';
  return 'viewer';
}

function userFromClaims(claims: JwtClaims | null): string {
  if (!claims) return '';
  const candidate =
    claims['email'] ?? claims['cognito:username'] ?? claims['username'];
  return typeof candidate === 'string' ? candidate : '';
}

function displayNameFromClaims(claims: JwtClaims | null): string {
  if (!claims) return '';
  const given = claims['custom:givenname'] ?? claims['given_name'];
  const sur = claims['custom:surname'] ?? claims['family_name'];
  if (typeof given === 'string' && typeof sur === 'string') {
    return `${given} ${sur}`.trim();
  }
  if (typeof given === 'string') return given;
  return userFromClaims(claims);
}

type AuthKind = 'cognito' | 'basic' | '';

export type AuthState = {
  authKind: AuthKind;
  idToken: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  claims: JwtClaims | null;
  basicUser: string;
  basicPassword: string;
  basicRole: AuthRole | '';
  hydrated: boolean;
};

function currentRole(state: AuthState): AuthRole | '' {
  if (state.authKind === 'basic') {
    return state.basicRole;
  }
  return roleFromClaims(state.claims);
}

export function selectIsLoggedIn(state: AuthState): boolean {
  if (state.authKind === 'basic') {
    return Boolean(state.basicUser && state.basicPassword);
  }
  return Boolean(state.idToken || state.refreshToken);
}

export function selectRole(state: AuthState): AuthRole | '' {
  return currentRole(state);
}

export function selectIsAdmin(state: AuthState): boolean {
  return currentRole(state) === 'admin';
}

export function selectIsAppEditor(state: AuthState): boolean {
  return currentRole(state) === 'app_editor';
}

export function selectCanManageApplications(state: AuthState): boolean {
  const r = currentRole(state);
  return r === 'admin' || r === 'app_editor';
}

export function selectDisplayUser(state: AuthState): string {
  if (state.authKind === 'basic' && state.basicUser) {
    return state.basicUser;
  }
  const fromClaims =
    displayNameFromClaims(state.claims) || userFromClaims(state.claims);
  if (fromClaims) return fromClaims;
  return state.idToken || state.refreshToken ? FALLBACK_DISPLAY_USER : '';
}

export function selectAuthorizationHeader(state: AuthState): string | null {
  if (state.authKind === 'basic' && state.basicUser && state.basicPassword) {
    return encodeBasicAuthorization(state.basicUser, state.basicPassword);
  }
  if (state.idToken) {
    return `Bearer ${state.idToken}`;
  }
  return null;
}

const initialState: AuthState = {
  authKind: '',
  idToken: '',
  accessToken: '',
  refreshToken: '',
  expiresAt: 0,
  claims: null,
  basicUser: '',
  basicPassword: '',
  basicRole: '',
  hydrated: false,
};

type AuthActions = {
  hydrateFromSession: () => void;
  loginWithBasic: (user: string, password: string) => Promise<void>;
  setCognitoSession: (tokens: TokenSet, claims: JwtClaims) => void;
  tryRefreshCognito: (cfg: CognitoConfig) => Promise<boolean>;
  shouldRefreshSoon: () => boolean;
  clearSession: () => void;
  logout: () => void;
};

export type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>()((set, get) => ({
  ...initialState,

  hydrateFromSession(): void {
    try {
      const basic = readStoredBasicSession();
      if (basic && isAuthRole(basic.role)) {
        set({
          authKind: 'basic',
          basicUser: basic.user,
          basicPassword: basic.password,
          basicRole: basic.role,
        });
      } else {
        const claimsRaw = sessionStorage.getItem(COGNITO_CLAIMS_KEY);
        const refresh = sessionStorage.getItem(COGNITO_REFRESH_KEY) ?? '';

        if (claimsRaw && refresh) {
          let claims: JwtClaims | null = null;
          try {
            claims = JSON.parse(claimsRaw) as JwtClaims;
          } catch {
            claims = null;
          }
          set({
            authKind: 'cognito',
            refreshToken: refresh,
            claims,
          });
        }
      }
    } finally {
      set({ hydrated: true });
    }
  },

  async loginWithBasic(user: string, password: string): Promise<void> {
    const trimmedUser = user.trim();
    if (!trimmedUser || !password) {
      throw new Error('Username and password are required.');
    }

    const { data } = await api.get<{ user: string; role: string }>('/me', {
      headers: {
        Authorization: encodeBasicAuthorization(trimmedUser, password),
      },
    });

    if (!isAuthRole(data.role)) {
      throw new Error('Unexpected role returned from the API.');
    }

    get().clearSession();
    set({
      authKind: 'basic',
      basicUser: trimmedUser,
      basicPassword: password,
      basicRole: data.role,
    });
    persistBasicSession(trimmedUser, password, data.role);
  },

  setCognitoSession(tokens: TokenSet, claims: JwtClaims): void {
    clearStoredBasicSession();
    const refreshToken = tokens.refreshToken ?? get().refreshToken;
    set({
      authKind: 'cognito',
      basicUser: '',
      basicPassword: '',
      basicRole: '',
      idToken: tokens.idToken,
      accessToken: tokens.accessToken,
      refreshToken,
      expiresAt: tokens.expiresAt,
      claims,
    });
    sessionStorage.setItem(COGNITO_CLAIMS_KEY, JSON.stringify(claims));
    if (refreshToken) {
      sessionStorage.setItem(COGNITO_REFRESH_KEY, refreshToken);
    }
  },

  async tryRefreshCognito(cfg: CognitoConfig): Promise<boolean> {
    const state = get();
    if (state.authKind !== 'cognito' || !state.refreshToken) return false;
    try {
      const fresh = await refreshCognitoTokens(cfg, state.refreshToken);
      const nextRefresh = fresh.refreshToken ?? state.refreshToken;
      set({
        idToken: fresh.idToken,
        accessToken: fresh.accessToken,
        expiresAt: fresh.expiresAt,
        refreshToken: nextRefresh,
      });
      if (fresh.refreshToken) {
        sessionStorage.setItem(COGNITO_REFRESH_KEY, fresh.refreshToken);
      }
      return true;
    } catch (err) {
      console.warn('auth.refresh.failed', err);
      return false;
    }
  },

  shouldRefreshSoon(): boolean {
    const state = get();
    if (state.authKind !== 'cognito') return false;
    if (!state.idToken && !state.refreshToken) return false;
    if (!state.expiresAt) return true;
    return Date.now() + REFRESH_LEEWAY_MS >= state.expiresAt;
  },

  clearSession(): void {
    set({
      authKind: '',
      idToken: '',
      accessToken: '',
      refreshToken: '',
      expiresAt: 0,
      claims: null,
      basicUser: '',
      basicPassword: '',
      basicRole: '',
    });
    sessionStorage.removeItem(COGNITO_CLAIMS_KEY);
    sessionStorage.removeItem(COGNITO_REFRESH_KEY);
    clearStoredBasicSession();
  },

  logout(): void {
    const state = get();
    const wasCognito =
      state.authKind === 'cognito' &&
      (state.idToken || state.refreshToken || state.claims);
    get().clearSession();
    const cfg = readCognitoConfig();
    if (wasCognito && cfg && cognitoAuthEnabled(readClientAuthMode())) {
      window.location.assign(buildLogoutUrl(cfg));
    }
  },
}));

/** Reset store state between unit tests. */
export function resetAuthStore(): void {
  useAuthStore.setState({ ...initialState });
}
