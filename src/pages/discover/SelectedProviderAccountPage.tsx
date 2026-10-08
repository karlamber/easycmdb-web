import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';

import { type ColumnDef } from '@tanstack/react-table';
import {
  ArrowLeft,
  ExternalLink,
  FilterX,
  Globe,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

import * as cmdb from '@/api/cmdb';
import { parseApiError } from '@/api/http';

import { DataTable } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import { SearchField } from '@/components/SearchField';
import { HostingProviderBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

import { cn } from '@/lib/utils';

import { coerceSearchInputModelValue } from '@/utils/form';
import { providerAccountName } from '@/utils/provider-account';

import type {
  Application,
  Landscape,
  LandscapeEnvironment,
  Resource,
} from '@/types/cmdb';

type ResourceRow = {
  id: string;
  name: string;
  app_alias: string | null;
  landscape_name: string;
  environment_name: string;
  provider_account_name: string;
  service: string | null;
  resource_type: string | null;
  region: string | null;
};

function uniqueSorted(values: (string | null)[]): string[] {
  const set = new Set<string>();
  for (const v of values) {
    if (v) set.add(v);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export default function SelectedProviderAccountPage() {
  const { providerAccountName: accountParam = '' } = useParams<{
    providerAccountName: string;
  }>();

  const [applications, setApplications] = useState<Application[]>([]);
  const [landscapes, setLandscapes] = useState<Landscape[]>([]);
  const [environments, setEnvironments] = useState<LandscapeEnvironment[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(false);

  async function load(): Promise<void> {
    setLoading(true);
    try {
      const [apps, ls, envs, res] = await Promise.all([
        cmdb.listApplications(false),
        cmdb.listLandscapes(false),
        cmdb.listLandscapeEnvironments(false),
        cmdb.listResources(false, {}),
      ]);
      setApplications(apps);
      setLandscapes(ls);
      setEnvironments(envs);
      setResources(res);
    } catch (err) {
      toast.error(await parseApiError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [accountParam]);

  const matchingEnvironments = useMemo(
    () => environments.filter((e) => e.provider_account_name === accountParam),
    [environments, accountParam],
  );

  const notFound = !loading && matchingEnvironments.length === 0;

  const matchingEnvironmentIds = useMemo(
    () => new Set(matchingEnvironments.map((e) => e.id)),
    [matchingEnvironments],
  );

  const hostingProviders = useMemo(() => {
    const set = new Set<string>();
    for (const e of matchingEnvironments) set.add(e.hosting_provider);
    return Array.from(set).sort();
  }, [matchingEnvironments]);

  const accountNumbers = useMemo(() => {
    const set = new Set<string>();
    for (const e of matchingEnvironments) {
      if (e.provider_account_number) set.add(e.provider_account_number);
    }
    return Array.from(set).sort();
  }, [matchingEnvironments]);

  const directLinkByAccountNumber = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of matchingEnvironments) {
      const num = e.provider_account_number;
      if (num && e.direct_link && !map.has(num)) {
        map.set(num, e.direct_link);
      }
    }
    return map;
  }, [matchingEnvironments]);

  const landscapeById = useMemo(() => {
    const map = new Map<string, Landscape>();
    for (const l of landscapes) map.set(l.id, l);
    return map;
  }, [landscapes]);

  const applicationById = useMemo(() => {
    const map = new Map<string, Application>();
    for (const a of applications) map.set(a.id, a);
    return map;
  }, [applications]);

  const environmentById = useMemo(() => {
    const map = new Map<string, LandscapeEnvironment>();
    for (const e of environments) map.set(e.id, e);
    return map;
  }, [environments]);

  const relatedLandscapes = useMemo(() => {
    const ids = new Set<string>();
    for (const e of matchingEnvironments) ids.add(e.landscape_id);
    return Array.from(ids)
      .map((id) => landscapeById.get(id))
      .filter((l): l is Landscape => l != null)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [matchingEnvironments, landscapeById]);

  const resourceRows = useMemo<ResourceRow[]>(() => {
    const ids = matchingEnvironmentIds;
    if (ids.size === 0) return [];
    return resources
      .filter((r) => ids.has(r.landscape_environment_id))
      .map((r) => {
        const env = environmentById.get(r.landscape_environment_id);
        const ls = landscapeById.get(r.landscape_id);
        const app = r.application_id
          ? applicationById.get(r.application_id)
          : null;
        return {
          id: r.id,
          name: r.name,
          app_alias: app?.app_alias ?? null,
          landscape_name: ls?.name ?? `#${r.landscape_id}`,
          environment_name:
            env?.environment_name ?? `#${r.landscape_environment_id}`,
          provider_account_name: providerAccountName(
            env,
            r.landscape_environment_id,
          ),
          service: r.service,
          resource_type: r.resource_type,
          region: r.region,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [
    matchingEnvironmentIds,
    resources,
    environmentById,
    landscapeById,
    applicationById,
  ]);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterApplication, setFilterApplication] = useState<string | null>(
    null,
  );
  const [filterService, setFilterService] = useState<string | null>(null);
  const [filterResourceType, setFilterResourceType] = useState<string | null>(
    null,
  );

  const applicationOptions = useMemo(
    () => uniqueSorted(resourceRows.map((r) => r.app_alias)),
    [resourceRows],
  );
  const serviceOptions = useMemo(
    () => uniqueSorted(resourceRows.map((r) => r.service)),
    [resourceRows],
  );
  const resourceTypeOptions = useMemo(
    () => uniqueSorted(resourceRows.map((r) => r.resource_type)),
    [resourceRows],
  );

  const filteredResourceRows = useMemo(() => {
    const q = coerceSearchInputModelValue(searchTerm).trim().toLowerCase();
    return resourceRows.filter((r) => {
      if (filterApplication && r.app_alias !== filterApplication) return false;
      if (filterService && r.service !== filterService) return false;
      if (filterResourceType && r.resource_type !== filterResourceType)
        return false;
      if (q === '') return true;
      const haystack: (string | null)[] = [
        r.name,
        r.app_alias,
        r.landscape_name,
        r.environment_name,
        r.provider_account_name,
        r.service,
        r.resource_type,
        r.region,
      ];
      return haystack.some((v) => v != null && v.toLowerCase().includes(q));
    });
  }, [
    resourceRows,
    searchTerm,
    filterApplication,
    filterService,
    filterResourceType,
  ]);

  const hasActiveFilters =
    coerceSearchInputModelValue(searchTerm).trim() !== '' ||
    filterApplication != null ||
    filterService != null ||
    filterResourceType != null;

  const resourceColumns = useMemo<ColumnDef<ResourceRow>[]>(
    () => [
      { accessorKey: 'name', header: 'Name' },
      {
        accessorKey: 'app_alias',
        header: 'Application',
        cell: ({ row }) => {
          const alias = row.original.app_alias;
          if (!alias) return <span className="text-slate-400">—</span>;
          return (
            <Link
              to={`/applications/${encodeURIComponent(alias)}`}
              className="text-teal-700 hover:underline"
            >
              {alias}
            </Link>
          );
        },
      },
      {
        accessorKey: 'landscape_name',
        header: 'Landscape',
        cell: ({ row }) => (
          <Link
            to={`/landscapes/${encodeURIComponent(row.original.landscape_name)}`}
            className="text-teal-700 hover:underline"
          >
            {row.original.landscape_name}
          </Link>
        ),
      },
      { accessorKey: 'environment_name', header: 'Environment' },
      {
        accessorKey: 'service',
        header: 'Service',
        cell: ({ row }) => row.original.service ?? '—',
      },
      {
        accessorKey: 'resource_type',
        header: 'Resource Type',
        cell: ({ row }) => row.original.resource_type ?? '—',
      },
      {
        accessorKey: 'region',
        header: 'Region',
        cell: ({ row }) => row.original.region ?? '—',
      },
    ],
    [],
  );

  return (
    <div>
      <div className="mb-6 flex items-center gap-2">
        <Button type="button" variant="ghost" size="icon" asChild>
          <Link to="/all-applications" aria-label="Back">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Provider Account: {accountParam}
        </h1>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="ml-auto"
          onClick={() => void load()}
          aria-label="Refresh"
        >
          <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
        </Button>
      </div>

      {notFound ? (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          No environments found using provider account name “{accountParam}”.
        </div>
      ) : null}

      {!notFound ? (
        <>
          <div className="mb-6 grid gap-6 lg:grid-cols-2">
            <section className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="mb-4 text-lg font-medium text-slate-900">
                Summary
              </h2>
              <dl className="divide-y divide-slate-100">
                <div className="grid gap-1 py-3 sm:grid-cols-[200px_1fr]">
                  <dt className="text-sm font-medium text-slate-600">
                    Provider account name
                  </dt>
                  <dd className="text-sm">{accountParam}</dd>
                </div>
                <div className="grid gap-1 py-3 sm:grid-cols-[200px_1fr]">
                  <dt className="text-sm font-medium text-slate-600">
                    Hosting provider
                  </dt>
                  <dd className="flex flex-wrap gap-1">
                    {hostingProviders.length === 0 ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      hostingProviders.map((hp) => (
                        <HostingProviderBadge key={hp} provider={hp} />
                      ))
                    )}
                  </dd>
                </div>
                <div className="grid gap-1 py-3 sm:grid-cols-[200px_1fr]">
                  <dt className="text-sm font-medium text-slate-600">
                    Account numbers
                  </dt>
                  <dd className="text-sm">
                    {accountNumbers.length === 0 ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      accountNumbers.map((num, idx) => {
                        const link = directLinkByAccountNumber.get(num);
                        return (
                          <span key={num}>
                            {link ? (
                              <a
                                href={link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-teal-700 hover:underline"
                              >
                                {num}
                                <ExternalLink className="size-3.5" />
                              </a>
                            ) : (
                              num
                            )}
                            {idx < accountNumbers.length - 1 ? ', ' : null}
                          </span>
                        );
                      })
                    )}
                  </dd>
                </div>
                <div className="grid gap-1 py-3 sm:grid-cols-[200px_1fr]">
                  <dt className="text-sm font-medium text-slate-600">
                    Environments
                  </dt>
                  <dd className="text-sm">
                    {matchingEnvironments.length === 0
                      ? '—'
                      : matchingEnvironments.length}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="mb-4 text-lg font-medium text-slate-900">
                Landscapes using this provider account
              </h2>
              {relatedLandscapes.length > 0 ? (
                <ul className="divide-y divide-slate-100">
                  {relatedLandscapes.map((l) => (
                    <li key={l.id}>
                      <Link
                        to={`/landscapes/${encodeURIComponent(l.name)}`}
                        className="flex items-start gap-3 py-3 hover:bg-slate-50"
                      >
                        <Globe className="mt-0.5 size-4 shrink-0 text-teal-700" />
                        <div>
                          <div className="font-medium text-teal-700">
                            {l.name}
                          </div>
                          {l.organization ? (
                            <div className="text-sm text-slate-500">
                              {l.organization}
                            </div>
                          ) : null}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">No landscapes.</p>
              )}
            </section>
          </div>

          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <PageHeader
              title="Resources"
              countLabel={`${filteredResourceRows.length} of ${resourceRows.length}`}
              className="mb-4"
            />

            <div className="mb-4 flex flex-wrap items-end gap-3">
              <SearchField
                label="Search resources"
                placeholder="Name, service, region…"
                value={searchTerm}
                onChange={setSearchTerm}
                className="min-w-[200px] flex-1 md:max-w-md"
              />
              <div className="min-w-[140px] space-y-1.5">
                <Label
                  htmlFor="pa-filter-app"
                  className="text-sm text-slate-600"
                >
                  Application
                </Label>
                <select
                  id="pa-filter-app"
                  value={filterApplication ?? ''}
                  onChange={(e) =>
                    setFilterApplication(
                      e.target.value === '' ? null : e.target.value,
                    )
                  }
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="">All</option>
                  {applicationOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-[120px] space-y-1.5">
                <Label
                  htmlFor="pa-filter-service"
                  className="text-sm text-slate-600"
                >
                  Service
                </Label>
                <select
                  id="pa-filter-service"
                  value={filterService ?? ''}
                  onChange={(e) =>
                    setFilterService(
                      e.target.value === '' ? null : e.target.value,
                    )
                  }
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="">All</option>
                  {serviceOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-[120px] space-y-1.5">
                <Label
                  htmlFor="pa-filter-type"
                  className="text-sm text-slate-600"
                >
                  Resource Type
                </Label>
                <select
                  id="pa-filter-type"
                  value={filterResourceType ?? ''}
                  onChange={(e) =>
                    setFilterResourceType(
                      e.target.value === '' ? null : e.target.value,
                    )
                  }
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="">All</option>
                  {resourceTypeOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!hasActiveFilters}
                onClick={() => {
                  setSearchTerm('');
                  setFilterApplication(null);
                  setFilterService(null);
                  setFilterResourceType(null);
                }}
              >
                <FilterX className="mr-1.5 size-4" />
                Reset
              </Button>
            </div>

            <DataTable
              columns={resourceColumns}
              data={filteredResourceRows}
              loading={loading}
              getRowId={(row) => row.id}
            />
          </section>
        </>
      ) : null}
    </div>
  );
}
