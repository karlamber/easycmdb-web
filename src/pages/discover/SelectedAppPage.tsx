import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';

import { ArrowLeft, Globe, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import * as cmdb from '@/api/cmdb';
import { parseApiError } from '@/api/http';

import { DetailDl, type DetailItem } from '@/components/DetailDl';
import { Button } from '@/components/ui/button';

import { useLandscapes } from '@/hooks/useLandscapes';

import { cn } from '@/lib/utils';

import { sortCompliance } from '@/utils/compliance';

import type { Application, Landscape, Resource } from '@/types/cmdb';

export default function SelectedAppPage() {
  const { appAlias = '' } = useParams<{ appAlias: string }>();
  const landscapesQuery = useLandscapes(false);

  const [application, setApplication] = useState<Application | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const landscapes = useMemo(
    () => landscapesQuery.data ?? [],
    [landscapesQuery.data],
  );

  async function load(): Promise<void> {
    setLoadingDetail(true);
    setNotFound(false);
    setApplication(null);
    try {
      const apps = await cmdb.listApplications(false);
      const match = apps.find((a) => a.app_alias === appAlias);
      if (!match) {
        setNotFound(true);
        setResources([]);
        return;
      }
      setApplication(match);
      setResources(
        await cmdb.listResources(false, { applicationId: match.id }),
      );
      await landscapesQuery.refetch();
    } catch (err) {
      toast.error(await parseApiError(err));
    } finally {
      setLoadingDetail(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appAlias]);

  const details = useMemo<DetailItem[]>(() => {
    const a = application;
    if (!a) return [];
    return [
      { label: 'ID', value: a.id },
      { label: 'App alias', value: a.app_alias },
      { label: 'Business name', value: a.business_name },
      { label: 'Description', value: a.description },
      { label: 'Data class', value: a.data_class, type: 'badge' },
      {
        label: 'Compliance',
        value: sortCompliance(a.compliance),
        type: 'compliance',
      },
      { label: 'Business contact', value: a.business_contact },
      { label: 'Development contact', value: a.development_contact },
      { label: 'Support contact', value: a.support_contact },
      { label: 'Source repository', value: a.source_repository, type: 'url' },
      { label: 'Prod URL', value: a.prod_url, type: 'url' },
      { label: 'Runbook URL', value: a.runbook_url, type: 'url' },
      { label: 'Active', value: a.is_active, type: 'boolean' },
      { label: 'Created at', value: a.created_at },
      { label: 'Updated at', value: a.updated_at },
    ];
  }, [application]);

  const relatedLandscapes = useMemo<Landscape[]>(() => {
    const a = application;
    if (!a) return [];
    const landscapeIds = new Set<string>();
    for (const r of resources) {
      if (r.application_id === a.id) {
        landscapeIds.add(r.landscape_id);
      }
    }
    return landscapes
      .filter((l) => landscapeIds.has(l.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [application, resources, landscapes]);

  const loading = loadingDetail;

  return (
    <div>
      <div className="mb-6 flex items-center gap-2">
        <Button type="button" variant="ghost" size="icon" asChild>
          <Link to="/all-applications" aria-label="Back">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Application: {appAlias}
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
          No application found with alias “{appAlias}”.
        </div>
      ) : null}

      {loading && !application ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : null}

      {application ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-4 text-lg font-medium text-slate-900">Details</h2>
            <DetailDl items={details} />
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-1 text-lg font-medium text-slate-900">
              Related landscapes
            </h2>
            <p className="mb-4 text-sm text-slate-500">
              Landscapes that have resources associated with this application.
            </p>
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
              <p className="text-sm text-slate-500">No related landscapes.</p>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
