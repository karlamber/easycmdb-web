import { useMemo, useState } from 'react';
import { Link } from 'react-router';

import { type ColumnDef } from '@tanstack/react-table';
import { FilterX } from 'lucide-react';
import { toast } from 'sonner';

import { parseApiError } from '@/api/http';

import { DataTable } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import { SearchField } from '@/components/SearchField';
import { DataClassBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { useApplications } from '@/hooks/useApplications';
import { useLandscapes } from '@/hooks/useLandscapes';
import { useResources } from '@/hooks/useResources';

import { coerceSearchInputModelValue } from '@/utils/form';

import type { Application, Landscape } from '@/types/cmdb';

type Row = {
  id: string;
  app_alias: string;
  description: string | null;
  business_name: string | null;
  data_class: Application['data_class'];
  landscapes: { id: string; name: string }[];
};

export default function AllApplicationsPage() {
  const appsQuery = useApplications(false);
  const landscapesQuery = useLandscapes(false);
  const resourcesQuery = useResources(false);

  const loading =
    appsQuery.isLoading ||
    landscapesQuery.isLoading ||
    resourcesQuery.isLoading;
  const refreshing =
    appsQuery.isFetching ||
    landscapesQuery.isFetching ||
    resourcesQuery.isFetching;

  const [searchTerm, setSearchTerm] = useState('');

  const rows = useMemo<Row[]>(() => {
    const applications = appsQuery.data ?? [];
    const landscapes = landscapesQuery.data ?? [];
    const resources = resourcesQuery.data ?? [];

    const landscapeById = new Map<string, Landscape>();
    for (const l of landscapes) {
      landscapeById.set(l.id, l);
    }

    const landscapeIdsByApp = new Map<string, Set<string>>();
    for (const r of resources) {
      if (!r.application_id) continue;
      const set = landscapeIdsByApp.get(r.application_id) ?? new Set<string>();
      set.add(r.landscape_id);
      landscapeIdsByApp.set(r.application_id, set);
    }

    return applications.map((app) => {
      const ids = Array.from(
        landscapeIdsByApp.get(app.id) ?? new Set<string>(),
      );
      const landscapesForApp = ids
        .map((id) => landscapeById.get(id))
        .filter((l): l is Landscape => l != null)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((l) => ({ id: l.id, name: l.name }));

      return {
        id: app.id,
        app_alias: app.app_alias,
        description: app.description,
        business_name: app.business_name,
        data_class: app.data_class,
        landscapes: landscapesForApp,
      };
    });
  }, [appsQuery.data, landscapesQuery.data, resourcesQuery.data]);

  const filteredRows = useMemo(() => {
    const q = coerceSearchInputModelValue(searchTerm).trim().toLowerCase();
    if (q === '') return rows;
    return rows.filter((r) => {
      const landscapeNames = r.landscapes.map((l) => l.name).join(', ');
      const haystack: (string | null)[] = [
        r.app_alias,
        r.description,
        r.business_name,
        r.data_class,
        landscapeNames || null,
      ];
      return haystack.some((v) => v != null && v.toLowerCase().includes(q));
    });
  }, [rows, searchTerm]);

  const hasActiveSearch = coerceSearchInputModelValue(searchTerm).trim() !== '';

  async function refresh(): Promise<void> {
    try {
      await Promise.all([
        appsQuery.refetch(),
        landscapesQuery.refetch(),
        resourcesQuery.refetch(),
      ]);
    } catch (err) {
      toast.error(await parseApiError(err));
    }
  }

  const columns = useMemo<ColumnDef<Row>[]>(
    () => [
      {
        accessorKey: 'app_alias',
        header: 'Name',
        cell: ({ row }) => (
          <Link
            to={`/applications/${encodeURIComponent(row.original.app_alias)}`}
            className="font-medium text-teal-700 hover:text-teal-900 hover:underline"
          >
            {row.original.app_alias}
          </Link>
        ),
      },
      {
        accessorKey: 'description',
        header: 'Description',
        cell: ({ row }) => {
          const desc = row.original.description;
          if (!desc) return <span className="text-slate-400">—</span>;
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="line-clamp-2 max-w-[360px]">{desc}</span>
                </TooltipTrigger>
                <TooltipContent className="max-w-md">{desc}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        },
      },
      {
        accessorKey: 'business_name',
        header: 'Business Name',
        cell: ({ row }) => row.original.business_name ?? '—',
      },
      {
        id: 'landscapes',
        header: 'Landscape',
        accessorFn: (row) => row.landscapes.map((l) => l.name).join(', '),
        cell: ({ row }) => {
          const landscapes = row.original.landscapes;
          if (landscapes.length === 0) {
            return <span className="text-slate-400">—</span>;
          }
          return (
            <>
              {landscapes.map((l, idx) => (
                <span key={l.id}>
                  <Link
                    to={`/landscapes/${encodeURIComponent(l.name)}`}
                    className="text-teal-700 hover:text-teal-900 hover:underline"
                  >
                    {l.name}
                  </Link>
                  {idx < landscapes.length - 1 ? ', ' : null}
                </span>
              ))}
            </>
          );
        },
      },
      {
        accessorKey: 'data_class',
        header: 'Data Class',
        cell: ({ row }) => <DataClassBadge value={row.original.data_class} />,
      },
    ],
    [],
  );

  return (
    <div>
      <PageHeader
        title="Discover Applications"
        countLabel={`${filteredRows.length} of ${rows.length}`}
        onRefresh={() => void refresh()}
        refreshing={refreshing}
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <SearchField
          label="Search applications"
          placeholder="Name, description, business name, landscape, data class…"
          value={searchTerm}
          onChange={setSearchTerm}
          className="min-w-[240px] flex-1 md:max-w-sm"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!hasActiveSearch}
          onClick={() => setSearchTerm('')}
        >
          <FilterX className="mr-1.5 size-4" />
          Reset search
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={filteredRows}
        loading={loading}
        getRowId={(row) => row.id}
      />
    </div>
  );
}
