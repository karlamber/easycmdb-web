/**
 * HTTP Basic credentials for demo/local auth against AUTH_MODE=basic (or both)
 * on the API. Credentials live in sessionStorage so a tab reload stays signed in;
 * never commit real passwords — configure them on the Lambda via BASIC_AUTH_*.
 */

const BASIC_USER_KEY = 'argus_basic_user';
const BASIC_PASSWORD_KEY = 'argus_basic_password';
const BASIC_ROLE_KEY = 'argus_basic_role';

export function encodeBasicAuthorization(
  user: string,
  password: string,
): string {
  const encoded = btoa(`${user}:${password}`);
  return `Basic ${encoded}`;
}

export function persistBasicSession(
  user: string,
  password: string,
  role: string,
): void {
  sessionStorage.setItem(BASIC_USER_KEY, user);
  sessionStorage.setItem(BASIC_PASSWORD_KEY, password);
  sessionStorage.setItem(BASIC_ROLE_KEY, role);
}

export function readStoredBasicSession(): {
  user: string;
  password: string;
  role: string;
} | null {
  const user = sessionStorage.getItem(BASIC_USER_KEY);
  const password = sessionStorage.getItem(BASIC_PASSWORD_KEY);
  const role = sessionStorage.getItem(BASIC_ROLE_KEY);
  if (!user || !password || !role) {
    return null;
  }
  return { user, password, role };
}

export function clearStoredBasicSession(): void {
  sessionStorage.removeItem(BASIC_USER_KEY);
  sessionStorage.removeItem(BASIC_PASSWORD_KEY);
  sessionStorage.removeItem(BASIC_ROLE_KEY);
}
