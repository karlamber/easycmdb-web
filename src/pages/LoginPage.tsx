import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { LogIn, User } from 'lucide-react';
import { toast } from 'sonner';

import { useAuthStore } from '@/stores/auth';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

import heroImage from '@/assets/easycmdb-hero.png';

import {
  beginLogin,
  DEFAULT_POST_LOGIN_REDIRECT,
  readCognitoConfig,
} from '@/auth/cognito';
import {
  basicAuthEnabled,
  cognitoAuthEnabled,
  readClientAuthMode,
} from '@/auth/mode';

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const loginWithBasic = useAuthStore((s) => s.loginWithBasic);

  const authMode = readClientAuthMode();
  const cognitoConfig = useMemo(() => readCognitoConfig(), []);
  const showBasicLogin = basicAuthEnabled(authMode);
  const showCognitoLogin =
    cognitoAuthEnabled(authMode) && cognitoConfig !== null;
  const cognitoMisconfigured =
    cognitoAuthEnabled(authMode) && cognitoConfig === null;
  const showDivider = showBasicLogin && showCognitoLogin;

  const [cognitoLoading, setCognitoLoading] = useState(false);
  const [basicLoading, setBasicLoading] = useState(false);
  const [basicUser, setBasicUser] = useState('');
  const [basicPassword, setBasicPassword] = useState('');

  function redirectTarget(): string {
    const redirect = searchParams.get('redirect');
    return redirect ?? DEFAULT_POST_LOGIN_REDIRECT;
  }

  async function startCognito(): Promise<void> {
    if (!cognitoConfig) return;
    setCognitoLoading(true);
    try {
      await beginLogin(cognitoConfig, redirectTarget());
    } catch (err) {
      setCognitoLoading(false);
      toast.error(err instanceof Error ? err.message : 'Sign-in failed');
    }
  }

  async function startBasic(): Promise<void> {
    setBasicLoading(true);
    try {
      await loginWithBasic(basicUser, basicPassword);
      await navigate(redirectTarget(), { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setBasicLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--surface,#f1f5f9)] p-4 md:p-8">
      <div className="flex w-full max-w-[1100px] flex-wrap items-center justify-center gap-6 md:gap-12">
        <div className="min-w-0 flex-1 basis-[360px]">
          <h1 className="sr-only">easyCMDB</h1>
          <p className="sr-only">
            From any point to everything related. Correlate landscapes,
            applications, environments, and resources instantly.
          </p>
          <img
            src={heroImage}
            alt=""
            width={1520}
            height={860}
            className="block w-full max-w-[640px] rounded-xl"
          />
        </div>

        <div className="w-full max-w-[380px] flex-none rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-medium text-slate-900">Sign in</h2>

          {cognitoMisconfigured && !showBasicLogin ? (
            <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Cognito sign-in is not configured. Set the{' '}
              <code className="text-xs">VITE_COGNITO_*</code> environment
              variables and redeploy, or set{' '}
              <code className="text-xs">VITE_AUTH_MODE=basic</code> for
              username/password auth.
            </div>
          ) : null}

          {showBasicLogin ? (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void startBasic();
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  autoComplete="username"
                  value={basicUser}
                  onChange={(e) => setBasicUser(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={basicPassword}
                  onChange={(e) => setBasicPassword(e.target.value)}
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-teal-700 hover:bg-teal-800"
                disabled={basicLoading}
              >
                <User className="mr-2 size-4" />
                {basicLoading ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
          ) : null}

          {showDivider ? <Separator className="my-6" /> : null}

          {showCognitoLogin ? (
            <div className="space-y-3">
              {showDivider ? (
                <p className="text-sm text-slate-500">
                  Or use your organization SSO (Cognito hosted UI).
                </p>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={cognitoLoading}
                onClick={() => void startCognito()}
              >
                <LogIn className="mr-2 size-4" />
                {cognitoLoading ? 'Redirecting…' : 'Sign in with SSO'}
              </Button>
            </div>
          ) : null}

          {cognitoMisconfigured && showBasicLogin ? (
            <div className="mt-4 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-600">
              SSO is not configured for this build. Use username/password above,
              or set <code className="text-xs">VITE_COGNITO_*</code> to enable
              Cognito sign-in.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
