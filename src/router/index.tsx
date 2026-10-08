import { lazy, type ReactNode, Suspense } from 'react';
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
  useLocation,
} from 'react-router';

import {
  selectCanManageApplications,
  selectIsAdmin,
  selectIsLoggedIn,
  useAuthStore,
} from '@/stores/auth';

import AppShell from '@/components/AppShell';

const LoginPage = lazy(() => import('@/pages/LoginPage'));
const AuthCallbackPage = lazy(() => import('@/pages/AuthCallbackPage'));
const AllApplicationsPage = lazy(
  () => import('@/pages/discover/AllApplicationsPage'),
);
const AllLandscapesPage = lazy(
  () => import('@/pages/discover/AllLandscapesPage'),
);
const AllResourcesPage = lazy(
  () => import('@/pages/discover/AllResourcesPage'),
);
const SelectedAppPage = lazy(() => import('@/pages/discover/SelectedAppPage'));
const SelectedLandscapePage = lazy(
  () => import('@/pages/discover/SelectedLandscapePage'),
);
const SelectedProviderAccountPage = lazy(
  () => import('@/pages/discover/SelectedProviderAccountPage'),
);
const ApplicationsPage = lazy(() =>
  import('@/pages/manage/ApplicationsPage').then((m) => ({
    default: m.ApplicationsPage,
  })),
);
const LandscapesPage = lazy(() =>
  import('@/pages/manage/LandscapesPage').then((m) => ({
    default: m.LandscapesPage,
  })),
);
const LandscapeEnvironmentsPage = lazy(() =>
  import('@/pages/manage/LandscapeEnvironmentsPage').then((m) => ({
    default: m.LandscapeEnvironmentsPage,
  })),
);
const ResourcesPage = lazy(() =>
  import('@/pages/manage/ResourcesPage').then((m) => ({
    default: m.ResourcesPage,
  })),
);
const HostingProvidersPage = lazy(() =>
  import('@/pages/manage/HostingProvidersPage').then((m) => ({
    default: m.HostingProvidersPage,
  })),
);

function PageLoader() {
  return <div className="p-6 text-muted-foreground">Loading…</div>;
}

function withSuspense(element: ReactNode) {
  return <Suspense fallback={<PageLoader />}>{element}</Suspense>;
}

function HydrateAuth() {
  const hydrated = useAuthStore((s) => s.hydrated);
  if (!hydrated) {
    useAuthStore.getState().hydrateFromSession();
  }
  return <Outlet />;
}

function PublicLoginRoute() {
  const isLoggedIn = useAuthStore((s) => selectIsLoggedIn(s));
  if (isLoggedIn) {
    return <Navigate replace to="/all-applications" />;
  }
  return withSuspense(<LoginPage />);
}

function RequireAuth() {
  const location = useLocation();
  const isLoggedIn = useAuthStore((s) => selectIsLoggedIn(s));

  if (!isLoggedIn) {
    const redirect = `${location.pathname}${location.search}`;
    return (
      <Navigate
        replace
        to={`/login?redirect=${encodeURIComponent(redirect)}`}
      />
    );
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

function AdminGuard() {
  const isAdmin = useAuthStore((s) => selectIsAdmin(s));
  if (!isAdmin) {
    return <Navigate replace to="/all-applications" />;
  }
  return <Outlet />;
}

function AppEditGuard() {
  const canManage = useAuthStore((s) => selectCanManageApplications(s));
  if (!canManage) {
    return <Navigate replace to="/all-applications" />;
  }
  return <Outlet />;
}

export const router = createBrowserRouter(
  [
    {
      element: <HydrateAuth />,
      children: [
        {
          path: '/login',
          element: <PublicLoginRoute />,
        },
        {
          path: '/auth/callback',
          element: withSuspense(<AuthCallbackPage />),
        },
        {
          element: <RequireAuth />,
          children: [
            {
              index: true,
              element: <Navigate replace to="/all-applications" />,
            },
            {
              path: 'all-applications',
              element: withSuspense(<AllApplicationsPage />),
            },
            {
              path: 'all-landscapes',
              element: withSuspense(<AllLandscapesPage />),
            },
            {
              path: 'all-resources',
              element: withSuspense(<AllResourcesPage />),
            },
            {
              path: 'applications/:appAlias',
              element: withSuspense(<SelectedAppPage />),
            },
            {
              path: 'landscapes/:landscapeName',
              element: withSuspense(<SelectedLandscapePage />),
            },
            {
              path: 'provider-accounts/:providerAccountName',
              element: withSuspense(<SelectedProviderAccountPage />),
            },
            {
              element: <AppEditGuard />,
              children: [
                {
                  path: 'applications',
                  element: withSuspense(<ApplicationsPage />),
                },
              ],
            },
            {
              element: <AdminGuard />,
              children: [
                {
                  path: 'landscapes',
                  element: withSuspense(<LandscapesPage />),
                },
                {
                  path: 'landscape-environments',
                  element: withSuspense(<LandscapeEnvironmentsPage />),
                },
                {
                  path: 'resources',
                  element: withSuspense(<ResourcesPage />),
                },
                {
                  path: 'hosting-providers',
                  element: withSuspense(<HostingProvidersPage />),
                },
              ],
            },
          ],
        },
      ],
    },
  ],
  {
    basename: import.meta.env.BASE_URL,
  },
);

export default function AppRouter() {
  return <RouterProvider router={router} />;
}
