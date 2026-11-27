import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { ArrowRight, LogIn } from 'lucide-react';
import { toast } from 'sonner';

import { useAuthStore } from '@/stores/auth';

import { RelationshipMap } from '@/components/RelationshipMap';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

import { cn } from '@/lib/utils';

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

  const inputClass =
    'h-11 rounded-lg border-teal-100/30 bg-[#031f1e]/70 px-3.5 text-[15px] text-white shadow-none placeholder:text-teal-100/50 focus-visible:ring-teal-300';

  return (
    <div className="bg-dot-grid flex min-h-screen items-center justify-center bg-[#031f1e] px-6 py-12 text-teal-50">
      <div className="grid w-full max-w-[1280px] grid-cols-[repeat(auto-fit,minmax(min(460px,100%),1fr))] items-center gap-14">
        <div className="flex max-w-[520px] flex-col gap-10">
          <div className="flex flex-col gap-5">
            <p className="text-[22px] font-semibold tracking-tight">
              <span className="text-white">easy</span>
              <span className="text-teal-300">CMDB</span>
            </p>
            <h1 className="text-4xl leading-[1.05] font-bold tracking-[-0.03em] text-balance text-white sm:text-[56px]">
              From any point… to everything related.
            </h1>
            <p className="max-w-[440px] text-[17px] leading-relaxed text-[#a7c4c1]">
              Start from a landscape, an account number or a single resource,
              and follow the links to everything it touches.
            </p>
          </div>

          <div className="flex flex-col gap-4 rounded-[14px] border border-teal-300/25 bg-white/5 p-7 shadow-[0_24px_60px_rgb(0_0_0/0.35)]">
            <h2 className="text-lg font-semibold text-white">Sign in</h2>

            {cognitoMisconfigured && !showBasicLogin ? (
              <div className="rounded-md border border-amber-300/40 bg-amber-950/60 px-3 py-2 text-sm text-amber-100">
                Cognito sign-in is not configured. Set the{' '}
                <code className="text-xs">VITE_COGNITO_*</code> environment
                variables and redeploy, or set{' '}
                <code className="text-xs">VITE_AUTH_MODE=basic</code> for
                username/password auth.
              </div>
            ) : null}

            {showBasicLogin ? (
              <form
                className="flex flex-col gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void startBasic();
                }}
              >
                <div className="space-y-1.5">
                  <Label className="text-teal-100" htmlFor="username">
                    Username
                  </Label>
                  <Input
                    autoComplete="username"
                    className={inputClass}
                    id="username"
                    value={basicUser}
                    onChange={(e) => setBasicUser(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-teal-100" htmlFor="password">
                    Password
                  </Label>
                  <Input
                    autoComplete="current-password"
                    className={inputClass}
                    id="password"
                    type="password"
                    value={basicPassword}
                    onChange={(e) => setBasicPassword(e.target.value)}
                  />
                </div>
                <Button
                  className="mt-1 h-11 w-full rounded-lg bg-teal-400 text-[15px] font-semibold text-teal-950 hover:bg-teal-300"
                  disabled={basicLoading}
                  type="submit"
                >
                  {basicLoading ? 'Signing in…' : 'Sign in'}
                  <ArrowRight className="ml-2 size-4" />
                </Button>
              </form>
            ) : null}

            {showDivider ? <Separator className="my-2 bg-white/15" /> : null}

            {showCognitoLogin ? (
              <div className="space-y-3">
                {showDivider ? (
                  <p className="text-sm text-[#a7c4c1]">
                    Or use your organization SSO (Cognito hosted UI).
                  </p>
                ) : null}
                <Button
                  className={cn(
                    'h-11 w-full rounded-lg text-[15px] font-semibold',
                    showBasicLogin
                      ? 'border-teal-100/30 bg-transparent text-white hover:bg-white/10 hover:text-white'
                      : 'bg-teal-400 text-teal-950 hover:bg-teal-300',
                  )}
                  disabled={cognitoLoading}
                  type="button"
                  variant={showBasicLogin ? 'outline' : 'default'}
                  onClick={() => void startCognito()}
                >
                  <LogIn className="mr-2 size-4" />
                  {cognitoLoading ? 'Redirecting…' : 'Sign in with SSO'}
                </Button>
              </div>
            ) : null}

            {cognitoMisconfigured && showBasicLogin ? (
              <div className="rounded-md bg-white/5 px-3 py-2 text-sm text-[#a7c4c1]">
                SSO is not configured for this build. Use username/password
                above, or set <code className="text-xs">VITE_COGNITO_*</code> to
                enable Cognito sign-in.
              </div>
            ) : null}
          </div>
        </div>

        <RelationshipMap className="hidden justify-self-center md:block" />
      </div>
    </div>
  );
}
