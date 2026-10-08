import { useMemo } from 'react';
import { Link } from 'react-router';

import { type ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';

import { parseApiError } from '@/api/http';

import { DataTable } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import { DataClassBadge } from '@/components/StatusBadge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { useApplications } from '@/hooks/useApplications';
import { useLandscapes } from '@/hooks/useLandscapes';
import { useResources } from '@/hooks/useResources';

import type { Application, Landscape } from '@/types/cmdb';

type Row = {
  id: string;
  name: string;
  description: string | null;
  organization: string | null;
  data_class: Landscape['data_class'];
  applications: { id: string; app_alias: string }[];
};

export default function AllLandscapesPage() {
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

  const rows = useMemo<Row[]>(() => {
    const applications = appsQuery.data ?? [];
    const landscapes = landscapesQuery.data ?? [];
    const resources = resourcesQuery.data ?? [];

    const applicationById = new Map<string, Application>();
    for (const a of applications) {
      applicationById.set(a.id, a);
    }

    const appIdsByLandscape = new Map<string, Set<string>>();
    for (const r of resources) {
      if (!r.application_id) continue;
      const set = appIdsByLandscape.get(r.landscape_id) ?? new Set<string>();
      set.add(r.application_id);
      appIdsByLandscape.set(r.landscape_id, set);
    }

    return landscapes.map((l) => {
      const ids = Array.from(appIdsByLandscape.get(l.id) ?? new Set<string>());
      const appsForLandscape = ids
        .map((id) => applicationById.get(id))
        .filter((a): a is Application => a != null)
        .sort((a, b) => a.app_alias.localeCompare(b.app_alias))
        .map((a) => ({ id: a.id, app_alias: a.app_alias }));

      return {
        id: l.id,
        name: l.name,
        description: l.description,
        organization: l.organization,
        data_class: l.data_class,
        applications: appsForLandscape,
      };
    });
  }, [appsQuery.data, landscapesQuery.data, resourcesQuery.data]);

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
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }) => (
          <Link
            to={`/landscapes/${encodeURIComponent(row.original.name)}`}
            className="font-medium text-teal-700 hover:text-teal-900 hover:underline"
          >
            {row.original.name}
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
        accessorKey: 'organization',
        header: 'Organization',
        cell: ({ row }) => row.original.organization ?? '—',
      },
      {
        id: 'applications',
        header: 'Application',
        accessorFn: (row) =>
          row.applications.map((a) => a.app_alias).join(', '),
        cell: ({ row }) => {
          const apps = row.original.applications;
          if (apps.length === 0) {
            return <span className="text-slate-400">—</span>;
          }
          return (
            <>
              {apps.map((a, idx) => (
                <span key={a.id}>
                  <Link
                    to={`/applications/${encodeURIComponent(a.app_alias)}`}
                    className="text-teal-700 hover:text-teal-900 hover:underline"
                  >
                    {a.app_alias}
                  </Link>
                  {idx < apps.length - 1 ? ', ' : null}
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
        title="Discover Landscapes"
        onRefresh={() => void refresh()}
        refreshing={refreshing}
      />
      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        getRowId={(row) => row.id}
      />
    </div>
  );
}
