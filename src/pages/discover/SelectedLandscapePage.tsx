import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';

import { type ColumnDef } from '@tanstack/react-table';
import { AppWindow, ArrowLeft, ExternalLink, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import * as cmdb from '@/api/cmdb';
import { parseApiError } from '@/api/http';

import { DataTable } from '@/components/DataTable';
import { DetailDl, type DetailItem } from '@/components/DetailDl';
import { Button } from '@/components/ui/button';

import { cn } from '@/lib/utils';

import type {
  Application,
  Landscape,
  LandscapeEnvironment,
  Resource,
} from '@/types/cmdb';

export default function SelectedLandscapePage() {
  const { landscapeName = '' } = useParams<{ landscapeName: string }>();

  const [landscape, setLandscape] = useState<Landscape | null>(null);
  const [allEnvironments, setAllEnvironments] = useState<
    LandscapeEnvironment[]
  >([]);
  const [allResources, setAllResources] = useState<Resource[]>([]);
  const [allApplications, setAllApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  async function load(): Promise<void> {
    setLoading(true);
    setNotFound(false);
    setLandscape(null);
    try {
      const [ls, envs, apps] = await Promise.all([
        cmdb.listLandscapes(false),
        cmdb.listLandscapeEnvironments(false),
        cmdb.listApplications(false),
      ]);
      setAllEnvironments(envs);
      setAllApplications(apps);
      const match = ls.find((l) => l.name === landscapeName);
      if (!match) {
        setNotFound(true);
        setAllResources([]);
        return;
      }
      setLandscape(match);
      setAllResources(await cmdb.listResources(false, {}));
    } catch (err) {
      toast.error(await parseApiError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landscapeName]);

  const details = useMemo<DetailItem[]>(() => {
    const l = landscape;
    if (!l) return [];
    return [
      { label: 'ID', value: l.id },
      { label: 'Name', value: l.name },
      { label: 'Description', value: l.description },
      { label: 'Organization', value: l.organization },
      { label: 'DevOps contact', value: l.devops_contact },
      { label: 'Data class', value: l.data_class, type: 'badge' },
      { label: 'Runbook URL', value: l.runbook_url, type: 'url' },
      { label: 'IaC repository', value: l.iac_repository, type: 'url' },
      { label: 'Active', value: l.is_active, type: 'boolean' },
      { label: 'Created at', value: l.created_at },
      { label: 'Updated at', value: l.updated_at },
    ];
  }, [landscape]);

  const ownEnvironments = useMemo(() => {
    const l = landscape;
    if (!l) return [];
    return allEnvironments
      .filter((e) => e.landscape_id === l.id)
      .sort((a, b) =>
        (a.provider_account_name ?? '').localeCompare(
          b.provider_account_name ?? '',
        ),
      );
  }, [landscape, allEnvironments]);

  const providerAccountNameSet = useMemo(() => {
    const set = new Set<string>();
    for (const e of ownEnvironments) {
      if (e.provider_account_name) set.add(e.provider_account_name);
    }
    return set;
  }, [ownEnvironments]);

  const matchingEnvironmentIds = useMemo(() => {
    const ids = new Set<string>();
    if (providerAccountNameSet.size === 0) return ids;
    for (const e of allEnvironments) {
      if (
        e.provider_account_name &&
        providerAccountNameSet.has(e.provider_account_name)
      ) {
        ids.add(e.id);
      }
    }
    return ids;
  }, [allEnvironments, providerAccountNameSet]);

  const relatedApplications = useMemo<Application[]>(() => {
    const matchingEnvs = matchingEnvironmentIds;
    if (matchingEnvs.size === 0) return [];
    const appIds = new Set<string>();
    for (const r of allResources) {
      if (r.application_id && matchingEnvs.has(r.landscape_environment_id)) {
        appIds.add(r.application_id);
      }
    }
    return allApplications
      .filter((a) => appIds.has(a.id))
      .sort((a, b) => a.app_alias.localeCompare(b.app_alias));
  }, [matchingEnvironmentIds, allResources, allApplications]);

  const environmentColumns = useMemo<ColumnDef<LandscapeEnvironment>[]>(
    () => [
      {
        accessorKey: 'provider_account_name',
        header: 'Provider account name',
        cell: ({ row }) => {
          const name = row.original.provider_account_name;
          if (!name) return <span className="text-slate-400">—</span>;
          return (
            <Link
              to={`/provider-accounts/${encodeURIComponent(name)}`}
              className="text-teal-700 hover:text-teal-900 hover:underline"
            >
              {name}
            </Link>
          );
        },
      },
      { accessorKey: 'environment_name', header: 'Environment' },
      { accessorKey: 'hosting_provider', header: 'Provider' },
      {
        accessorKey: 'provider_account_number',
        header: 'Account #',
        cell: ({ row }) => {
          const num = row.original.provider_account_number;
          if (!num) return <span className="text-slate-400">—</span>;
          if (row.original.direct_link) {
            return (
              <a
                href={row.original.direct_link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-teal-700 hover:underline"
              >
                {num}
                <ExternalLink className="size-3.5" />
              </a>
            );
          }
          return num;
        },
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
          Landscape: {landscapeName}
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
          No landscape found with name “{landscapeName}”.
        </div>
      ) : null}

      {loading && !landscape ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : null}

      {landscape ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-4 text-lg font-medium text-slate-900">Details</h2>
            <DetailDl items={details} />
          </section>

          <div className="space-y-6">
            <section className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="mb-1 text-lg font-medium text-slate-900">
                Environments
              </h2>
              <p className="mb-4 text-sm text-slate-500">
                Environments included in this landscape.
              </p>
              {ownEnvironments.length > 0 ? (
                <DataTable
                  columns={environmentColumns}
                  data={ownEnvironments}
                  getRowId={(row) => row.id}
                />
              ) : (
                <p className="text-sm text-slate-500">
                  No environments configured.
                </p>
              )}
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="mb-1 text-lg font-medium text-slate-900">
                Related applications
              </h2>
              <p className="mb-4 text-sm text-slate-500">
                Applications with resources in any environment that shares a
                provider account name with this landscape.
              </p>
              {relatedApplications.length > 0 ? (
                <ul className="divide-y divide-slate-100">
                  {relatedApplications.map((a) => (
                    <li key={a.id}>
                      <Link
                        to={`/applications/${encodeURIComponent(a.app_alias)}`}
                        className="flex items-start gap-3 py-3 hover:bg-slate-50"
                      >
                        <AppWindow className="mt-0.5 size-4 shrink-0 text-teal-700" />
                        <div>
                          <div className="font-medium text-teal-700">
                            {a.app_alias}
                          </div>
                          {a.business_name ? (
                            <div className="text-sm text-slate-500">
                              {a.business_name}
                            </div>
                          ) : null}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">
                  No related applications.
                </p>
              )}
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
}
