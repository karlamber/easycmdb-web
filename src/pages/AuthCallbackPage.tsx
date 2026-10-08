import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { useAuthStore } from '@/stores/auth';

import { Button } from '@/components/ui/button';

import { handleCallback, readCognitoConfig } from '@/auth/cognito';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const setCognitoSession = useAuthStore((s) => s.setCognitoSession);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function run(): Promise<void> {
      const cfg = readCognitoConfig();
      if (!cfg) {
        setErrorMessage(
          'Cognito is not configured for this build. Set VITE_COGNITO_* and rebuild.',
        );
        return;
      }
      try {
        const { tokens, claims, redirectAfter } = await handleCallback(
          cfg,
          window.location.search,
        );
        setCognitoSession(tokens, claims);
        await navigate(redirectAfter, { replace: true });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Sign-in failed unexpectedly.';
        setErrorMessage(message);
        toast.error(message);
      }
    }
    void run();
  }, [navigate, setCognitoSession]);

  function backToLogin(): void {
    void navigate('/login', { replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-[420px] rounded-xl border border-slate-800 bg-white p-6 shadow-lg">
        {errorMessage ? (
          <>
            <h1 className="mb-3 text-lg font-semibold text-red-700">
              Sign-in failed
            </h1>
            <p className="mb-4 text-sm text-slate-600">{errorMessage}</p>
            <Button
              type="button"
              className="bg-teal-700 hover:bg-teal-800"
              onClick={backToLogin}
            >
              Back to sign in
            </Button>
          </>
        ) : (
          <div className="flex items-center gap-3 text-slate-700">
            <Loader2 className="size-6 animate-spin text-teal-700" />
            <span>Completing sign-in…</span>
          </div>
        )}
      </div>
    </div>
  );
}
