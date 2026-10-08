import { type ReactNode, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router';

import {
  AppWindow,
  ChevronDown,
  ChevronRight,
  Cloud,
  LayoutGrid,
  LogOut,
  Menu,
  Network,
  Server,
  Settings,
  X,
} from 'lucide-react';

import {
  selectCanManageApplications,
  selectDisplayUser,
  selectIsAdmin,
  useAuthStore,
} from '@/stores/auth';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

import { cn } from '@/lib/utils';

import { readCognitoConfig } from '@/auth/cognito';

const REFRESH_TICK_MS = 30_000;

type SidebarLinkProps = {
  to: string;
  icon: React.ReactNode;
  label: string;
  end?: boolean;
  onNavigate?: () => void;
};

function SidebarLink({ to, icon, label, end, onNavigate }: SidebarLinkProps) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
          isActive
            ? 'bg-teal-50 font-medium text-teal-900'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
        )
      }
    >
      <span className="shrink-0 opacity-80">{icon}</span>
      <span>{label}</span>
    </NavLink>
  );
}

export default function AppShell({ children }: { children?: ReactNode }) {
  const navigate = useNavigate();
  const displayUser = useAuthStore(selectDisplayUser);
  const canManageApplications = useAuthStore(selectCanManageApplications);
  const isAdmin = useAuthStore(selectIsAdmin);
  const authKind = useAuthStore((s) => s.authKind);
  const shouldRefreshSoon = useAuthStore((s) => s.shouldRefreshSoon);
  const tryRefreshCognito = useAuthStore((s) => s.tryRefreshCognito);
  const logout = useAuthStore((s) => s.logout);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [managementOpen, setManagementOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      if (authKind !== 'cognito') return;
      if (!shouldRefreshSoon()) return;
      const cfg = readCognitoConfig();
      if (!cfg) return;
      void tryRefreshCognito(cfg);
    }, REFRESH_TICK_MS);
    return () => clearInterval(timer);
  }, [authKind, shouldRefreshSoon, tryRefreshCognito]);

  async function handleLogout(): Promise<void> {
    const cfg = readCognitoConfig();
    logout();
    if (cfg) return;
    try {
      await navigate('/login', { replace: true });
    } catch {
      window.location.assign('/login');
    }
  }

  function closeMobile(): void {
    setMobileOpen(false);
  }

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1 px-3 py-4">
        <p className="mb-2 px-3 text-xs font-semibold tracking-wide text-slate-400 uppercase">
          Discover
        </p>
        <nav className="space-y-1">
          <SidebarLink
            to="/all-applications"
            icon={<AppWindow className="size-4" />}
            label="Applications"
            onNavigate={closeMobile}
          />
          <SidebarLink
            to="/all-landscapes"
            icon={<Network className="size-4" />}
            label="Landscapes"
            onNavigate={closeMobile}
          />
          <SidebarLink
            to="/all-resources"
            icon={<LayoutGrid className="size-4" />}
            label="Resources"
            onNavigate={closeMobile}
          />
        </nav>

        {canManageApplications ? (
          <>
            <Separator className="my-4" />
            <button
              type="button"
              className="mb-2 flex w-full items-center gap-2 px-3 text-xs font-semibold tracking-wide text-slate-400 uppercase"
              onClick={() => setManagementOpen((v) => !v)}
            >
              <Settings className="size-3.5" />
              Management
              {managementOpen ? (
                <ChevronDown className="ml-auto size-3.5" />
              ) : (
                <ChevronRight className="ml-auto size-3.5" />
              )}
            </button>
            {managementOpen ? (
              <nav className="space-y-1 pl-2">
                <SidebarLink
                  to="/applications"
                  icon={<AppWindow className="size-4" />}
                  label="Applications"
                  onNavigate={closeMobile}
                />
                {isAdmin ? (
                  <>
                    <SidebarLink
                      to="/landscapes"
                      icon={<Network className="size-4" />}
                      label="Landscapes"
                      onNavigate={closeMobile}
                    />
                    <SidebarLink
                      to="/landscape-environments"
                      icon={<Server className="size-4" />}
                      label="Environments"
                      onNavigate={closeMobile}
                    />
                    <SidebarLink
                      to="/resources"
                      icon={<LayoutGrid className="size-4" />}
                      label="Resources"
                      onNavigate={closeMobile}
                    />
                    <SidebarLink
                      to="/hosting-providers"
                      icon={<Cloud className="size-4" />}
                      label="Hosting providers"
                      onNavigate={closeMobile}
                    />
                  </>
                ) : null}
              </nav>
            ) : null}
          </>
        ) : null}
      </ScrollArea>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-[var(--surface,#f1f5f9)]">
      <header className="sticky top-0 z-40 border-b border-teal-900/20 bg-[var(--header,#134e4a)] text-white shadow-sm">
        <div className="flex h-14 items-center gap-2 px-4">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10 lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="hidden text-white hover:bg-white/10 lg:inline-flex"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="Toggle sidebar"
          >
            <Menu className="size-5" />
          </Button>
          <Link
            to="/all-applications"
            className="text-lg font-medium tracking-tight"
          >
            easyCMDB
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-teal-100 sm:inline">
              {displayUser}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/10"
              onClick={() => void handleLogout()}
            >
              <LogOut className="mr-1.5 size-4" />
              Log out
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        <aside
          className={cn(
            'hidden shrink-0 border-r border-slate-200 bg-white transition-[width] duration-200 lg:block',
            sidebarOpen ? 'w-60' : 'w-0 overflow-hidden border-r-0',
          )}
        >
          {sidebarOpen ? sidebarContent : null}
        </aside>

        {mobileOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-black/40"
              aria-label="Close menu overlay"
              onClick={closeMobile}
            />
            <aside className="relative flex h-full w-72 max-w-[85vw] flex-col bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <span className="font-medium text-slate-900">Menu</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={closeMobile}
                  aria-label="Close menu"
                >
                  <X className="size-5" />
                </Button>
              </div>
              {sidebarContent}
            </aside>
          </div>
        ) : null}

        <main className="flex-1 overflow-auto p-4 md:p-6">
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  );
}
