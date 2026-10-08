import { useMemo, useState } from 'react';
import { Link } from 'react-router';

import { type ColumnDef } from '@tanstack/react-table';
import { FilterX } from 'lucide-react';
import { toast } from 'sonner';

import { parseApiError } from '@/api/http';

import { DataTable } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import { SearchField } from '@/components/SearchField';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

import { useApplications } from '@/hooks/useApplications';
import { useLandscapeEnvironments } from '@/hooks/useLandscapeEnvironments';
import { useLandscapes } from '@/hooks/useLandscapes';
import { useResources } from '@/hooks/useResources';

import { coerceSearchInputModelValue } from '@/utils/form';
import { providerAccountName } from '@/utils/provider-account';

import type {
  Application,
  Landscape,
  LandscapeEnvironment,
} from '@/types/cmdb';

type ResourceRow = {
  id: string;
  name: string;
  app_alias: string | null;
  landscape_name: string;
  provider_account_name: string;
  provider_account_link: string | null;
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

function FilterSelect({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string | null;
  options: string[];
  onChange: (value: string | null) => void;
}) {
  return (
    <div className="min-w-[120px] space-y-1.5">
      <Label htmlFor={id} className="text-sm text-slate-600">
        {label}
      </Label>
      <select
        id={id}
        value={value ?? ''}
        onChange={(e) =>
          onChange(e.target.value === '' ? null : e.target.value)
        }
        className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-xs outline-none focus-visible:border-teal-600 focus-visible:ring-2 focus-visible:ring-teal-600/20"
      >
        <option value="">All</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function AllResourcesPage() {
  const appsQuery = useApplications(false);
  const landscapesQuery = useLandscapes(false);
  const envsQuery = useLandscapeEnvironments(false);
  const resourcesQuery = useResources(false);

  const loading =
    appsQuery.isLoading ||
    landscapesQuery.isLoading ||
    envsQuery.isLoading ||
    resourcesQuery.isLoading;
  const refreshing =
    appsQuery.isFetching ||
    landscapesQuery.isFetching ||
    envsQuery.isFetching ||
    resourcesQuery.isFetching;

  const [searchTerm, setSearchTerm] = useState('');
  const [filterApplication, setFilterApplication] = useState<string | null>(
    null,
  );
  const [filterLandscape, setFilterLandscape] = useState<string | null>(null);
  const [filterProviderAccount, setFilterProviderAccount] = useState<
    string | null
  >(null);
  const [filterService, setFilterService] = useState<string | null>(null);
  const [filterResourceType, setFilterResourceType] = useState<string | null>(
    null,
  );

  const resourceRows = useMemo<ResourceRow[]>(() => {
    const applications = appsQuery.data ?? [];
    const landscapes = landscapesQuery.data ?? [];
    const environments = envsQuery.data ?? [];
    const resources = resourcesQuery.data ?? [];

    const landscapeById = new Map<string, Landscape>();
    for (const l of landscapes) landscapeById.set(l.id, l);

    const applicationById = new Map<string, Application>();
    for (const a of applications) applicationById.set(a.id, a);

    const environmentById = new Map<string, LandscapeEnvironment>();
    for (const e of environments) environmentById.set(e.id, e);

    return resources
      .map((r) => {
        const env = environmentById.get(r.landscape_environment_id);
        const ls = landscapeById.get(r.landscape_id);
        const app = r.application_id
          ? applicationById.get(r.application_id)
          : null;
        const accountName = providerAccountName(
          env,
          r.landscape_environment_id,
        );
        const accountLink = env?.provider_account_name?.trim() ?? null;
        return {
          id: r.id,
          name: r.name,
          app_alias: app?.app_alias ?? null,
          landscape_name: ls?.name ?? `#${r.landscape_id}`,
          provider_account_name: accountName,
          provider_account_link: accountLink,
          service: r.service,
          resource_type: r.resource_type,
          region: r.region,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [
    appsQuery.data,
    landscapesQuery.data,
    envsQuery.data,
    resourcesQuery.data,
  ]);

  const applicationOptions = useMemo(
    () => uniqueSorted(resourceRows.map((r) => r.app_alias)),
    [resourceRows],
  );
  const landscapeOptions = useMemo(
    () => uniqueSorted(resourceRows.map((r) => r.landscape_name)),
    [resourceRows],
  );
  const providerAccountOptions = useMemo(
    () => uniqueSorted(resourceRows.map((r) => r.provider_account_name)),
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
      if (filterLandscape && r.landscape_name !== filterLandscape) return false;
      if (
        filterProviderAccount &&
        r.provider_account_name !== filterProviderAccount
      )
        return false;
      if (filterService && r.service !== filterService) return false;
      if (filterResourceType && r.resource_type !== filterResourceType)
        return false;
      if (q === '') return true;
      const haystack: (string | null)[] = [
        r.name,
        r.app_alias,
        r.landscape_name,
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
    filterLandscape,
    filterProviderAccount,
    filterService,
    filterResourceType,
  ]);

  const hasActiveFilters =
    coerceSearchInputModelValue(searchTerm).trim() !== '' ||
    filterApplication != null ||
    filterLandscape != null ||
    filterProviderAccount != null ||
    filterService != null ||
    filterResourceType != null;

  async function refresh(): Promise<void> {
    try {
      await Promise.all([
        appsQuery.refetch(),
        landscapesQuery.refetch(),
        envsQuery.refetch(),
        resourcesQuery.refetch(),
      ]);
    } catch (err) {
      toast.error(await parseApiError(err));
    }
  }

  const columns = useMemo<ColumnDef<ResourceRow>[]>(
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
              className="text-teal-700 hover:text-teal-900 hover:underline"
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
            className="text-teal-700 hover:text-teal-900 hover:underline"
          >
            {row.original.landscape_name}
          </Link>
        ),
      },
      {
        accessorKey: 'provider_account_name',
        header: 'Provider account',
        cell: ({ row }) => {
          const link = row.original.provider_account_link;
          if (link) {
            return (
              <Link
                to={`/provider-accounts/${encodeURIComponent(link)}`}
                className="text-teal-700 hover:text-teal-900 hover:underline"
              >
                {row.original.provider_account_name}
              </Link>
            );
          }
          return row.original.provider_account_name;
        },
      },
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
      <PageHeader
        title="Discover Resources"
        countLabel={`${filteredResourceRows.length} of ${resourceRows.length}`}
        onRefresh={() => void refresh()}
        refreshing={refreshing}
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <SearchField
          label="Search resources"
          placeholder="Name, service, region…"
          value={searchTerm}
          onChange={setSearchTerm}
          className="min-w-[240px] flex-1 md:max-w-sm"
        />
        <FilterSelect
          id="filter-app"
          label="Application"
          value={filterApplication}
          options={applicationOptions}
          onChange={setFilterApplication}
        />
        <FilterSelect
          id="filter-landscape"
          label="Landscape"
          value={filterLandscape}
          options={landscapeOptions}
          onChange={setFilterLandscape}
        />
        <FilterSelect
          id="filter-account"
          label="Provider account"
          value={filterProviderAccount}
          options={providerAccountOptions}
          onChange={setFilterProviderAccount}
        />
        <FilterSelect
          id="filter-service"
          label="Service"
          value={filterService}
          options={serviceOptions}
          onChange={setFilterService}
        />
        <FilterSelect
          id="filter-type"
          label="Type"
          value={filterResourceType}
          options={resourceTypeOptions}
          onChange={setFilterResourceType}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!hasActiveFilters}
          onClick={() => {
            setSearchTerm('');
            setFilterApplication(null);
            setFilterLandscape(null);
            setFilterProviderAccount(null);
            setFilterService(null);
            setFilterResourceType(null);
          }}
        >
          <FilterX className="mr-1.5 size-4" />
          Reset filters
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={filteredResourceRows}
        loading={loading}
        getRowId={(row) => row.id}
      />
    </div>
  );
}
