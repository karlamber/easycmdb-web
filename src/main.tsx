import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './index.css';
import { QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';

import { register401Handler, registerAuthorizationGetter } from '@/api/http';

import { selectAuthorizationHeader, useAuthStore } from '@/stores/auth';

import { router } from '@/router';

import { Toaster } from '@/components/ui/sonner';

import { queryClient } from '@/lib/query-client';

import App from '@/App';
import { readCognitoConfig } from '@/auth/cognito';

useAuthStore.getState().hydrateFromSession();
registerAuthorizationGetter(() =>
  selectAuthorizationHeader(useAuthStore.getState()),
);

register401Handler(async () => {
  const auth = useAuthStore.getState();
  if (auth.authKind === 'basic') {
    toast.warning('Your session has expired. Please sign in again.');
    auth.clearSession();
    void router.navigate('/login');
    return false;
  }
  if (!auth.refreshToken) return false;
  const cfg = readCognitoConfig();
  if (!cfg) return false;
  const recovered = await auth.tryRefreshCognito(cfg);
  if (!recovered) {
    toast.warning('Your session has expired. Please sign in again.');
    auth.clearSession();
    void router.navigate('/login');
  }
  return recovered;
});

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster richColors closeButton />
    </QueryClientProvider>
  </StrictMode>,
);
